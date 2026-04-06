"""WebSocket endpoint for real-time orchestrator updates."""

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import async_session_factory
from app.services.session_manager import session_manager

logger = structlog.get_logger()
router = APIRouter()


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

                elif msg_type == "session.approve":
                    # Forward approval to sidecar (future: when tool approval
                    # is implemented)
                    pass

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
