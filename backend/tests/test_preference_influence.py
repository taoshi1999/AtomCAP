"""经验沉淀「反哺」层（路线第 9 步）单元 + 集成测试 —— 纯函数、不连网关、不连库。

覆盖：
- assess_preference_fit：空偏好零调整（非回归底线）、正/负/中性权重、置信度缩放、
  多维特异度加权平均、未命中零调、有界裁剪、反偏好惩罚、规范化/包含匹配、默认置信
- PreferenceInfluence.adjust 裁剪 [0,100]、reason_text/risk_text、as_dict
- extract_preference_blocks：dict / None / 对象
- screen_risk_boundary：空边界/空文本、低容忍命中、高容忍不命中、未知维度不误报、按维度去重
- 三 Agent 反哺 hook：thesis 子赛道重排 + 微调；deal_sourcing 候选微调/重排/分层/旗标；
  deal_intake analysis overall_fit 微调 + 风险初筛 —— 全部「空偏好恒等」（非回归守卫）
"""

from __future__ import annotations

import app.agents.experience.influence as inf
from app.agents.experience.influence import (
    ANTI_PREF_PENALTY,
    MAX_FIT_DELTA,
    PreferenceInfluence,
    assess_preference_fit,
    extract_preference_blocks,
    screen_risk_boundary,
)
from tests.test_agent_runner import _fit


def _learned(**tables):
    """构造 learned_preference dict：subsector_weights=[("储能PCS", 0.9, 1.0)] → 标准结构。"""
    return {
        field_name: [{"name": n, "weight": w, "confidence": c} for (n, w, c) in items]
        for field_name, items in tables.items()
    }


# ---------- assess_preference_fit ----------

def test_empty_learned_is_noop():
    infl = assess_preference_fit(None, sub_sector="储能PCS", sector="储能")
    assert infl.delta == 0.0 and not infl.changed and infl.matched == []


def test_empty_dict_learned_is_noop():
    infl = assess_preference_fit({}, sub_sector="储能PCS")
    assert infl.delta == 0.0 and not infl.changed


def test_strong_positive_single_dim_full_delta():
    learned = _learned(subsector_weights=[("储能PCS", 1.0, 1.0)])
    infl = assess_preference_fit(learned, sub_sector="储能PCS")
    assert infl.delta == MAX_FIT_DELTA  # (1-0.5)*2*1*3 / 3 *10 = 10
    assert infl.changed and infl.matched[0].dimension == "sub_sector"


def test_strong_negative_single_dim():
    learned = _learned(subsector_weights=[("储能PCS", 0.0, 1.0)])
    assert assess_preference_fit(learned, sub_sector="储能PCS").delta == -MAX_FIT_DELTA


def test_neutral_weight_zero_delta():
    learned = _learned(sector_weights=[("储能", 0.5, 1.0)])
    infl = assess_preference_fit(learned, sector="储能")
    assert infl.delta == 0.0 and infl.matched and not infl.changed


def test_confidence_scales_delta():
    learned = _learned(subsector_weights=[("储能PCS", 1.0, 0.5)])
    assert assess_preference_fit(learned, sub_sector="储能PCS").delta == MAX_FIT_DELTA * 0.5


def test_multi_dim_specificity_weighted_average():
    # sub_sector(spec3,w1→+1) 与 stage(spec1,w0→-1)：weighted_sum=2, spec_total=4 → 2/4*10=5
    learned = _learned(
        subsector_weights=[("储能PCS", 1.0, 1.0)],
        stage_weights=[("A轮", 0.0, 1.0)],
    )
    infl = assess_preference_fit(learned, sub_sector="储能PCS", stage="A轮")
    assert infl.delta == 5.0 and len(infl.matched) == 2


def test_no_match_in_table_zero_delta():
    learned = _learned(subsector_weights=[("光伏", 1.0, 1.0)])
    infl = assess_preference_fit(learned, sub_sector="储能PCS")
    assert infl.delta == 0.0 and not infl.changed


