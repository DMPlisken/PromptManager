"""WebSocket endpoint for real-time orchestrator updates."""

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from sqlalchemy import select

from app.database import async_session_factory
from app.models.claude_session import ClaudeSession
from app.services.session_manager import session_manager
from app.services.agent_manager import agent_manager

logger = structlog.get_logger()
router = APIRouter()


async def _forward_to_agent(session_id: str, message: dict) -> bool:
    """Look up which machine owns a session and forward a message to its agent."""
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(ClaudeSession).where(ClaudeSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session or not session.machine_id:
                return False

            from app.models.machine import Machine
            machine = await db.get(Machine, session.machine_id)
            if not machine:
                return False

            return await agent_manager.send_to_agent(machine.machine_uuid, message)
    except Exception as exc:
        logger.warning("forward_to_agent_failed", session_id=session_id, error=str(exc))
        return False


@router.websocket("/ws/orchestrator")
async def orchestrator_websocket(websocket: WebSocket):
    await websocket.accept()
    tracked_sessions: set[str] = set()

    logger.info("ws_connected")

    try:
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "protocol.ping":
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "protocol.pong",
                                "timestamp": msg.get("timestamp", 0),
                                "serverTimestamp": int(
                                    asyncio.get_event_loop().time() * 1000
                                ),
                            }
                        )
                    )

                elif msg_type == "session.subscribe":
                    session_id = msg.get("sessionId")
                    if session_id:
                        session_manager.register_ws(session_id, websocket)
                        tracked_sessions.add(session_id)

                elif msg_type == "session.unsubscribe":
                    session_id = msg.get("sessionId")
                    if session_id:
                        session_manager.unregister_ws(session_id, websocket)
                        tracked_sessions.discard(session_id)

                elif msg_type == "session.abort":
                    session_id = msg.get("sessionId")
                    if session_id:
                        async with async_session_factory() as db:
                            await session_manager.abort_session(db, session_id)

                elif msg_type == "session.input":
                    # Forward follow-up text to the agent running this session
                    session_id = msg.get("sessionId")
                    text = msg.get("text", "")
                    if session_id and text.strip():
                        await _forward_to_agent(session_id, {
                            "type": "server.session.input",
                            "sessionId": session_id,
                            "text": text,
                        })

                elif msg_type == "session.end":
                    # Gracefully end a session (close stdin, let Claude finish)
                    session_id = msg.get("sessionId")
                    if session_id:
                        await _forward_to_agent(session_id, {
                            "type": "server.session.end",
                            "sessionId": session_id,
                        })

                elif msg_type == "session.approve":
                    # Forward approval to agent
                    session_id = msg.get("sessionId")
                    if session_id:
                        await _forward_to_agent(session_id, {
                            "type": "server.session.approve",
                            "sessionId": session_id,
                            "toolUseId": msg.get("toolUseId"),
                            "approved": msg.get("approved", False),
                        })

            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "protocol.error",
                            "code": "INVALID_MESSAGE",
                            "message": "Invalid JSON",
                        }
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("ws_error", error=str(exc))
    finally:
        # Unregister from all tracked sessions
        for session_id in tracked_sessions:
            session_manager.unregister_ws(session_id, websocket)
        logger.info("ws_disconnected")
