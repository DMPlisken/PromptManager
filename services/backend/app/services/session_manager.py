"""Manage Claude session lifecycle, background stream relay, and WebSocket fan-out."""

import asyncio
import json
import uuid
from datetime import datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_factory
from app.models.claude_session import ClaudeSession, SessionStatus
from app.models.session_message import SessionMessage
from app.services.sidecar_client import CircuitBreakerOpen, sidecar_client

logger = structlog.get_logger()


class SessionManager:
    """Coordinates session creation, sidecar communication, and WS broadcast."""

    def __init__(self) -> None:
        self.active_streams: dict[str, asyncio.Task] = {}
        # session_id -> set of WebSocket connections
        self.ws_connections: dict[str, set] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._locks:
            self._locks[session_id] = asyncio.Lock()
        return self._locks[session_id]

    # ------------------------------------------------------------------
    # Session creation
    # ------------------------------------------------------------------

    async def create_session(
        self,
        db: AsyncSession,
        prompt: str,
        working_directory: str,
        model: str | None = None,
        group_id: int | None = None,
        template_id: int | None = None,
        name: str | None = None,
        permission_mode: str | None = None,
        allowed_tools: list[str] | None = None,
        machine_id: int | None = None,
    ) -> ClaudeSession:
        session_id = str(uuid.uuid4())

        # Persist the session record
        session = ClaudeSession(
            id=session_id,
            group_id=group_id,
            template_id=template_id,
            machine_id=machine_id,
            name=name or f"Session {datetime.now().strftime('%H:%M')}",
            status=SessionStatus.STARTING.value,
            working_directory=working_directory,
            model=model or settings.claude_default_model,
            initial_prompt=prompt,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        # If machine_id is provided, dispatch to remote agent
        # If machine_id is None but online agents exist, auto-select the least loaded
        if machine_id is None:
            from app.services.agent_manager import agent_manager
            online_uuids = agent_manager.get_online_machines()
            if online_uuids:
                # Auto-select: find the machine with the most available capacity
                from app.models.machine import Machine as MachineModel
                result = await db.execute(
                    select(MachineModel).where(
                        MachineModel.machine_uuid.in_(online_uuids)
                    )
                )
                online_machines = result.scalars().all()
                if online_machines:
                    # Pick machine with lowest active session ratio
                    best = min(
                        online_machines,
                        key=lambda m: (
                            (m.last_health or {}).get("activeSessions", 0)
                            / max(m.max_concurrent_sessions, 1)
                        ),
                    )
                    machine_id = best.id
                    session.machine_id = machine_id
                    await db.commit()
                    logger.info("auto_selected_machine", machine_id=machine_id, machine_name=best.name)

        if machine_id is not None:
            await self._create_session_on_agent(
                db=db,
                session=session,
                session_id=session_id,
                prompt=prompt,
                working_directory=working_directory,
                model=model,
                permission_mode=permission_mode,
                allowed_tools=allowed_tools,
                machine_id=machine_id,
            )
            return session

        # Fallback: create on the local sidecar (only if no remote agents)
        try:
            await sidecar_client.create_session(
                session_id=session_id,
                prompt=prompt,
                working_directory=working_directory,
                model=model or settings.claude_default_model,
                permission_mode=permission_mode or settings.claude_permission_mode,
                allowed_tools=allowed_tools,
            )
            session.status = SessionStatus.RUNNING.value
            await db.commit()

            # Start background stream relay
            self.active_streams[session_id] = asyncio.create_task(
                self._stream_relay(session_id)
            )

        except CircuitBreakerOpen:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_create_failed_circuit_open",
                session_id=session_id,
            )
            raise ValueError(
                "Sidecar is unreachable (circuit breaker open). "
                "Check that the orchestrator sidecar is running on port 9100 "
                "and that ORCHESTRATOR_URL is configured correctly in .env."
            )
        except ConnectionError as exc:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_create_connection_error",
                session_id=session_id,
                error=str(exc),
            )
            raise ValueError(
                f"Cannot connect to orchestrator sidecar: {exc}. "
                "Ensure the sidecar is running: cd services/orchestrator && ./run.sh"
            )
        except TimeoutError as exc:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_create_timeout",
                session_id=session_id,
                error=str(exc),
            )
            raise ValueError(
                f"Sidecar request timed out: {exc}. "
                "The orchestrator may be overloaded or unresponsive."
            )
        except Exception as exc:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_create_unexpected_error",
                session_id=session_id,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise

        return session

    async def _create_session_on_agent(
        self,
        db: AsyncSession,
        session: ClaudeSession,
        session_id: str,
        prompt: str,
        working_directory: str,
        model: str | None,
        permission_mode: str | None,
        allowed_tools: list[str] | None,
        machine_id: int,
    ) -> None:
        """Dispatch session creation to a remote machine agent."""
        from app.models.machine import Machine
        from app.services.agent_manager import agent_manager

        # Look up the machine to get its UUID
        result = await db.execute(
            select(Machine).where(Machine.id == machine_id)
        )
        machine = result.scalar_one_or_none()

        if machine is None:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_agent_machine_not_found",
                session_id=session_id,
                machine_id=machine_id,
            )
            raise ValueError(
                f"Machine with id {machine_id} not found. "
                "It may have been removed. Refresh the machines list and try again."
            )

        if not agent_manager.is_online(machine.machine_uuid):
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.warning(
                "session_agent_machine_offline",
                session_id=session_id,
                machine_id=machine_id,
                machine_name=machine.name,
            )
            raise ValueError(
                f"Machine '{machine.name}' is currently offline. "
                "Ensure the agent is running on that machine and has a stable "
                "network connection to the server."
            )

        # Dispatch to the agent via WebSocket
        dispatched = await agent_manager.dispatch_session_create(
            machine.machine_uuid,
            {
                "session_id": session_id,
                "prompt": prompt,
                "working_directory": working_directory,
                "model": model or settings.claude_default_model,
                "permission_mode": permission_mode or settings.claude_permission_mode,
                "allowed_tools": allowed_tools,
            },
        )

        if not dispatched:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            logger.error(
                "session_agent_dispatch_failed",
                session_id=session_id,
                machine_uuid=machine.machine_uuid,
                machine_name=machine.name,
            )
            raise ValueError(
                f"Failed to dispatch session to machine '{machine.name}'. "
                "The agent WebSocket connection may have dropped. "
                "Check the agent logs on that machine."
            )

        # Mark as running — the agent will update status via WS messages
        session.status = SessionStatus.RUNNING.value
        await db.commit()

    # ------------------------------------------------------------------
    # Background stream relay
    # ------------------------------------------------------------------

    async def _stream_relay(self, session_id: str) -> None:
        """Read from sidecar SSE, persist messages, relay to WebSockets."""
        sequence = 0

        try:
            async for msg in sidecar_client.stream_session(session_id):
                if msg.get("type") == "stream_end":
                    break

                sequence = msg.get("_sequence", sequence + 1)
                msg_type = msg.get("type", "text")

                # Determine role and content
                role = "assistant"
                content = ""
                if msg_type == "assistant":
                    content_blocks = msg.get("message", {}).get("content", [])
                    for block in content_blocks:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                content = block.get("text", "")
                                msg_type = "text"
                            elif block.get("type") == "tool_use":
                                content = str(block)
                                msg_type = "tool_use"
                        elif isinstance(block, str):
                            content = block
                elif msg_type == "result":
                    role = "result"
                    content = str(msg.get("result", ""))
                elif msg_type in ("error", "system"):
                    role = "system"
                    content = msg.get("error", msg.get("content", str(msg)))
                else:
                    content = str(msg.get("content", msg.get("message", str(msg))))

                # Persist to DB
                try:
                    async with async_session_factory() as db:
                        db_msg = SessionMessage(
                            session_id=session_id,
                            sequence=sequence,
                            role=role,
                            content=content[:100_000],
                            message_type=msg_type,
                            metadata_json=msg,
                        )
                        db.add(db_msg)
                        await db.commit()
                except Exception as exc:
                    logger.warning(
                        "message_persist_failed",
                        session_id=session_id,
                        error=str(exc),
                    )

                # Relay to WebSocket connections
                ws_msg = {
                    "type": "session.message",
                    "sessionId": session_id,
                    "sequence": sequence,
                    "message": {
                        "role": role,
                        "type": msg_type,
                        "content": content[:50_000],
                    },
                }
                await self._broadcast(session_id, ws_msg)

            # Stream ended normally -- mark completed
            async with async_session_factory() as db:
                result = await db.execute(
                    select(ClaudeSession).where(ClaudeSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                if session and session.status == SessionStatus.RUNNING.value:
                    session.status = SessionStatus.COMPLETED.value
                    session.ended_at = datetime.utcnow()
                    await db.commit()

            await self._broadcast(
                session_id,
                {
                    "type": "session.completed",
                    "sessionId": session_id,
                    "result": {
                        "costUsd": 0,
                        "tokenCountInput": 0,
                        "tokenCountOutput": 0,
                        "duration": 0,
                    },
                },
            )

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("stream_relay_error", session_id=session_id, error=str(exc))
            await self._broadcast(
                session_id,
                {
                    "type": "session.error",
                    "sessionId": session_id,
                    "error": {
                        "code": "STREAM_ERROR",
                        "message": str(exc),
                        "retryable": False,
                    },
                },
            )
        finally:
            self.active_streams.pop(session_id, None)
            self._locks.pop(session_id, None)

    # ------------------------------------------------------------------
    # WebSocket broadcast
    # ------------------------------------------------------------------

    async def _broadcast(self, session_id: str, message: dict) -> None:
        """Send *message* to every WebSocket watching *session_id*."""
        connections = self.ws_connections.get(session_id, set())
        dead: set = set()
        payload = json.dumps(message)
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        connections -= dead

    def register_ws(self, session_id: str, ws) -> None:
        if session_id not in self.ws_connections:
            self.ws_connections[session_id] = set()
        self.ws_connections[session_id].add(ws)

    def unregister_ws(self, session_id: str, ws) -> None:
        if session_id in self.ws_connections:
            self.ws_connections[session_id].discard(ws)

    # ------------------------------------------------------------------
    # Session abort / shutdown
    # ------------------------------------------------------------------

    async def abort_session(self, db: AsyncSession, session_id: str) -> None:
        async with self._get_lock(session_id):
            # Look up the session to determine if it's on a remote machine
            result = await db.execute(
                select(ClaudeSession).where(ClaudeSession.id == session_id)
            )
            session = result.scalar_one_or_none()

            if session and session.machine_id is not None:
                # Abort on remote agent
                from app.models.machine import Machine
                from app.services.agent_manager import agent_manager

                machine_result = await db.execute(
                    select(Machine).where(Machine.id == session.machine_id)
                )
                machine = machine_result.scalar_one_or_none()
                if machine:
                    await agent_manager.dispatch_session_abort(
                        machine.machine_uuid, session_id
                    )
            else:
                # Abort on local sidecar
                try:
                    await sidecar_client.abort_session(session_id)
                except Exception:
                    pass

            task = self.active_streams.pop(session_id, None)
            if task:
                task.cancel()

            if session:
                session.status = SessionStatus.TERMINATED.value
                session.ended_at = datetime.utcnow()
                await db.commit()

    async def shutdown(self) -> None:
        """Cancel all active stream relay tasks (called on app shutdown)."""
        for session_id in list(self.active_streams.keys()):
            task = self.active_streams.pop(session_id)
            task.cancel()


# Module-level singleton
session_manager = SessionManager()
