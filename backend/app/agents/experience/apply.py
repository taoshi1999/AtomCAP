"""接受 PreferenceAdvice 后，把 suggested_changes 应用到 InvestmentPreference。

经验沉淀路线第 8 步的**纯函数核心**：不连库、不调 LLM。输入机构当前生效的
InvestmentPreference 与一条已接受 Advice 的 suggested_changes，输出应用后的新偏好
对象（深拷贝，绝不原地改输入）与逐条应用记录（供溯源/审计/前端展示）。

只动 ``learned_preference`` 的五张权重表与 ``risk_boundary``——``declared_strategy``
（人工维护）与早期扁平遗留字段一律不碰，避免学习反哺污染人工声明。约定 2：每条
改动都带 reason 透传，结论可解释。

field_path 约定与 ``agents/experience/match.py`` 的 ``_DIMENSION_FIELD_PATH`` 对齐：
``learned_preference.<dim>_weights`` 与 ``risk_boundary``。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.objects.experience import SuggestedChange
from app.objects.preference import (
    InvestmentPreference,
    LearnedPreference,
    WeightedItem,
)

# 未显式给 delta 时的默认权重步长，与 match._suggested_update 的 ±0.1 一致。
DEFAULT_WEIGHT_STEP = 0.1
# 为尚不存在的权重项新建时的基准值（再叠加带符号步长后裁剪到 [0,1]）。
DEFAULT_NEW_ITEM_BASE = 0.5

# field_path → LearnedPreference 上的列表属性名。
_WEIGHT_LIST_FIELDS: dict[str, str] = {
    "learned_preference.sector_weights": "sector_weights",
    "learned_preference.subsector_weights": "subsector_weights",
    "learned_preference.industry_chain_position_weights": "industry_chain_position_weights",
    "learned_preference.stage_weights": "stage_weights",
    "learned_preference.region_weights": "region_weights",
}

_APPLIED = "applied"
_SKIPPED = "skipped"


@dataclass
class AppliedChange:
    """一条 suggested_change 的应用结果（applied 才真正改了偏好）。"""

    field_path: str
    operation: str
    status: str  # applied / skipped
    change_id: str | None = None
    target: str | None = None
    old_value: float | None = None
    new_value: float | None = None
    note: str | None = None

    def as_dict(self) -> dict:
        return {
            "change_id": self.change_id,
            "field_path": self.field_path,
            "target": self.target,
            "operation": self.operation,
            "status": self.status,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "note": self.note,
        }


@dataclass
class ApplyResult:
    preference: InvestmentPreference
    applied: list[AppliedChange] = field(default_factory=list)

    @property
    def changed(self) -> bool:
        """是否有任何一条改动真正落到了偏好上（决定是否要造新版本）。"""
        return any(item.status == _APPLIED for item in self.applied)

    @property
    def applied_count(self) -> int:
        return sum(1 for item in self.applied if item.status == _APPLIED)

    def applied_summaries(self) -> list[dict]:
        return [item.as_dict() for item in self.applied if item.status == _APPLIED]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _norm(name: str | None) -> str:
    return (name or "").strip().casefold()


def _resolve_step(change: SuggestedChange) -> float:
    """从 change.delta 取步长绝对值，缺省回退默认步长。"""
    if change.delta is not None and change.delta != 0:
        return abs(change.delta)
    return DEFAULT_WEIGHT_STEP


def _skip(change: SuggestedChange, note: str) -> AppliedChange:
    return AppliedChange(
        change_id=change.change_id,
        field_path=change.field_path,
        target=change.target,
        operation=change.operation,
        status=_SKIPPED,
        note=note,
    )


def _apply_weight_change(
    items: list[WeightedItem],
    change: SuggestedChange,
    *,
    confidence: float | None,
) -> AppliedChange:
    """对某一权重表应用一条改动：定位/新建 WeightedItem 并调整权重。"""
    if not change.target:
        return _skip(change, "缺少 target，无法定位权重项")

    op = change.operation
    norm = _norm(change.target)
    existing = next((it for it in items if _norm(it.name) == norm), None)
    old_value = existing.weight if existing is not None else None

    if op == "set":
        if change.suggested_value is None:
            return _skip(change, "set 操作缺少 suggested_value")
        new_value = _clamp01(change.suggested_value)
    elif op in ("increase_weight", "decrease_weight"):
        step = _resolve_step(change)
        signed = step if op == "increase_weight" else -step
        base = existing.weight if existing is not None else DEFAULT_NEW_ITEM_BASE
        new_value = _clamp01(base + signed)
    else:
        return _skip(change, f"不支持的操作: {op}")

    # 置信度抬升也算一次有意义的更新（更确定，即便权重未变）。
    conf_raised = (
        existing is not None
        and confidence is not None
        and confidence > (existing.confidence or 0.0)
    )
    weight_changed = existing is None or new_value != old_value
    if not weight_changed and not conf_raised:
        return _skip(change, "权重无变化")

    if existing is not None:
        existing.weight = new_value
        if confidence is not None:
            existing.confidence = max(existing.confidence or 0.0, _clamp01(confidence))
    else:
        items.append(
            WeightedItem(
                name=change.target,
                weight=new_value,
                confidence=_clamp01(confidence) if confidence is not None else None,
            )
        )

    return AppliedChange(
        change_id=change.change_id,
        field_path=change.field_path,
        target=change.target,
        operation=op,
        status=_APPLIED,
        old_value=old_value,
        new_value=new_value,
        note=change.reason,
    )


def _risk_label(change: SuggestedChange) -> str:
    """risk_boundary 是 dict[str, str]，把改动转成可读的容忍度描述。"""
    if change.reason:
        return change.reason
    op = change.operation
    if op == "increase_weight":
        return "提高容忍度"
    if op == "decrease_weight":
        return "收紧容忍度"
    return "需关注"


def _apply_risk_change(
    risk_boundary: dict[str, str], change: SuggestedChange
) -> AppliedChange:
    if not change.target:
        return _skip(change, "缺少 target，无法定位风险维度")
    label = _risk_label(change)
    old = risk_boundary.get(change.target)
    if old == label:
        return _skip(change, "风险边界无变化")
    risk_boundary[change.target] = label
    return AppliedChange(
        change_id=change.change_id,
        field_path=change.field_path,
        target=change.target,
        operation=change.operation,
        status=_APPLIED,
        note=f"{old or '∅'} → {label}",
    )


def apply_changes_to_preference(
    preference: InvestmentPreference,
    changes: list[SuggestedChange],
    *,
    confidence: float | None = None,
) -> ApplyResult:
    """把一组 suggested_changes 应用到偏好，返回新偏好与逐条结果。

    输入 ``preference`` 不被修改（深拷贝后操作）。``confidence`` 一般取 Advice 的
    confidence，用于新建/更新权重项的置信度。非可执行的 field_path / operation
    一律记为 skipped，不致命。
    """
    pref = preference.model_copy(deep=True)
    if pref.learned_preference is None:
        pref.learned_preference = LearnedPreference()

    applied: list[AppliedChange] = []
    for change in changes:
        field_path = change.field_path
        if field_path in _WEIGHT_LIST_FIELDS:
            items = getattr(pref.learned_preference, _WEIGHT_LIST_FIELDS[field_path])
            applied.append(_apply_weight_change(items, change, confidence=confidence))
        elif field_path == "risk_boundary":
            applied.append(_apply_risk_change(pref.risk_boundary, change))
        else:
            applied.append(_skip(change, f"非可执行字段路径: {field_path}"))

    return ApplyResult(preference=pref, applied=applied)
