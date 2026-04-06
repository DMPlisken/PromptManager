"""REST endpoints for Claude session lifecycle."""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.claude_session import ClaudeSession
from app.models.session_message import SessionMessage
from app.schemas.claude_session import (
    SessionCreate,
    SessionMessageResponse,
    SessionResponse,
)
from app.services.session_manager import session_manager
from app.services.sidecar_client import sidecar_client

logger = structlog.get_logger()
router = APIRouter()


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(body: SessionCreate, db: AsyncSession = Depends(get_db)):
    try:
        session = await session_manager.create_session(
            db=db,
            prompt=body.prompt,
            working_directory=body.working_directory,
            model=body.model,
            group_id=body.group_id,
            template_id=body.template_id,
            name=body.name,
            permission_mode=body.permission_mode,
            allowed_tools=body.allowed_tools,
            machine_id=body.machine_id,
        )
        return session
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("session_create_error", error=str(exc))
        raise HTTPException(
            status_code=500, detail=f"Failed to create session: {exc}"
        )


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    status: str | None = None,
    group_id: int | None = None,
    machine_id: int | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(ClaudeSession).order_by(desc(ClaudeSession.started_at))
    if status:
        query = query.where(ClaudeSession.status == status)
    if group_id:
        query = query.where(ClaudeSession.group_id == group_id)
    if machine_id is not None:
        query = query.where(ClaudeSession.machine_id == machine_id)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/sidecar/health")
async def sidecar_health():
    health = await sidecar_client.health_check()
    if health:
        return health
    raise HTTPException(status_code=503, detail="Sidecar unreachable")


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClaudeSession).where(ClaudeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClaudeSession).where(ClaudeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.post("/{session_id}/abort", status_code=200)
async def abort_session(session_id: str, db: AsyncSession = Depends(get_db)):
    await session_manager.abort_session(db, session_id)
    return {"status": "terminated"}


@router.get("/{session_id}/messages", response_model=list[SessionMessageResponse])
async def get_session_messages(
    session_id: str,
    after_sequence: int | None = None,
    limit: int = Query(default=100, le=1000),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.sequence)
    )
    if after_sequence is not None:
        query = query.where(SessionMessage.sequence > after_sequence)
    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
