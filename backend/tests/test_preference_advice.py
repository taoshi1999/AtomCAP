"""PreferenceAdvice 聚合与审阅服务测试。"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import app.services.preference_advice as svc
from app.models.models import ExperienceEventRow, PreferenceAdviceRow
from app.objects.experience import (
    ExperienceEvent,
    ExperienceEventType,
    ExperienceStatus,
    PreferenceImpact,
    PreferenceSignal,
    Polarity,
    ReviewDecision,
    ReviewStatus,
    SignalStrength,
    SignalType,
    SourceRecords,
    SuggestedUpdate,
)


def _run(coro):
    return asyncio.run(coro)


class _Rows:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.added = []
        self.flushed = False

    async def execute(self, stmt):
        return _Rows(self.rows)

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    async def flush(self):
        self.flushed = True


def _event(*, status=ExperienceStatus.CANDIDATE, source_count=1) -> ExperienceEvent:
    return ExperienceEvent(
        experience_event_id=str(uuid.uuid4()),
        institution_id=str(uuid.uuid4()),
        event_type=ExperienceEventType.REPEATED_REJECTION_PATTERN,
        title="用户持续排斥 AI 眼镜整机项目",
        summary="用户对 AI 眼镜整机项目多次负向反馈",
        status=status,
        source_records=SourceRecords(
            source_user_action_ids=[f"action_{i}" for i in range(source_count)]
        ),
        preference_signal=PreferenceSignal(
            signal_type=SignalType.NEGATIVE_BEHAVIOR_SIGNAL,
            polarity=Polarity.NEGATIVE,
            strength=SignalStrength.MEDIUM,
            confidence=0.86,
        ),
        preference_impact=PreferenceImpact(
            suggested_updates=[
                SuggestedUpdate(
                    field_path="learned_preference.subsector_weights",
                    target="AI眼镜整机",
                    operation="decrease_weight",
                    suggested_delta=-0.1,
                )
            ]
        ),
        evidence_summary=["用户点击不感兴趣（权重 -3）"],
    )


def _event_row(event: ExperienceEvent, *, institution_id: uuid.UUID) -> ExperienceEventRow:
    return ExperienceEventRow(
        id=uuid.UUID(event.experience_event_id),
        institution_id=institution_id,
        event_type=event.event_type.value,
        status=event.status.value,
        title=event.title,
        polarity=event.preference_signal.polarity.value,
        strength=event.preference_signal.strength.value,
        confidence=event.preference_signal.confidence,
        advice_generated=False,
        payload=event.model_dump(mode="json"),
    )


def test_generate_preference_advice_marks_event(monkeypatch):
    institution_id = uuid.uuid4()
    preference_id = uuid.uuid4()
    event = _event(source_count=3)
    row = _event_row(event, institution_id=institution_id)
    db = _FakeDb(rows=[row])

    async def fake_preference(db, *, institution_id):
        return SimpleNamespace(id=preference_id, version=7)

    events = []

    async def fake_record_event(db, **kwargs):
        events.append(kwargs)
        return SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(svc.preferences_service, "get_active_row", fake_preference)
    monkeypatch.setattr(svc, "record_event", fake_record_event)

    stats = _run(svc.generate_preference_advice(db, institution_id=institution_id))

    assert stats.generated_advice == 1
    assert stats.updated_events == 1
    assert len(stats.advice_ids) == 1
    assert row.status == ExperienceStatus.ADVICE_GENERATED.value
    assert row.advice_generated is True
    assert row.payload["lifecycle"]["advice_generated"] is True

    advice_rows = [item for item in db.added if isinstance(item, PreferenceAdviceRow)]
    assert len(advice_rows) == 1
    advice = advice_rows[0].payload
    assert advice["base_preference_version"] == "7"
    assert advice["suggested_changes"][0]["target"] == "AI眼镜整机"
    assert advice["source_summary"]["user_action_count"] == 3
    assert events[0]["event_type"] == svc.GENERATED_EVENT
    assert db.flushed


def test_review_preference_advice_accepts_and_records(monkeypatch):
    institution_id = uuid.uuid4()
    user_id = uuid.uuid4()
    event = _event(status=ExperienceStatus.ADVICE_GENERATED, source_count=3)
    event = event.model_copy(
        update={
            "lifecycle": event.lifecycle.model_copy(update={"advice_generated": True})
        }
    )
    event_row = _event_row(event, institution_id=institution_id)
    event_row.status = ExperienceStatus.ADVICE_GENERATED.value
    event_row.advice_generated = True
    advice = svc.build_preference_advice(event, institution_id=institution_id)
    advice_row = PreferenceAdviceRow(
        id=uuid.UUID(advice.advice_id),
        institution_id=institution_id,
        advice_type=advice.advice_type.value,
        priority=advice.priority.value,
        review_status=ReviewStatus.PENDING_REVIEW.value,
        confidence=advice.confidence,
        applied=False,
        payload=advice.model_dump(mode="json"),
    )

    async def fake_get_row(db, *, institution_id, advice_id):
        return advice_row

    async def fake_event_rows(db, *, institution_id, advice):
        return [event_row]

    events = []
    actions = []

    async def fake_record_event(db, **kwargs):
        events.append(kwargs)
        return SimpleNamespace(id=uuid.uuid4())

    async def fake_record_user_action(db, **kwargs):
        actions.append(kwargs)
        return SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(svc, "_get_advice_row", fake_get_row)
    monkeypatch.setattr(svc, "_source_event_rows", fake_event_rows)
    monkeypatch.setattr(svc, "record_event", fake_record_event)
    monkeypatch.setattr(svc, "record_user_action", fake_record_user_action)

    db = _FakeDb()
    result = _run(
        svc.review_preference_advice(
            db,
            institution_id=institution_id,
            user_id=user_id,
            advice_id=advice_row.id,
            decision=ReviewDecision.ACCEPT,
            comment="同意",
        )
    )

    assert result["review_status"] == ReviewStatus.ACCEPTED.value
    assert advice_row.review_status == ReviewStatus.ACCEPTED.value
    assert advice_row.payload["review"]["reviewed_by"] == str(user_id)
    assert event_row.status == ExperienceStatus.ACCEPTED.value
    assert events[0]["event_type"] == svc.ACCEPTED_EVENT
    assert actions[0]["action_type"].value == "accept_preference_advice"
    assert db.flushed
