"""Index project-bound documents by deal id.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("documents")}
    if "ix_documents_deal_id" not in indexes:
        op.create_index("ix_documents_deal_id", "documents", ["deal_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("documents")}
    if "ix_documents_deal_id" in indexes:
        op.drop_index("ix_documents_deal_id", table_name="documents")
