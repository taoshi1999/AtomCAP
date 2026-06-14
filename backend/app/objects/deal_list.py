"""DealList 对象 —— 项目获取 Agent（Deal Sourcing）的交付结果：候选项目池。

字段对齐《项目获取Agent》设计文档：
- Step 8 匹配度评分与排序：fit_score 分项（复用赛道前瞻的 FitScoreBreakdown）
- Step 9 推荐理由与轻量风险：recommendation_reasons / initial_risks 用 Claim 表达
- Step 10 项目池分层：每个候选带 recommendation_tier（强推荐/可关注/待观察/不推荐）
"""

from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, Field

from app.objects.base import BaseDeliverable, Claim
from app.objects.thesis import FitScoreBreakdown


class RecommendationTier(StrEnum):
    STRONG = "strong"
    WATCH = "watch"
    OBSERVE = "observe"
    REJECT = "reject"


class DealSourceType(StrEnum):
    # 搜寻流来源
    THESIS_GENERATED = "thesis_generated"
    PUBLIC_SIGNAL_MINING = "public_signal_mining"
    SYSTEM_PUSH = "system_push"
    # 分析流来源（用户主动带入的项目，《项目获取Agent》流程二 Step 7）
    USER_INPUT = "user_input"
    BP_UPLOAD = "bp_upload"
    FA_RECOMMENDATION = "fa_recommendation"
    INTERNAL_EXCEL = "internal_excel"


class DealCandidate(BaseModel):
    company_name: str = Field(description="规范化后的公司主体名")
    company_id: uuid.UUID | None = Field(default=None)
    uscc: str | None = Field(default=None)
    aliases: list[str] = Field(default_factory=list)
    sub_direction: str | None = Field(default=None)
    source_type: DealSourceType = Field(default=DealSourceType.PUBLIC_SIGNAL_MINING)

    selection_reasons: list[Claim] = Field(min_length=1)
    recommendation_reasons: list[Claim] = Field(default_factory=list)
    initial_risks: list[Claim] = Field(default_factory=list)

    fit_score: FitScoreBreakdown | None = Field(default=None)
    initial_score: float = Field(ge=0, le=100)
    recommendation_tier: RecommendationTier = Field(default=RecommendationTier.OBSERVE)


class DealList(BaseDeliverable):
    name: str = Field(description="项目池名称")
    source_type: DealSourceType = Field(default=DealSourceType.PUBLIC_SIGNAL_MINING)
    source_thesis_id: uuid.UUID | None = Field(default=None)
    search_themes: list[str] = Field(default_factory=list)
    summary: str | None = Field(default=None)
    candidates: list[DealCandidate] = Field(default_factory=list)
