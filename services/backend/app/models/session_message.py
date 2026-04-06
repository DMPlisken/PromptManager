from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import BigInteger, Integer, String, Text, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionMessage(Base):
    __tablename__ = "session_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        PgUUID(as_uuid=False),
        ForeignKey("claude_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # user, assistant, system, result
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # text, tool_use, tool_result, thinking, error
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa.func.now()
    )

    session = relationship("ClaudeSession", back_populates="messages")

    __table_args__ = (
        Index(
            "ix_session_messages_session_seq", "session_id", "sequence", unique=True
        ),
        Index("ix_session_messages_created", "created_at"),
    )
