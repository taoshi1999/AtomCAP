"""DDReport / Checklist 对象 —— Pre-DD Agent 的交付结果（Phase 3 实现，先定契约）。"""

from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, Field

from app.objects.base import BaseDeliverable, Claim


class ChecklistDimension(StrEnum):
    TEAM = "team"
    PRODUCT = "product"
    TECH = "tech"
    MARKET = "market"
    FINANCE = "finance"
    LEGAL = "legal"
    COMPETITION = "competition"


class ChecklistItem(BaseModel):
    dimension: ChecklistDimension
    question: str = Field(description="立项会前需要回答的信息项")
    filled: bool = False
    answer: Claim | None = None


class DDSection(BaseModel):
    title: str
    dimension: ChecklistDimension
    findings: list[Claim] = Field(default_factory=list)


class DDReport(BaseDeliverable):
    deal_id: uuid.UUID
    company_name: str
    checklist: list[ChecklistItem] = Field(default_factory=list)
    sections: list[DDSection] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list, description="仍未补全的缺口")