def test_normalized_and_containment_match():
    learned = _learned(subsector_weights=[("储能pcs", 0.9, 1.0)])
    infl = assess_preference_fit(learned, sub_sector="储能PCS系统")  # 大小写 + 包含
    assert infl.changed and infl.matched[0].matched_name == "储能pcs"


def test_default_confidence_when_none():
    learned = {"subsector_weights": [{"name": "储能PCS", "weight": 1.0}]}  # 无 confidence
    assert assess_preference_fit(learned, sub_sector="储能PCS").delta == MAX_FIT_DELTA


def test_anti_preference_penalty():
    anti = {"disliked_subsectors": ["社区团购"]}
    infl = assess_preference_fit(None, sub_sector="社区团购", anti_preference=anti)
    assert infl.penalties and infl.delta == -ANTI_PREF_PENALTY


def test_anti_preference_penalty_supports_stage_and_region():
    anti = {"disliked_stages": ["Pre-IPO"], "disliked_regions": ["海外"]}
    infl = assess_preference_fit(None, stage="Pre-IPO", region="海外", anti_preference=anti)
    assert infl.delta == -ANTI_PREF_PENALTY * 2
    assert "阶段『Pre-IPO』" in infl.penalties
    assert "地域『海外』" in infl.penalties


def test_anti_preference_stacks_with_learned():
    learned = _learned(sector_weights=[("消费", 1.0, 1.0)])
    anti = {"disliked_subsectors": ["社区团购"]}
    infl = assess_preference_fit(
        learned, sector="消费", sub_sector="社区团购", anti_preference=anti
    )
    assert infl.delta == 0.0 and infl.penalties  # sector +10 抵消 反偏好 -10


def test_delta_clamped_to_max_total():
    learned = _learned(subsector_weights=[("x", 0.0, 1.0)])
    anti = {"disliked_sectors": ["a"], "disliked_subsectors": ["x"]}
    infl = assess_preference_fit(learned, sector="a", sub_sector="x", anti_preference=anti)
    assert infl.delta == -inf.MAX_TOTAL_DELTA  # -10 -20 → 裁剪到 -20


# ---------- PreferenceInfluence helpers ----------

def test_adjust_clamps_high():
    assert PreferenceInfluence(delta=10.0).adjust(95) == 100.0


def test_adjust_clamps_low():
    assert PreferenceInfluence(delta=-10.0).adjust(3) == 0.0


def test_adjust_normal():
    assert PreferenceInfluence(delta=6.4).adjust(70) == 76.4


def test_reason_text_positive_only():
    learned = _learned(subsector_weights=[("储能PCS", 1.0, 1.0)])
    infl = assess_preference_fit(learned, sub_sector="储能PCS")
    rt = infl.reason_text()
    assert rt and "加成" in rt and "储能PCS" in rt
    assert infl.risk_text() is None


def test_risk_text_negative():
    learned = _learned(subsector_weights=[("储能PCS", 0.0, 1.0)])
    infl = assess_preference_fit(learned, sub_sector="储能PCS")
    assert infl.reason_text() is None and "提示" in infl.risk_text()


def test_as_dict_serializable():
    learned = _learned(subsector_weights=[("储能PCS", 0.9, 0.8)])
    d = assess_preference_fit(learned, sub_sector="储能PCS").as_dict()
    assert set(d) == {"delta", "matched", "penalties"}
    assert d["matched"][0]["dimension"] == "sub_sector"


# ---------- extract_preference_blocks ----------

def test_extract_blocks_from_dict():
    pref = {
        "learned_preference": {"sector_weights": []},
        "anti_preference": {"x": 1},
        "risk_boundary": {"a": "low"},
    }
    assert extract_preference_blocks(pref) == ({"sector_weights": []}, {"x": 1}, {"a": "low"})


