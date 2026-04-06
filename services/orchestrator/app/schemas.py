"""Pydantic request/response models for the orchestrator sidecar API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    """Request body for creating a new Claude CLI session."""

    session_id: str = Field(..., description="Unique identifier for this session")
    prompt: str = Field(..., description="The initial prompt to send to Claude CLI")
    working_directory: str = Field(
        ..., description="Absolute path for the session working directory"
    )
    model: str | None = Field(
        None, description="Model override (e.g. 'opus', 'sonnet')"
    )
    permission_mode: str | None = Field(
        None, description="Permission mode for the CLI session"
    )
    allowed_tools: list[str] | None = Field(
        None, description="Explicit list of allowed tools"
    )


class SessionCreateResponse(BaseModel):
    """Response after successfully creating a session."""

    session_id: str
    status: str


class SessionMessageRequest(BaseModel):
    """Request body for sending a follow-up message to a session."""

    text: str = Field(..., description="The message text to send")


class SessionStatusResponse(BaseModel):
    """Status information for a single session."""

    session_id: str
    status: str
    pid: int | None = None
    started_at: str | None = None


class SessionListResponse(BaseModel):
    """Response listing all known sessions."""

    sessions: list[SessionStatusResponse]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    boot_id: str
    active_sessions: int
    cli_available: bool
    uptime_seconds: float


class ApprovalResponse(BaseModel):
    """Response for tool-use approval decisions."""

    tool_use_id: str
    approved: bool
