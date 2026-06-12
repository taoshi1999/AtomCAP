"""Thesis 对象 —— 赛道前瞻 Agent 的交付结果。

字段与《赛道前瞻Agent》设计文档的字段表一一对应：
thesis_name / one_line_view / sub_directions / investment_reason / evidence(经 Claim 绑定) /
institution_fit_score / recent_signals / representative_companies / key_risks /
recommended_actions / created_from_conversation / status

前端按六区渲染：核心信息卡片、子赛道卡片、产业链图谱、近期市场信号、风险点、下一步操作。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.objects.base import BaseDeliverable, Claim


class ThesisStatus(StrEnum):
    DRAFT = "draft"                          # 刚生成
    FOLLOWING = "following"                  # 已关注（进入定时监控）
    DEAL_POOL_GENERATED = "deal_pool_generated"  # 已生成项目池
    DELETED = "deleted"                      # 已删除


class RecommendedAction(StrEnum):
    """设计文档规定的四个下一步操作。"""

    GENERATE_DEAL_POOL = "generate_deal_pool"  # 生成项目池
    FOLLOW_TRACK = "follow_track"              # 关注该赛道
    GENERATE_BRIEFING = "generate_briefing"    # 生成赛道简报
    RE_RECOMMEND = "re_recommend"              # 重新推荐


class SignalKind(StrEnum):
    """设计文档 Step 3：必须区分两类信号，结构性信号权重更高。"""

    HEAT = "heat"              # 热度信号：融资变多、媒体报道、大厂进入……说明“有人看”
    STRUCTURAL = "structural"  # 结构性信号：成本下降、技术成熟、政策窗口……说明“可能值得投”


class MarketSignal(BaseModel):
    kind: SignalKind
    title: str
    summary: Claim = Field(description="信号内容，必须可展开证据链")
    signal_date: str | None = Field(default=None, description="信号发生时间 YYYY-MM-DD")


class FitScoreBreakdown(BaseModel):
    """机构匹配度分项评分（设计文档 Step 6 公式）。

    机构匹配度 = 赛道偏好匹配 + 投资阶段匹配 + 技术壁垒匹配 + 地域匹配
                + 风险偏好匹配 + 历史项目相似度 - 不感兴趣赛道惩罚
    分项与理由全部保留，保证前端可解释“为什么是 82 分”。
    """

    track_preference: float = Field(ge=0, le=100)
    stage_match: float = Field(ge=0, le=100)
    moat_match: float = Field(ge=0, le=100)
    geo_match: float = Field(ge=0, le=100)
    risk_appetite_match: float = Field(ge=0, le=100)
    history_similarity: float = Field(ge=0, le=100, description="与历史项目的 embedding 相似度")
    exclusion_penalty: float = Field(ge=0, le=100, description="命中不感兴趣清单的惩罚分")
    total: float = Field(ge=0, le=100, description="加权合成的总分")
    rationale: str = Field(description="评分理由摘要")


class ValueChainSegment(BaseModel):
    """产业链环节（设计文档 Step 4：上/中/下游 + 各环节投资判断）。"""

    name: str
    examples: list[str] = Field(default_factory=list, description="该环节的代表性细分或公司")
    margin_potential: str | None = Field(default=None, description="毛利率潜力判断")
    entry_difficulty: str | None = Field(default=None, description="创业公司进入难度")
    suitable_stage: str | None = Field(default=None, description="适合的投资阶段")
    preference_fit: str | None = Field(default=None, description="与机构偏好的匹配判断")


class ValueChain(BaseModel):
    upstream: list[ValueChainSegment] = Field(default_factory=list)
    midstream: list[ValueChainSegment] = Field(default_factory=list)
    downstream: list[ValueChainSegment] = Field(default_factory=list)
    customers: list[str] = Field(default_factory=list, description="终端客户类型")


class RepresentativeCompany(BaseModel):
    name: str
    note: Claim | None = Field(default=None, description="一句话说明，带证据")
    company_id: str | None = Field(default=None, description="关联的 company 业务对象 id（如已建档）")


class SubDirection(BaseModel):
    """子赛道。设计文档 Step 5：输出 3–7 个，每个含名称、详情、推荐理由、
    代表公司、主要风险、适合投资阶段、与机构偏好匹配。"""

    name: str
    detail: str = Field(description="子赛道详情")
    investment_reasons: list[Claim] = Field(min_length=1, description="推荐理由（证据链绑定）")
    representative_companies: list[RepresentativeCompany] = Field(default_factory=list)
    key_risks: list[Claim] = Field(default_factory=list)
    suitable_stage: str = Field(description="适合的投资阶段，如 天使/A轮/B轮+")
    fit_score: FitScoreBreakdown


class Thesis(BaseDeliverable):
    """赛道前瞻 Agent 的交付结果对象。不是一篇文章，而是可被系统继续使用的资产。"""

    thesis_name: str = Field(description="赛道名称")
    one_line_view: str = Field(description="一句话判断")
    opportunity_level: str = Field(description="机会等级：高/中/低（顶部核心卡片展示）")
    risk_level: str = Field(description="风险等级：高/中高/中/低")
    advice: str = Field(description="核心卡片底部的一句话建议")
    sub_directions: list[SubDirection] = Field(min_length=3, max_length=7)
    investment_reason: list[Claim] = Field(description="赛道整体推荐理由：为何与本机构匹配")
    institution_fit_score: FitScoreBreakdown
    value_chain: ValueChain
    recent_signals: list[MarketSignal] = Field(default_factory=list)
    representative_companies: list[RepresentativeCompany] = Field(default_factory=list)
    key_risks: list[Claim] = Field(min_length=1, description="风险点必须有，否则像销售材料")
    recommended_actions: list[RecommendedAction] = Field(
        default_factory=lambda: list(RecommendedAction)
    )
    status: ThesisStatus = ThesisStatus.DRAFT
