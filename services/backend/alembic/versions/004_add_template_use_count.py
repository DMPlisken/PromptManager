"""Add use_count to task_templates

Revision ID: 004
Revises: 003
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("task_templates", sa.Column("use_count", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("task_templates", "use_count")