def test_extract_blocks_promotes_declared_strategy_to_scoring_blocks():
    pref = {
        "declared_strategy": {
            "focus_sectors": ["新能源"],
            "focus_stages": ["A 轮"],
            "anti_focus_sectors": ["太阳能"],
            "anti_focus_regions": ["海外"],
        },
        "risk_boundary": {},
    }
    learned, anti, rb = extract_preference_blocks(pref)
    assert learned["sector_weights"] == [{"name": "新能源", "weight": 1.0, "confidence": 1.0}]
    assert learned["stage_weights"] == [{"name": "A 轮", "weight": 1.0, "confidence": 1.0}]
    assert anti["disliked_sectors"] == ["太阳能"]
    assert anti["disliked_regions"] == ["海外"]
    assert rb == {}


def test_declared_positive_and_anti_affect_fit_together():
    pref = {
        "declared_strategy": {
            "focus_sectors": ["新能源"],
            "anti_focus_sectors": ["太阳能"],
        }
    }
    learned, anti, _ = extract_preference_blocks(pref)
    positive = assess_preference_fit(learned, sector="新能源", anti_preference=anti)
    negative = assess_preference_fit(learned, sector="太阳能", anti_preference=anti)
    assert positive.delta == MAX_FIT_DELTA
    assert negative.delta == -ANTI_PREF_PENALTY


def test_extract_blocks_none():
    assert extract_preference_blocks(None) == (None, None, {})


def test_extract_blocks_object():
    class P:
        learned_preference = {"sector_weights": []}
        anti_preference = None
        risk_boundary = {"a": "low"}

    learned, anti, rb = extract_preference_blocks(P())
    assert learned and anti is None and rb == {"a": "low"}


# ---------- screen_risk_boundary ----------

def test_screen_empty_boundary():
    assert screen_risk_boundary({}, ["估值偏高"]) == []


def test_screen_empty_texts():
    assert screen_risk_boundary({"valuation_sensitivity": "low"}, []) == []


def test_screen_low_tolerance_hit():
    flags = screen_risk_boundary({"valuation_sensitivity": "low"}, ["本轮估值偏高，存在溢价"])
    assert len(flags) == 1 and flags[0].dimension == "valuation_sensitivity"
    assert "估值敏感" in flags[0].note


def test_screen_high_tolerance_no_flag():
    assert screen_risk_boundary({"valuation_sensitivity": "high"}, ["估值偏高"]) == []


def test_screen_unknown_dimension_no_flag():
    assert screen_risk_boundary({"unknown_dim": "low"}, ["估值偏高"]) == []


def test_screen_dedup_per_dimension():
    flags = screen_risk_boundary({"valuation_sensitivity": "敏感"}, ["估值偏高", "估值倍数过大"])
    assert len(flags) == 1  # 每维度只旗标一次


def test_screen_chinese_low_token():
    flags = screen_risk_boundary({"team_stability": "低"}, ["创始团队近期有核心成员离职"])
    assert len(flags) == 1 and flags[0].dimension == "team_stability"


# ---------- thesis_scout hook ----------

from app.agents.thesis_scout.nodes import apply_learned_preference_to_sub_directions


def _subdir(name, total, stage="A轮"):
    return {"name": name, "suitable_stage": stage, "fit_score": {"total": total}}


def test_thesis_empty_pref_identity():
    subs = [_subdir("A", 90), _subdir("B", 50), _subdir("C", 30)]
    out = apply_learned_preference_to_sub_directions(subs, {}, {"name": "储能"})
    assert out == subs  # 完全恒等（顺序、内容不变）


def test_thesis_learned_reranks_and_adjusts():
    subs = [_subdir("储能EMS", 60), _subdir("储能PCS", 55)]
    pref = {"learned_preference": _learned(subsector_weights=[("储能PCS", 1.0, 1.0)])}
    out = apply_learned_preference_to_sub_directions(subs, pref, {"name": "储能"})
    assert out[0]["name"] == "储能PCS" and out[0]["fit_score"]["total"] == 65
    assert "preference_influence" in out[0]
    ems = next(s for s in out if s["name"] == "储能EMS")
    assert ems["fit_score"]["total"] == 60 and "preference_influence" not in ems


# ---------- deal_sourcing hook ----------

