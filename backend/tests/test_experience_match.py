"""经验沉淀管线第 2 层 ExperienceEvent 匹配/更新/创建 + 生命周期单测 —— 纯函数、不连库、不调 LLM。

覆盖（设计 Step 4/5/6）：
- 由信号建新事件（负向行为 / 正向行为 / 风险边界 / 双向修正）字段与状态
- 匹配维度：同子赛道累积升 candidate、不同子赛道不误并、同赛道+同产业链位置跨子赛道合并
- 家族隔离：正向信号不并入负向事件
- 不沉淀守卫：临时请求(durable=False) / 中性信号
- 时间窗 staleness（max_gap_seconds）
- 拒绝/归档事件不再吸附新证据
- 生命周期状态机合法/非法流转、advice_generated/archived 标志
- apply 不可变；confidence 叠加单调饱和
"""

from __future__ import annotations

import app.agents.experience.match as M
from app.agents.experience.match import (
    apply_signal_to_event,
    archive,
    create_event_from_signal,
    ingest_signal,
    ingest_signals,
    initial_status,
    mark_accepted,
    mark_advice_generated,
    match_signal_to_event,
    transition_status,
)
from app.objects.experience import (
    EventScope,
    ExperienceEvent,
    ExperienceEventType,
    ExperienceStatus,
    ExtractedPreferenceSignal,
    Polarity,
    PreferenceDirection,
    SignalSourceType,
    SignalStrength,
    SignalTargetScope,
    SignalType,
)


# ---------- 构造工具 ----------

def _sig(
    signal_type,
    *,
    source_type=SignalSourceType.USER_ACTION,
    polarity,
    strength,
    durable=True,
    sector=None,
    sub_sector=None,
    icp=None,
    stage=None,
    region=None,
    risk=None,
    thesis=None,
    deal=None,
    pos=None,
    neg=None,
    weight=0,
    source_id="s1",
    inst="inst_1",
    user="user_1",
    confidence=0.8,
    rationale="判断依据",
    created_at=None,
) -> ExtractedPreferenceSignal:
    def _dir(spec, op):
        if spec is None:
            return None
        if isinstance(spec, tuple):
            target, dim = spec
        else:
            target, dim = spec, None
        return PreferenceDirection(target=target, operation=op, dimension=dim)

    return ExtractedPreferenceSignal(
        signal_type=signal_type,
        source_type=source_type,
        source_id=source_id,
        institution_id=inst,
        user_id=user,
        target_scope=SignalTargetScope(
            sector=sector,
            sub_sector=sub_sector,
            industry_chain_position=icp,
            stage=stage,
            region=region,
            risk_level=risk,
            related_thesis_id=thesis,
            related_deal_id=deal,
        ),
        positive_preference=_dir(pos, "increase_weight"),
        negative_preference=_dir(neg, "decrease_weight"),
        polarity=polarity,
        weight=weight,
        strength=strength,
        confidence=confidence,
        durable=durable,
        rationale=rationale,
        created_at=created_at,
    )


def _neg_behavior(sub_sector="AI眼镜整机", **kw):
    return _sig(
        SignalType.NEGATIVE_BEHAVIOR_SIGNAL,
        polarity=Polarity.NEGATIVE,
        strength=SignalStrength.MEDIUM,
        sector="AI硬件",
        sub_sector=sub_sector,
        neg=(sub_sector, "sub_sector"),
        weight=-3,
        **kw,
    )


# ---------- 由信号建新事件 ----------

def test_create_negative_behavior_event():
    sig = _neg_behavior(source_id="a1")
    ev = create_event_from_signal(sig, now="2026-06-16T10:00:00+00:00", event_id="exp_1")
    assert ev.event_type == ExperienceEventType.REPEATED_REJECTION_PATTERN
    assert ev.status == ExperienceStatus.OPEN            # 单条中等信号从 open 起
    assert ev.experience_event_id == "exp_1"
    assert ev.institution_id == "inst_1"
    assert ev.scope.scope_type == "user"
    assert ev.scope.source_user_ids == ["user_1"]
    assert ev.source_records.source_user_action_ids == ["a1"]
    assert ev.source_records.source_message_ids == []
    # 维度身份落进 target_scope（供后续匹配）
    assert ev.target_scope.sector == "AI硬件"
    assert ev.target_scope.sub_sector == "AI眼镜整机"
    # observed / impact
    assert ev.observed_pattern.negative_patterns and not ev.observed_pattern.positive_patterns
    assert ev.preference_impact.suggested_updates[0].field_path == "learned_preference.subsector_weights"
    assert ev.preference_impact.suggested_updates[0].suggested_delta == -0.1
    assert ev.preference_signal.strength == SignalStrength.MEDIUM
    assert "负向偏好" in ev.title


