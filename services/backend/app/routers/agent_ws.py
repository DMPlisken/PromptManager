"""WebSocket endpoint for remote machine agent connections."""

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import async_session_factory
from app.services.agent_manager import agent_manager

logger = structlog.get_logger()
router = APIRouter()


@router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
    """WebSocket endpoint for machine agents.

    Protocol:
    1. Agent connects and sends ``agent.hello`` with API key within 10 seconds.
    2. Server validates and replies with ``server.welcome``.
    3. Agent sends heartbeats (``agent.heartbeat``) and session updates.
    4. Server sends session commands (``server.session.create``, ``server.session.abort``).
    """
    await websocket.accept()
    machine_uuid = None

    try:
        # First message must be agent.hello with API key — 10 second timeout
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        except asyncio.TimeoutError:
            logger.warning("agent_ws_hello_timeout")
            await websocket.close(code=4001, reason="Hello timeout")
            return

        try:
            msg = json.loads(data)
        except json.JSONDecodeError:
            await websocket.close(code=4002, reason="Invalid JSON")
            return

        if msg.get("type") != "agent.hello":
            logger.warning("agent_ws_bad_first_message", msg_type=msg.get("type"))
            await websocket.close(code=4001, reason="Expected agent.hello")
            return

        # Validate API key and register the agent
        async with async_session_factory() as db:
            try:
                machine = await agent_manager.register_agent(websocket, msg, db)
            except ValueError as exc:
                logger.warning("agent_ws_auth_failed", error=str(exc))
                await websocket.send_text(
                    json.dumps({
                        "type": "server.error",
                        "code": "AUTH_FAILED",
                        "message": str(exc),
                    })
                )
                await websocket.close(code=4003, reason="Authentication failed")
                return

        machine_uuid = machine.machine_uuid

        # Send welcome message
        await websocket.send_text(
            json.dumps({
                "type": "server.welcome",
                "machineId": machine.machine_uuid,
                "machineName": machine.name,
                "serverId": "promptflow-server",
            })
        )

        logger.info("agent_ws_connected", machine_uuid=machine_uuid)

        # Main message loop
        while True:
            data = await websocket.receive_text()

            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({
                        "type": "server.error",
                        "code": "INVALID_MESSAGE",
                        "message": "Invalid JSON",
                    })
                )
                continue

            # Process the message
            async with async_session_factory() as db:
                await agent_manager.handle_agent_message(machine_uuid, msg, db)

    except WebSocketDisconnect:
        logger.info("agent_ws_disconnected", machine_uuid=machine_uuid)
    except Exception as exc:
        logger.error(
            "agent_ws_error",
            machine_uuid=machine_uuid,
            error=str(exc),
        )
    finally:
        if machine_uuid:
            async with async_session_factory() as db:
                await agent_manager.unregister_agent(machine_uuid, db)
