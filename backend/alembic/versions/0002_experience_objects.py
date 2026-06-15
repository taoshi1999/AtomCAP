"""经验沉淀 Agent 三对象建表：user_actions / experience_events / preference_advice

与 app/models/models.py 的 UserActionRow / ExperienceEventRow / PreferenceAdviceRow
严格对应（tests/test_migration_contract.py 跨全部迁移做契约校验）。
server_default 与 ORM Python 端默认值一致，保证绕过 ORM 的写入也有合理默认。

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0002"
down_revision = "0001"
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
    # ---------- UserAction ----------
    op.create_table(
        "user_actions",
        _pk(),
        _tenant(),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(30), nullable=True),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("polarity", sa.String(20), nullable=True),
        sa.Column("weight", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("confidence", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("scanned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_user_actions_institution_id", "user_actions", ["institution_id"])
    op.create_index("ix_user_actions_user_id", "user_actions", ["user_id"])
    op.create_index("ix_user_actions_action_type", "user_actions", ["action_type"])
    op.create_index("ix_user_actions_scanned", "user_actions", ["scanned"])

    # ---------- ExperienceEvent ----------
    op.create_table(
        "experience_events",
        _pk(),
        _tenant(),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'open'"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("polarity", sa.String(20), nullable=True),
        sa.Column("strength", sa.String(20), nullable=True),
        sa.Column("confidence", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "advice_generated", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index(
        "ix_experience_events_institution_id", "experience_events", ["institution_id"]
    )
    op.create_index("ix_experience_events_user_id", "experience_events", ["user_id"])
    op.create_index("ix_experience_events_event_type", "experience_events", ["event_type"])
    op.create_index("ix_experience_events_status", "experience_events", ["status"])
    op.create_index(
        "ix_experience_events_advice_generated", "experience_events", ["advice_generated"]
    )

    # ---------- PreferenceAdvice ----------
    op.create_table(
        "preference_advice",
        _pk(),
        _tenant(),
        sa.Column("preference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("base_preference_version", sa.Integer(), nullable=True),
        sa.Column("advice_type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=True),
        sa.Column(
            "review_status",
            sa.String(30),
            server_default=sa.text("'pending_review'"),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("applied", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index(
        "ix_preference_advice_institution_id", "preference_advice", ["institution_id"]
    )
    op.create_index("ix_preference_advice_advice_type", "preference_advice", ["advice_type"])
    op.create_index("ix_preference_advice_review_status", "preference_advice", ["review_status"])
    op.create_index("ix_preference_advice_applied", "preference_advice", ["applied"])


def downgrade() -> None:
    for table in ("preference_advice", "experience_events", "user_actions"):
        op.drop_table(table)
