"""Multi-machine agent management

Revision ID: 008
Revises: 007
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- machines ---
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("machine_uuid", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("hostname", sa.String(300), nullable=True),
        sa.Column("platform", sa.String(50), nullable=True),
        sa.Column("platform_version", sa.String(200), nullable=True),
        sa.Column("status", sa.String(50), server_default="offline"),
        sa.Column("agent_version", sa.String(50), nullable=True),
        sa.Column("claude_cli_version", sa.String(50), nullable=True),
        sa.Column("claude_cli_available", sa.Boolean(), server_default="false"),
        sa.Column("workspace_root", sa.Text(), nullable=True),
        sa.Column("max_concurrent_sessions", sa.Integer(), server_default="5"),
        sa.Column("api_key_hash", sa.String(128), nullable=True),
        sa.Column("api_key_prefix", sa.String(12), nullable=True),
        sa.Column("last_health", JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("color", sa.String(10), server_default="'#7c5cfc'"),
        sa.Column("pairing_code", sa.String(10), nullable=True),
        sa.Column(
            "pairing_expires_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_machines_status", "machines", ["status"])
    op.create_index(
        "ix_machines_pairing_code",
        "machines",
        ["pairing_code"],
        unique=True,
        postgresql_where=sa.text("pairing_code IS NOT NULL"),
    )

    # --- Add machine_id to claude_sessions ---
    op.add_column(
        "claude_sessions",
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_claude_sessions_machine_status",
        "claude_sessions",
        ["machine_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_claude_sessions_machine_status", table_name="claude_sessions")
    op.drop_column("claude_sessions", "machine_id")
    op.drop_table("machines")
