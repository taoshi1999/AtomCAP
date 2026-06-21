"""用户自建命名投资偏好卡片建表：preference_profiles

与 app/models/models.py 的 PreferenceProfileRow 严格对应
（tests/test_migration_contract.py 跨全部迁移做列集合契约校验）。
server_default 与 ORM Python 端默认值一致，保证绕过 ORM 的写入也有合理默认。

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-19
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _pk() -> sa.Column:
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True)


def _tenant() -> sa.Column:
    return sa.Column(
        "institution_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("institutions.id"),
        nullable=False,
    )


def _ts() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("preference_profiles"):
        op.create_table(
            "preference_profiles",
            _pk(),
            _tenant(),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("payload", postgresql.JSONB(), nullable=False),
            *_ts(),
        )

    indexes = {
        index["name"]
        for index in sa.inspect(bind).get_indexes("preference_profiles")
    }
    if "ix_preference_profiles_institution_id" not in indexes:
        op.create_index(
            "ix_preference_profiles_institution_id",
            "preference_profiles",
            ["institution_id"],
        )
    if "ix_preference_profiles_name" not in indexes:
        op.create_index("ix_preference_profiles_name", "preference_profiles", ["name"])
    if "ix_preference_profiles_archived" not in indexes:
        op.create_index(
            "ix_preference_profiles_archived",
            "preference_profiles",
            ["archived"],
        )


def downgrade() -> None:
    op.drop_table("preference_profiles")
