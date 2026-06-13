"""load_preference / load_history 实装测试 —— 不连库。

覆盖：
- services.preferences.get_active：active 取最大 version、脏数据降级空偏好、无记录
- services.events.recent_history：租户过滤 + 事件类型白名单 + 轻量视图
- nodes.load_preference：校验 + 空字段剔除 + 脏数据兜底
- nodes.load_history：按赛道关键词过滤、行为统计头、条数上限、兜底路径
"""

from __future__ import annotations

import asyncio
import datetime as dt
import uuid

from sqlalchemy.dialects import postgresql

from app.agents.thesis_scout.nodes import load_history, load_preference
from app.models.models import DomainEvent, Preference
from app.services import preferences as preferences_service
from app.services.events import THESIS_HISTORY_EVENT_TYPES, recent_history

INST = uuid.uuid4()


# ---------- 假 Session：捕获 select 语句并返回预置行 ----------

class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return list(self._rows)


class _SelectSession:
    def __init__(self, rows):
        self.rows = rows
        self.statements: list[str] = []

    async def execute(self, stmt):
        self.statements.append(
            str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": False}))
        )
        return _Result(self.rows)


def _pref_row(payload, version=1):
    return Preference(id=uuid.uuid4(), institution_id=INST, version=version,
                      payload=payload, is_active=True)


def _event_row(event_type, payload, when):
    return DomainEvent(
        id=uuid.uuid4(), institution_id=INST, user_id=None, event_type=event_type,
        subject_type="thesis", subject_id=uuid.uuid4(), payload=payload, occurred_at=when,
    )


# ---------- services.preferences.get_active ----------

def test_get_active_returns_validated_payload():
    db = _SelectSession([_pref_row({"track_preferences": ["AI 硬件"], "stages": ["A"]})])
    out = asyncio.run(preferences_service.get_active(db, institution_id=INST))
    assert out["track_preferences"] == ["AI 硬件"]
    assert out["version"] == 1  # InvestmentPreference 默认字段补全
    # SQL 形状：active 过滤 + version 倒序 + limit 1
    [sql] = db.statements
    assert "is_active IS true" in sql and "ORDER BY preferences.version DESC" in sql

def test_get_active_no_row_returns_empty():
    assert asyncio.run(preferences_service.get_active(_SelectSession([]), institution_id=INST)) == {}

def test_get_active_dirty_payload_degrades_to_empty():
    db = _SelectSession([_pref_row({"track_preferences": "不是列表"})])
    assert asyncio.run(preferences_service.get_active(db, institution_id=INST)) == {}


# ---------- services.events.recent_history ----------

def test_recent_history_view_shape():
    when = dt.datetime(2026, 6, 1, 12, 0, 0)
    sid_row = _event_row("thesis.followed", {"track": "AI 硬件"}, when)
    db = _SelectSession([sid_row])
    [ev] = asyncio.run(recent_history(db, institution_id=INST))
    assert ev == {
        "event_type": "thesis.followed",
        "subject_type": "thesis",
        "subject_id": str(sid_row.subject_id),
        "occurred_at": "2026-06-01T12:00:00",
        "payload": {"track": "AI 硬件"},
    }
    [sql] = db.statements
    assert "event_type IN" in sql and "ORDER BY domain_events.occurred_at DESC" in sql

def test_history_event_types_cover_invalidation():
    # 经验沉淀的核心因子（被证伪判断）必须在回放白名单内
    assert "thesis.invalidated" in THESIS_HISTORY_EVENT_TYPES
    assert "thesis.created" in THESIS_HISTORY_EVENT_TYPES


# ---------- nodes.load_preference ----------

def test_load_preference_validates_and_prunes_empty_fields():
    state = {"preference_input": {"track_preferences": ["机器人"], "notes": None, "geographies": []}}
    out = asyncio.run(load_preference(state))
    assert out["preference"]["track_preferences"] == ["机器人"]
    assert "notes" not in out["preference"] and "geographies" not in out["preference"]

def test_load_preference_empty_and_dirty_inputs():
    assert asyncio.run(load_preference({}))["preference"] == {}
    assert asyncio.run(load_preference({"preference_input": {"stages": 42}}))["preference"] == {}


# ---------- nodes.load_history ----------

TRACK_DEF = {"name": "AI 硬件", "includes": ["边缘推理芯片"], "search_keywords": ["AI hardware"]}

def _ev(event_type="thesis.followed", track="AI 硬件", when="2026-06-01T00:00:00", **extra):
    payload = {"track": track, **extra}
    return {"event_type": event_type, "subject_type": "thesis", "subject_id": None,
            "occurred_at": when, "payload": payload}

def test_load_history_filters_by_track_and_prepends_stats():
    events = [
        _ev(track="AI 硬件", one_line_view="上游机会"),
        _ev(event_type="thesis.invalidated", track="消费电子", reason="边缘推理芯片成本未降"),  # includes 关键词命中
        _ev(event_type="thesis.created", track="医疗器械"),  # 不相关，应被过滤
    ]
    out = asyncio.run(load_history({"track_definition": TRACK_DEF, "history_events": events}))
    head, *rest = out["history"]
    assert head["同赛道历史条数"] == 2
    assert head["机构近期行为统计"] == {
        "thesis.followed": 1, "thesis.invalidated": 1, "thesis.created": 1,
    }
    assert [r["event"] for r in rest] == ["thesis.followed", "thesis.invalidated"]
    assert rest[0]["track"] == "AI 硬件" and rest[0]["one_line_view"] == "上游机会"
    assert rest[1]["reason"] == "边缘推理芯片成本未降"
    assert rest[0]["when"] == "2026-06-01"  # 日期粒度

def test_load_history_empty_and_no_trackdef():
    assert asyncio.run(load_history({"track_definition": TRACK_DEF}))["history"] == []
    # 无赛道定义：不过滤（兜底），但仍带统计头
    out = asyncio.run(load_history({"history_events": [_ev(track="任意")]}))
    assert out["history"][0]["同赛道历史条数"] == 1

def test_load_history_caps_view():
    events = [_ev(when=f"2026-05-{i:02d}T00:00:00") for i in range(1, 29)] * 3  # 84 条同赛道
    out = asyncio.run(load_history({"track_definition": TRACK_DEF, "history_events": events}))
    assert len(out["history"]) == 51  # 统计头 + 上限 50
