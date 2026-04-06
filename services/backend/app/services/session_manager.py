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
    ) -> ClaudeSession:
        session_id = str(uuid.uuid4())

        # Persist the session record
        session = ClaudeSession(
            id=session_id,
            group_id=group_id,
            template_id=template_id,
            name=name or f"Session {datetime.now().strftime('%H:%M')}",
            status=SessionStatus.STARTING.value,
            working_directory=working_directory,
            model=model or settings.claude_default_model,
            initial_prompt=prompt,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        # Create on the sidecar
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
            raise ValueError("Sidecar is unreachable. Cannot create session.")
        except Exception:
            session.status = SessionStatus.FAILED.value
            await db.commit()
            raise

        return session

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
            try:
                await sidecar_client.abort_session(session_id)
            except Exception:
                pass

            task = self.active_streams.pop(session_id, None)
            if task:
                task.cancel()

            result = await db.execute(
                select(ClaudeSession).where(ClaudeSession.id == session_id)
            )
            session = result.scalar_one_or_none()
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
