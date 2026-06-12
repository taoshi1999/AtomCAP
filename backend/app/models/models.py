"""SQLAlchemy ORM 模型 —— 三类对象的存储层。

所有业务表带 institution_id 做多租户行级隔离（服务层强制过滤）。
domain_events 从 Phase 0 就开始记账：它是投资经验沉淀 Agent 的唯一数据来源。
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

EMBEDDING_DIM = 1024  # BGE-M3 / text-embedding-v4


class Base(DeclarativeBase):
    type_annotation_map = {dict: JSONB, datetime: DateTime(timezone=True)}


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


def pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def tenant_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("institutions.id"), index=True)


# ---------- 租户 ----------

class Institution(Base, TimestampMixin):
    __tablename__ = "institutions"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(255))
    # 机构级合规开关：是否允许调用海外模型（数据出境）
    allow_overseas_models: Mapped[bool] = mapped_column(Boolean, default=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(255))


# ---------- 系统对象 ----------

class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Message(Base, TimestampMixin):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user / assistant / system
    # content 为块数组：[{type:"text",...} | {type:"object_ref", deliverable_id:...}]
    # 文本块与对象引用块混排，是前端混合渲染的基础
    content: Mapped[dict] = mapped_column(JSONB, default=dict)


class Preference(Base, TimestampMixin):
    __tablename__ = "preferences"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    version: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSONB)  # InvestmentPreference schema
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AgentRun(Base, TimestampMixin):
    __tablename__ = "agent_runs"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    agent: Mapped[str] = mapped_column(String(50), index=True)  # thesis_scout / deal_sourcing / ...
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running")  # running/succeeded/failed
    steps: Mapped[dict] = mapped_column(JSONB, default=dict)  # 各步骤输入输出摘要（审计）
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class DomainEvent(Base):
    """事件流水（append-only）：所有用户操作与对象状态流转。

    例：thesis.followed / thesis.deal_pool_generated / thesis.invalidated /
        deal.created / deal.approved / deal.rejected / preference.updated
    """

    __tablename__ = "domain_events"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    subject_type: Mapped[str] = mapped_column(String(50))  # thesis / deal / company / preference
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True)


# ---------- 业务对象 ----------

class Company(Base, TimestampMixin):
    __tablename__ = "companies"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    name: Mapped[str] = mapped_column(String(255), index=True)
    uscc: Mapped[str | None] = mapped_column(String(18), nullable=True, index=True)  # 统一社会信用代码
    profile: Mapped[dict] = mapped_column(JSONB, default=dict)
    name_embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)


class Person(Base, TimestampMixin):
    __tablename__ = "persons"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    name: Mapped[str] = mapped_column(String(100))
    profile: Mapped[dict] = mapped_column(JSONB, default=dict)


class Deal(Base, TimestampMixin):
    __tablename__ = "deals"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"))
    # 状态机：sourced → screening → pre_dd → ic_ready → approved/rejected
    # 状态流转由系统管控并写 domain_events
    status: Mapped[str] = mapped_column(String(30), default="sourced", index=True)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)


# ---------- 交付结果对象 ----------

class Deliverable(Base, TimestampMixin):
    """单表多类型。payload 入库前必须通过 SCHEMA_REGISTRY[type] 校验。"""

    __tablename__ = "deliverables"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    type: Mapped[str] = mapped_column(String(30), index=True)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    source_conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


# ---------- 证据链 ----------

class EvidenceItemRow(Base, TimestampMixin):
    __tablename__ = "evidence_items"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    source_type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str] = mapped_column(Text)
    published_at: Mapped[str | None] = mapped_column(String(20), nullable=True)
    connector: Mapped[str | None] = mapped_column(String(50), nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class EvidenceLinkRow(Base):
    __tablename__ = "evidence_links"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    from_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    to_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    relation: Mapped[str] = mapped_column(String(30))


# ---------- RAG（机构私有信息） ----------

class Document(Base, TimestampMixin):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    deal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    doc_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # bp / 财报 / 访谈纪要
    parse_status: Mapped[str] = mapped_column(String(20), default="pending")


class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
