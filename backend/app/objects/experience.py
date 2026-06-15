"""经验沉淀（投资学习）Agent 的三个系统对象。

设计依据 `agent_design/经验沉淀Agent.docx`，四层管线中「实时产生 → 经验归纳 →
偏好改进」三层的对象契约：

- UserAction：用户与系统对象的显式交互（关注/不感兴趣/加入项目库/进入工作台/
  生成 Pre-DD Brief 等），落库在 `user_actions` 表的 JSONB payload。**必须保存
  target_snapshot**——对象后续被更新也不丢复盘上下文。
- ExperienceEvent：Agent 从 Message / UserAction 归纳出的内部经验事件，是
  Preference 迭代的原料，落库在 `experience_events` 表。
- PreferenceAdvice：基于一个或多个 ExperienceEvent 生成的偏好改进建议，进入
  人工审阅队列，落库在 `preference_advice` 表。前端只展示其自然语言解释。

这三个对象都不是「交付结果对象」，不进 SCHEMA_REGISTRY（注册表只收 Agent 的
最终交付物）；它们是与用户行为绑定、实时产生的系统对象，类比 Message。
约定 4：用户操作必须写 domain_events，UserAction 是其结构化、带快照的强化形态。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


# ---------- 公共枚举 ----------

class Polarity(StrEnum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class SignalStrength(StrEnum):
    WEAK = "weak"
    MEDIUM = "medium"
    STRONG = "strong"


class SignalType(StrEnum):
    """PreferenceSignal 的类型（Message / UserAction 抽取共用）。"""

    EXPLICIT_PREFERENCE = "explicit_preference"            # 显式偏好：我更想看……
    EXPLICIT_ANTI_PREFERENCE = "explicit_anti_preference"  # 显式反偏好：我不想投……
    PREFERENCE_CORRECTION = "preference_correction"        # 推荐纠偏
    EXPLICIT_PREFERENCE_CORRECTION = "explicit_preference_correction"
    RISK_BOUNDARY = "risk_boundary"                        # 风险边界
    STRATEGY_CORRECTION = "strategy_correction"            # 策略修正
    TEMPORARY_REQUEST = "temporary_request"                # 临时请求（不沉淀）
    NEGATIVE_BEHAVIOR_SIGNAL = "negative_behavior_signal"  # UserAction 负向行为
    POSITIVE_BEHAVIOR_SIGNAL = "positive_behavior_signal"  # UserAction 正向行为


class UserActionType(StrEnum):
    """UserAction.action_type 建议枚举（设计文档）。"""

    VIEW_DETAIL = "view_detail"
    FOLLOW_THESIS = "follow_thesis"
    DISLIKE_THESIS = "dislike_thesis"
    GENERATE_PROJECT_POOL = "generate_project_pool"
    JOIN_PROJECT_LIBRARY = "join_project_library"
    ENTER_PROJECT_WORKSPACE = "enter_project_workspace"
    CREATE_PROJECT_WORKSPACE = "create_project_workspace"
    DISLIKE_DEAL = "dislike_deal"
    ABANDON_DEAL = "abandon_deal"
    MARK_DEAL_AS_INTERESTED = "mark_deal_as_interested"
    MARK_RISK_UNACCEPTABLE = "mark_risk_unacceptable"
    PREPARE_IC = "prepare_ic"
    GENERATE_PRE_DD_BRIEF = "generate_pre_dd_brief"
    GENERATE_FOUNDER_CALL_QUESTIONS = "generate_founder_call_questions"
    ACCEPT_PREFERENCE_ADVICE = "accept_preference_advice"
    REJECT_PREFERENCE_ADVICE = "reject_preference_advice"


# 行为权重表（设计文档 Step 3）：UserAction → 初始权重。
# 经验沉淀 Agent 的 PreferenceSignal 抽取（路线第 3 步）按本表出 polarity/weight。
ACTION_WEIGHTS: dict[str, int] = {
    UserActionType.VIEW_DETAIL: 1,
    UserActionType.FOLLOW_THESIS: 2,
    UserActionType.GENERATE_PROJECT_POOL: 2,
    UserActionType.GENERATE_PRE_DD_BRIEF: 5,
    UserActionType.GENERATE_FOUNDER_CALL_QUESTIONS: 3,
    UserActionType.JOIN_PROJECT_LIBRARY: 3,
    UserActionType.ENTER_PROJECT_WORKSPACE: 4,
    UserActionType.CREATE_PROJECT_WORKSPACE: 4,
    UserActionType.MARK_DEAL_AS_INTERESTED: 3,
    UserActionType.PREPARE_IC: 6,
    UserActionType.DISLIKE_DEAL: -3,
    UserActionType.DISLIKE_THESIS: -3,
    UserActionType.ABANDON_DEAL: -5,
    UserActionType.MARK_RISK_UNACCEPTABLE: -6,
}


class ExperienceEventType(StrEnum):
    EXPLICIT_PREFERENCE = "explicit_preference"
    EXPLICIT_ANTI_PREFERENCE = "explicit_anti_preference"
    PREFERENCE_CORRECTION = "preference_correction"
    PREFERENCE_SHIFT = "preference_shift"
    RISK_SENSITIVITY = "risk_sensitivity"
    STAGE_PREFERENCE = "stage_preference"
    SECTOR_PREFERENCE = "sector_preference"
    SUBSECTOR_PREFERENCE = "subsector_preference"
    INDUSTRY_CHAIN_PREFERENCE = "industry_chain_preference"
    DATA_SOURCE_EFFECTIVENESS = "data_source_effectiveness"
    REPEATED_REJECTION_PATTERN = "repeated_rejection_pattern"
    REPEATED_POSITIVE_PATTERN = "repeated_positive_pattern"


class ExperienceStatus(StrEnum):
    OPEN = "open"                          # 还在收集证据
    CANDIDATE = "candidate"                # 已形成较明确模式
    ADVICE_GENERATED = "advice_generated"  # 已生成 Preference_Advice
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class AdviceType(StrEnum):
    DECLARED_STRATEGY_UPDATE = "declared_strategy_update"
    SECTOR_WEIGHT_ADJUSTMENT = "sector_weight_adjustment"
    SUBSECTOR_WEIGHT_ADJUSTMENT = "subsector_weight_adjustment"
    INDUSTRY_CHAIN_WEIGHT_ADJUSTMENT = "industry_chain_weight_adjustment"
    ANTI_PREFERENCE_UPDATE = "anti_preference_update"
    RISK_BOUNDARY_UPDATE = "risk_boundary_update"
    SCORING_WEIGHT_UPDATE = "scoring_weight_update"
    PREFERRED_DEAL_PROFILE_UPDATE = "preferred_deal_profile_update"
    DATA_SOURCE_WEIGHT_UPDATE = "data_source_weight_update"
    PREFERENCE_WEIGHT_ADJUSTMENT = "preference_weight_adjustment"


class AdvicePriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReviewStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PARTIALLY_ACCEPTED = "partially_accepted"
    EXPIRED = "expired"


class ReviewDecision(StrEnum):
    ACCEPT = "accept"
    REJECT = "reject"
    PARTIAL_ACCEPT = "partial_accept"


# ---------- 公共子结构 ----------

class TimeWindow(BaseModel):
    start: str | None = None
    end: str | None = None


class ProcessingStatus(BaseModel):
    """支持每 5 分钟增量扫描、避免重复处理（Message / UserAction 共用）。"""

    experience_agent_scanned: bool = False
    scanned_at: str | None = None
    linked_experience_event_ids: list[str] = Field(default_factory=list)


# ---------- 1. UserAction ----------

class ActionTarget(BaseModel):
    target_type: str | None = Field(default=None, description="deal / thesis / preference 等")
    target_id: str | None = None
    target_name: str | None = None


class ActionContext(BaseModel):
    source_page: str | None = None
    source_agent: str | None = None
    source_conversation_id: str | None = None
    source_thesis_id: str | None = None
    source_preference_id: str | None = None


class TargetSnapshot(BaseModel):
    """操作发生时对象的关键画像快照——对象后续被更新也不丢复盘上下文。"""

    sector: str | None = None
    sub_sector: str | None = None
    stage: str | None = None
    region: str | None = None
    industry_chain_position: str | None = None
    fit_score: float | None = None
    risk_level: str | None = None


class ActionStrength(BaseModel):
    polarity: Polarity = Polarity.NEUTRAL
    weight: int = 0
    confidence: float = Field(default=0.0, ge=0, le=1)


class UserAction(BaseModel):
    """用户与系统对象的显式交互（user_actions 表的 JSONB payload 契约）。"""

    action_id: str | None = None
    institution_id: str | None = None
    user_id: str | None = None
    action_type: UserActionType
    action_label: str | None = Field(default=None, description="中文标签，如「不感兴趣」")
    target: ActionTarget = Field(default_factory=ActionTarget)
    context: ActionContext = Field(default_factory=ActionContext)
    target_snapshot: TargetSnapshot = Field(default_factory=TargetSnapshot)
    action_strength: ActionStrength = Field(default_factory=ActionStrength)
    extra_payload: dict = Field(default_factory=dict, description="reason / note 等")
    processing_status: ProcessingStatus = Field(default_factory=ProcessingStatus)
    created_at: str | None = None


# ---------- 2. ExperienceEvent ----------

class EventScope(BaseModel):
    scope_type: str = "user"  # user / institution
    scope_id: str | None = None
    source_user_ids: list[str] = Field(default_factory=list)


class EventLifecycle(BaseModel):
    created_at: str | None = None
    last_updated_at: str | None = None
    advice_generated: bool = False
    archived_at: str | None = None


class SourceRecords(BaseModel):
    source_message_ids: list[str] = Field(default_factory=list)
    source_user_action_ids: list[str] = Field(default_factory=list)
    source_conversation_ids: list[str] = Field(default_factory=list)


class RelatedObjects(BaseModel):
    related_thesis_ids: list[str] = Field(default_factory=list)
    related_deal_ids: list[str] = Field(default_factory=list)
    related_preference_id: str | None = None


class ObservedPattern(BaseModel):
    positive_patterns: list[str] = Field(default_factory=list)
    negative_patterns: list[str] = Field(default_factory=list)
    risk_patterns: list[str] = Field(default_factory=list)


class PreferenceSignal(BaseModel):
    """ExperienceEvent 内嵌的偏好信号摘要。"""

    signal_type: SignalType
    polarity: Polarity = Polarity.NEUTRAL
    strength: SignalStrength = SignalStrength.WEAK
    confidence: float = Field(default=0.0, ge=0, le=1)


class SuggestedUpdate(BaseModel):
    """ExperienceEvent 给出的偏好影响草案（粒度比 Advice 的 change 更粗）。"""

    field_path: str
    target: str | None = None
    operation: str = Field(description="increase_weight / decrease_weight / set 等")
    suggested_delta: float | None = None


class PreferenceImpact(BaseModel):
    suggested_updates: list[SuggestedUpdate] = Field(default_factory=list)


class ExperienceEvent(BaseModel):
    """Agent 从 Message / UserAction 归纳出的内部经验事件（Preference 迭代原料）。"""

    experience_event_id: str | None = None
    institution_id: str | None = None
    scope: EventScope = Field(default_factory=EventScope)
    event_type: ExperienceEventType
    title: str
    summary: str | None = None
    status: ExperienceStatus = ExperienceStatus.OPEN
    lifecycle: EventLifecycle = Field(default_factory=EventLifecycle)
    time_window: TimeWindow = Field(default_factory=TimeWindow)
    source_records: SourceRecords = Field(default_factory=SourceRecords)
    related_objects: RelatedObjects = Field(default_factory=RelatedObjects)
    observed_pattern: ObservedPattern = Field(default_factory=ObservedPattern)
    preference_signal: PreferenceSignal | None = None
    preference_impact: PreferenceImpact = Field(default_factory=PreferenceImpact)
    evidence_summary: list[str] = Field(default_factory=list)
    created_by: str = "experience_learning_agent"
    updated_by: str = "experience_learning_agent"


# ---------- 3. PreferenceAdvice ----------

class SourceSummary(BaseModel):
    message_count: int = 0
    user_action_count: int = 0
    time_window: TimeWindow = Field(default_factory=TimeWindow)


class SuggestedChange(BaseModel):
    """具体到 Preference 字段路径的一条改动（人工可按 change_id 选择性接受）。"""

    change_id: str | None = None
    field_path: str
    target: str | None = None
    operation: str
    current_value: float | None = None
    suggested_value: float | None = None
    delta: float | None = None
    reason: str | None = None


class ExpectedEffect(BaseModel):
    affected_agents: list[str] = Field(default_factory=list)
    effect_summary: str | None = None


class AdviceReview(BaseModel):
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    review_decision: ReviewDecision | None = None
    review_comment: str | None = None


class AdviceApplication(BaseModel):
    applied: bool = False
    applied_at: str | None = None
    new_preference_version: str | None = None


class PreferenceAdvice(BaseModel):
    """基于 ExperienceEvent 生成的偏好改进建议，进入人工审阅队列。

    即便强信号也不直接改 Preference——一律走本对象进审阅。前端只展示
    title/summary/effect 的自然语言版，不暴露底层 ExperienceEvent。
    """

    advice_id: str | None = None
    institution_id: str | None = None
    preference_id: str | None = None
    base_preference_version: str | None = None
    title: str
    summary: str | None = None
    advice_type: AdviceType
    priority: AdvicePriority = AdvicePriority.MEDIUM
    source_experience_event_ids: list[str] = Field(default_factory=list)
    source_summary: SourceSummary = Field(default_factory=SourceSummary)
    suggested_changes: list[SuggestedChange] = Field(default_factory=list)
    expected_effect: ExpectedEffect = Field(default_factory=ExpectedEffect)
    confidence: float = Field(default=0.0, ge=0, le=1)
    review_status: ReviewStatus = ReviewStatus.PENDING_REVIEW
    review: AdviceReview = Field(default_factory=AdviceReview)
    application: AdviceApplication = Field(default_factory=AdviceApplication)
    created_at: str | None = None
