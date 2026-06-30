"""DDReport / Checklist 对象 —— Pre-DD Agent 的交付结果（Phase 3 实现，先定契约）。"""

from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

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


class PreDDProjectOverview(BaseModel):
    """Pre-DD Report 首页概览四字段。"""

    founded_at: Claim = Field(description="成立时间")
    region: Claim = Field(description="地域")
    main_business: Claim = Field(description="主营业务")
    valuation: Claim = Field(description="估值")


class PreDDMeetingQuestion(BaseModel):
    """Founder/管理层会议中建议提出的问题。"""

    question: str = Field(description="提问方式")
    purpose: str = Field(description="该问题的意义、预期收集的信息和分析用途")


class PreDDReport(BaseModel):
    """立项会前报告草稿。

    该对象面向一场 Founder/管理层会议：一方面把当前材料可支撑的价值点、
    风险点用 Claim 绑定证据，另一方面把尚缺的 Pre-DD 材料转成可直接提问的
    会议问题清单。
    """

    project_overview: PreDDProjectOverview = Field(description="项目概览四字段")
    fit_summary: Claim = Field(description="机构匹配度摘要")
    completion_score: int = Field(ge=0, le=100, description="资料完整度评分")
    completion_summary: str = Field(description="资料完整度摘要")
    value_points: list[Claim] = Field(default_factory=list, description="价值点")
    risk_points: list[Claim] = Field(default_factory=list, description="风险点")
    meeting_questions: list[PreDDMeetingQuestion] = Field(
        default_factory=list,
        description="推荐会议问题列表",
    )

    @field_validator("meeting_questions", mode="before")
    @classmethod
    def _normalize_meeting_questions(cls, value: object) -> object:
        """Accept legacy ``list[str]`` reports while moving to structured QA prep."""
        if not isinstance(value, list):
            return value
        normalized: list[object] = []
        for item in value:
            if isinstance(item, str):
                text = " ".join(item.split())
                if text:
                    normalized.append(
                        {
                            "question": text,
                            "purpose": "该问题用于补充当前 Pre-DD 资料缺口，并帮助投资团队在会后更新项目判断。",
                        }
                    )
            else:
                normalized.append(item)
        return normalized


class DDReport(BaseDeliverable):
    deal_id: uuid.UUID
    company_name: str
    report: PreDDReport | None = Field(default=None, description="Pre-DD Report 草稿")
    checklist: list[ChecklistItem] = Field(default_factory=list)
    sections: list[DDSection] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list, description="仍未补全的缺口")
