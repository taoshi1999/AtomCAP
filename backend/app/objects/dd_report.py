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


class PreDDBrief(BaseModel):
    """立项会前简报草稿。

    MVP 版本只从当前 DealProfile 与 Pre-DD 任务树确定性组装，不调用 LLM，
    因此所有新增判断都会经 Claim 自动标记为 inferred，避免伪造证据。
    """

    project_overview: Claim = Field(description="项目概览")
    fit_summary: Claim = Field(description="机构匹配度摘要")
    completion_score: int = Field(ge=0, le=100, description="资料完整度评分")
    completion_summary: str = Field(description="资料完整度摘要")
    key_highlights: list[Claim] = Field(default_factory=list, description="核心亮点")
    top_risks: list[Claim] = Field(default_factory=list, description="Top 风险")
    priority_questions: list[str] = Field(default_factory=list, description="待验证问题")
    recommended_next_steps: list[Claim] = Field(default_factory=list, description="建议下一步")


class DDReport(BaseDeliverable):
    deal_id: uuid.UUID
    company_name: str
    brief: PreDDBrief | None = Field(default=None, description="Pre-DD Brief 草稿")
    checklist: list[ChecklistItem] = Field(default_factory=list)
    sections: list[DDSection] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list, description="仍未补全的缺口")