def test_create_positive_behavior_event():
    sig = _sig(
        SignalType.POSITIVE_BEHAVIOR_SIGNAL,
        polarity=Polarity.POSITIVE,
        strength=SignalStrength.MEDIUM,
        sector="合成生物",
        pos=("合成生物", "sector"),
        weight=4,
    )
    ev = create_event_from_signal(sig, event_id="exp_p")
    assert ev.event_type == ExperienceEventType.REPEATED_POSITIVE_PATTERN
    assert ev.observed_pattern.positive_patterns and not ev.observed_pattern.negative_patterns
    u = ev.preference_impact.suggested_updates[0]
    assert u.field_path == "learned_preference.sector_weights"
    assert u.suggested_delta == 0.1
    assert "偏好" in ev.title


def test_create_risk_event_buckets_into_risk_patterns():
    sig = _sig(
        SignalType.RISK_BOUNDARY,
        source_type=SignalSourceType.MESSAGE,
        polarity=Polarity.NEGATIVE,
        strength=SignalStrength.MEDIUM,
        sector="AI硬件",
        neg=("客户集中度高", "risk"),
        source_id="m1",
    )
    ev = create_event_from_signal(sig, event_id="exp_r")
    assert ev.event_type == ExperienceEventType.RISK_SENSITIVITY
    assert ev.observed_pattern.risk_patterns and not ev.observed_pattern.negative_patterns
    assert ev.preference_impact.suggested_updates[0].field_path == "risk_boundary"
    assert ev.source_records.source_message_ids == ["m1"]


def test_strong_durable_message_starts_candidate():
    sig = _sig(
        SignalType.EXPLICIT_ANTI_PREFERENCE,
        source_type=SignalSourceType.MESSAGE,
        polarity=Polarity.NEGATIVE,
        strength=SignalStrength.STRONG,
        sector="AI硬件",
        neg=("纯整机品牌", "sub_sector"),
        confidence=0.94,
    )
    assert initial_status(sig) == ExperienceStatus.CANDIDATE
    ev = create_event_from_signal(sig, event_id="exp_s")
    assert ev.status == ExperienceStatus.CANDIDATE


def test_correction_signal_creates_mixed_event():
    sig = _sig(
        SignalType.STRATEGY_CORRECTION,
        source_type=SignalSourceType.MESSAGE,
        polarity=Polarity.MIXED,
        strength=SignalStrength.STRONG,
        sector="AI硬件",
        thesis="thesis_x",
        neg=("上游产业", "industry_chain_position"),
        pos=("下游产业", "industry_chain_position"),
    )
    ev = create_event_from_signal(sig, event_id="exp_c")
    assert ev.event_type == ExperienceEventType.PREFERENCE_CORRECTION
    assert ev.observed_pattern.positive_patterns and ev.observed_pattern.negative_patterns
    paths = {(u.target, u.suggested_delta) for u in ev.preference_impact.suggested_updates}
    assert ("下游产业", 0.1) in paths and ("上游产业", -0.1) in paths
    assert ev.related_objects.related_thesis_ids == ["thesis_x"]
    assert "上游产业" in ev.title and "下游产业" in ev.title


# ---------- 匹配 / 累积 ----------

def test_accumulate_same_subsector_promotes_to_candidate():
    sigs = [_neg_behavior(source_id=f"a{i}") for i in range(1, 4)]
    events = ingest_signals(sigs, now="2026-06-16T10:00:00+00:00")
    assert len(events) == 1                       # 同子赛道并入一个事件
    ev = events[0]
    assert ev.source_records.source_user_action_ids == ["a1", "a2", "a3"]
    assert ev.status == ExperienceStatus.CANDIDATE  # 累计 3 条 → 升 candidate
    assert ev.preference_signal.confidence > 0.8    # 置信度叠加上升


def test_different_subsector_not_merged():
    sigs = [
        _neg_behavior(sub_sector="AI眼镜整机", source_id="a1"),
        _neg_behavior(sub_sector="AI耳机整机", source_id="a2"),
    ]
    events = ingest_signals(sigs)
    assert len(events) == 2                        # 不同子赛道、无共享产业链位置 → 不误并


def test_same_sector_chain_position_merges_across_subsector():
    common = dict(sector="AI硬件", icp="整机品牌", polarity=Polarity.NEGATIVE,
                  strength=SignalStrength.MEDIUM, weight=-3)
    sigs = [
        _sig(SignalType.NEGATIVE_BEHAVIOR_SIGNAL, sub_sector="AI眼镜整机",
             neg=("整机品牌", "industry_chain_position"), source_id="a1", **common),
        _sig(SignalType.NEGATIVE_BEHAVIOR_SIGNAL, sub_sector="AI耳机整机",
             neg=("整机品牌", "industry_chain_position"), source_id="a2", **common),
    ]
    events = ingest_signals(sigs)
    assert len(events) == 1                        # sector+产业链位置一致(4) > 子赛道冲突(3) → 合并


