"""会话历史列表单元测试（不连库、不连网关）。

覆盖会话历史窗口（GET /api/conversations）与首页「最近会话」共用的口径：
- preview_from_content：块数组 -> 80 字预览（object_ref 计占位符）/ 空 -> None
- project_conversations 纯函数：关键词过滤、最后活跃时间倒序、分页、标题兜底、空输入
- list_conversation_summaries 异步壳：把 DB 读取与纯投影正确串起来（monkeypatch DB 层）
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

import app.services.conversations as conv_svc
from app.services.conversations import (
    CONVERSATION_TITLE_FALLBACK,
    ConversationRecord,
    list_conversation_summaries,
    normalize_conversation_type,
    preview_from_content,
    project_conversations,
)


def _run(coro):
    return asyncio.run(coro)


def _record(
    *,
    title=None,
    last=None,
    updated=None,
    preview=None,
    rid=None,
    conversation_type="normal",
    source_deal_id=None,
) -> ConversationRecord:
    return ConversationRecord(
        id=rid or uuid.uuid4(),
        title=title,
        updated_at=updated or datetime(2026, 6, 1, 0, 0, 0),
        last_message_at=last,
        preview=preview,
        conversation_type=conversation_type,
        source_deal_id=source_deal_id,
    )


# ---------- preview_from_content ----------

def test_preview_truncates_to_limit():
    preview = preview_from_content([{"type": "text", "text": "市" * 200}])
    assert preview is not None and len(preview) == 80


def test_preview_empty_blocks_is_none():
    assert preview_from_content([]) is None
    assert preview_from_content([{"type": "text", "text": ""}]) is None


def test_preview_includes_object_ref_placeholder():
    assert preview_from_content([{"type": "object_ref", "deliverable_id": "abc"}]) == "[交付对象 abc]"


def test_preview_includes_deal_ref_placeholder():
    assert preview_from_content([{"type": "deal_ref", "deal_id": "deal-1"}]) == "[项目工作台 deal-1]"


# ---------- project_conversations：排序 ----------

def test_orders_by_last_activity_desc_with_updated_fallback():
    a = _record(title="A", last=datetime(2026, 6, 10), updated=datetime(2026, 6, 1))
    b = _record(title="B", last=None, updated=datetime(2026, 6, 15))
    c = _record(title="C", last=datetime(2026, 6, 12), updated=datetime(2026, 6, 5))
    items, total = project_conversations([a, b, c])
    assert total == 3
    assert [it["title"] for it in items] == ["B", "C", "A"]
    assert items[0]["updated_at"] == datetime(2026, 6, 15).isoformat()


def test_tie_breaks_are_deterministic():
    ts = datetime(2026, 6, 10)
    ids = [uuid.UUID(int=1), uuid.UUID(int=2), uuid.UUID(int=3)]
    recs = [_record(title=f"T{i}", last=ts, rid=ids[i]) for i in range(3)]
    first = project_conversations(list(recs))[0]
    second = project_conversations(list(reversed(recs)))[0]
    assert [it["id"] for it in first] == [it["id"] for it in second]


# ---------- 标题兜底 / 预览透传 ----------

def test_title_fallback_when_blank():
    items, _ = project_conversations([_record(title=None), _record(title="")])
    assert all(it["title"] == CONVERSATION_TITLE_FALLBACK for it in items)


def test_preview_passthrough():
    items, _ = project_conversations([_record(title="X", preview="你好世界")])
    assert items[0]["preview"] == "你好世界"


# ---------- 关键词过滤 ----------

def test_projection_includes_fixed_conversation_metadata():
    deal_id = uuid.uuid4()
    items, _ = project_conversations(
        [
            _record(
                title="project workspace",
                conversation_type="project_workspace",
                source_deal_id=deal_id,
            )
        ]
    )
    assert items[0]["conversation_type"] == "project_workspace"
    assert items[0]["source_deal_id"] == str(deal_id)


def test_normalize_conversation_type_keeps_only_two_durable_types():
    assert normalize_conversation_type("normal") == "normal"
    assert normalize_conversation_type("project_workspace") == "project_workspace"
    assert normalize_conversation_type("deal_workspace") == "project_workspace"
    assert normalize_conversation_type("track_workspace") == "normal"
    assert normalize_conversation_type("unexpected") == "normal"


def test_query_filters_case_insensitive_on_title_and_preview():
    ai = _record(title="AI 芯片讨论", last=datetime(2026, 6, 9))
    consumer = _record(title="消费投资", preview="关于 New Retail 的笔记", last=datetime(2026, 6, 8))
    assert project_conversations([ai, consumer], query="ai")[1] == 2
    items2, total2 = project_conversations([ai, consumer], query="消费")
    assert total2 == 1 and items2[0]["title"] == "消费投资"
    items3, total3 = project_conversations([ai, consumer], query="不存在的词")
    assert total3 == 0 and items3 == []


def test_blank_query_is_noop():
    assert project_conversations([_record(title="A"), _record(title="B")], query="   ")[1] == 2


# ---------- 分页 ----------

def test_pagination_limit_offset():
    recs = [_record(title=f"C{i}", last=datetime(2026, 6, 1 + i)) for i in range(5)]
    page, total = project_conversations(recs, limit=2, offset=1)
    assert total == 5
    assert [it["title"] for it in page] == ["C3", "C2"]


def test_empty_input():
    assert project_conversations([]) == ([], 0)


# ---------- list_conversation_summaries 异步壳 ----------

def test_list_summaries_delegates_to_fetch_and_projection(monkeypatch):
    recs = [
        _record(title="较新", last=datetime(2026, 6, 12)),
        _record(title="较旧", last=datetime(2026, 6, 2)),
    ]
    captured = {}

    async def _fake_fetch(db, *, institution_id, user_id):
        captured["institution_id"] = institution_id
        captured["user_id"] = user_id
        return recs

    monkeypatch.setattr(conv_svc, "_fetch_conversation_records", _fake_fetch)
    inst, usr = uuid.uuid4(), uuid.uuid4()
    items, total = _run(
        list_conversation_summaries(None, institution_id=inst, user_id=usr, limit=1, offset=0, query=None)
    )
    assert captured == {"institution_id": inst, "user_id": usr}
    assert total == 2
    assert len(items) == 1 and items[0]["title"] == "较新"
