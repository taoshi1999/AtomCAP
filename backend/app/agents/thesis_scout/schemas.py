"""赛道前瞻子图的中间结构化输出模型。

这些是节点间的内部契约，不进 SCHEMA_REGISTRY（注册表只收最终交付对象）。
能复用最终 Thesis 内嵌模型的（MarketSignal/ValueChain/FitScoreBreakdown 等）
一律复用，保证中间产物到最终对象零转换损耗。
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.objects.base import Claim
from app.objects.thesis import (
    FitScoreBreakdown,
    MarketSignal,
    RepresentativeCompany,
)


class TrackDefinition(BaseModel):
    """Step 2 输出：赛道定义拆解。"""

    name: str = Field(description="规范化的赛道名称")
    includes: list[str] = Field(default_factory=list, description="该赛道包括的细分/环节")
    excludes: list[str] = Field(default_factory=list, description="容易混淆但不属于该赛道的领域")
    search_keywords: list[str] = Field(
        default_factory=list, description="供市场信号检索用的关键词（中英文）"
    )


class ClassifiedSignals(BaseModel):
    """Step 3 输出容器：热度/结构性分类后的信号列表。"""

    signals: list[MarketSignal] = Field(default_factory=list)


class SubDirectionDraft(BaseModel):
    """Step 5 输出：子赛道草稿 —— 即 SubDirection 去掉 fit_score。

    机构匹配度由 Step 6 评分节点补全，两步各司其职。
    """

    name: str
    detail: str = Field(description="子赛道详情")
    investment_reasons: list[Claim] = Field(min_length=3, max_length=5, description="推荐理由（证据链绑定）")
    representative_companies: list[RepresentativeCompany] = Field(default_factory=list)
    key_risks: list[Claim] = Field(min_length=3, max_length=5)
    suitable_stage: str = Field(description="适合的投资阶段，如 天使/A轮/B轮+")


class SubDirectionDrafts(BaseModel):
    sub_directions: list[SubDirectionDraft] = Field(min_length=3, max_length=7)


class SubDirectionFit(BaseModel):
    name: str = Field(description="子赛道名称，必须与草稿一致")
    fit: FitScoreBreakdown


class FitAssessment(BaseModel):
    """Step 6 输出：机构整体匹配度 + 各子赛道分项匹配度。"""

    institution_fit: FitScoreBreakdown
    sub_direction_fits: list[SubDirectionFit] = Field(default_factory=list)
