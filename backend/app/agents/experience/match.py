"""经验沉淀（投资学习）Agent —— 管线第 2 层：PreferenceSignal → ExperienceEvent 匹配 / 更新 / 创建 + 生命周期。

设计依据 `agent_design/经验沉淀Agent.docx` Step 4 / Step 5 / Step 6：

- **Step 4 匹配**：抽到 PreferenceSignal 后不立刻建事件，先在该用户名下已有 ExperienceEvent 中找
  「同一模式」。匹配维度（设计文档）：同一用户 / 同一机构、同一赛道 / Thesis、同一子赛道、同一产业链
  位置、同一风险类型、同一行为方向（正 / 负 / 风险）、时间窗口是否接近、语义是否相似。
- **Step 5 更新 / 创建**：命中则更新（追加 source_id、补 evidence_summary、提 confidence、扩 time_window、
  并入 observed_pattern / preference_impact、富化 target_scope）；未命中则按信号建新事件。
- **Step 6 生命周期**：open（还在收集证据）→ candidate（已形成较明确模式）→ advice_generated（已生成
  Preference_Advice）→ accepted / rejected → archived。本层只负责 open→candidate 的自然推进；
  advice_generated 及之后由 Step 8 聚合层与审阅 API 推进，本层不回退。

全部纯函数、不连库、不调 LLM——输入是 Step 2/3 抽出的 `ExtractedPreferenceSignal` 与已读出的同用户
ExperienceEvent 列表，输出是新建或更新后的 ExperienceEvent（不可变：一律返回副本）。语义相似在离线纯函数
层用「维度一致度」确定性近似（无 embedding 依赖），是设计文档「语义是否相似」的可解释代理。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.objects.experience import (
    EventLifecycle,
    EventScope,
    ExperienceEvent,
    ExperienceEventType,
    ExperienceStatus,
    ExtractedPreferenceSignal,
    ObservedPattern,
    Polarity,
    PreferenceDirection,
    PreferenceImpact,
    PreferenceSignal,
    RelatedObjects,
    SignalSourceType,
    SignalStrength,
    SignalTargetScope,
    SignalType,
    SourceRecords,
    SuggestedUpdate,
    TimeWindow,
)

CREATED_BY = "experience_learning_agent"


# ====================================================================
# 生命周期状态机（Step 6）
# ====================================================================

ALLOWED_STATUS_TRANSITIONS: dict[ExperienceStatus, set[ExperienceStatus]] = {
    ExperienceStatus.OPEN: {ExperienceStatus.CANDIDATE, ExperienceStatus.ARCHIVED},
    ExperienceStatus.CANDIDATE: {
        ExperienceStatus.ADVICE_GENERATED,
        ExperienceStatus.ARCHIVED,
    },
    ExperienceStatus.ADVICE_GENERATED: {
        ExperienceStatus.ACCEPTED,
        ExperienceStatus.REJECTED,
        ExperienceStatus.ARCHIVED,
    },
    ExperienceStatus.ACCEPTED: {ExperienceStatus.ARCHIVED},
    ExperienceStatus.REJECTED: {ExperienceStatus.ARCHIVED},
    ExperienceStatus.ARCHIVED: set(),
}

# match 层不主动跨过 candidate：到达 advice_generated 后，新证据只补充不回退状态。
_LAYER_FROZEN = {
    ExperienceStatus.ADVICE_GENERATED,
    ExperienceStatus.ACCEPTED,
    ExperienceStatus.REJECTED,
    ExperienceStatus.ARCHIVED,
}

# 已采纳 / 拒绝 / 归档的事件不再吸附新证据（设计 Step 8「未被拒绝过相似 advice」）。
_MATCH_SKIP_STATUS = {
    ExperienceStatus.ACCEPTED,
    ExperienceStatus.REJECTED,
    ExperienceStatus.ARCHIVED,
}

# open→candidate 升级阈值（设计 Step 6 / Step 8）。
CANDIDATE_MIN_SOURCES = 3      # 连续 3 条同向证据成稳定模式
CANDIDATE_CONFIDENCE = 0.75    # 置信度达阈值


# ====================================================================
# 信号 / 事件「家族」与类型映射
# ====================================================================

class _Family:
    PREFERENCE = "preference"      # 正向长期 / 行为偏好
    ANTI = "anti"                  # 反偏好 / 拒绝 / 负向行为
    RISK = "risk"                  # 风险边界 / 风险敏感
    CORRECTION = "correction"      # 含正反双向的偏好 / 策略修正
    DATA_SOURCE = "data_source"


_SIGNAL_FAMILY: dict[SignalType, str] = {
    SignalType.EXPLICIT_PREFERENCE: _Family.PREFERENCE,
    SignalType.POSITIVE_BEHAVIOR_SIGNAL: _Family.PREFERENCE,
    SignalType.EXPLICIT_ANTI_PREFERENCE: _Family.ANTI,
    SignalType.NEGATIVE_BEHAVIOR_SIGNAL: _Family.ANTI,
    SignalType.RISK_BOUNDARY: _Family.RISK,
    SignalType.PREFERENCE_CORRECTION: _Family.CORRECTION,
    SignalType.EXPLICIT_PREFERENCE_CORRECTION: _Family.CORRECTION,
    SignalType.STRATEGY_CORRECTION: _Family.CORRECTION,
    # TEMPORARY_REQUEST 不沉淀，无 family（ingest 守卫拦截）
}

_SIGNAL_TO_EVENT_TYPE: dict[SignalType, ExperienceEventType] = {
    SignalType.EXPLICIT_PREFERENCE: ExperienceEventType.EXPLICIT_PREFERENCE,
    SignalType.POSITIVE_BEHAVIOR_SIGNAL: ExperienceEventType.REPEATED_POSITIVE_PATTERN,
    SignalType.EXPLICIT_ANTI_PREFERENCE: ExperienceEventType.EXPLICIT_ANTI_PREFERENCE,
    SignalType.NEGATIVE_BEHAVIOR_SIGNAL: ExperienceEventType.REPEATED_REJECTION_PATTERN,
    SignalType.RISK_BOUNDARY: ExperienceEventType.RISK_SENSITIVITY,
    SignalType.PREFERENCE_CORRECTION: ExperienceEventType.PREFERENCE_CORRECTION,
    SignalType.EXPLICIT_PREFERENCE_CORRECTION: ExperienceEventType.PREFERENCE_CORRECTION,
    SignalType.STRATEGY_CORRECTION: ExperienceEventType.PREFERENCE_CORRECTION,
}

_EVENT_FAMILY: dict[ExperienceEventType, str] = {
    ExperienceEventType.EXPLICIT_PREFERENCE: _Family.PREFERENCE,
    ExperienceEventType.REPEATED_POSITIVE_PATTERN: _Family.PREFERENCE,
    ExperienceEventType.SECTOR_PREFERENCE: _Family.PREFERENCE,
    ExperienceEventType.SUBSECTOR_PREFERENCE: _Family.PREFERENCE,
    ExperienceEventType.INDUSTRY_CHAIN_PREFERENCE: _Family.PREFERENCE,
    ExperienceEventType.STAGE_PREFERENCE: _Family.PREFERENCE,
    ExperienceEventType.EXPLICIT_ANTI_PREFERENCE: _Family.ANTI,
    ExperienceEventType.REPEATED_REJECTION_PATTERN: _Family.ANTI,
    ExperienceEventType.RISK_SENSITIVITY: _Family.RISK,
    ExperienceEventType.PREFERENCE_CORRECTION: _Family.CORRECTION,
    ExperienceEventType.PREFERENCE_SHIFT: _Family.CORRECTION,
    ExperienceEventType.DATA_SOURCE_EFFECTIVENESS: _Family.DATA_SOURCE,
}

# 偏好维度 → Preference 字段路径（preference_impact 草案，Step 8 据此细化为 Advice 的 change）。
_DIMENSION_FIELD_PATH: dict[str, str] = {
    "sector": "learned_preference.sector_weights",
    "sub_sector": "learned_preference.subsector_weights",
    "industry_chain_position": "learned_preference.industry_chain_position_weights",
    "stage": "learned_preference.stage_weights",
    "region": "learned_preference.region_weights",
    "risk": "risk_boundary",
}

# 匹配维度特异度权重（越具体权重越高）。related_deal_id 不作匹配维度——同一模式跨不同项目本应合并。
_DIMENSION_WEIGHT: dict[str, int] = {
    "related_thesis_id": 3,
    "sub_sector": 3,
    "sector": 2,
    "industry_chain_position": 2,
    "stage": 1,
    "region": 1,
    "risk_level": 1,
}
_SCOPE_DIMENSIONS = tuple(_DIMENSION_WEIGHT)
MATCH_THRESHOLD = 2  # 一致度至少需达赛道级（sector=2）或更具体

_STRENGTH_ORDER = {
    SignalStrength.WEAK: 0,
    SignalStrength.MEDIUM: 1,
    SignalStrength.STRONG: 2,
}


# ====================================================================
# 小工具
# ====================================================================

def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(v: object) -> str | None:
    return v.strip().lower() if isinstance(v, str) and v.strip() else None


def _parse_ts(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return None


def _max_ts(a: str | None, b: str | None) -> str | None:
    da, db = _parse_ts(a), _parse_ts(b)
    if da is None:
        return b or a
    if db is None:
        return a
    return a if da >= db else b


def _max_strength(a: SignalStrength, b: SignalStrength) -> SignalStrength:
    return a if _STRENGTH_ORDER[a] >= _STRENGTH_ORDER[b] else b


def _blend_confidence(old: float | None, add: float | None) -> float:
    """证据叠加：向 1 收缩半步，按新信号置信度加权。单调不减、自然饱和。"""
    old = old or 0.0
    add = add or 0.0
    return round(min(0.99, old + (1.0 - old) * add * 0.5), 4)


def _append_unique(lst: list, item, *, cap: int | None = None) -> None:
    if item and item not in lst:
        lst.append(item)
        if cap and len(lst) > cap:
            del lst[0 : len(lst) - cap]


# ====================================================================
# 匹配（Step 4）
# ====================================================================

def _same_principal(signal: ExtractedPreferenceSignal, event: ExperienceEvent) -> bool:
    """同一机构（双方均有则须相等）；事件为 user 维度时须同一用户。"""
    if signal.institution_id and event.institution_id and signal.institution_id != event.institution_id:
        return False
    if event.scope.scope_type == "user" and signal.user_id:
        ids = set(event.scope.source_user_ids)
        if event.scope.scope_id:
            ids.add(event.scope.scope_id)
        if ids and signal.user_id not in ids:
            return False
    return True


def _scope_agreement(a: SignalTargetScope, b: SignalTargetScope) -> tuple[int, int]:
    """仅比较两侧都非空的维度，返回 (一致度, 冲突度)。"""
    agree = conflict = 0
    for dim, w in _DIMENSION_WEIGHT.items():
        va, vb = _norm(getattr(a, dim, None)), _norm(getattr(b, dim, None))
        if va and vb:
            if va == vb:
                agree += w
            else:
                conflict += w
    return agree, conflict


def _within_window(
    signal: ExtractedPreferenceSignal, event: ExperienceEvent, max_gap_seconds: float | None
) -> bool:
    """时间窗约束：缺时间戳或未设上限时不阻断（长期偏好可跨较长时间继续吸附证据）。"""
    if max_gap_seconds is None:
        return True
    end = _parse_ts(event.time_window.end or event.lifecycle.last_updated_at)
    ts = _parse_ts(signal.created_at)
    if end is None or ts is None:
        return True
    return abs((ts - end).total_seconds()) <= max_gap_seconds


def _recency(event: ExperienceEvent) -> datetime:
    return _parse_ts(event.lifecycle.last_updated_at or event.time_window.end) or datetime.min.replace(
        tzinfo=timezone.utc
    )


def match_signal_to_event(
    signal: ExtractedPreferenceSignal,
    events,
    *,
    max_gap_seconds: float | None = None,
) -> ExperienceEvent | None:
    """在同用户名下已有 ExperienceEvent 中找同一模式（家族 + 主体 + 维度一致 + 时间窗）。"""
    fam = _SIGNAL_FAMILY.get(signal.signal_type)
    if fam is None:
        return None
    best: ExperienceEvent | None = None
    best_score = 0
    for ev in events:
        if ev.status in _MATCH_SKIP_STATUS:
            continue
        if _EVENT_FAMILY.get(ev.event_type) != fam:
            continue
        if not _same_principal(signal, ev):
            continue
        if not _within_window(signal, ev, max_gap_seconds):
            continue
        agree, conflict = _scope_agreement(signal.target_scope, ev.target_scope)
        if agree < MATCH_THRESHOLD or agree <= conflict:
            continue
        score = agree - conflict
        if score > best_score or (
            score == best_score and best is not None and _recency(ev) > _recency(best)
        ):
            best, best_score = ev, score
    return best


# ====================================================================
# 由信号派生事件子结构
# ====================================================================

def _title_for(signal: ExtractedPreferenceSignal) -> str:
    scope = signal.target_scope
    neg = signal.negative_preference.target if signal.negative_preference else None
    pos = signal.positive_preference.target if signal.positive_preference else None
    label = neg or pos or scope.sub_sector or scope.sector or "相关方向"
    fam = _SIGNAL_FAMILY.get(signal.signal_type)
    if fam == _Family.ANTI:
        return f"用户对「{label}」存在负向偏好"
    if fam == _Family.PREFERENCE:
        return f"用户偏好「{label}」"
    if fam == _Family.RISK:
        return f"用户风险边界：{label}"
    if fam == _Family.CORRECTION:
        if pos and neg:
            return f"用户调整偏好：降低「{neg}」、提高「{pos}」"
        return f"用户修正偏好：{label}"
    return f"偏好信号：{label}"


def _pattern_text(direction: PreferenceDirection, kind: str) -> str:
    return f"{kind}：{direction.target}（{direction.operation}）"


def _observed_from_signal(signal: ExtractedPreferenceSignal) -> ObservedPattern:
    op = ObservedPattern()
    fam = _SIGNAL_FAMILY.get(signal.signal_type)
    if signal.positive_preference:
        op.positive_patterns.append(_pattern_text(signal.positive_preference, "偏好"))
    if signal.negative_preference:
        if fam == _Family.RISK:
            op.risk_patterns.append(_pattern_text(signal.negative_preference, "风险"))
        else:
            op.negative_patterns.append(_pattern_text(signal.negative_preference, "反偏好"))
    if not (op.positive_patterns or op.negative_patterns or op.risk_patterns) and signal.rationale:
        if signal.polarity == Polarity.NEGATIVE:
            op.negative_patterns.append(signal.rationale)
        else:
            op.positive_patterns.append(signal.rationale)
    return op


def _suggested_update(direction: PreferenceDirection, fam: str | None) -> SuggestedUpdate:
    if fam == _Family.RISK:
        field_path = "risk_boundary"
    else:
        field_path = _DIMENSION_FIELD_PATH.get(direction.dimension or "", "learned_preference.sector_weights")
    if direction.operation == "increase_weight":
        delta: float | None = 0.1
    elif direction.operation == "decrease_weight":
        delta = -0.1
    else:
        delta = None
    return SuggestedUpdate(
        field_path=field_path,
        target=direction.target,
        operation=direction.operation,
        suggested_delta=delta,
    )


def _impact_from_signal(signal: ExtractedPreferenceSignal) -> PreferenceImpact:
    fam = _SIGNAL_FAMILY.get(signal.signal_type)
    impact = PreferenceImpact()
    for direction in (signal.positive_preference, signal.negative_preference):
        if direction is not None:
            impact.suggested_updates.append(_suggested_update(direction, fam))
    return impact


def initial_status(signal: ExtractedPreferenceSignal) -> ExperienceStatus:
    """首条信号建事件时的初始状态：强且可沉淀的信号一上来即 candidate（设计 情况B / Step 7）；
    其余从 open 起，靠后续证据累积升级。"""
    if signal.durable and signal.strength == SignalStrength.STRONG:
        return ExperienceStatus.CANDIDATE
    return ExperienceStatus.OPEN


# ====================================================================
# 创建 / 更新（Step 5）
# ====================================================================

def create_event_from_signal(
    signal: ExtractedPreferenceSignal,
    *,
    now: str | None = None,
    event_id: str | None = None,
    id_factory=None,
) -> ExperienceEvent:
    """未匹配到已有事件时，按信号建新 ExperienceEvent。"""
    now = now or _utcnow_iso()
    ts = signal.created_at or now
    eid = event_id or (id_factory() if id_factory else f"exp_{uuid.uuid4().hex[:12]}")

    scope = EventScope(
        scope_type="user" if signal.user_id else "institution",
        scope_id=signal.user_id or signal.institution_id,
        source_user_ids=[signal.user_id] if signal.user_id else [],
    )
    src = SourceRecords()
    if signal.source_type == SignalSourceType.MESSAGE and signal.source_id:
        src.source_message_ids.append(signal.source_id)
    elif signal.source_type == SignalSourceType.USER_ACTION and signal.source_id:
        src.source_user_action_ids.append(signal.source_id)

    related = RelatedObjects(
        related_thesis_ids=(
            [signal.target_scope.related_thesis_id] if signal.target_scope.related_thesis_id else []
        ),
        related_deal_ids=(
            [signal.target_scope.related_deal_id] if signal.target_scope.related_deal_id else []
        ),
    )

    return ExperienceEvent(
        experience_event_id=eid,
        institution_id=signal.institution_id,
        scope=scope,
        event_type=_SIGNAL_TO_EVENT_TYPE[signal.signal_type],
        title=_title_for(signal),
        summary=signal.rationale,
        status=initial_status(signal),
        lifecycle=EventLifecycle(created_at=now, last_updated_at=now),
        time_window=TimeWindow(start=ts, end=ts),
        source_records=src,
        related_objects=related,
        target_scope=signal.target_scope.model_copy(deep=True),
        observed_pattern=_observed_from_signal(signal),
        preference_signal=PreferenceSignal(
            signal_type=signal.signal_type,
            polarity=signal.polarity,
            strength=signal.strength,
            confidence=signal.confidence,
        ),
        preference_impact=_impact_from_signal(signal),
        evidence_summary=[signal.rationale] if signal.rationale else [],
        created_by=CREATED_BY,
        updated_by=CREATED_BY,
    )


def _merge_observed(dst: ObservedPattern, src: ObservedPattern) -> None:
    for tgt, new in (
        (dst.positive_patterns, src.positive_patterns),
        (dst.negative_patterns, src.negative_patterns),
        (dst.risk_patterns, src.risk_patterns),
    ):
        for x in new:
            if x not in tgt:
                tgt.append(x)


def _merge_impact(dst: PreferenceImpact, src: PreferenceImpact) -> None:
    seen = {(u.field_path, u.target, u.operation) for u in dst.suggested_updates}
    for u in src.suggested_updates:
        key = (u.field_path, u.target, u.operation)
        if key not in seen:
            dst.suggested_updates.append(u)
            seen.add(key)


def _enrich_scope(dst: SignalTargetScope, src: SignalTargetScope) -> None:
    """补空维度，不覆盖事件已确立的维度身份。"""
    for dim in _SCOPE_DIMENSIONS:
        if not getattr(dst, dim, None) and getattr(src, dim, None):
            setattr(dst, dim, getattr(src, dim))


def _recompute_status(event: ExperienceEvent) -> ExperienceStatus:
    """open→candidate 自然推进；advice_generated 及之后不回退。"""
    if event.status in _LAYER_FROZEN:
        return event.status
    count = len(event.source_records.source_message_ids) + len(
        event.source_records.source_user_action_ids
    )
    sig = event.preference_signal
    strong = sig is not None and sig.strength == SignalStrength.STRONG
    conf = sig.confidence if sig else 0.0
    if strong or count >= CANDIDATE_MIN_SOURCES or conf >= CANDIDATE_CONFIDENCE:
        return ExperienceStatus.CANDIDATE
    return ExperienceStatus.OPEN


def apply_signal_to_event(
    event: ExperienceEvent, signal: ExtractedPreferenceSignal, *, now: str | None = None
) -> ExperienceEvent:
    """命中已有事件时合并新证据（不可变：返回更新后的副本）。"""
    now = now or _utcnow_iso()
    ts = signal.created_at or now
    updated = event.model_copy(deep=True)

    # 1. 来源记录
    if signal.source_type == SignalSourceType.MESSAGE:
        _append_unique(updated.source_records.source_message_ids, signal.source_id)
    elif signal.source_type == SignalSourceType.USER_ACTION:
        _append_unique(updated.source_records.source_user_action_ids, signal.source_id)
    # 2. 关联对象
    _append_unique(updated.related_objects.related_thesis_ids, signal.target_scope.related_thesis_id)
    _append_unique(updated.related_objects.related_deal_ids, signal.target_scope.related_deal_id)
    # 3. 用户范围
    _append_unique(updated.scope.source_user_ids, signal.user_id)
    # 4. 证据摘要（上限 50 条防膨胀）
    _append_unique(updated.evidence_summary, signal.rationale, cap=50)
    # 5. observed_pattern / 6. preference_impact 合并
    _merge_observed(updated.observed_pattern, _observed_from_signal(signal))
    _merge_impact(updated.preference_impact, _impact_from_signal(signal))
    # 7. target_scope 富化
    _enrich_scope(updated.target_scope, signal.target_scope)
    # 8. 置信度 / 强度
    cur = updated.preference_signal or PreferenceSignal(signal_type=signal.signal_type)
    updated.preference_signal = cur.model_copy(
        update={
            "confidence": _blend_confidence(cur.confidence, signal.confidence),
            "strength": _max_strength(cur.strength, signal.strength),
        }
    )
    # 9. 时间窗
    updated.time_window.end = _max_ts(updated.time_window.end, ts)
    if not updated.time_window.start:
        updated.time_window.start = ts
    # 10. 生命周期 + 状态推进
    updated.lifecycle.last_updated_at = now
    updated.status = _recompute_status(updated)
    updated.updated_by = CREATED_BY
    return updated


# ====================================================================
# 编排入口（供 Step 5 增量扫描复用）
# ====================================================================

@dataclass
class IngestResult:
    event: ExperienceEvent
    created: bool
    matched_event_id: str | None = None


def ingest_signal(
    signal: ExtractedPreferenceSignal,
    events,
    *,
    now: str | None = None,
    max_gap_seconds: float | None = None,
    event_id: str | None = None,
    id_factory=None,
) -> IngestResult | None:
    """一条信号 → 更新已有 / 新建 ExperienceEvent。不沉淀的信号返回 None。"""
    # 临时请求 / 单次任务指令不沉淀（设计硬约束）
    if not signal.durable:
        return None
    # 中性信号 / 无对应事件类型不沉淀
    if signal.polarity == Polarity.NEUTRAL:
        return None
    if signal.signal_type not in _SIGNAL_TO_EVENT_TYPE:
        return None

    match = match_signal_to_event(signal, events, max_gap_seconds=max_gap_seconds)
    if match is not None:
        return IngestResult(
            event=apply_signal_to_event(match, signal, now=now),
            created=False,
            matched_event_id=match.experience_event_id,
        )
    return IngestResult(
        event=create_event_from_signal(signal, now=now, event_id=event_id, id_factory=id_factory),
        created=True,
    )


def ingest_signals(
    signals,
    events=None,
    *,
    now: str | None = None,
    max_gap_seconds: float | None = None,
    id_factory=None,
) -> list[ExperienceEvent]:
    """把一批信号顺序折叠进事件列表（供 Step 5 每 5 分钟增量扫描复用）。返回更新后的事件列表。"""
    working: list[ExperienceEvent] = list(events or [])
    counter = 0

    def _default_id() -> str:
        nonlocal counter
        counter += 1
        return f"exp_{counter:06d}"

    factory = id_factory or _default_id
    for sig in signals:
        res = ingest_signal(
            sig, working, now=now, max_gap_seconds=max_gap_seconds, id_factory=factory
        )
        if res is None:
            continue
        if res.created:
            working.append(res.event)
        else:
            working = [
                res.event if e.experience_event_id == res.matched_event_id else e
                for e in working
            ]
    return working


# ====================================================================
# 状态机流转（Step 6 显式推进，供 Step 8 聚合层 / 审阅 API 调用）
# ====================================================================

def transition_status(
    event: ExperienceEvent, to_status: ExperienceStatus, *, now: str | None = None
) -> ExperienceEvent:
    """按状态机校验后流转（不可变）。非法流转抛 ValueError。"""
    allowed = ALLOWED_STATUS_TRANSITIONS.get(event.status, set())
    if to_status not in allowed:
        raise ValueError(f"非法 ExperienceEvent 状态流转：{event.status} → {to_status}")
    now = now or _utcnow_iso()
    updated = event.model_copy(deep=True)
    updated.status = to_status
    updated.lifecycle.last_updated_at = now
    if to_status == ExperienceStatus.ADVICE_GENERATED:
        updated.lifecycle.advice_generated = True
    if to_status == ExperienceStatus.ARCHIVED:
        updated.lifecycle.archived_at = now
    return updated


def promote_to_candidate(event: ExperienceEvent, *, now: str | None = None) -> ExperienceEvent:
    return transition_status(event, ExperienceStatus.CANDIDATE, now=now)


def mark_advice_generated(event: ExperienceEvent, *, now: str | None = None) -> ExperienceEvent:
    return transition_status(event, ExperienceStatus.ADVICE_GENERATED, now=now)


def mark_accepted(event: ExperienceEvent, *, now: str | None = None) -> ExperienceEvent:
    return transition_status(event, ExperienceStatus.ACCEPTED, now=now)


def mark_rejected(event: ExperienceEvent, *, now: str | None = None) -> ExperienceEvent:
    return transition_status(event, ExperienceStatus.REJECTED, now=now)


def archive(event: ExperienceEvent, *, now: str | None = None) -> ExperienceEvent:
    return transition_status(event, ExperienceStatus.ARCHIVED, now=now)
