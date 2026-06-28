"""用户自建命名投资偏好卡片 —— 离线单元测试（不连库，假 Session）。

覆盖：
- PreferenceProfile schema：列表去空白去重、名称裁剪、空名拒绝
- 维度推荐：精选清单排除已选 / 限额 / 未知维度空；AI 合并优先与降级
- 服务层 create / update / 投影（假 Session 捕获 add/flush）
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from pydantic import ValidationError

from app.models.models import PreferenceProfileRow
from app.objects.preference_profile import (
    DIMENSION_LABELS,
    PROFILE_DIMENSIONS,
    PreferenceProfile,
)
from app.services import preference_profiles as profiles_service
from app.services import preference_recommendations as rec_service

INST = uuid.uuid4()
USER = uuid.uuid4()


# ----------------------------- Schema -----------------------------

def test_profile_schema_cleans_lists_and_name():
    p = PreferenceProfile(
        name="  硬科技  ",
        sectors=[" 半导体 ", "半导体", "", "人工智能"],
        anti_sectors=[" 太阳能 ", "太阳能", ""],
        stages=["A 轮"],
        supplemental_notes=[" 优先参考产业资源协同 ", "优先参考产业资源协同", ""],
        custom_dimensions=[
            {
                "key": "team",
                "label": "团队背景",
                "values": [" 科研背景 ", "科研背景", ""],
                "anti_values": ["纯销售背景", " 纯销售背景 "],
            },
            {"key": "team", "label": "重复维度", "values": ["不应保留"]},
        ],
    )
    assert p.name == "硬科技"  # 裁剪
    assert p.sectors == ["半导体", "人工智能"]  # 去空白去重保序
    assert p.anti_sectors == ["太阳能"]
    assert p.stages == ["A 轮"]
    assert p.regions == [] and p.risk_levels == [] and p.check_sizes == []
    assert p.supplemental_notes == ["优先参考产业资源协同"]
    assert len(p.custom_dimensions) == 1
    assert p.custom_dimensions[0].label == "团队背景"
    assert p.custom_dimensions[0].values == ["科研背景"]
    assert p.custom_dimensions[0].anti_values == ["纯销售背景"]


def test_profile_schema_rejects_empty_name():
    with pytest.raises(ValidationError):
        PreferenceProfile(name="   ")  # 纯空白裁剪后为空
    with pytest.raises(ValidationError):
        PreferenceProfile(name="")  # 长度不足


def test_profile_schema_promotes_legacy_notes():
    p = PreferenceProfile(name="旧偏好", notes="看重产业资源")
    assert p.supplemental_notes == ["看重产业资源"]


def test_dimensions_metadata_consistent():
    assert set(PROFILE_DIMENSIONS) == set(DIMENSION_LABELS)
    for d in PROFILE_DIMENSIONS:
        assert rec_service.CURATED_RECOMMENDATIONS.get(d), f"维度 {d} 缺精选清单"


# --------------------------- 维度推荐 ---------------------------

def test_recommend_excludes_existing_and_limits():
    out = rec_service.recommend_dimension_values("sectors", existing=["人工智能"], limit=3)
    assert "人工智能" not in out
    assert len(out) == 3
    expected = [v for v in rec_service.CURATED_RECOMMENDATIONS["sectors"] if v != "人工智能"][:3]
    assert out == expected


def test_recommend_unknown_dimension_empty():
    assert rec_service.recommend_dimension_values("不存在的维度") == []


def test_merge_ai_priority_dedupe_exclude():
    merged = rec_service._merge(
        ["人工智能", " 人工智能 ", "半导体"], ["半导体", "新能源"], ["新能源"], 6
    )
    # 去重保序 -> [人工智能, 半导体, 新能源]；排除已选 新能源 -> [人工智能, 半导体]
    assert merged == ["人工智能", "半导体"]


def test_ai_recommend_success(monkeypatch):
    async def fake_cs(tier, messages, schema, **kw):
        return rec_service._DimensionSuggestion(values=["合成生物", "脑机接口", "人工智能"])

    monkeypatch.setattr(rec_service.llm_client, "complete_structured", fake_cs)
    values, source = asyncio.run(
        rec_service.ai_recommend_dimension_values(
            "sectors", name="硬科技", existing=["人工智能"], limit=5
        )
    )
    assert source == "ai"
    assert "人工智能" not in values  # 已选被排除
    assert values[0] == "合成生物"  # AI 候选优先
    assert "脑机接口" in values


def test_ai_recommend_fallback_on_error(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("无可用 LLM key")

    monkeypatch.setattr(rec_service.llm_client, "complete_structured", boom)
    values, source = asyncio.run(
        rec_service.ai_recommend_dimension_values("stages", existing=[], limit=4)
    )
    assert source == "curated"
    assert values == rec_service.recommend_dimension_values("stages", limit=4)


def test_ai_recommend_unknown_dimension_skips_llm(monkeypatch):
    called = {"n": 0}

    async def cs(*a, **k):
        called["n"] += 1
        return rec_service._DimensionSuggestion(values=["x"])

    monkeypatch.setattr(rec_service.llm_client, "complete_structured", cs)
    values, source = asyncio.run(rec_service.ai_recommend_dimension_values("不存在"))
    assert values == [] and source == "curated"
    assert called["n"] == 0  # 未知维度不调用 LLM


# --------------------------- 服务层 ---------------------------

class _FakeDb:
    """捕获 add/flush 的假 Session（create/update 不需要 execute）。"""

    def __init__(self):
        self.added: list = []
        self.flushed = 0

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()  # 模拟库端默认主键

    async def flush(self):
        self.flushed += 1


def test_create_profile_persists_clean_payload():
    prof = PreferenceProfile(
        name="硬科技",
        sectors=["半导体", "半导体", " 人工智能 "],
        anti_sectors=["太阳能", "太阳能"],
    )
    db = _FakeDb()
    row = asyncio.run(
        profiles_service.create_profile(
            db, institution_id=INST, created_by=USER, profile=prof
        )
    )
    assert row.name == "硬科技"
    assert row.institution_id == INST and row.created_by == USER
    assert row.archived is False
    assert row.payload["sectors"] == ["半导体", "人工智能"]
    assert row.payload["anti_sectors"] == ["太阳能"]
    assert db.added == [row] and db.flushed == 1


def test_update_profile_overwrites_and_flushes():
    row = PreferenceProfileRow(
        institution_id=INST, name="旧名", archived=False, payload={"name": "旧名"}
    )
    row.id = uuid.uuid4()
    prof = PreferenceProfile(name="新名", stages=["A 轮", "B 轮"])
    db = _FakeDb()
    out = asyncio.run(profiles_service.update_profile(db, row=row, profile=prof))
    assert out.name == "新名"
    assert out.payload["stages"] == ["A 轮", "B 轮"]
    assert db.flushed == 1


def test_archive_profile_marks_row_archived():
    row = PreferenceProfileRow(
        institution_id=INST,
        name="AI 早期",
        archived=False,
        payload={"name": "AI 早期", "sectors": ["人工智能"]},
    )
    row.id = uuid.uuid4()
    db = _FakeDb()

    out = asyncio.run(profiles_service.archive_profile(db, row=row))

    assert out.archived is True
    assert db.flushed == 1


def test_profile_matches_query_covers_core_and_custom_dimensions():
    row = PreferenceProfileRow(
        institution_id=INST,
        name="AI 早期",
        archived=False,
        payload={
            "name": "AI 早期",
            "sectors": ["人工智能"],
            "anti_sectors": ["太阳能"],
            "stages": ["Pre-A"],
            "regions": ["华东"],
            "risk_levels": ["中高风险"],
            "check_sizes": ["1000-3000万"],
            "custom_dimensions": [
                {
                    "key": "team",
                    "label": "团队背景",
                    "values": ["科研背景"],
                    "anti_values": ["纯销售背景"],
                }
            ],
            "supplemental_notes": ["优先参考产业资源协同"],
            "notes": "关注硬科技上游",
        },
    )

    assert profiles_service.profile_matches_query(row, "AI早期")
    assert profiles_service.profile_matches_query(row, "科研背景")
    assert profiles_service.profile_matches_query(row, "太阳能")
    assert profiles_service.profile_matches_query(row, "纯销售背景")
    assert profiles_service.profile_matches_query(row, "产业资源协同")
    assert profiles_service.profile_matches_query(row, "1000 3000万")
    assert profiles_service.profile_matches_query(row, "硬科技")
    assert not profiles_service.profile_matches_query(row, "消费连锁")


def test_profile_projections():
    row = PreferenceProfileRow(
        institution_id=INST,
        name="均衡型",
        archived=False,
        payload={
            "name": "均衡型",
            "sectors": ["人工智能"],
            "anti_sectors": ["太阳能"],
            "stages": [],
            "regions": ["北京"],
            "risk_levels": [],
            "check_sizes": [],
            "custom_dimensions": [
                {
                    "key": "team",
                    "label": "团队背景",
                    "values": ["科研背景"],
                    "anti_values": ["纯销售背景"],
                }
            ],
            "supplemental_notes": ["优先参考产业资源协同"],
            "notes": "备注",
        },
    )
    row.id = uuid.uuid4()
    row.created_at = None
    row.updated_at = None

    summary = profiles_service.profile_summary(row)
    assert summary["name"] == "均衡型"
    assert summary["sectors"] == ["人工智能"] and summary["regions"] == ["北京"]
    assert summary["anti_sectors"] == ["太阳能"]
    assert summary["custom_dimensions"][0]["label"] == "团队背景"
    assert summary["custom_dimensions"][0]["anti_values"] == ["纯销售背景"]
    assert summary["supplemental_notes"] == ["优先参考产业资源协同"]
    assert summary["created_at"] is None  # 容空

    detail = profiles_service.profile_detail(row)
    assert detail["archived"] is False
    assert detail["profile"]["name"] == "均衡型"
    assert detail["profile"]["custom_dimensions"][0]["values"] == ["科研背景"]
    assert detail["profile"]["custom_dimensions"][0]["anti_values"] == ["纯销售背景"]
    assert detail["profile"]["supplemental_notes"] == ["优先参考产业资源协同"]
    assert detail["profile"]["notes"] == "备注"


def test_profile_to_investment_preference_payload():
    prof = PreferenceProfile(
        name="AI 早期",
        sectors=["人工智能", "电池"],
        anti_sectors=["太阳能"],
        stages=["Pre-A"],
        anti_stages=["Pre-IPO"],
        regions=["中国"],
        anti_regions=["海外"],
        risk_levels=["高风险"],
        anti_risk_levels=["低风险"],
        check_sizes=["1000-3000万"],
        anti_check_sizes=["1 亿以上"],
        custom_dimensions=[
            {
                "key": "team",
                "label": "团队背景",
                "values": ["科研背景"],
                "anti_values": ["纯销售背景"],
            }
        ],
        supplemental_notes=["优先参考产业资源协同", "不追逐短期热点"],
        notes="重点看上游",
    )
    payload = profiles_service.profile_to_investment_preference(prof)
    assert payload["name"] == "AI 早期"
    assert payload["track_preferences"] == ["人工智能", "电池"]
    assert payload["excluded_tracks"] == ["太阳能"]
    assert payload["anti_preference"]["disliked_sectors"] == ["太阳能"]
    assert payload["anti_preference"]["disliked_stages"] == ["Pre-IPO"]
    assert payload["anti_preference"]["disliked_regions"] == ["海外"]
    assert payload["anti_preference"]["disliked_custom_dimensions"] == {"团队背景": ["纯销售背景"]}
    assert payload["learned_preference"]["sector_weights"][0]["name"] == "人工智能"
    assert payload["declared_strategy"]["focus_stages"] == ["Pre-A"]
    assert payload["declared_strategy"]["anti_focus_stages"] == ["Pre-IPO"]
    assert payload["declared_strategy"]["custom_dimensions"] == {"团队背景": ["科研背景"]}
    assert payload["declared_strategy"]["anti_custom_dimensions"] == {"团队背景": ["纯销售背景"]}
    assert payload["declared_strategy"]["supplemental_notes"] == ["优先参考产业资源协同", "不追逐短期热点"]
    assert payload["supplemental_notes"] == ["优先参考产业资源协同", "不追逐短期热点"]
    assert payload["notes"] == "优先参考产业资源协同\n不追逐短期热点"
    assert payload["risk_appetite"] == "高风险"
    assert payload["check_size"] == "1000-3000万"
