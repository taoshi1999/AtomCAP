"""经验沉淀「反哺」层（经验沉淀 Agent 路线第 9 步）。

把机构 `learned_preference` 权重表 / `risk_boundary` / `anti_preference` 确定性地作用到
三个生成 Agent 的输出：
- 赛道前瞻：子赛道推荐排序与匹配度微调（thesis_scout.fit_score）
- 项目获取·搜寻：候选 fit_score 微调、重排与分层（deal_sourcing.score_candidates）
- 项目获取·分析：DealProfile overall_fit 微调与风险初筛（deal_intake.assemble_deal）

设计原则：
- 纯函数、不连库、不调 LLM，仅依赖标准库 —— 可完全离线单测。
- learned_preference 只做**有界 nudge**（|delta| ≤ MAX_TOTAL_DELTA），绝不覆盖 LLM 的实质评分。
- **空 learned_preference / risk_boundary → 零调整、零风险旗标**，严格保持既有行为（非回归）。
- 约定 2：每条调整都带可解释 rationale 与命中明细，由调用方落成 inferred Claim。
- 维度特异度与字段映射与 `agents/experience/match.py` 对齐（sub_sector>sector/产业链>stage/region）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

# —— 调参常量 ——
MAX_FIT_DELTA = 10.0          # 纯 learned 权重的最大单向 nudge（正/负对称）
ANTI_PREF_PENALTY = 10.0      # 命中一条反偏好（不喜欢的赛道/子赛道）的附加惩罚
MAX_TOTAL_DELTA = 20.0        # 合成 delta 的对称硬上限
NEUTRAL_WEIGHT = 0.5          # 权重中枢：>0.5 正偏好、<0.5 负偏好
DEFAULT_CONFIDENCE = 1.0      # WeightedItem.confidence 缺省视为满置信

# 维度 → learned_preference 权重表字段（对齐 match._DIMENSION_FIELD_PATH）
_DIMENSION_WEIGHT_FIELD: dict[str, str] = {
    "sector": "sector_weights",
    "sub_sector": "subsector_weights",
    "industry_chain_position": "industry_chain_position_weights",
    "stage": "stage_weights",
    "region": "region_weights",
}
# 维度特异度（对齐 match._DIMENSION_WEIGHT：越具体影响越大）
_DIMENSION_SPECIFICITY: dict[str, float] = {
    "sub_sector": 3.0,
    "sector": 2.0,
    "industry_chain_position": 2.0,
    "stage": 1.0,
    "region": 1.0,
}
_DIMENSION_LABEL: dict[str, str] = {
    "sector": "赛道",
    "sub_sector": "子赛道",
    "industry_chain_position": "产业链位置",
    "stage": "阶段",
    "region": "地域",
}


def _clamp(value: float, lo: float, hi: float) -> float:
    return lo if value < lo else hi if value > hi else value


def _clamp01(value: Any) -> float:
    try:
        return _clamp(float(value), 0.0, 1.0)
    except (TypeError, ValueError):
        return 0.0


def _normalize(value: Any) -> str:
    return str(value).strip().lower() if value not in (None, "") else ""


# ---------- WeightedItem 读取（兼容 dict 与对象） ----------

def _item_name(item: Any) -> str:
    if isinstance(item, Mapping):
        return str(item.get("name") or "")
    return str(getattr(item, "name", "") or "")


def _item_weight(item: Any) -> float:
    raw = item.get("weight") if isinstance(item, Mapping) else getattr(item, "weight", 0.0)
    return _clamp01(raw)


def _item_confidence(item: Any) -> float | None:
    raw = item.get("confidence") if isinstance(item, Mapping) else getattr(item, "confidence", None)
    return None if raw is None else _clamp01(raw)


def _weight_table(learned: Any, field_name: str) -> list:
    if learned is None:
        return []
    table = learned.get(field_name) if isinstance(learned, Mapping) else getattr(learned, field_name, None)
    return list(table) if table else []


def _match_item(items: Sequence[Any], value: Any) -> Any | None:
    """在权重表里找命中项：先规范化精确命中，再双向包含（口语 ↔ 规范名）。"""
    nv = _normalize(value)
    if not nv or not items:
        return None
    for it in items:
        if _normalize(_item_name(it)) == nv:
            return it
    for it in items:
        nin = _normalize(_item_name(it))
        if nin and (nin in nv or nv in nin):
            return it
    return None


# ---------- 反偏好读取 ----------

def _anti_list(anti: Any, field_name: str) -> list:
    if anti is None:
        return []
    raw = anti.get(field_name) if isinstance(anti, Mapping) else getattr(anti, field_name, None)
    return list(raw) if raw else []


def _in_list(values: Sequence[Any], probe: Any) -> str | None:
    np = _normalize(probe)
    if not np:
        return None
    for v in values:
        nv = _normalize(v)
        if nv and (nv == np or nv in np or np in nv):
            return str(v)
    return None


# ---------- 偏好影响结果 ----------

@dataclass
class MatchedDimension:
    dimension: str
    value: str
    matched_name: str
    weight: float
    confidence: float
    contribution: float

    def as_dict(self) -> dict:
        return {
            "dimension": self.dimension,
            "value": self.value,
            "matched_name": self.matched_name,
            "weight": round(self.weight, 4),
            "confidence": round(self.confidence, 4),
            "contribution": round(self.contribution, 4),
        }


@dataclass
class PreferenceInfluence:
    """一个候选/子赛道的有界匹配度调整 + 可解释命中明细。"""

    delta: float = 0.0
    matched: list[MatchedDimension] = field(default_factory=list)
    penalties: list[str] = field(default_factory=list)

    @property
    def changed(self) -> bool:
        return abs(self.delta) >= 0.01

    def adjust(self, base: Any) -> float:
        try:
            b = float(base)
        except (TypeError, ValueError):
            b = 0.0
        return round(_clamp(b + self.delta, 0.0, 100.0), 2)

    def positives(self) -> list[MatchedDimension]:
        return [m for m in self.matched if m.contribution > 0]

    def negatives(self) -> list[MatchedDimension]:
        return [m for m in self.matched if m.contribution < 0]

    def reason_text(self) -> str | None:
        """正向加成说明（调用方落成 inferred Claim 进 recommendation_reasons/highlights）。"""
        if self.delta <= 0:
            return None
        parts = [
            f"{_DIMENSION_LABEL.get(m.dimension, m.dimension)}『{m.matched_name}』(权重{m.weight:.2f})"
            for m in self.positives()
        ]
        if not parts:
            return None
        return "机构学习偏好加成：命中 " + "、".join(parts) + f"，匹配度 +{self.delta:.1f}"

    def risk_text(self) -> str | None:
        """负向（低权重/反偏好）说明（调用方落成 inferred Claim 进 initial_risks）。"""
        if self.delta >= 0 and not self.penalties:
            return None
        segs: list[str] = []
        neg = [
            f"{_DIMENSION_LABEL.get(m.dimension, m.dimension)}『{m.matched_name}』(权重{m.weight:.2f})"
            for m in self.negatives()
        ]
        if neg:
            segs.append("命中机构低权重维度 " + "、".join(neg))
        if self.penalties:
            segs.append("命中机构反偏好 " + "、".join(self.penalties))
        if not segs:
            return None
        return "机构学习偏好提示：" + "；".join(segs) + f"，匹配度 {self.delta:.1f}"

    def as_dict(self) -> dict:
        return {
            "delta": round(self.delta, 2),
            "matched": [m.as_dict() for m in self.matched],
            "penalties": list(self.penalties),
        }


def assess_preference_fit(
    learned_preference: Any,
    *,
    sector: Any = None,
    sub_sector: Any = None,
    stage: Any = None,
    region: Any = None,
    industry_chain_position: Any = None,
    anti_preference: Any = None,
) -> PreferenceInfluence:
    """据 learned_preference 五张权重表 + anti_preference，给一个候选/子赛道算有界匹配度调整。

    delta 为命中维度按特异度加权的「置信度缩放后平均偏好」(signed∈[-1,1]) × MAX_FIT_DELTA，
    再叠加反偏好惩罚，最后裁剪到 [-MAX_TOTAL_DELTA, MAX_TOTAL_DELTA]。
    无任何命中（含空 learned_preference）→ delta=0，调用方据此完全跳过。
    """
    dims = {
        "sector": sector,
        "sub_sector": sub_sector,
        "industry_chain_position": industry_chain_position,
        "stage": stage,
        "region": region,
    }
    matched: list[MatchedDimension] = []
    weighted_sum = 0.0
    spec_total = 0.0
    for dim, value in dims.items():
        if not value:
            continue
        table = _weight_table(learned_preference, _DIMENSION_WEIGHT_FIELD[dim])
        it = _match_item(table, value)
        if it is None:
            continue
        weight = _item_weight(it)
        conf = _item_confidence(it)
        conf = DEFAULT_CONFIDENCE if conf is None else conf
        spec = _DIMENSION_SPECIFICITY[dim]
        signed = (weight - NEUTRAL_WEIGHT) * 2.0  # [-1, 1]
        contribution = signed * conf * spec
        weighted_sum += contribution
        spec_total += spec
        matched.append(
            MatchedDimension(dim, _normalize(value), _item_name(it), weight, conf, contribution)
        )
    delta = (weighted_sum / spec_total) * MAX_FIT_DELTA if spec_total > 0 else 0.0

    penalties: list[str] = []
    hit_sector = _in_list(_anti_list(anti_preference, "disliked_sectors"), sector)
    if hit_sector:
        penalties.append(f"赛道『{hit_sector}』")
    hit_sub = _in_list(_anti_list(anti_preference, "disliked_subsectors"), sub_sector)
    if hit_sub:
        penalties.append(f"子赛道『{hit_sub}』")
    hit_stage = _in_list(_anti_list(anti_preference, "disliked_stages"), stage)
    if hit_stage:
        penalties.append(f"阶段『{hit_stage}』")
    hit_region = _in_list(_anti_list(anti_preference, "disliked_regions"), region)
    if hit_region:
        penalties.append(f"地域『{hit_region}』")
    if penalties:
        delta -= ANTI_PREF_PENALTY * len(penalties)

    delta = _clamp(delta, -MAX_TOTAL_DELTA, MAX_TOTAL_DELTA)
    return PreferenceInfluence(delta=round(delta, 2), matched=matched, penalties=penalties)


def _get(source: Any, field_name: str, default: Any = None) -> Any:
    if source is None:
        return default
    if isinstance(source, Mapping):
        return source.get(field_name, default)
    return getattr(source, field_name, default)


def _string_values(value: Any) -> list[str]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        text = str(item).strip() if item is not None else ""
        key = _normalize(text)
        if text and key not in seen:
            seen.add(key)
            out.append(text)
    return out


def _copy_learned(learned: Any) -> dict:
    if isinstance(learned, Mapping):
        return {str(k): list(v) if isinstance(v, list) else v for k, v in learned.items()}
    out: dict[str, Any] = {}
    if learned is None:
        return out
    for field_name in _DIMENSION_WEIGHT_FIELD.values():
        values = getattr(learned, field_name, None)
        if values:
            out[field_name] = list(values)
    return out


def _with_declared_positive_weights(learned: Any, declared: Any) -> Any:
    """把人工声明的正向偏好补进评分权重表，保留已有 learned_preference。"""
    declared_values = {
        "sector_weights": _string_values(_get(declared, "focus_sectors")),
        "stage_weights": _string_values(_get(declared, "focus_stages")),
        "region_weights": _string_values(_get(declared, "focus_regions")),
    }
    if not any(declared_values.values()):
        return learned

    out = _copy_learned(learned)
    for field_name, values in declared_values.items():
        table = list(out.get(field_name) or [])
        existing = {_normalize(_item_name(item)) for item in table}
        for value in values:
            key = _normalize(value)
            if key and key not in existing:
                table.append({"name": value, "weight": 1.0, "confidence": 1.0})
                existing.add(key)
        out[field_name] = table
    return out


def _copy_anti(anti: Any) -> dict:
    if isinstance(anti, Mapping):
        return {
            str(k): (list(v) if isinstance(v, list) else dict(v) if isinstance(v, Mapping) else v)
            for k, v in anti.items()
        }
    out: dict[str, Any] = {}
    if anti is None:
        return out
    for field_name in (
        "disliked_sectors",
        "disliked_subsectors",
        "disliked_stages",
        "disliked_regions",
        "disliked_risk_levels",
        "disliked_check_sizes",
        "disliked_custom_dimensions",
        "disliked_deal_patterns",
        "abandoned_similarity_penalty",
    ):
        value = getattr(anti, field_name, None)
        if value:
            out[field_name] = value
    return out


def _merge_unique_list(target: dict, field_name: str, values: list[str]) -> None:
    if not values:
        return
    current = _string_values(target.get(field_name))
    seen = {_normalize(item) for item in current}
    for value in values:
        key = _normalize(value)
        if key and key not in seen:
            current.append(value)
            seen.add(key)
    target[field_name] = current


def _with_declared_anti_preferences(anti: Any, declared: Any) -> Any:
    declared_lists = {
        "disliked_sectors": _string_values(_get(declared, "anti_focus_sectors")),
        "disliked_stages": _string_values(_get(declared, "anti_focus_stages")),
        "disliked_regions": _string_values(_get(declared, "anti_focus_regions")),
        "disliked_risk_levels": _string_values(_get(declared, "anti_risk_levels")),
        "disliked_check_sizes": _string_values(_get(declared, "anti_check_sizes")),
    }
    raw_custom = _get(declared, "anti_custom_dimensions") or {}
    custom = raw_custom if isinstance(raw_custom, Mapping) else {}
    has_declared_anti = any(declared_lists.values()) or any(custom.values())
    if not has_declared_anti:
        return anti

    out = _copy_anti(anti)
    for field_name, values in declared_lists.items():
        _merge_unique_list(out, field_name, values)

    if custom:
        current = out.get("disliked_custom_dimensions")
        current = dict(current) if isinstance(current, Mapping) else {}
        for label, values in custom.items():
            clean_values = _string_values(values)
            if not clean_values:
                continue
            merged = _string_values(current.get(label))
            seen = {_normalize(item) for item in merged}
            for value in clean_values:
                key = _normalize(value)
                if key and key not in seen:
                    merged.append(value)
                    seen.add(key)
            current[str(label)] = merged
        out["disliked_custom_dimensions"] = current
    return out


def extract_preference_blocks(preference: Any) -> tuple[Any, Any, dict]:
    """从偏好视图 dict / InvestmentPreference 取评分可读的偏好、反偏好和风险边界。

    learned_preference 仍是行为学习权重表；若当前生效偏好来自人工声明策略，则把声明的
    正向/负向维度补成权重表和 anti_preference，保证“偏好加分、反偏好减分”在推荐排序里
    生效，而不要求前端直接维护 learned_preference。
    """
    if preference is None:
        return None, None, {}
    if isinstance(preference, Mapping):
        declared = preference.get("declared_strategy")
        learned = _with_declared_positive_weights(preference.get("learned_preference"), declared)
        anti = _with_declared_anti_preferences(preference.get("anti_preference"), declared)
        return (
            learned,
            anti,
            preference.get("risk_boundary") or {},
        )
    declared = getattr(preference, "declared_strategy", None)
    learned = _with_declared_positive_weights(
        getattr(preference, "learned_preference", None), declared
    )
    anti = _with_declared_anti_preferences(
        getattr(preference, "anti_preference", None), declared
    )
    return (
        learned,
        anti,
        getattr(preference, "risk_boundary", None) or {},
    )


# ---------- 风险边界初筛 ----------

_LOW_TOLERANCE = {"low", "低", "保守", "敏感", "strict", "严格", "intolerant", "不接受", "零容忍"}
_RISK_DIM_KEYWORDS: dict[str, tuple[str, ...]] = {
    "valuation_sensitivity": ("估值", "valuation", "溢价", "偏高", "倍数", "pe", "ps"),
    "cash_burn": ("烧钱", "现金流", "亏损", "burn", "造血", "资金链"),
    "team_stability": ("团队", "创始人", "股东", "离职", "内斗", "核心成员", "高管"),
    "tech_maturity": ("技术路线", "量产", "试产", "工程化", "良率", "未验证", "技术风险"),
    "competition": ("竞争", "红海", "同质化", "巨头", "价格战", "对手"),
    "regulatory": ("合规", "政策", "监管", "牌照", "资质", "法规"),
    "market_size": ("市场空间", "天花板", "市场规模", "需求不足", "小众"),
    "customer_concentration": ("客户集中", "大客户", "单一客户", "依赖", "集中度"),
    "commercialization": ("商业化", "落地", "收入", "订单", "付费", "变现", "pmf"),
}
_RISK_DIM_LABEL: dict[str, str] = {
    "valuation_sensitivity": "估值敏感",
    "cash_burn": "现金消耗",
    "team_stability": "团队稳定性",
    "tech_maturity": "技术成熟度",
    "competition": "竞争格局",
    "regulatory": "合规监管",
    "market_size": "市场空间",
    "customer_concentration": "客户集中度",
    "commercialization": "商业化进度",
}


@dataclass
class RiskBoundaryFlag:
    dimension: str
    label: str
    tolerance: str
    matched_text: str

    @property
    def note(self) -> str:
        return (
            f"命中机构低容忍风险维度【{self.label}】（容忍度：{self.tolerance}）："
            f"{self.matched_text[:80]}"
        )

    def as_dict(self) -> dict:
        return {
            "dimension": self.dimension,
            "label": self.label,
            "tolerance": self.tolerance,
            "matched_text": self.matched_text,
        }


def _is_low_tolerance(value: Any) -> bool:
    nv = _normalize(value)
    return any(tok in nv for tok in _LOW_TOLERANCE) if nv else False


def screen_risk_boundary(risk_boundary: Any, risk_texts: Sequence[Any]) -> list[RiskBoundaryFlag]:
    """按机构 risk_boundary 的低容忍维度，扫描已识别风险文本，命中即旗标（确定性、可解释）。

    空 risk_boundary 或空风险文本 → 空旗标（保持既有行为）。未知维度（无关键词表）→ 不误报。
    每个维度最多旗标一次，避免刷屏。
    """
    if not risk_boundary or not isinstance(risk_boundary, Mapping):
        return []
    texts = [str(t) for t in risk_texts if t]
    if not texts:
        return []
    flags: list[RiskBoundaryFlag] = []
    for dim, tol in risk_boundary.items():
        if not _is_low_tolerance(tol):
            continue
        keywords = _RISK_DIM_KEYWORDS.get(dim)
        if not keywords:
            continue
        label = _RISK_DIM_LABEL.get(dim, dim)
        for text in texts:
            nt = _normalize(text)
            if any(kw in nt for kw in keywords):
                flags.append(RiskBoundaryFlag(dim, label, str(tol), text))
                break
    return flags