def test_positive_signal_not_merged_into_negative_event():
    neg = _neg_behavior(source_id="a1")
    pos = _sig(SignalType.POSITIVE_BEHAVIOR_SIGNAL, polarity=Polarity.POSITIVE,
               strength=SignalStrength.MEDIUM, sector="AI硬件", sub_sector="AI眼镜整机",
               pos=("AI眼镜整机", "sub_sector"), weight=4, source_id="a2")
    events = ingest_signals([neg, pos])
    assert len(events) == 2                        # 家族隔离：正向不并入负向


def test_match_returns_best_scoring_event():
    sig = _neg_behavior(source_id="a1")
    ev = create_event_from_signal(sig, event_id="exp_1")
    sig2 = _neg_behavior(source_id="a2")
    assert match_signal_to_event(sig2, [ev]) is ev


# ---------- 不沉淀守卫 ----------

def test_temporary_request_not_sedimented():
    sig = _sig(SignalType.TEMPORARY_REQUEST, polarity=Polarity.POSITIVE,
               strength=SignalStrength.WEAK, durable=False, pos=("下游", "sector"))
    assert ingest_signal(sig, []) is None


def test_neutral_signal_not_sedimented():
    sig = _sig(SignalType.EXPLICIT_PREFERENCE, source_type=SignalSourceType.MESSAGE,
               polarity=Polarity.NEUTRAL, strength=SignalStrength.WEAK)
    assert ingest_signal(sig, []) is None


def test_rejected_event_not_reattached():
    base = create_event_from_signal(_neg_behavior(source_id="a1"), event_id="exp_1")
    rejected = base.model_copy(update={"status": ExperienceStatus.REJECTED})
    res = ingest_signal(_neg_behavior(source_id="a2"), [rejected], event_id="exp_2")
    assert res is not None and res.created is True   # 不吸附进已拒绝事件，另起新事件
    assert res.event.experience_event_id == "exp_2"


# ---------- 时间窗 ----------

def test_time_window_staleness_blocks_match():
    old = create_event_from_signal(
        _neg_behavior(source_id="a1", created_at="2026-05-01T10:00:00+00:00"),
        now="2026-05-01T10:00:00+00:00", event_id="exp_old",
    )
    fresh = _neg_behavior(source_id="a2", created_at="2026-06-16T10:00:00+00:00")
    # 46 天间隔 > 1 天上限 → 不匹配
    assert match_signal_to_event(fresh, [old], max_gap_seconds=86400) is None
    # 不设上限 → 仍匹配（长期偏好可持续吸附）
    assert match_signal_to_event(fresh, [old]) is old


# ---------- 生命周期状态机 ----------

def test_state_machine_happy_path():
    ev = create_event_from_signal(_neg_behavior(source_id="a1"), event_id="exp_1")
    assert ev.status == ExperienceStatus.OPEN
    ev = transition_status(ev, ExperienceStatus.CANDIDATE, now="t1")
    assert ev.status == ExperienceStatus.CANDIDATE
    ev = mark_advice_generated(ev, now="t2")
    assert ev.status == ExperienceStatus.ADVICE_GENERATED
    assert ev.lifecycle.advice_generated is True
    ev = mark_accepted(ev, now="t3")
    assert ev.status == ExperienceStatus.ACCEPTED
    ev = archive(ev, now="t4")
    assert ev.status == ExperienceStatus.ARCHIVED
    assert ev.lifecycle.archived_at == "t4"


def test_state_machine_illegal_transition_raises():
    ev = create_event_from_signal(_neg_behavior(source_id="a1"), event_id="exp_1")
    import pytest
    with pytest.raises(ValueError):
        transition_status(ev, ExperienceStatus.ACCEPTED)   # open 不能直接 accepted
    archived = archive(ev)
    with pytest.raises(ValueError):
        transition_status(archived, ExperienceStatus.OPEN)  # archived 终态无出口


def test_advice_generated_status_not_regressed_by_new_evidence():
    ev = create_event_from_signal(_neg_behavior(source_id="a1"), event_id="exp_1")
    ev = transition_status(ev, ExperienceStatus.CANDIDATE)
    ev = mark_advice_generated(ev)
    updated = apply_signal_to_event(ev, _neg_behavior(source_id="a2"))
    assert updated.status == ExperienceStatus.ADVICE_GENERATED  # 新证据补充但不回退
    assert "a2" in updated.source_records.source_user_action_ids


# ---------- 不可变 / 置信度 ----------

def test_apply_is_immutable():
    ev = create_event_from_signal(_neg_behavior(source_id="a1"), event_id="exp_1")
    before = ev.model_dump()
    apply_signal_to_event(ev, _neg_behavior(source_id="a2"))
    assert ev.model_dump() == before  # 原对象不被修改


def test_blend_confidence_monotonic_and_saturating():
    c = 0.5
    prev = c
    for _ in range(10):
        c = M._blend_confidence(c, 0.86)
        assert c >= prev
        assert c < 1.0
        prev = c
    assert c > 0.9
