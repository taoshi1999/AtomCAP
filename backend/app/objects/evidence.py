"""证据链对象。

evidence_items：检索到的每条原始材料；evidence_links：证据与结论、对象与对象
之间的关系（邻接表建模，MVP 不引入图数据库）。
交付对象 payload 中的 Claim.evidence_ids 指向 EvidenceItem.id。
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class SourceType(StrEnum):
    NEWS = "news"                  # 行业新闻 / 财经报道
    FUNDING_EVENT = "funding_event"  # 融资事件
    POLICY = "policy"              # 政策文件
    CORP_REGISTRY = "corp_registry"  # 工商信息
    FILING = "filing"              # 上市公司公告
    PAPER_PATENT = "paper_patent"  # 论文 / 专利
    INTERNAL_DOC = "internal_doc"  # 机构私有文档（RAG）
    HISTORY = "history"            # 机构历史操作 / 已投项目
    WEB = "web"                    # 一般网页


class EvidenceItem(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    source_type: SourceType
    title: str
    url: str | None = None
    snippet: str = Field(description="原文摘录，前端证据面板展示")
    published_at: str | None = None
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)
    connector: str | None = Field(default=None, description="来源 Connector 名称")
    raw: dict | None = Field(default=None, description="Connector 返回的原始数据")


class EvidenceRelation(StrEnum):
    SUPPORTS = "supports"        # 证据支撑结论
    CONTRADICTS = "contradicts"  # 证据与结论相悖（保留反例，保证严谨）
    DERIVED_FROM = "derived_from"  # 对象由另一对象加工而来


class EvidenceLink(BaseModel):
    from_id: uuid.UUID
    to_id: uuid.UUID
    relation: EvidenceRelation
