"""经验沉淀（投资学习）Agent —— 管线第 1 层：PreferenceSignal 抽取。

设计依据 `agent_design/经验沉淀Agent.docx` Step 2 / Step 3：

- **Message 路径**（Step 2）：对每条新 Message，先用 LLM（STANDARD 档）判断它是否包含
  偏好信号（preference_signal_candidate），命中则抽取 signal_type（显式偏好 / 显式反偏好 /
  推荐纠偏 / 风险边界 / 策略修正 / 临时请求）、作用范围、正/反向偏好与强度/置信度。**核心是
  区分长期偏好与单次任务指令**——「这次先帮我找下游」（临时请求）不沉淀，「以后这个赛道不看
  上游」（长期偏好）才沉淀；临时请求一律 `durable=False`。

- **UserAction 路径**（Step 3）：纯函数，零 LLM 成本。据 `action_type` 的设计文档行为权重表
  （`objects.experience.ACTION_WEIGHTS`，已在 UserAction 落库时写入 action_strength）与
  `target_snapshot` 直接出 polarity / weight / strength，把对象画像快照映射成信号作用范围。

本层只「抽信号」，不创建/更新 ExperienceEvent（那是 Step 4 的匹配层，后续增量实现）。
两条路径都不碰数据库——输入是已读出的文本 / UserAction 对象，输出是 ExtractedPreferenceSignal，
便于离线单测。所有 LLM 调用经 allow_overseas 透传（约定 5）。
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.llm.client import ModelTier, complete_structured
from app.objects.experience import (
    ExtractedPreferenceSignal,
    Polarity,
    PreferenceDirection,
    SignalSourceType,
    SignalStrength,
    SignalTargetScope,
    SignalType,
    UserAction,
)


# ====================================================================
# UserAction 路径（纯函数，无 LLM）
# ====================================================================

def strength_from_weight(weight: int) -> SignalStrength:
    """据行为权重绝对值分档（设计文档权重表：±1~2 弱、±3~4 中、±5~6 强）。"""
    mag = abs(weight)
    if mag >= 5:
        return SignalStrength.STRONG
    if mag >= 3:
        return SignalStrength.MEDIUM
    return SignalStrength.WEAK


def _coerce_user_action(action: UserAction | dict) -> UserAction:
    return action if isinstance(action, UserAction) else UserAction.model_validate(action)


def extract_user_action_signal(
    action: UserAction | dict,
) -> ExtractedPreferenceSignal | None:
    """Step 3：从一条 UserAction 抽取 PreferenceSignal（纯函数）。

    中性 / 零权重动作（如查看详情边界场景或未在权重表中的动作）不构成偏好信号，返回 None。
    作用范围 target_scope 直接取 UserAction 写入的 target_snapshot——这正是「对象后续被更新也
    不丢复盘上下文」的快照价值所在。"""
    ua = _coerce_user_action(action)
    strength_obj = ua.action_strength
    weight = strength_obj.weight
    polarity = strength_obj.polarity

    # 中性 / 零权重不沉淀为信号（不是每个点击都是偏好）
    if polarity == Polarity.NEUTRAL or weight == 0:
        return None

    snap = ua.target_snapshot
    scope = SignalTargetScope(
        related_thesis_id=ua.context.source_thesis_id,
        related_deal_id=(
            ua.target.target_id if ua.target.target_type == "deal" else None
        ),
        sector=snap.sector,
        sub_sector=snap.sub_sector,
        industry_chain_position=snap.industry_chain_position,
        stage=snap.stage,
        region=snap.region,
        risk_level=snap.risk_level,
    )

    # 行为信号的「作用对象」尽量取最具体的画像维度
    target_label = (
        snap.sub_sector
        or snap.sector
        or ua.target.target_name
        or (ua.target.target_type or "项目")
    )
    dimension = (
        "sub_sector" if snap.sub_sector
        else "sector" if snap.sector
        else None
    )

    if weight > 0:
        signal_type = SignalType.POSITIVE_BEHAVIOR_SIGNAL
        direction = PreferenceDirection(
            target=target_label, operation="increase_weight", dimension=dimension
        )
        pos, neg = direction, None
    else:
        signal_type = SignalType.NEGATIVE_BEHAVIOR_SIGNAL
        direction = PreferenceDirection(
            target=target_label, operation="decrease_weight", dimension=dimension
        )
        pos, neg = None, direction

    return ExtractedPreferenceSignal(
        signal_type=signal_type,
        source_type=SignalSourceType.USER_ACTION,
        source_id=ua.action_id,
        institution_id=ua.institution_id,
        user_id=ua.user_id,
        target_scope=scope,
        positive_preference=pos,
        negative_preference=neg,
        polarity=polarity,
        weight=weight,
        strength=strength_from_weight(weight),
        confidence=strength_obj.confidence,
        # 单条行为是弱原料，沉淀与否由 Step 4/8 聚合决定，这里默认可沉淀
        durable=True,
        rationale=f"{ua.action_label or ua.action_type.value}（权重 {weight:+d}）",
        created_at=ua.created_at,
    )


# ====================================================================
# Message 路径（LLM，STANDARD 档）
# ====================================================================

class MessageSignalExtraction(BaseModel):
    """Message 偏好信号抽取的 LLM 结构化输出契约（中间模型，再转 ExtractedPreferenceSignal）。"""

    is_preference_signal: bool = Field(description="本条消息是否包含偏好信号")
    signal_type: SignalType | None = Field(
        default=None, description="is_preference_signal=True 时给出"
    )
    durable: bool = Field(
        default=True,
        description="True=长期偏好（如「以后这个赛道不看上游」）；False=单次任务指令/临时请求（如「这次先帮我找下游」）",
    )
    target_scope: SignalTargetScope = Field(default_factory=SignalTargetScope)
    positive_preference: PreferenceDirection | None = None
    negative_preference: PreferenceDirection | None = None
    strength: SignalStrength = SignalStrength.WEAK
    confidence: float = Field(default=0.0, ge=0, le=1)
    rationale: str | None = None


MESSAGE_SIGNAL_SYSTEM = """你是一级市场（VC/PE）投资机构的「经验沉淀」分析师。你的任务是判断用户的一条消息
是否表达了**对投资偏好的信号**，并在表达时把它抽取成结构化信号。

