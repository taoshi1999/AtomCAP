"""项目获取 Agent（Deal Sourcing）子图的中间结构化输出模型。

节点间的内部契约，不进 SCHEMA_REGISTRY（注册表只收最终交付对象）。
能复用最终 DealList / Thesis 内嵌模型的一律复用，保证中间产物到最终对象零转换损耗。
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.objects.base import Claim
from app.objects.deal_list import DealSourceType, RecommendationTier
from app.objects.thesis import FitScoreBreakdown


class SearchStrategy(BaseModel):
    """Step 2：把模糊需求拆成可执行搜索策略。"""

    themes: list[str] = Field(
        min_length=1, max_length=8, description="检索主题（如「AI 眼镜光学模组」「端侧 AI 芯片」）"
    )
    priority_signals: list[str] = Field(
        default_factory=list,
        description="优先信号类型：新融资/新注册公司/专利增长/大厂离职创业/招聘扩张/产品发布等",
    )
    keywords: list[str] = Field(
        default_factory=list, description="供 Connector 检索的关键词（中英文）"
    )
    regions: list[str] = Field(default_factory=list, description="地域约束（如深圳/苏州），无则空")


class CandidateDraft(BaseModel):
    """Step 4-7：从信号反推的候选公司草稿（评分由下一节点补全）。

    Signal-to-Deal：先发现信号，再反推公司。selection_reasons 必须绑定信号 evidence_id，
    严禁伪造证据；无证据由 Claim 自动 inferred=True（约定 2）。
    """

    company_name: str = Field(description="公司主体名（尽量规范化）")
    aliases: list[str] = Field(default_factory=list, description="品牌名/英文名/项目代号")
    sub_direction: str | None = Field(default=None, description="对应子赛道方向")
    selection_reasons: list[Claim] = Field(min_length=1, description="入选理由（绑定信号 evidence_id）")


class CandidateDrafts(BaseModel):
    candidates: list[CandidateDraft] = Field(default_factory=list)


class ScoredCandidate(BaseModel):
    """Step 8-10：候选公司的机构匹配度评分 + 推荐分层 + 推荐理由/轻量风险。"""

    company_name: str = Field(description="必须与候选草稿一致（按名合并）")
    fit_score: FitScoreBreakdown
    recommendation_tier: RecommendationTier
    recommendation_reasons: list[Claim] = Field(default_factory=list)
    initial_risks: list[Claim] = Field(default_factory=list)


class ScoredCandidates(BaseModel):
    candidates: list[ScoredCandidate] = Field(default_factory=list)


class DealListSummary(BaseModel):
    """Step 10：项目池级别的命名与总览。候选明细已结构化，PREMIUM 仅做池级提炼。"""

    name: str = Field(description="项目池名称，如「AI 硬件上游候选项目池」")
    summary: str = Field(description="项目池一句话总览：覆盖方向、候选规模、推荐分布")


# 重导出供 nodes 引用，避免散落 import
__all__ = [
    "SearchStrategy",
    "CandidateDraft",
    "CandidateDrafts",
    "ScoredCandidate",
    "ScoredCandidates",
    "DealListSummary",
    "DealSourceType",
    "RecommendationTier",
]
