"""经验沉淀 Agent 三对象 + Preference 双块的 Schema 离线测试（pydantic-only）。"""

from __future__ import annotations

from app.objects.experience import (
    ACTION_WEIGHTS,
    AdviceType,
    ExperienceEvent,
    ExperienceEventType,
    ExperienceStatus,
    PreferenceAdvice,
    Polarity,
    ReviewStatus,
    SignalStrength,
    SignalType,
    UserAction,
    UserActionType,
)
from app.objects.preference import InvestmentPreference


def test_user_action_minimal_and_snapshot():
    ua = UserAction(action_type=UserActionType.DISLIKE_DEAL)
    # 默认子结构齐全，target_snapshot 必须存在（复盘上下文）
    assert ua.target_snapshot is not None
    assert ua.action_strength.polarity == Polarity.NEUTRAL
    assert ua.processing_status.experience_agent_scanned is False

    rich = UserAction(
        action_type=UserActionType.DISLIKE_DEAL,
        action_label="不感兴趣",
        target={"target_type": "deal", "target_id": "d1", "target_name": "光羽科技"},
        target_snapshot={
            "sector": "AI硬件",
            "sub_sector": "AI眼镜整机",
            "stage": "Pre-A",
            "industry_chain_position": "下游终端",
            "fit_score": 72,
            "risk_level": "中高",
        },
        action_strength={"polarity": "negative", "weight": -3, "confidence": 0.9},
    )
    assert rich.target.target_name == "光羽科技"
    assert rich.target_snapshot.fit_score == 72
    assert rich.action_strength.weight == -3
    # round-trip
    assert UserAction.model_validate(rich.model_dump()).action_type == UserActionType.DISLIKE_DEAL


def test_action_weight_table_matches_design():
    assert ACTION_WEIGHTS[UserActionType.VIEW_DETAIL] == 1
    assert ACTION_WEIGHTS[UserActionType.GENERATE_PRE_DD_BRIEF] == 5
    assert ACTION_WEIGHTS[UserActionType.ABANDON_DEAL] == -5
    assert ACTION_WEIGHTS[UserActionType.MARK_RISK_UNACCEPTABLE] == -6


def test_experience_event_lifecycle_defaults():
    ev = ExperienceEvent(
        event_type=ExperienceEventType.PREFERENCE_CORRECTION,
        title="用户明确降低当前赛道上游产业偏好",
        summary="用户在对话中明确表示不希望投资当前赛道的上游产业。",
        preference_signal={
            "signal_type": "explicit_preference_correction",
            "polarity": "mixed",
            "strength": "strong",
            "confidence": 0.94,
        },
        preference_impact={
            "suggested_updates": [
                {
                    "field_path": "learned_preference.industry_chain_position_weights",
                    "target": "上游产业",
                    "operation": "decrease_weight",
                    "suggested_delta": -0.12,
                }
            ]
        },
    )
    assert ev.status == ExperienceStatus.OPEN
    assert ev.lifecycle.advice_generated is False
    assert ev.preference_signal.strength == SignalStrength.STRONG
    assert ev.preference_impact.suggested_updates[0].suggested_delta == -0.12
    assert ev.created_by == "experience_learning_agent"


def test_preference_advice_review_queue_defaults():
    adv = PreferenceAdvice(
        title="建议调整当前赛道上下游产业偏好",
        advice_type=AdviceType.INDUSTRY_CHAIN_WEIGHT_ADJUSTMENT,
        source_experience_event_ids=["exp_001"],
        suggested_changes=[
            {
                "change_id": "change_001",
                "field_path": "learned_preference.industry_chain_position_weights",
                "target": "上游产业",
                "operation": "decrease_weight",
                "current_value": 0.72,
                "suggested_value": 0.60,
                "delta": -0.12,
                "reason": "用户明确表示不希望投资当前赛道上游产业",
            }
        ],
        confidence=0.92,
    )
    # 即便强信号也默认进人工审阅、未应用
    assert adv.review_status == ReviewStatus.PENDING_REVIEW
    assert adv.application.applied is False
    assert adv.suggested_changes[0].delta == -0.12


def test_signal_type_enum_covers_temporary_request():
    # 区分长期偏好与单次任务指令：temporary_request 不应沉淀
    assert SignalType.TEMPORARY_REQUEST == "temporary_request"
    assert SignalType.EXPLICIT_ANTI_PREFERENCE == "explicit_anti_preference"


def test_preference_backward_compatible_old_payload():
    # 旧扁平 payload（无双块）必须仍可校验，新块为 None
    old = {
        "version": 1,
        "track_preferences": ["AI硬件"],
        "excluded_tracks": ["纯整机品牌"],
        "stages": ["Pre-A", "A轮"],
        "geographies": ["中国"],
        "risk_appetite": "中性偏低",
        "check_size": "1000万-5000万",
        "notes": "重点看硬科技",
    }
    p = InvestmentPreference.model_validate(old)
    assert p.declared_strategy is None
    assert p.learned_preference is None
    assert p.track_preferences == ["AI硬件"]


def test_preference_dual_block():
    p = InvestmentPreference(
        version=4,
        name="默认投资偏好",
        status="active",
        declared_strategy={
            "focus_sectors": ["AI硬件", "机器人"],
            "focus_stages": ["Pre-A", "A轮"],
            "check_size": {"min": 10000000, "max": 50000000, "currency": "CNY"},
        },
        learned_preference={
            "industry_chain_position_weights": [
                {"name": "上游产业", "weight": 0.60, "confidence": 0.78},
                {"name": "下游应用", "weight": 0.73, "confidence": 0.81},
            ]
        },
        scoring_weights={"sector_fit": 0.2, "risk_penalty": 0.18},
        source_advice_ids=["advice_001"],
    )
    assert p.declared_strategy.check_size.max == 50000000
    icp = p.learned_preference.industry_chain_position_weights
    assert icp[1].name == "下游应用" and icp[1].weight == 0.73
    assert p.scoring_weights["risk_penalty"] == 0.18
    # round-trip
    assert InvestmentPreference.model_validate(p.model_dump()).version == 4