偏好信号分为几类（signal_type）：
- explicit_preference 显式偏好：「我更想看……」
- explicit_anti_preference 显式反偏好：「我不想投……」
- preference_correction / explicit_preference_correction 推荐纠偏：「这些项目太早期了……」「不要再给我推纯整机品牌」
- risk_boundary 风险边界：「客户集中度高的项目不要推……」
- strategy_correction 策略修正：「这个赛道我们只看下游」
- temporary_request 临时请求：「这次先帮我找下游」

**最关键的判断——区分长期偏好与单次任务指令**：
- 「这次先帮我找几个下游项目」是一次性任务请求，durable=false、signal_type=temporary_request，不应沉淀为长期偏好。
- 「以后这个赛道我不想看上游」是长期偏好，durable=true，要沉淀。
含「这次 / 暂时 / 先 / 临时」等一次性措辞且无长期意图的，一律 durable=false。
含「以后 / 一直 / 总是 / 长期 / 不要再 / 我们只看」等长期措辞的，durable=true。

抽取要求：
- 纯任务、纯提问、纯闲聊、对具体某项目的事实询问等**不含偏好倾向**的消息，is_preference_signal=false，其余字段留空。
- 命中时：尽量从消息中识别作用范围（赛道 sector / 子赛道 / 产业链位置 / 阶段 / 风险类型，识别不到就留空，绝不臆造）；
  把「想要 / 加权」的对象放进 positive_preference，把「不要 / 减权 / 排除」的对象放进 negative_preference（operation 用
  increase_weight / decrease_weight / exclude）；按语气强弱给 strength（weak/medium/strong）与 confidence(0~1)。
- rationale 用一句简体中文说明判断依据，供前端展示。
全部用简体中文（专有名词保留原文）。"""


def _message_polarity(
    sig: MessageSignalExtraction,
) -> Polarity:
    """据正/反向偏好与信号类型推 polarity。"""
    has_pos = sig.positive_preference is not None
    has_neg = sig.negative_preference is not None
    if has_pos and has_neg:
        return Polarity.MIXED
    if has_neg:
        return Polarity.NEGATIVE
    if has_pos:
        return Polarity.POSITIVE
    # 无显式方向时按类型兜底
    if sig.signal_type in (
        SignalType.EXPLICIT_ANTI_PREFERENCE,
        SignalType.RISK_BOUNDARY,
    ):
        return Polarity.NEGATIVE
    if sig.signal_type == SignalType.EXPLICIT_PREFERENCE:
        return Polarity.POSITIVE
    return Polarity.NEUTRAL


async def extract_message_signal(
    *,
    text: str,
    message_id: str | None = None,
    institution_id: str | None = None,
    user_id: str | None = None,
    related_thesis_id: str | None = None,
    sector_hint: str | None = None,
    allow_overseas: bool = False,
) -> ExtractedPreferenceSignal | None:
    """Step 2：判断 Message 是否含偏好信号并抽取（LLM，STANDARD 档）。

    空文本守卫不调 LLM；判定非偏好信号返回 None。临时请求（temporary_request）即便 LLM 误标
    durable=True，也在此强制 durable=False——「不沉淀临时指令」是设计的硬约束。"""
    text = (text or "").strip()
    if not text:
        return None

    raw = await complete_structured(
        ModelTier.STANDARD,
        [
            {"role": "system", "content": MESSAGE_SIGNAL_SYSTEM},
            {"role": "user", "content": text},
        ],
        MessageSignalExtraction,
        allow_overseas=allow_overseas,
    )

    if not raw.is_preference_signal or raw.signal_type is None:
        return None

    # 临时请求恒不沉淀（设计硬约束，防 LLM 误判 durable）
    durable = raw.durable and raw.signal_type != SignalType.TEMPORARY_REQUEST

    # 调用方已知的上下文回灌（LLM 抽不到时兜底，不覆盖 LLM 已抽到的值）
    scope = raw.target_scope
    if related_thesis_id and not scope.related_thesis_id:
        scope = scope.model_copy(update={"related_thesis_id": related_thesis_id})
    if sector_hint and not scope.sector:
        scope = scope.model_copy(update={"sector": sector_hint})

    return ExtractedPreferenceSignal(
        signal_type=raw.signal_type,
        source_type=SignalSourceType.MESSAGE,
        source_id=message_id,
        institution_id=institution_id,
        user_id=user_id,
        target_scope=scope,
        positive_preference=raw.positive_preference,
        negative_preference=raw.negative_preference,
        polarity=_message_polarity(raw),
        weight=0,  # Message 信号不走权重表，权重在聚合层据 strength 折算
        strength=raw.strength,
        confidence=raw.confidence,
        durable=durable,
        rationale=raw.rationale,
    )
