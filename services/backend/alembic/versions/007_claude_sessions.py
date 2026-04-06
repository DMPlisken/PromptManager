"""Claude orchestrator session tables

Revision ID: 007
Revises: 006
Create Date: 2026-04-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- claude_sessions ---
    op.create_table(
        "claude_sessions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("prompt_groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("prompt_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "execution_id",
            sa.Integer(),
            sa.ForeignKey("task_executions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(300), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="starting"),
        sa.Column("working_directory", sa.Text(), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("initial_prompt", sa.Text(), nullable=False),
        sa.Column("config", JSONB(), nullable=True),
        sa.Column("token_count_input", sa.Integer(), server_default="0"),
        sa.Column("token_count_output", sa.Integer(), server_default="0"),
        sa.Column("total_cost_usd", sa.Numeric(10, 6), server_default="0"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_claude_sessions_status", "claude_sessions", ["status"])
    op.create_index(
        "ix_claude_sessions_group_status",
        "claude_sessions",
        ["group_id", "status"],
    )

    # --- session_messages ---
    op.create_table(
        "session_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            UUID(as_uuid=False),
            sa.ForeignKey("claude_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(50), nullable=True),
        sa.Column("metadata_json", JSONB(), nullable=True),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_session_messages_session_seq",
        "session_messages",
        ["session_id", "sequence"],
        unique=True,
    )
    op.create_index(
        "ix_session_messages_created",
        "session_messages",
        ["created_at"],
    )

    # --- pending_approvals ---
    op.create_table(
        "pending_approvals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            UUID(as_uuid=False),
            sa.ForeignKey("claude_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_use_id", sa.String(100), nullable=False),
        sa.Column("tool_name", sa.String(100), nullable=False),
        sa.Column("tool_input", JSONB(), nullable=False),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_pending_approvals_unresolved",
        "pending_approvals",
        ["session_id", "requested_at"],
        postgresql_where=sa.text("resolved_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("pending_approvals")
    op.drop_table("session_messages")
    op.drop_table("claude_sessions")
