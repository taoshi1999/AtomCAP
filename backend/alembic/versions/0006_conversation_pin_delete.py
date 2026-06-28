"""Add conversation pinning and soft delete flags.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("conversations")}

    if "is_pinned" not in columns:
        op.add_column(
            "conversations",
            sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        )
        op.alter_column("conversations", "is_pinned", server_default=None)
    if "pinned_at" not in columns:
        op.add_column(
            "conversations",
            sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "deleted_at" not in columns:
        op.add_column(
            "conversations",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    indexes = {index["name"] for index in inspector.get_indexes("conversations")}
    if "ix_conversations_is_pinned" not in indexes:
        op.create_index("ix_conversations_is_pinned", "conversations", ["is_pinned"])
    if "ix_conversations_deleted_at" not in indexes:
        op.create_index("ix_conversations_deleted_at", "conversations", ["deleted_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("conversations")}
    if "ix_conversations_deleted_at" in indexes:
        op.drop_index("ix_conversations_deleted_at", table_name="conversations")
    if "ix_conversations_is_pinned" in indexes:
        op.drop_index("ix_conversations_is_pinned", table_name="conversations")

    columns = {column["name"] for column in inspector.get_columns("conversations")}
    if "deleted_at" in columns:
        op.drop_column("conversations", "deleted_at")
    if "pinned_at" in columns:
        op.drop_column("conversations", "pinned_at")
    if "is_pinned" in columns:
        op.drop_column("conversations", "is_pinned")
