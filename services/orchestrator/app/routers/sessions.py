"""Session management endpoints and SSE streaming."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas import (
    SessionCreateRequest,
    SessionCreateResponse,
    SessionListResponse,
    SessionStatusResponse,
)

if TYPE_CHECKING:
    from app.session_manager import SessionManager

logger = structlog.get_logger()

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_manager(request: Request) -> SessionManager:
    """Retrieve the SessionManager instance from app state."""
    return request.app.state.session_manager


# ------------------------------------------------------------------
# POST /sessions  --  Create a new Claude CLI session
# ------------------------------------------------------------------


@router.post("", response_model=SessionCreateResponse, status_code=201)
async def create_session(body: SessionCreateRequest, request: Request):
    """Spawn a new Claude CLI subprocess for the given prompt."""
    manager = _get_manager(request)

    try:
        session = await manager.create_session(
            session_id=body.session_id,
            prompt=body.prompt,
            working_directory=body.working_directory,
            model=body.model,
            permission_mode=body.permission_mode,
            allowed_tools=body.allowed_tools,
        )
    except RuntimeError as exc:
        # CLI not found
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        # Duplicate session, concurrency limit, bad working dir, etc.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("session_create_error", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to create session") from exc

    return SessionCreateResponse(
        session_id=session.session_id,
        status=session.status,
    )


# ------------------------------------------------------------------
# GET /sessions  --  List all sessions
# ------------------------------------------------------------------


@router.get("", response_model=SessionListResponse)
async def list_sessions(request: Request):
    """Return status information for every known session."""
    manager = _get_manager(request)
    items = manager.list_sessions()
    return SessionListResponse(
        sessions=[
            SessionStatusResponse(
                session_id=s["session_id"],
                status=s["status"],
                pid=s["pid"],
                started_at=str(s["started_at"]) if s["started_at"] else None,
            )
            for s in items
        ]
    )


# ------------------------------------------------------------------
# GET /sessions/{session_id}  --  Get session status
# ------------------------------------------------------------------


@router.get("/{session_id}", response_model=SessionStatusResponse)
async def get_session(session_id: str, request: Request):
    """Return the current status of a single session."""
    manager = _get_manager(request)
    info = await manager.get_session_status(session_id)
    if info["status"] == "not_found":
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return SessionStatusResponse(
        session_id=info["session_id"],
        status=info["status"],
        pid=info["pid"],
        started_at=str(info["started_at"]) if info.get("started_at") else None,
    )


# ------------------------------------------------------------------
# GET /sessions/{session_id}/stream  --  SSE streaming endpoint
# ------------------------------------------------------------------


async def _sse_generator(manager: SessionManager, session_id: str):
    """Async generator that yields SSE-formatted messages."""
    try:
        async for msg in manager.stream_messages(session_id):
            data = json.dumps(msg, default=str)
            yield f"data: {data}\n\n"
    except ValueError as exc:
        yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

    # Final event so clients know the stream has ended
    yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"


@router.get("/{session_id}/stream")
async def stream_session(session_id: str, request: Request):
    """Server-Sent Events stream of all messages from a Claude CLI session.

    The stream emits one JSON object per `data:` line, terminated by a
    `stream_end` event when the subprocess finishes.
    """
    manager = _get_manager(request)

    # Verify the session exists before starting the stream
    info = await manager.get_session_status(session_id)
    if info["status"] == "not_found":
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    return StreamingResponse(
        _sse_generator(manager, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ------------------------------------------------------------------
# POST /sessions/{session_id}/abort  --  Abort a running session
# ------------------------------------------------------------------


@router.post("/{session_id}/abort", status_code=200)
async def abort_session(session_id: str, request: Request):
    """Terminate the subprocess for the given session."""
    manager = _get_manager(request)
    info = await manager.get_session_status(session_id)
    if info["status"] == "not_found":
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    await manager.abort_session(session_id)
    return {"session_id": session_id, "status": "terminated"}


# ------------------------------------------------------------------
# DELETE /sessions/{session_id}  --  Remove a session entirely
# ------------------------------------------------------------------


@router.delete("/{session_id}", status_code=200)
async def delete_session(session_id: str, request: Request):
    """Abort (if running) and remove a session from the registry."""
    manager = _get_manager(request)
    info = await manager.get_session_status(session_id)
    if info["status"] == "not_found":
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    await manager.remove_session(session_id)
    return {"session_id": session_id, "status": "removed"}
