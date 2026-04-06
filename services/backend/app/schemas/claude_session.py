from datetime import datetime

from pydantic import BaseModel, Field


# --- Session schemas ---


class SessionCreate(BaseModel):
    group_id: int | None = None
    template_id: int | None = None
    execution_id: int | None = None
    name: str | None = None
    working_directory: str
    model: str | None = None
    prompt: str
    config: dict | None = None
    permission_mode: str | None = None
    allowed_tools: list[str] | None = None


class SessionUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    model: str | None = None
    token_count_input: int | None = None
    token_count_output: int | None = None
    total_cost_usd: float | None = None
    ended_at: datetime | None = None


class SessionResponse(BaseModel):
    id: str
    group_id: int | None
    template_id: int | None
    execution_id: int | None
    name: str | None
    status: str
    working_directory: str
    model: str | None
    initial_prompt: str
    config: dict | None
    token_count_input: int
    token_count_output: int
    total_cost_usd: float
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


# --- Session message schemas ---


class SessionMessageResponse(BaseModel):
    id: int
    session_id: str
    sequence: int
    role: str
    content: str
    message_type: str | None
    metadata_json: dict | None
    cost_usd: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Approval schemas ---


class ApprovalCreate(BaseModel):
    session_id: str
    tool_use_id: str
    tool_name: str
    tool_input: dict


class ApprovalResolve(BaseModel):
    resolution: str = Field(..., pattern="^(approved|denied|timeout)$")


class ApprovalResponse(BaseModel):
    id: int
    session_id: str
    tool_use_id: str
    tool_name: str
    tool_input: dict
    requested_at: datetime
    resolved_at: datetime | None
    resolution: str | None

    model_config = {"from_attributes": True}
