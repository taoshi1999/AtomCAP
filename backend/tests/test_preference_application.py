"""apply_changes_to_preference 纯函数测试（经验沉淀路线第 8 步核心）。"""

from __future__ import annotations

from app.agents.experience.apply import (
    DEFAULT_WEIGHT_STEP,
    apply_changes_to_preference,
)
from app.objects.experience import SuggestedChange
from app.objects.preference import (
    DeclaredStrategy,
    InvestmentPreference,
    LearnedPreference,
    WeightedItem,
)


def _change(**kw) -> SuggestedChange:
    base = dict(field_path="learned_preference.sector_weights", operation="increase_weight")
    base.update(kw)
    return SuggestedChange(**base)


def test_increase_existing_item_weight_and_confidence():
    pref = InvestmentPreference(
        learned_preference=LearnedPreference(
            sector_weights=[WeightedItem(name="半导体", weight=0.5, confidence=0.4)]
        )
    )
    res = apply_changes_to_preference(
        pref, [_change(target="半导体", operation="increase_weight", delta=0.1)], confidence=0.8
    )
    assert res.changed
    item = res.preference.learned_preference.sector_weights[0]
    assert abs(item.weight - 0.6) < 1e-9
    assert abs(item.confidence - 0.8) < 1e-9  # 抬升到 advice 置信度
    # 输入不被修改
    assert pref.learned_preference.sector_weights[0].weight == 0.5


def test_decrease_existing_item_weight():
    pref = InvestmentPreference(
        learned_preference=LearnedPreference(
            subsector_weights=[WeightedItem(name="AI眼镜整机", weight=0.7)]
        )
    )
    res = apply_changes_to_preference(
        pref,
        [_change(field_path="learned_preference.subsector_weights", target="AI眼镜整机",
                 operation="decrease_weight", delta=-0.2)],
    )
    assert res.changed
    assert abs(res.preference.learned_preference.subsector_weights[0].weight - 0.5) < 1e-9


def test_create_new_item_when_absent():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(
        pref,
        [_change(target="具身智能", operation="increase_weight")],  # delta 缺省 → 默认步长
        confidence=0.9,
    )
    assert res.changed
    items = res.preference.learned_preference.sector_weights
    assert len(items) == 1
    assert items[0].name == "具身智能"
    assert abs(items[0].weight - (0.5 + DEFAULT_WEIGHT_STEP)) < 1e-9
    assert abs(items[0].confidence - 0.9) < 1e-9


def test_set_operation_uses_suggested_value():
    pref = InvestmentPreference(
        learned_preference=LearnedPreference(
            stage_weights=[WeightedItem(name="A轮", weight=0.5)]
        )
    )
    res = apply_changes_to_preference(
        pref,
        [_change(field_path="learned_preference.stage_weights", target="A轮",
                 operation="set", suggested_value=0.85)],
    )
    assert res.changed
    assert abs(res.preference.learned_preference.stage_weights[0].weight - 0.85) < 1e-9


def test_set_missing_value_is_skipped():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(
        pref, [_change(target="X", operation="set")]
    )
    assert not res.changed
    assert res.applied[0].status == "skipped"


def test_weight_clamped_to_unit_interval():
    pref = InvestmentPreference(
        learned_preference=LearnedPreference(
            sector_weights=[
                WeightedItem(name="high", weight=0.95),
                WeightedItem(name="low", weight=0.05),
            ]
        )
    )
    res = apply_changes_to_preference(
        pref,
        [
            _change(target="high", operation="increase_weight", delta=0.3),
            _change(target="low", operation="decrease_weight", delta=-0.3),
        ],
    )
    weights = {it.name: it.weight for it in res.preference.learned_preference.sector_weights}
    assert weights["high"] == 1.0
    assert weights["low"] == 0.0


def test_missing_target_skipped():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(pref, [_change(target=None, operation="increase_weight")])
    assert not res.changed
    assert res.applied[0].status == "skipped"
    assert "target" in res.applied[0].note


def test_non_actionable_field_path_skipped():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(
        pref, [_change(field_path="learned_preference", target="x", operation="review")]
    )
    assert not res.changed
    assert res.applied[0].status == "skipped"


def test_risk_boundary_change_sets_value():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(
        pref,
        [SuggestedChange(field_path="risk_boundary", target="valuation_sensitivity",
                         operation="decrease_weight", reason="对高估值更谨慎")],
    )
    assert res.changed
    assert res.preference.risk_boundary["valuation_sensitivity"] == "对高估值更谨慎"


def test_declared_strategy_preserved():
    pref = InvestmentPreference(
        declared_strategy=DeclaredStrategy(focus_sectors=["半导体", "AI"]),
        track_preferences=["半导体"],
    )
    res = apply_changes_to_preference(
        pref, [_change(target="机器人", operation="increase_weight")]
    )
    assert res.preference.declared_strategy.focus_sectors == ["半导体", "AI"]
    assert res.preference.track_preferences == ["半导体"]


def test_no_change_when_weight_already_at_target_and_no_confidence():
    pref = InvestmentPreference(
        learned_preference=LearnedPreference(
            sector_weights=[WeightedItem(name="X", weight=1.0)]
        )
    )
    # 已在上界，increase 不再变化，且未提供 confidence → 整体未变更
    res = apply_changes_to_preference(
        pref, [_change(target="X", operation="increase_weight", delta=0.1)]
    )
    assert not res.changed
    assert res.applied[0].status == "skipped"


def test_applied_summaries_only_includes_applied():
    pref = InvestmentPreference()
    res = apply_changes_to_preference(
        pref,
        [
            _change(target="A", operation="increase_weight"),
            _change(target=None, operation="increase_weight"),  # skipped
        ],
    )
    summaries = res.applied_summaries()
    assert len(summaries) == 1
    assert summaries[0]["target"] == "A"
    assert res.applied_count == 1
