"""经验沉淀管线第 1 层 PreferenceSignal 抽取单测 —— 不连网关、不连库。

覆盖：
- UserAction 纯函数路径：正/负向行为信号、权重→强度分档、中性/零权重不出信号、
  target_snapshot → target_scope 映射、dict 入参兼容
- Message LLM 路径：偏好信号命中转换、非信号返回 None、临时请求强制 durable=False、
  长期偏好 durable=True、polarity 推断、上下文回灌、空文本守卫不调 LLM、allow_overseas 透传
"""

from __future__ import annotations

import asyncio

import app.agents.experience.extract as extract
from app.agents.experience.extract import (
    MessageSignalExtraction,
    extract_message_signal,
    extract_user_action_signal,
    strength_from_weight,
)
from app.objects.experience import (
    ActionContext,
    ActionStrength,
    ActionTarget,
    ExtractedPreferenceSignal,
    Polarity,
    PreferenceDirection,
    SignalSourceType,
    SignalStrength,
    SignalType,
    TargetSnapshot,
    UserAction,
    UserActionType,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _action(action_type, *, polarity, weight, snapshot=None, **kw) -> UserAction:
    return UserAction(
        action_id="action_001",
        institution_id="inst_1",
        user_id="user_1",
        action_type=action_type,
        action_label="不感兴趣",
        target=ActionTarget(target_type="deal", target_id="deal_9", target_name="光羽科技"),
        context=ActionContext(source_thesis_id="thesis_x"),
        target_snapshot=snapshot or TargetSnapshot(),
        action_strength=ActionStrength(polarity=polarity, weight=weight, confidence=1.0),
        **kw,
    )


# ---------- 权重 → 强度分档 ----------

def test_strength_from_weight_bands():
    assert strength_from_weight(1) == SignalStrength.WEAK
    assert strength_from_weight(-2) == SignalStrength.WEAK
    assert strength_from_weight(3) == SignalStrength.MEDIUM
    assert strength_from_weight(-4) == SignalStrength.MEDIUM
    assert strength_from_weight(5) == SignalStrength.STRONG
    assert strength_from_weight(-6) == SignalStrength.STRONG


# ---------- UserAction 路径 ----------

def test_user_action_negative_signal_with_snapshot():
    snap = TargetSnapshot(
        sector="AI硬件", sub_sector="AI眼镜整机",
        industry_chain_position="下游终端", stage="Pre-A", risk_level="中高",
    )
    ua = _action(UserActionType.DISLIKE_DEAL, polarity=Polarity.NEGATIVE, weight=-3, snapshot=snap)
    sig = extract_user_action_signal(ua)
    assert sig is not None
    assert sig.signal_type == SignalType.NEGATIVE_BEHAVIOR_SIGNAL
    assert sig.source_type == SignalSourceType.USER_ACTION
    assert sig.source_id == "action_001"
    assert sig.polarity == Polarity.NEGATIVE
    assert sig.weight == -3
    assert sig.strength == SignalStrength.MEDIUM
    assert sig.confidence == 1.0
    # 快照映射进 scope
    assert sig.target_scope.sector == "AI硬件"
    assert sig.target_scope.sub_sector == "AI眼镜整机"
    assert sig.target_scope.industry_chain_position == "下游终端"
    assert sig.target_scope.related_thesis_id == "thesis_x"
    assert sig.target_scope.related_deal_id == "deal_9"
    # 负向 → 反向偏好，作用对象取最具体维度（子赛道）
    assert sig.positive_preference is None
    assert sig.negative_preference is not None
    assert sig.negative_preference.target == "AI眼镜整机"
    assert sig.negative_preference.operation == "decrease_weight"
    assert sig.negative_preference.dimension == "sub_sector"
    assert sig.durable is True


def test_user_action_positive_signal():
    ua = _action(
        UserActionType.PREPARE_IC, polarity=Polarity.POSITIVE, weight=6,
        snapshot=TargetSnapshot(sector="合成生物"),
    )
    sig = extract_user_action_signal(ua)
    assert sig is not None
    assert sig.signal_type == SignalType.POSITIVE_BEHAVIOR_SIGNAL
    assert sig.polarity == Polarity.POSITIVE
    assert sig.strength == SignalStrength.STRONG
    assert sig.positive_preference is not None
    assert sig.positive_preference.target == "合成生物"
    assert sig.positive_preference.operation == "increase_weight"
    assert sig.positive_preference.dimension == "sector"
    assert sig.negative_preference is None


def test_user_action_neutral_returns_none():
    ua = _action(UserActionType.VIEW_DETAIL, polarity=Polarity.NEUTRAL, weight=0)
    assert extract_user_action_signal(ua) is None


def test_user_action_accepts_dict_payload():
    snap = TargetSnapshot(sector="AI硬件")
    ua = _action(UserActionType.ABANDON_DEAL, polarity=Polarity.NEGATIVE, weight=-5, snapshot=snap)
    payload = ua.model_dump(mode="json")
    sig = extract_user_action_signal(payload)
    assert sig is not None
    assert sig.weight == -5
    assert sig.strength == SignalStrength.STRONG
    assert sig.target_scope.sector == "AI硬件"


def test_user_action_target_label_fallback_to_name():
    # 无快照赛道/子赛道时回退到 target_name
    ua = _action(UserActionType.ABANDON_DEAL, polarity=Polarity.NEGATIVE, weight=-5)
    sig = extract_user_action_signal(ua)
    assert sig.negative_preference.target == "光羽科技"
    assert sig.negative_preference.dimension is None


# ---------- Message 路径（LLM stub） ----------

def _stub_llm(monkeypatch, result: MessageSignalExtraction):
    calls: list[dict] = []

    async def fake(tier, messages, schema, *, allow_overseas=False, **kw):
        calls.append({"tier": tier, "schema": schema, "allow_overseas": allow_overseas,
                      "user": messages[-1]["content"]})
        assert schema is MessageSignalExtraction
        return result

    monkeypatch.setattr(extract, "complete_structured", fake)
    return calls


def test_message_long_term_preference_durable(monkeypatch):
    res = MessageSignalExtraction(
        is_preference_signal=True,
        signal_type=SignalType.STRATEGY_CORRECTION,
        durable=True,
        negative_preference=PreferenceDirection(target="上游产业", operation="decrease_weight"),
        positive_preference=PreferenceDirection(target="下游产业", operation="increase_weight"),
        strength=SignalStrength.STRONG,
        confidence=0.94,
        rationale="用户表达长期不看上游、偏好下游",
    )
    calls = _stub_llm(monkeypatch, res)
    sig = _run(extract_message_signal(
        text="以后这个赛道我不想看上游，帮我多找下游",
        message_id="msg_001", institution_id="inst_1", user_id="user_1",
        related_thesis_id="thesis_x", allow_overseas=True,
    ))
    assert sig is not None
    assert sig.durable is True
    assert sig.source_type == SignalSourceType.MESSAGE
    assert sig.source_id == "msg_001"
    assert sig.polarity == Polarity.MIXED  # 正反皆有
    assert sig.weight == 0  # Message 信号不走权重表
    assert sig.target_scope.related_thesis_id == "thesis_x"  # 上下文回灌
    # STANDARD 档 + 合规透传
    assert calls[0]["tier"].value == "standard"
    assert calls[0]["allow_overseas"] is True


def test_message_temporary_request_forced_not_durable(monkeypatch):
    # 即便 LLM 误标 durable=True，临时请求也强制 False
    res = MessageSignalExtraction(
        is_preference_signal=True,
        signal_type=SignalType.TEMPORARY_REQUEST,
        durable=True,
        positive_preference=PreferenceDirection(target="下游", operation="increase_weight"),
        strength=SignalStrength.WEAK,
        confidence=0.5,
    )
    _stub_llm(monkeypatch, res)
    sig = _run(extract_message_signal(text="这次先帮我找几个下游项目"))
    assert sig is not None
    assert sig.durable is False
    assert sig.signal_type == SignalType.TEMPORARY_REQUEST
    assert sig.polarity == Polarity.POSITIVE


def test_message_non_signal_returns_none(monkeypatch):
    res = MessageSignalExtraction(is_preference_signal=False)
    _stub_llm(monkeypatch, res)
    sig = _run(extract_message_signal(text="这家公司的最新融资是什么时候？"))
    assert sig is None


def test_message_anti_preference_polarity(monkeypatch):
    res = MessageSignalExtraction(
        is_preference_signal=True,
        signal_type=SignalType.EXPLICIT_ANTI_PREFERENCE,
        durable=True,
        strength=SignalStrength.MEDIUM,
        confidence=0.8,
    )
    _stub_llm(monkeypatch, res)
    sig = _run(extract_message_signal(text="纯整机品牌不要再给我推了"))
    assert sig.polarity == Polarity.NEGATIVE


def test_message_empty_text_skips_llm(monkeypatch):
    calls = _stub_llm(monkeypatch, MessageSignalExtraction(is_preference_signal=True,
                                                           signal_type=SignalType.EXPLICIT_PREFERENCE))
    sig = _run(extract_message_signal(text="   "))
    assert sig is None
    assert calls == []  # 守卫：空文本不调 LLM


def test_message_sector_hint_backfill(monkeypatch):
    res = MessageSignalExtraction(
        is_preference_signal=True,
        signal_type=SignalType.EXPLICIT_PREFERENCE,
        durable=True,
        positive_preference=PreferenceDirection(target="下游"),
        strength=SignalStrength.MEDIUM,
        confidence=0.7,
    )
    _stub_llm(monkeypatch, res)
    sig = _run(extract_message_signal(text="多看下游", sector_hint="AI硬件"))
    assert sig.target_scope.sector == "AI硬件"
    assert sig.polarity == Polarity.POSITIVE
