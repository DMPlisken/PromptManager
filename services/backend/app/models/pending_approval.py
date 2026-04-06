from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PendingApproval(Base):
    __tablename__ = "pending_approvals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        PgUUID(as_uuid=False),
        ForeignKey("claude_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    tool_use_id: Mapped[str] = mapped_column(String(100), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tool_input: Mapped[dict] = mapped_column(JSONB, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa.func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # approved, denied, timeout

    session = relationship("ClaudeSession", back_populates="approvals")

    __table_args__ = (
        Index(
            "ix_pending_approvals_unresolved",
            "session_id",
            "requested_at",
            postgresql_where=sa.text("resolved_at IS NULL"),
        ),
    )
