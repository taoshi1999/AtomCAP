"""Add durable conversation type and project workspace binding.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "conversation_type",
            sa.String(30),
            server_default="normal",
            nullable=False,
        ),
    )
    op.add_column(
        "conversations",
        sa.Column("source_deal_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_conversations_conversation_type",
        "conversations",
        ["conversation_type"],
    )
    op.create_index(
        "ix_conversations_source_deal_id",
        "conversations",
        ["source_deal_id"],
    )
    op.create_foreign_key(
        "fk_conversations_source_deal_id_deals",
        "conversations",
        "deals",
        ["source_deal_id"],
        ["id"],
    )
    op.alter_column("conversations", "conversation_type", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "fk_conversations_source_deal_id_deals",
        "conversations",
        type_="foreignkey",
    )
    op.drop_index("ix_conversations_source_deal_id", table_name="conversations")
    op.drop_index("ix_conversations_conversation_type", table_name="conversations")
    op.drop_column("conversations", "source_deal_id")
    op.drop_column("conversations", "conversation_type")
