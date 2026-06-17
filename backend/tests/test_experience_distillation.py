"""经验沉淀增量扫描服务测试。

覆盖 P0 闭环：
- UserAction → PreferenceSignal → ExperienceEvent 创建/更新，并标记 scanned；
- 非偏好 Message 也写 experience.message_scanned，避免 5 分钟任务重复调用 LLM。
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest

import app.services.experience_distillation as svc
from app.models.models import DomainEvent, ExperienceEventRow
from app.objects.experience import (
    ActionStrength,
    ActionTarget,
    Polarity,
    TargetSnapshot,
    UserAction,
    UserActionType,
)


def _run(coro):
    return asyncio.run(coro)


class _FakeDb:
    def __init__(self):
        self.added = []
        self.flushed = False

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    async def flush(self):
        self.flushed = True


async def _empty_events(db, *, institution_id):
    return [], {}


async def _no_messages(db, **kwargs):
    return []


async def _no_actions(db, **kwargs):
    return []


def _action_row(
    *,
    action_id: str,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    deal_id: uuid.UUID,
    row_id=None,
):
    action = UserAction(
        action_id=action_id,
        institution_id=str(institution_id),
        user_id=str(user_id),
        action_type=UserActionType.DISLIKE_DEAL,
        action_label="不感兴趣",
        target=ActionTarget(target_type="deal", target_id=str(deal_id), target_name="光羽科技"),
        target_snapshot=TargetSnapshot(sector="AI硬件", sub_sector="AI眼镜整机"),
        action_strength=ActionStrength(
            polarity=Polarity.NEGATIVE,
            weight=-3,
            confidence=1.0,
        ),
    )
    return SimpleNamespace(
        id=row_id or uuid.uuid4(),
        institution_id=institution_id,
        user_id=user_id,
        payload=action.model_dump(mode="json"),
        scanned=False,
    )


def test_user_actions_create_then_update_experience_event(monkeypatch):
    monkeypatch.setattr(svc, "_load_existing_events", _empty_events)
    monkeypatch.setattr(svc, "_load_unscanned_messages", _no_messages)

    institution_id = uuid.uuid4()
    user_id = uuid.uuid4()
    deal_id = uuid.uuid4()
    rows = [
        _action_row(
            action_id="action_1",
            institution_id=institution_id,
            user_id=user_id,
            deal_id=deal_id,
        ),
        _action_row(
            action_id="action_2",
            institution_id=institution_id,
            user_id=user_id,
            deal_id=deal_id,
        ),
    ]

    async def load_actions(db, **kwargs):
        return rows

    monkeypatch.setattr(svc, "_load_unscanned_user_actions", load_actions)

    db = _FakeDb()
    stats = _run(
        svc.scan_experience(
            db,
            institution_id=institution_id,
            include_messages=False,
            include_user_actions=True,
        )
    )

    assert stats.processed_user_actions == 2
    assert stats.created_events == 1
    assert stats.updated_events == 1
    assert all(row.scanned for row in rows)
    assert all(row.payload["processing_status"]["experience_agent_scanned"] for row in rows)

    event_rows = [obj for obj in db.added if isinstance(obj, ExperienceEventRow)]
    assert len(event_rows) == 1
    payload = event_rows[0].payload
    assert payload["source_records"]["source_user_action_ids"] == ["action_1", "action_2"]
    assert payload["target_scope"]["sector"] == "AI硬件"
    assert stats.touched_experience_event_ids
    assert db.flushed


def test_non_signal_message_is_marked_scanned(monkeypatch):
    monkeypatch.setattr(svc, "_load_existing_events", _empty_events)
    monkeypatch.setattr(svc, "_load_unscanned_user_actions", _no_actions)

    message_id = uuid.uuid4()
    user_id = uuid.uuid4()
    message = SimpleNamespace(
        id=message_id,
        conversation_id=uuid.uuid4(),
        content=[{"type": "text", "text": "这家公司最新融资是什么时候？"}],
    )

    async def load_messages(db, **kwargs):
        return [(message, user_id)]

    async def no_signal(**kwargs):
        return None

    monkeypatch.setattr(svc, "_load_unscanned_messages", load_messages)
    monkeypatch.setattr(svc.experience_extract, "extract_message_signal", no_signal)

    db = _FakeDb()
    stats = _run(
        svc.scan_experience(
            db,
            institution_id=uuid.uuid4(),
            include_messages=True,
            include_user_actions=False,
        )
    )

    assert stats.processed_messages == 1
    assert stats.skipped_messages == 1
    assert stats.scanned_message_ids == [str(message_id)]
    assert not [obj for obj in db.added if isinstance(obj, ExperienceEventRow)]

    scan_events = [
        obj for obj in db.added
        if isinstance(obj, DomainEvent) and obj.event_type == svc.MESSAGE_SCANNED_EVENT
    ]
    assert len(scan_events) == 1
    assert scan_events[0].subject_id == message_id
    assert scan_events[0].payload["has_signal"] is False
    assert db.flushed
