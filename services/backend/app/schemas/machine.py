from datetime import datetime

from pydantic import BaseModel, Field


# --- Machine schemas ---


class MachineCreate(BaseModel):
    """Manual machine registration (admin)."""

    name: str = Field(..., max_length=200)
    hostname: str | None = None
    platform: str | None = None
    workspace_root: str | None = None
    max_concurrent_sessions: int = 5
    color: str = "#7c5cfc"


class MachineUpdate(BaseModel):
    """Updateable machine settings."""

    name: str | None = Field(None, max_length=200)
    color: str | None = Field(None, max_length=10)
    workspace_root: str | None = None
    max_concurrent_sessions: int | None = None


class MachineResponse(BaseModel):
    id: int
    machine_uuid: str
    name: str
    hostname: str | None
    platform: str | None
    platform_version: str | None
    status: str
    agent_version: str | None
    claude_cli_version: str | None
    claude_cli_available: bool
    workspace_root: str | None
    max_concurrent_sessions: int
    api_key_prefix: str | None
    last_health: dict | None
    ip_address: str | None
    color: str
    last_seen_at: datetime | None
    registered_at: datetime

    model_config = {"from_attributes": True}


class MachineHealthResponse(BaseModel):
    machine_uuid: str
    status: str
    last_health: dict | None
    last_seen_at: datetime | None

    model_config = {"from_attributes": True}


# --- Pairing schemas ---


class PairingCodeResponse(BaseModel):
    """Returned when a pairing code is generated."""

    code: str
    api_key: str  # Plain-text key, only shown once
    expires_at: datetime


class PairingRequest(BaseModel):
    """Sent by the agent to complete pairing."""

    pairing_code: str = Field(..., min_length=6, max_length=6)
    machine_uuid: str
    machine_name: str
    platform: str | None = None
    hostname: str | None = None
    platform_version: str | None = None
    agent_version: str | None = None
    claude_cli_version: str | None = None
    claude_cli_available: bool = False
    workspace_root: str | None = None


class PairingResponse(BaseModel):
    """Returned to the agent after successful pairing."""

    machine_uuid: str
    machine_id: int
    api_key: str
    server_url: str
