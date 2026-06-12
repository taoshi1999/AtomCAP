"""DealList 对象 —— 项目获取 Agent 的交付结果（Phase 2 实现，先定契约）。"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.objects.base import BaseDeliverable, Claim


class DealCandidate(BaseModel):
    company_name: str
    company_id: uuid.UUID | None = Field(default=None, description="关联 company 业务对象")
    uscc: str | None = Field(default=None, description="统一社会信用代码（实体对齐用）")
    selection_reasons: list[Claim] = Field(min_length=1, description="入选理由")
    initial_score: float = Field(ge=0, le=100, description="初筛评分")
    sub_direction: str | None = Field(default=None, description="对应 Thesis 的子赛道")


class DealList(BaseDeliverable):
    name: str
    source_thesis_id: uuid.UUID | None = Field(default=None, description="来源 Thesis 对象")
    candidates: list[DealCandidate] = Field(default_factory=list)
