import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(str, enum.Enum):
    STARTING = "starting"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    TERMINATED = "terminated"
    DISCONNECTED = "disconnected"


class ClaudeSession(Base):
    __tablename__ = "claude_sessions"

    id: Mapped[str] = mapped_column(
        PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("prompt_groups.id", ondelete="SET NULL"), nullable=True
    )
    template_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True
    )
    execution_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("task_executions.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=SessionStatus.STARTING.value
    )
    working_directory: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    initial_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    token_count_input: Mapped[int] = mapped_column(Integer, default=0)
    token_count_output: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Numeric(10, 6), default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa.func.now()
    )
    machine_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    group = relationship("PromptGroup", backref="sessions")
    template = relationship("PromptTemplate")
    execution = relationship("TaskExecution")
    machine = relationship("Machine", back_populates="sessions")
    messages = relationship(
        "SessionMessage", back_populates="session", cascade="all, delete-orphan"
    )
    approvals = relationship(
        "PendingApproval", back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_claude_sessions_status", "status"),
        Index("ix_claude_sessions_group_status", "group_id", "status"),
        Index("ix_claude_sessions_machine_status", "machine_id", "status"),
    )
