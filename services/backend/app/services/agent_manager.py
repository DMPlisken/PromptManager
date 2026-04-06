"""Manage WebSocket connections from remote machine agents."""

import hashlib
import json
from datetime import datetime, timezone

import structlog
from fastapi import WebSocket
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.claude_session import ClaudeSession, SessionStatus
from app.models.machine import Machine

logger = structlog.get_logger()


class AgentConnectionManager:
    """Tracks WebSocket connections from remote machine agents and dispatches
    session commands to them."""

    def __init__(self) -> None:
        # machine_uuid -> WebSocket connection
        self.connections: dict[str, WebSocket] = {}
        # machine_uuid -> last heartbeat data
        self.machine_info: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Agent registration / deregistration
    # ------------------------------------------------------------------

    async def register_agent(
        self, ws: WebSocket, hello_msg: dict, db: AsyncSession
    ) -> Machine:
        """Validate API key from hello message and register the agent connection.

        Returns the Machine ORM object on success, raises ValueError on failure.
        """
        api_key = hello_msg.get("apiKey", "")
        machine_uuid = hello_msg.get("machineUuid", "")

        if not api_key or not machine_uuid:
            raise ValueError("Missing apiKey or machineUuid in agent.hello")

        # Hash the provided key and look up the machine
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        result = await db.execute(
            select(Machine).where(
                Machine.machine_uuid == machine_uuid,
                Machine.api_key_hash == key_hash,
            )
        )
        machine = result.scalar_one_or_none()

        if machine is None:
            raise ValueError("Invalid API key or machine UUID")

        # Update machine status
        machine.status = "online"
        machine.last_seen_at = datetime.now(timezone.utc)
        machine.ip_address = hello_msg.get("ipAddress")
        machine.agent_version = hello_msg.get("agentVersion", machine.agent_version)
        machine.claude_cli_version = hello_msg.get(
            "claudeCliVersion", machine.claude_cli_version
        )
        machine.claude_cli_available = hello_msg.get(
            "claudeCliAvailable", machine.claude_cli_available
        )
        await db.commit()

        # Store connection
        self.connections[machine_uuid] = ws
        self.machine_info[machine_uuid] = {
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "machine_id": machine.id,
        }

        logger.info(
            "agent_registered",
            machine_uuid=machine_uuid,
            machine_name=machine.name,
        )
        return machine

    async def unregister_agent(self, machine_uuid: str, db: AsyncSession) -> None:
        """Remove agent connection and mark machine offline."""
        self.connections.pop(machine_uuid, None)
        self.machine_info.pop(machine_uuid, None)

        # Mark machine offline in DB
        result = await db.execute(
            select(Machine).where(Machine.machine_uuid == machine_uuid)
        )
        machine = result.scalar_one_or_none()
        if machine:
            machine.status = "offline"
            machine.last_seen_at = datetime.now(timezone.utc)
            await db.commit()

        # Mark running sessions on this machine as disconnected
        await db.execute(
            update(ClaudeSession)
            .where(
                ClaudeSession.machine_id == (machine.id if machine else -1),
                ClaudeSession.status.in_([
                    SessionStatus.STARTING.value,
                    SessionStatus.RUNNING.value,
                    SessionStatus.WAITING_APPROVAL.value,
                ]),
            )
            .values(
                status=SessionStatus.DISCONNECTED.value,
                ended_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

        logger.info("agent_unregistered", machine_uuid=machine_uuid)

    # ------------------------------------------------------------------
    # Dispatch commands to agents
    # ------------------------------------------------------------------

    async def dispatch_session_create(
        self, machine_uuid: str, session_data: dict
    ) -> bool:
        """Send a session creation command to a remote agent.

        Returns True if the message was sent, False if the agent is not connected.
        """
        ws = self.connections.get(machine_uuid)
        if ws is None:
            return False

        try:
            await ws.send_text(
                json.dumps(
                    {
                        "type": "server.session.create",
                        "sessionId": session_data["session_id"],
                        "prompt": session_data["prompt"],
                        "workingDirectory": session_data["working_directory"],
                        "model": session_data.get("model"),
                        "permissionMode": session_data.get("permission_mode"),
                        "allowedTools": session_data.get("allowed_tools"),
                    }
                )
            )
            return True
        except Exception as exc:
            logger.error(
                "dispatch_session_create_failed",
                machine_uuid=machine_uuid,
                error=str(exc),
            )
            return False

    async def dispatch_session_abort(
        self, machine_uuid: str, session_id: str
    ) -> bool:
        """Send a session abort command to a remote agent.

        Returns True if the message was sent, False if the agent is not connected.
        """
        ws = self.connections.get(machine_uuid)
        if ws is None:
            return False

        try:
            await ws.send_text(
                json.dumps(
                    {
                        "type": "server.session.abort",
                        "sessionId": session_id,
                    }
                )
            )
            return True
        except Exception as exc:
            logger.error(
                "dispatch_session_abort_failed",
                machine_uuid=machine_uuid,
                error=str(exc),
            )
            return False

    # ------------------------------------------------------------------
    # Handle inbound agent messages
    # ------------------------------------------------------------------

    async def handle_agent_message(
        self, machine_uuid: str, msg: dict, db: AsyncSession
    ) -> None:
        """Process a message received from a connected agent."""
        msg_type = msg.get("type", "")

        if msg_type in ("agent.heartbeat", "agent.health"):
            await self._handle_heartbeat(machine_uuid, msg, db)

        elif msg_type == "agent.session.output":
            await self._handle_session_output(machine_uuid, msg)

        elif msg_type == "agent.session.completed":
            await self._handle_session_completed(machine_uuid, msg, db)

        elif msg_type == "agent.session.failed":
            await self._handle_session_failed(machine_uuid, msg, db)

        elif msg_type == "agent.session.started":
            await self._handle_session_started(machine_uuid, msg, db)

        elif msg_type == "agent.session.approval_required":
            await self._handle_approval_required(machine_uuid, msg)

        else:
            logger.warning(
                "unknown_agent_message",
                machine_uuid=machine_uuid,
                msg_type=msg_type,
            )

    # ------------------------------------------------------------------
    # Message handlers
    # ------------------------------------------------------------------

    async def _handle_heartbeat(
        self, machine_uuid: str, msg: dict, db: AsyncSession
    ) -> None:
        """Update machine health data from heartbeat."""
        health_data = msg.get("health", {})
        self.machine_info[machine_uuid] = {
            **self.machine_info.get(machine_uuid, {}),
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            "health": health_data,
        }

        result = await db.execute(
            select(Machine).where(Machine.machine_uuid == machine_uuid)
        )
        machine = result.scalar_one_or_none()
        if machine:
            machine.last_health = health_data
            machine.last_seen_at = datetime.now(timezone.utc)
            await db.commit()

    async def _handle_session_output(
        self, machine_uuid: str, msg: dict
    ) -> None:
        """Forward session output to browser WebSocket clients via session_manager.

        Import session_manager locally to avoid circular imports.
        """
        from app.services.session_manager import session_manager

        session_id = msg.get("sessionId")
        if not session_id:
            logger.warning(
                "agent_session_output_missing_id",
                machine_uuid=machine_uuid,
            )
            return

        # Build message for browser clients
        output_msg = msg.get("message", {})
        msg_role = output_msg.get("role", "assistant")
        msg_type = output_msg.get("type", "text")
        content_preview = str(output_msg.get("content", ""))[:120]

        logger.debug(
            "agent_session_output",
            machine_uuid=machine_uuid,
            session_id=session_id,
            sequence=msg.get("sequence", 0),
            role=msg_role,
            msg_type=msg_type,
            content_preview=content_preview,
        )
        ws_msg = {
            "type": "session.message",
            "sessionId": session_id,
            "sequence": msg.get("sequence", 0),
            "message": output_msg,
        }
        await session_manager._broadcast(session_id, ws_msg)

        # Persist message to DB
        from app.models.session_message import SessionMessage

        try:
            async with async_session_factory() as db:
                db_msg = SessionMessage(
                    session_id=session_id,
                    sequence=msg.get("sequence", 0),
                    role=output_msg.get("role", "assistant"),
                    content=str(output_msg.get("content", ""))[:100_000],
                    message_type=output_msg.get("type", "text"),
                    metadata_json=msg,
                )
                db.add(db_msg)
                await db.commit()
        except Exception as exc:
            logger.warning(
                "agent_message_persist_failed",
                session_id=session_id,
                error=str(exc),
            )

    async def _handle_session_started(
        self, machine_uuid: str, msg: dict, db: AsyncSession
    ) -> None:
        """Mark session as running when agent confirms it started."""
        from app.services.session_manager import session_manager

        session_id = msg.get("sessionId")
        if not session_id:
            return

        logger.info(
            "agent_session_started",
            machine_uuid=machine_uuid,
            session_id=session_id,
        )

        result = await db.execute(
            select(ClaudeSession).where(ClaudeSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session and session.status == SessionStatus.STARTING.value:
            session.status = SessionStatus.RUNNING.value
            await db.commit()

        await session_manager._broadcast(
            session_id,
            {"type": "session.started", "sessionId": session_id},
        )

    async def _handle_session_completed(
        self, machine_uuid: str, msg: dict, db: AsyncSession
    ) -> None:
        """Update session status to completed and broadcast to browsers."""
        from app.services.session_manager import session_manager

        session_id = msg.get("sessionId")
        if not session_id:
            return

        result_data = msg.get("result", {})
        logger.info(
            "agent_session_completed",
            machine_uuid=machine_uuid,
            session_id=session_id,
            cost_usd=result_data.get("costUsd"),
            tokens_in=result_data.get("tokenCountInput"),
            tokens_out=result_data.get("tokenCountOutput"),
        )

        result = await db.execute(
            select(ClaudeSession).where(ClaudeSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = SessionStatus.COMPLETED.value
            session.ended_at = datetime.now(timezone.utc)
            # Update cost/token data if provided
            result_data = msg.get("result", {})
            if result_data.get("tokenCountInput"):
                session.token_count_input = result_data["tokenCountInput"]
            if result_data.get("tokenCountOutput"):
                session.token_count_output = result_data["tokenCountOutput"]
            if result_data.get("costUsd"):
                session.total_cost_usd = result_data["costUsd"]
            await db.commit()

        await session_manager._broadcast(
            session_id,
            {
                "type": "session.completed",
                "sessionId": session_id,
                "result": msg.get("result", {}),
            },
        )

    async def _handle_session_failed(
        self, machine_uuid: str, msg: dict, db: AsyncSession
    ) -> None:
        """Update session status to failed and broadcast to browsers."""
        from app.models.session_message import SessionMessage
        from app.services.session_manager import session_manager

        session_id = msg.get("sessionId")
        if not session_id:
            return

        error_text = msg.get("error") or msg.get("errorMessage") or "Session failed on agent"

        result = await db.execute(
            select(ClaudeSession).where(ClaudeSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = SessionStatus.FAILED.value
            session.ended_at = datetime.now(timezone.utc)
            # Persist the error as a message so it's visible in history/test
            db.add(SessionMessage(
                session_id=session_id,
                sequence=1,
                role="system",
                content=error_text,
                message_type="error",
            ))
            await db.commit()

        logger.warning("agent_session_failed", session_id=session_id, machine_uuid=machine_uuid, error=error_text)

        await session_manager._broadcast(
            session_id,
            {
                "type": "session.error",
                "sessionId": session_id,
                "error": {
                    "code": msg.get("errorCode", "AGENT_ERROR"),
                    "message": error_text,
                    "retryable": False,
                },
            },
        )

    async def _handle_approval_required(
        self, machine_uuid: str, msg: dict
    ) -> None:
        """Forward approval request from agent to browser clients."""
        from app.services.session_manager import session_manager

        session_id = msg.get("sessionId")
        if not session_id:
            return

        approval = msg.get("approval", {})
        logger.info(
            "agent_approval_required",
            machine_uuid=machine_uuid,
            session_id=session_id,
            tool_name=approval.get("toolName", "unknown"),
        )

        await session_manager._broadcast(
            session_id,
            {
                "type": "session.approval_required",
                "sessionId": session_id,
                "approval": msg.get("approval", {}),
            },
        )

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def get_online_machines(self) -> list[str]:
        """Return list of machine UUIDs currently connected."""
        return list(self.connections.keys())

    def is_online(self, machine_uuid: str) -> bool:
        """Check whether a machine agent is currently connected."""
        return machine_uuid in self.connections

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    async def shutdown(self) -> None:
        """Close all agent WebSocket connections (called on app shutdown)."""
        for machine_uuid in list(self.connections.keys()):
            ws = self.connections.pop(machine_uuid, None)
            if ws:
                try:
                    await ws.close(code=1001, reason="Server shutting down")
                except Exception:
                    pass
        self.machine_info.clear()
        logger.info("agent_manager_shutdown")


# Module-level singleton
agent_manager = AgentConnectionManager()
