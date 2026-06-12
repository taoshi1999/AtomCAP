"""Thesis Schema 契约测试 —— 验证设计文档字段表与校验逻辑。"""

import uuid

import pytest
from pydantic import ValidationError

from app.objects import SCHEMA_REGISTRY, DeliverableType
from app.objects.base import Claim
from app.objects.thesis import Thesis, ThesisStatus


def make_fit(total: float = 82.0) -> dict:
    return {
        "track_preference": 90, "stage_match": 80, "moat_match": 75, "geo_match": 70,
        "risk_appetite_match": 85, "history_similarity": 60, "exclusion_penalty": 0,
        "total": total, "rationale": "偏好高度重合，阶段匹配",
    }


def make_sub(name: str) -> dict:
    return {
        "name": name,
        "detail": f"{name}详情",
        "investment_reasons": [{"text": "供应链确定性强", "evidence_ids": [str(uuid.uuid4())]}],
        "suitable_stage": "A轮",
        "fit_score": make_fit(),
    }


def make_thesis(n_subs: int = 3) -> dict:
    return {
        "thesis_name": "AI 硬件",
        "one_line_view": "AI 硬件正在从终端概念验证进入供应链环节分化阶段。",
        "opportunity_level": "高",
        "risk_level": "中高",
        "advice": "重点关注上游组件和端侧计算方向",
        "sub_directions": [make_sub(f"子赛道{i}") for i in range(n_subs)],
        "investment_reason": [{"text": "与机构硬科技偏好匹配", "evidence_ids": [str(uuid.uuid4())]}],
        "institution_fit_score": make_fit(),
        "value_chain": {"upstream": [{"name": "芯片"}], "midstream": [], "downstream": []},
        "key_risks": [{"text": "终端需求可能被高估", "inferred": True}],
    }


def test_valid_thesis_passes():
    t = Thesis.model_validate(make_thesis())
    assert t.status == ThesisStatus.DRAFT
    assert len(t.recommended_actions) == 4  # 设计文档规定的四个下一步操作


def test_sub_directions_must_be_3_to_7():
    """设计文档 Step 5：子赛道 3–7 个，不要太多。"""
    with pytest.raises(ValidationError):
        Thesis.model_validate(make_thesis(n_subs=2))
    with pytest.raises(ValidationError):
        Thesis.model_validate(make_thesis(n_subs=8))


def test_key_risks_required():
    """风险点必须有，否则像销售材料。"""
    payload = make_thesis()
    payload["key_risks"] = []
    with pytest.raises(ValidationError):
        Thesis.model_validate(payload)


def test_claim_without_evidence_marked_inferred():
    """无证据支撑的结论必须自动标记为模型推断 —— 证据链承诺的底线。"""
    c = Claim(text="某个没有证据的判断")
    assert c.inferred is True
    c2 = Claim(text="有证据的判断", evidence_ids=[uuid.uuid4()])
    assert c2.inferred is False


def test_registry_covers_thesis():
    assert SCHEMA_REGISTRY[DeliverableType.THESIS] is Thesis
