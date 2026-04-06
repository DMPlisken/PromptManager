from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Integer, String, Text, DateTime, Boolean, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    machine_uuid: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )  # Agent-generated UUID
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(300), nullable=True)
    platform: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # darwin, win32, linux
    platform_version: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="offline"
    )  # online, offline, pairing, error
    agent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    claude_cli_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    claude_cli_available: Mapped[bool] = mapped_column(Boolean, default=False)
    workspace_root: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_concurrent_sessions: Mapped[int] = mapped_column(Integer, default=5)
    api_key_hash: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )  # SHA-256 of API key
    api_key_prefix: Mapped[str | None] = mapped_column(
        String(12), nullable=True
    )  # First 8 chars for display
    last_health: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # CPU, memory, disk, sessions
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str] = mapped_column(String(10), default="#7c5cfc")
    pairing_code: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # 6-char code, null after paired
    pairing_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa.func.now()
    )

    # Relationships
    sessions = relationship("ClaudeSession", back_populates="machine")

    __table_args__ = (
        Index("ix_machines_status", "status"),
        Index("ix_machines_pairing_code", "pairing_code", unique=True,
              postgresql_where=sa.text("pairing_code IS NOT NULL")),
    )
