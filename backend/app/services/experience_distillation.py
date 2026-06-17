"""经验沉淀 Agent 增量扫描服务。

设计依据 `agent_design/经验沉淀Agent.docx` Step 1-6：
每 5 分钟扫描新 Message / UserAction，抽取 PreferenceSignal，
再匹配/更新/创建 ExperienceEvent。本服务只负责「经验归纳层」，
PreferenceAdvice 聚合与人工审阅留给下一轮增量。
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.experience import extract as experience_extract
from app.agents.experience.match import ingest_signal
from app.models.models import (
    Conversation,
    DomainEvent,
    ExperienceEventRow,
    Message,
    UserActionRow,
)
from app.objects.experience import ExperienceEvent, ExtractedPreferenceSignal
from app.services.conversations import blocks_to_text
from app.services.events import record_event

MESSAGE_SCANNED_EVENT = "experience.message_scanned"
EVENT_CREATED = "experience.event_created"
EVENT_UPDATED = "experience.event_updated"


@dataclass
class ExperienceScanStats:
    """一轮经验沉淀增量扫描的可解释统计。"""

    processed_messages: int = 0
    processed_user_actions: int = 0
    skipped_messages: int = 0
    skipped_user_actions: int = 0
    created_events: int = 0
    updated_events: int = 0
    failed_messages: int = 0
    failed_user_actions: int = 0
    scanned_message_ids: list[str] = field(default_factory=list)
    scanned_user_action_ids: list[str] = field(default_factory=list)
    touched_experience_event_ids: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enum_value(value: Any) -> str | None:
    if value is None:
        return None
    return getattr(value, "value", value)


def _uuid_or_none(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if isinstance(value, uuid.UUID):
        return value
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def _event_user_id(event: ExperienceEvent) -> uuid.UUID | None:
    if event.scope.scope_id:
        return _uuid_or_none(event.scope.scope_id)
    for user_id in event.scope.source_user_ids:
        parsed = _uuid_or_none(user_id)
        if parsed is not None:
            return parsed
    return None


def _event_payload(event: ExperienceEvent) -> dict[str, Any]:
    return event.model_dump(mode="json")


def _row_from_event(event: ExperienceEvent, *, institution_id: uuid.UUID) -> ExperienceEventRow:
    event_id = _uuid_or_none(event.experience_event_id) or uuid.uuid4()
    if not event.experience_event_id:
        event = event.model_copy(update={"experience_event_id": str(event_id)})
    signal = event.preference_signal
    return ExperienceEventRow(
        id=event_id,
        institution_id=institution_id,
        user_id=_event_user_id(event),
        event_type=_enum_value(event.event_type) or "unknown",
        status=_enum_value(event.status) or "open",
        title=event.title,
        polarity=_enum_value(signal.polarity) if signal else None,
        strength=_enum_value(signal.strength) if signal else None,
        confidence=signal.confidence if signal else 0.0,
        advice_generated=bool(event.lifecycle.advice_generated),
        payload=_event_payload(event),
    )


def _apply_event_to_row(row: ExperienceEventRow, event: ExperienceEvent) -> None:
    signal = event.preference_signal
    row.user_id = _event_user_id(event)
    row.event_type = _enum_value(event.event_type) or row.event_type
    row.status = _enum_value(event.status) or row.status
    row.title = event.title
    row.polarity = _enum_value(signal.polarity) if signal else None
    row.strength = _enum_value(signal.strength) if signal else None
    row.confidence = signal.confidence if signal else 0.0
    row.advice_generated = bool(event.lifecycle.advice_generated)
    row.payload = _event_payload(event)


def _valid_event_from_row(row: ExperienceEventRow) -> ExperienceEvent | None:
    try:
        event = ExperienceEvent.model_validate(row.payload or {})
    except Exception:
        return None
    if not event.experience_event_id:
        event = event.model_copy(update={"experience_event_id": str(row.id)})
    return event


async def _load_existing_events(
    db: AsyncSession, *, institution_id: uuid.UUID
) -> tuple[list[ExperienceEvent], dict[str, ExperienceEventRow]]:
    rows = (
        await db.execute(
            select(ExperienceEventRow)
            .where(ExperienceEventRow.institution_id == institution_id)
            .order_by(ExperienceEventRow.created_at.asc(), ExperienceEventRow.id.asc())
        )
    ).scalars().all()
    events: list[ExperienceEvent] = []
    by_id: dict[str, ExperienceEventRow] = {}
    for row in rows:
        event = _valid_event_from_row(row)
        if event is None or not event.experience_event_id:
            continue
        events.append(event)
        by_id[event.experience_event_id] = row
    return events, by_id


async def _load_unscanned_messages(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    limit: int,
) -> list[tuple[Message, uuid.UUID]]:
    scanned_ids = (
        await db.execute(
            select(DomainEvent.subject_id).where(
                DomainEvent.institution_id == institution_id,
                DomainEvent.event_type == MESSAGE_SCANNED_EVENT,
                DomainEvent.subject_type == "message",
            )
        )
    ).scalars().all()
    stmt = (
        select(Message, Conversation.user_id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.institution_id == institution_id,
            Conversation.institution_id == institution_id,
            Message.role == "user",
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
        .limit(limit)
    )
    if user_id is not None:
        stmt = stmt.where(Conversation.user_id == user_id)
    if scanned_ids:
        stmt = stmt.where(~Message.id.in_(scanned_ids))
    return list((await db.execute(stmt)).all())


async def _load_unscanned_user_actions(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    limit: int,
) -> list[UserActionRow]:
    stmt = (
        select(UserActionRow)
        .where(
            UserActionRow.institution_id == institution_id,
            UserActionRow.scanned.is_(False),
        )
        .order_by(UserActionRow.created_at.asc(), UserActionRow.id.asc())
        .limit(limit)
    )
    if user_id is not None:
        stmt = stmt.where(UserActionRow.user_id == user_id)
    return list((await db.execute(stmt)).scalars().all())


async def _mark_message_scanned(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    message: Message,
    signal: ExtractedPreferenceSignal | None,
    event: ExperienceEvent | None,
) -> None:
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=MESSAGE_SCANNED_EVENT,
        subject_type="message",
        subject_id=message.id,
        payload={
            "conversation_id": str(message.conversation_id),
            "has_signal": signal is not None,
            "signal_type": _enum_value(signal.signal_type) if signal else None,
            "experience_event_id": event.experience_event_id if event else None,
        },
    )


def _mark_user_action_scanned(row: UserActionRow, event: ExperienceEvent | None) -> None:
    payload = dict(row.payload or {})
    processing_status = dict(payload.get("processing_status") or {})
    processing_status.update(
        {
            "experience_agent_scanned": True,
            "scanned_at": _now_iso(),
            "linked_experience_event_ids": (
                [event.experience_event_id] if event and event.experience_event_id else []
            ),
        }
    )
    payload["processing_status"] = processing_status
    row.payload = payload
    row.scanned = True


async def _persist_ingest_result(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    working_events: list[ExperienceEvent],
    row_by_id: dict[str, ExperienceEventRow],
    signal: ExtractedPreferenceSignal,
    stats: ExperienceScanStats,
) -> ExperienceEvent | None:
    result = ingest_signal(
        signal,
        working_events,
        now=_now_iso(),
        id_factory=lambda: str(uuid.uuid4()),
    )
    if result is None:
        return None

    event = result.event
    if event.experience_event_id is None:
        event = event.model_copy(update={"experience_event_id": str(uuid.uuid4())})

    if result.created:
        row = _row_from_event(event, institution_id=institution_id)
        db.add(row)
        row_by_id[event.experience_event_id] = row
        working_events.append(event)
        stats.created_events += 1
        await record_event(
            db,
            institution_id=institution_id,
            user_id=_event_user_id(event),
            event_type=EVENT_CREATED,
            subject_type="experience_event",
            subject_id=row.id,
            payload={"title": event.title, "event_type": _enum_value(event.event_type)},
        )
    else:
        row = row_by_id.get(result.matched_event_id or "")
        if row is None:
            row = _row_from_event(event, institution_id=institution_id)
            db.add(row)
            row_by_id[event.experience_event_id] = row
            stats.created_events += 1
        else:
            _apply_event_to_row(row, event)
            stats.updated_events += 1
        working_events[:] = [
            event if item.experience_event_id == result.matched_event_id else item
            for item in working_events
        ]
        await record_event(
            db,
            institution_id=institution_id,
            user_id=_event_user_id(event),
            event_type=EVENT_UPDATED,
            subject_type="experience_event",
            subject_id=row.id,
            payload={"title": event.title, "event_type": _enum_value(event.event_type)},
        )

    if event.experience_event_id:
        stats.touched_experience_event_ids.append(event.experience_event_id)
    return event


async def scan_experience(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
    include_messages: bool = True,
    include_user_actions: bool = True,
    allow_overseas: bool = False,
) -> ExperienceScanStats:
    """扫描一批新 Message / UserAction 并折叠进 ExperienceEvent。

    本函数要求调用方提供事务边界；API 端点通过 `get_db`，worker 通过
    `SessionLocal().begin()` 保证整轮扫描原子提交。
    """
    stats = ExperienceScanStats()
    working_events, row_by_id = await _load_existing_events(
        db, institution_id=institution_id
    )

    if include_messages:
        messages = await _load_unscanned_messages(
            db, institution_id=institution_id, user_id=user_id, limit=limit
        )
        for message, message_user_id in messages:
            try:
                text = blocks_to_text(message.content).strip()
                if not text:
                    stats.skipped_messages += 1
                    await _mark_message_scanned(
                        db,
                        institution_id=institution_id,
                        user_id=message_user_id,
                        message=message,
                        signal=None,
                        event=None,
                    )
                    continue
                signal = await experience_extract.extract_message_signal(
                    text=text,
                    message_id=str(message.id),
                    institution_id=str(institution_id),
                    user_id=str(message_user_id),
                    allow_overseas=allow_overseas,
                )
                event = None
                if signal is None:
                    stats.skipped_messages += 1
                else:
                    event = await _persist_ingest_result(
                        db,
                        institution_id=institution_id,
                        working_events=working_events,
                        row_by_id=row_by_id,
                        signal=signal,
                        stats=stats,
                    )
                    if event is None:
                        stats.skipped_messages += 1
                await _mark_message_scanned(
                    db,
                    institution_id=institution_id,
                    user_id=message_user_id,
                    message=message,
                    signal=signal,
                    event=event,
                )
                stats.processed_messages += 1
                stats.scanned_message_ids.append(str(message.id))
            except Exception as exc:
                stats.failed_messages += 1
                stats.errors.append(f"message:{message.id}:{exc}")

    if include_user_actions:
        actions = await _load_unscanned_user_actions(
            db, institution_id=institution_id, user_id=user_id, limit=limit
        )
        for action in actions:
            try:
                signal = experience_extract.extract_user_action_signal(action.payload or {})
                event = None
                if signal is None:
                    stats.skipped_user_actions += 1
                else:
                    event = await _persist_ingest_result(
                        db,
                        institution_id=institution_id,
                        working_events=working_events,
                        row_by_id=row_by_id,
                        signal=signal,
                        stats=stats,
                    )
                    if event is None:
                        stats.skipped_user_actions += 1
                _mark_user_action_scanned(action, event)
                stats.processed_user_actions += 1
                stats.scanned_user_action_ids.append(str(action.id))
            except Exception as exc:
                # UserAction payload 如果永久脏，标记已扫并保留错误，避免 5 分钟任务卡死。
                _mark_user_action_scanned(action, None)
                stats.failed_user_actions += 1
                stats.errors.append(f"user_action:{action.id}:{exc}")

    await db.flush()
    return stats
