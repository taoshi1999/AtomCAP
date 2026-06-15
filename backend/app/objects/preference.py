"""机构投资偏好（系统对象）。

fit_score 的输入；版本化，变更需人工确认（经验沉淀 Agent 只能提 diff 建议）。

设计依据 `agent_design/经验沉淀Agent.docx` 第 5 节 Preference 对象：偏好由两块构成——
- declared_strategy：机构自己声明的策略（人工维护）
- learned_preference：系统从行为中学习到的权重表（经验沉淀 Agent 反哺，每项带 confidence）

向后兼容：保留早期扁平字段（track_preferences / excluded_tracks / stages /
geographies / risk_appetite / check_size / notes），既有 `preferences.data` 仍可校验；
新块全部可选，老数据加载即为 None。
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------- 学习到的权重表（learned_preference 子结构） ----------

class WeightedItem(BaseModel):
    """带置信度的权重项（赛道/子赛道/产业链位置/阶段/地域共用）。"""

    name: str
    weight: float = Field(ge=0, le=1)
    confidence: float | None = Field(default=None, ge=0, le=1)


class LearnedPreference(BaseModel):
    """经验沉淀 Agent 学习到的偏好权重表（约定 2 仍要求结论可解释）。"""

    sector_weights: list[WeightedItem] = Field(default_factory=list)
    subsector_weights: list[WeightedItem] = Field(default_factory=list)
    industry_chain_position_weights: list[WeightedItem] = Field(default_factory=list)
    stage_weights: list[WeightedItem] = Field(default_factory=list)
    region_weights: list[WeightedItem] = Field(default_factory=list)


# ---------- 机构声明的策略（declared_strategy 子结构） ----------

class CheckSize(BaseModel):
    min: float | None = None
    max: float | None = None
    currency: str = "CNY"


class DeclaredStrategy(BaseModel):
    focus_sectors: list[str] = Field(default_factory=list)
    focus_stages: list[str] = Field(default_factory=list)
    focus_regions: list[str] = Field(default_factory=list)
    check_size: CheckSize | None = None
    target_deal_types: list[str] = Field(default_factory=list)
    description: str | None = None


# ---------- 反偏好 / 风险边界 / 评分权重（可选块） ----------

class AbandonedSimilarityPenalty(BaseModel):
    enabled: bool = False
    penalty_weight: float = Field(default=0.0, ge=0, le=1)


class AntiPreference(BaseModel):
    disliked_sectors: list[str] = Field(default_factory=list)
    disliked_subsectors: list[str] = Field(default_factory=list)
    disliked_deal_patterns: list[str] = Field(default_factory=list)
    abandoned_similarity_penalty: AbandonedSimilarityPenalty = Field(
        default_factory=AbandonedSimilarityPenalty
    )


class PreferredDealProfile(BaseModel):
    industry_chain_position: list[str] = Field(default_factory=list)
    technology_moat: list[str] = Field(default_factory=list)
    team_background: list[str] = Field(default_factory=list)
    customer_type: list[str] = Field(default_factory=list)
    commercial_stage: list[str] = Field(default_factory=list)
    traction_signals: list[str] = Field(default_factory=list)


class PreferenceVersionRef(BaseModel):
    """版本溯源（接受 Advice 后版本化用，路线第 7 步）。"""

    version: str
    created_at: str | None = None
    summary: str | None = None
    source_advice_ids: list[str] = Field(default_factory=list)


class InvestmentPreference(BaseModel):
    """机构投资偏好对象（preferences.payload 契约）。

    双块设计 declared_strategy + learned_preference 为权威；扁平字段为向后兼容遗留。
    """

    version: int = 1
    name: str | None = Field(default=None, description="偏好名，如「默认投资偏好」")
    status: str | None = Field(default=None, description="active / archived")

    # —— 双块（设计文档权威） ——
    declared_strategy: DeclaredStrategy | None = None
    learned_preference: LearnedPreference | None = None
    preferred_deal_profile: PreferredDealProfile | None = None
    anti_preference: AntiPreference | None = None
    risk_boundary: dict[str, str] = Field(
        default_factory=dict, description="各风险维度容忍度（valuation_sensitivity 等）"
    )
    scoring_weights: dict[str, float] = Field(
        default_factory=dict, description="fit_score 各分项权重"
    )

    # —— 版本溯源（接受 Advice 后填） ——
    source_advice_ids: list[str] = Field(default_factory=list)
    source_experience_event_ids: list[str] = Field(default_factory=list)
    change_summary: str | None = None
    reviewed_by: str | None = None

    # —— 向后兼容的早期扁平字段 ——
    track_preferences: list[str] = Field(default_factory=list, description="偏好赛道")
    excluded_tracks: list[str] = Field(default_factory=list, description="不感兴趣清单（评分惩罚项）")
    stages: list[str] = Field(default_factory=list, description="偏好阶段：天使/Pre-A/A/B+...")
    geographies: list[str] = Field(default_factory=list, description="地域偏好")
    risk_appetite: str | None = Field(default=None, description="风险偏好描述")
    check_size: str | None = Field(default=None, description="单笔投资规模（遗留扁平字段，文本）")
    notes: str | None = Field(default=None, description="其他策略说明")
