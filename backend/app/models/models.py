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
    # normal: 普通会话；project_workspace: 绑定单个项目的工作台会话。
    conversation_type: Mapped[str] = mapped_column(String(30), default="normal", index=True)
    source_deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True, index=True
    )


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
    # 状态机：sourced → screening → pre_dd → approved → exited；推进阶段可 rejected
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
    deal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
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


# ---------- 经验沉淀 Agent 对象（agent_design/经验沉淀Agent.docx） ----------

class UserActionRow(Base, TimestampMixin):
    """用户与系统对象的显式交互（关注/不感兴趣/加入项目库/生成 Pre-DD 等）。

    约定 4 的强化形态：除写 domain_events 外，落结构化 UserAction 并保存
    target_snapshot（payload 内），对象后续被更新也不丢复盘上下文。
    scanned 供经验沉淀 Agent 每 5 分钟增量扫描（按 created_at 游标 + 该标志去重）。
    """

    __tablename__ = "user_actions"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    action_type: Mapped[str] = mapped_column(String(50), index=True)
    target_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    polarity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    weight: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    scanned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)  # UserAction schema


class ExperienceEventRow(Base, TimestampMixin):
    """经验沉淀 Agent 从 Message / UserAction 归纳出的内部经验事件。

    status 生命周期：open → candidate → advice_generated → accepted/rejected → archived。
    advice_generated 标志便于 1 小时聚合任务筛「尚未生成过 advice」的事件。
    """

    __tablename__ = "experience_events"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    title: Mapped[str] = mapped_column(String(500))
    polarity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    strength: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    advice_generated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)  # ExperienceEvent schema


class PreferenceAdviceRow(Base, TimestampMixin):
    """基于 ExperienceEvent 生成的偏好改进建议，进入人工审阅队列。

    即便强信号也一律入此队列，绝不直接覆盖 Preference。接受后复用
    services/preferences 写路径生成新版本并溯源。
    """

    __tablename__ = "preference_advice"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    preference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    base_preference_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    advice_type: Mapped[str] = mapped_column(String(50), index=True)
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review_status: Mapped[str] = mapped_column(String(30), default="pending_review", index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    applied: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)  # PreferenceAdvice schema


class PreferenceProfileRow(Base, TimestampMixin):
    """用户自建的命名投资偏好卡片（「投资偏好」界面创建 / 列表 / 详情 / 编辑）。

    与机构唯一生效偏好 Preference 表分离：那张表是经验沉淀 Agent 反哺、fit_score 单条
    读取的机构偏好；本表是用户手动维护的多张命名偏好卡片，互不干扰主链路。
    created_by 记录创建者（可空，兼容 AUTH_DEV_FALLBACK 的开发租户，故不加 users 外键）。
    archived 软删除标志，列表默认只看未归档。payload 存完整 PreferenceProfile。
    """

    __tablename__ = "preference_profiles"
    id: Mapped[uuid.UUID] = pk()
    institution_id: Mapped[uuid.UUID] = tenant_fk()
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)  # PreferenceProfile schema
