"""初始建表：pgvector 扩展 + 租户/系统对象/业务对象/交付对象/证据链/RAG 全部 15 张表

与 app/models/models.py 严格对应（tests/test_migration_contract.py 做契约校验）。
server_default 与 ORM 的 Python 端默认值保持一致，保证绕过 ORM 的写入也有合理默认。

Revision ID: 0001
Revises:
Create Date: 2026-06-12
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

EMBEDDING_DIM = 1024  # BGE-M3 / text-embedding-v4，与 models.EMBEDDING_DIM 一致


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
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ---------- 租户 ----------
    op.create_table(
        "institutions",
        _pk(),
        sa.Column("name", sa.String(255), nullable=False),
        # 机构级合规开关：是否允许调用海外模型（数据出境）
        sa.Column(
            "allow_overseas_models",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        *_ts(),
    )

    op.create_table(
        "users",
        _pk(),
        _tenant(),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        *_ts(),
    )
    op.create_index("ix_users_institution_id", "users", ["institution_id"])

    # ---------- 系统对象 ----------
    op.create_table(
        "conversations",
        _pk(),
        _tenant(),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("title", sa.String(255), nullable=True),
        *_ts(),
    )
    op.create_index("ix_conversations_institution_id", "conversations", ["institution_id"])

    op.create_table(
        "messages",
        _pk(),
        _tenant(),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        # 块数组：[{type:"text",...} | {type:"object_ref", deliverable_id:...}]
        sa.Column("content", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_messages_institution_id", "messages", ["institution_id"])
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "preferences",
        _pk(),
        _tenant(),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        *_ts(),
    )
    op.create_index("ix_preferences_institution_id", "preferences", ["institution_id"])

    op.create_table(
        "agent_runs",
        _pk(),
        _tenant(),
        sa.Column("agent", sa.String(50), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'running'"), nullable=False),
        sa.Column("steps", postgresql.JSONB(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("cost_usd", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        *_ts(),
    )
    op.create_index("ix_agent_runs_institution_id", "agent_runs", ["institution_id"])
    op.create_index("ix_agent_runs_agent", "agent_runs", ["agent"])

    # 事件流水（append-only）：经验沉淀 Agent 的唯一数据来源，Phase 0 起必须记账
    op.create_table(
        "domain_events",
        _pk(),
        _tenant(),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("subject_type", sa.String(50), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_domain_events_institution_id", "domain_events", ["institution_id"])
    op.create_index("ix_domain_events_event_type", "domain_events", ["event_type"])
    op.create_index("ix_domain_events_occurred_at", "domain_events", ["occurred_at"])

    # ---------- 业务对象 ----------
    op.create_table(
        "companies",
        _pk(),
        _tenant(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("uscc", sa.String(18), nullable=True),  # 统一社会信用代码
        sa.Column("profile", postgresql.JSONB(), nullable=False),
        sa.Column("name_embedding", Vector(EMBEDDING_DIM), nullable=True),
        *_ts(),
    )
    op.create_index("ix_companies_institution_id", "companies", ["institution_id"])
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_uscc", "companies", ["uscc"])
    # 实体对齐用：公司名向量近邻检索（cosine）
    op.create_index(
        "ix_companies_name_embedding_hnsw",
        "companies",
        ["name_embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"name_embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "persons",
        _pk(),
        _tenant(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("profile", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_persons_institution_id", "persons", ["institution_id"])

    op.create_table(
        "deals",
        _pk(),
        _tenant(),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id"),
            nullable=False,
        ),
        # 状态机：sourced → screening → pre_dd → approved → exited；推进阶段可 rejected
        sa.Column("status", sa.String(30), server_default=sa.text("'sourced'"), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_deals_institution_id", "deals", ["institution_id"])
    op.create_index("ix_deals_status", "deals", ["status"])

    # ---------- 交付结果对象（单表多类型） ----------
    op.create_table(
        "deliverables",
        _pk(),
        _tenant(),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(30), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("source_conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        *_ts(),
    )
    op.create_index("ix_deliverables_institution_id", "deliverables", ["institution_id"])
    op.create_index("ix_deliverables_type", "deliverables", ["type"])
    op.create_index("ix_deliverables_status", "deliverables", ["status"])

    # ---------- 证据链 ----------
    op.create_table(
        "evidence_items",
        _pk(),
        _tenant(),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("snippet", sa.Text(), nullable=False),
        sa.Column("published_at", sa.String(20), nullable=True),
        sa.Column("connector", sa.String(50), nullable=True),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        *_ts(),
    )
    op.create_index("ix_evidence_items_institution_id", "evidence_items", ["institution_id"])
    op.create_index("ix_evidence_items_source_type", "evidence_items", ["source_type"])

    op.create_table(
        "evidence_links",
        _pk(),
        _tenant(),
        sa.Column("from_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relation", sa.String(30), nullable=False),
    )
    op.create_index("ix_evidence_links_institution_id", "evidence_links", ["institution_id"])
    op.create_index("ix_evidence_links_from_id", "evidence_links", ["from_id"])
    op.create_index("ix_evidence_links_to_id", "evidence_links", ["to_id"])

    # ---------- RAG（机构私有信息） ----------
    op.create_table(
        "documents",
        _pk(),
        _tenant(),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=True),  # bp / 财报 / 访谈纪要
        sa.Column(
            "parse_status", sa.String(20), server_default=sa.text("'pending'"), nullable=False
        ),
        *_ts(),
    )
    op.create_index("ix_documents_institution_id", "documents", ["institution_id"])

    op.create_table(
        "chunks",
        _pk(),
        _tenant(),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_chunks_institution_id", "chunks", ["institution_id"])
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    # RAG 混合检索的向量近邻索引（cosine）
    op.create_index(
        "ix_chunks_embedding_hnsw",
        "chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    # 按依赖逆序删除；vector 扩展可能被库内其他 schema 使用，不在此删除
    for table in (
        "chunks",
        "documents",
        "evidence_links",
        "evidence_items",
        "deliverables",
        "deals",
        "persons",
        "companies",
        "domain_events",
        "agent_runs",
        "preferences",
        "messages",
        "conversations",
        "users",
        "institutions",
    ):
        op.drop_table(table)