from app.agents.deal_sourcing.nodes import apply_learned_preference_to_candidates


def _cand(name, sub, score, tier="watch", risks=None):
    return {
        "company_name": name, "sub_direction": sub, "initial_score": score,
        "recommendation_tier": tier, "recommendation_reasons": [], "initial_risks": risks or [],
    }


def test_ds_empty_pref_identity():
    cands = [_cand("光羽", "AI眼镜", 70)]
    assert apply_learned_preference_to_candidates(cands, {}, {}) == cands


def test_ds_learned_boosts_and_retiers():
    cands = [_cand("光羽", "AI眼镜光学模组", 72, "watch")]
    pref = {"learned_preference": _learned(subsector_weights=[("AI眼镜光学模组", 1.0, 1.0)])}
    out = apply_learned_preference_to_candidates(cands, pref, {})
    assert out[0]["initial_score"] == 82.0 and out[0]["recommendation_tier"] == "strong"
    assert any("加成" in r["text"] for r in out[0]["recommendation_reasons"])
    assert out[0]["recommendation_reasons"][-1]["inferred"] is True


def test_ds_risk_boundary_flags():
    cands = [_cand("光羽", "AI眼镜", 70,
                   risks=[{"text": "本轮估值偏高", "evidence_ids": [], "inferred": True}])]
    pref = {"risk_boundary": {"valuation_sensitivity": "low"}}
    out = apply_learned_preference_to_candidates(cands, pref, {})
    assert any("估值敏感" in r["text"] for r in out[0]["initial_risks"])
    assert out[0]["risk_boundary_flags"]


def test_ds_anti_pref_penalty_claim():
    cands = [_cand("某团购", "社区团购", 70)]
    pref = {"anti_preference": {"disliked_subsectors": ["社区团购"]}}
    out = apply_learned_preference_to_candidates(cands, pref, {})
    assert out[0]["initial_score"] == 60.0
    assert any("反偏好" in r["text"] for r in out[0]["initial_risks"])


# ---------- deal_intake hook ----------

from app.agents.deal_intake.nodes import _apply_learned_preference_to_analysis
from app.objects.deal import DealAnalysis
from app.objects.thesis import FitScoreBreakdown


def _analysis(overall=72, total=72, risks=None):
    return DealAnalysis(
        portrait="一家储能PCS公司",
        track_judgement="储能",
        fit_score=FitScoreBreakdown(**{**_fit(), "total": total}),
        overall_fit=overall,
        initial_risks=[{"text": t, "evidence_ids": [], "inferred": True} for t in (risks or [])],
    )


def test_di_empty_pref_identity():
    a = _analysis()
    _apply_learned_preference_to_analysis(a, {"track": "储能", "sub_direction": "储能PCS"}, {})
    assert a.overall_fit == 72 and not a.highlights and not a.initial_risks


def test_di_learned_boosts_overall_and_fit_total():
    a = _analysis(overall=72, total=72)
    pref = {"learned_preference": _learned(subsector_weights=[("储能PCS", 1.0, 1.0)])}
    _apply_learned_preference_to_analysis(a, {"track": "储能", "sub_direction": "储能PCS"}, pref)
    assert a.overall_fit == 82 and a.fit_score.total == 82
    assert any("加成" in c.text for c in a.highlights)


def test_di_risk_boundary_flag_on_valuation():
    a = _analysis(risks=["本轮估值偏高"])
    pref = {"risk_boundary": {"valuation_sensitivity": "low"}}
    _apply_learned_preference_to_analysis(a, {"valuation": "30亿"}, pref)
    assert any("估值敏感" in c.text for c in a.initial_risks)


def test_di_negative_learned_adds_risk_claim():
    a = _analysis()
    pref = {"learned_preference": _learned(subsector_weights=[("储能PCS", 0.0, 1.0)])}
    _apply_learned_preference_to_analysis(a, {"sub_direction": "储能PCS"}, pref)
    assert a.overall_fit == 62 and any("提示" in c.text for c in a.initial_risks)
