"""PreferenceAdvice 聚合与审阅服务。

经验沉淀管线第 3 层：把成熟的 ExperienceEvent 转成可人工审阅的
PreferenceAdvice。注意：即便强信号也只生成 advice，不直接改 Preference。
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.experience.match import (
    mark_accepted,
    mark_advice_generated,
    mark_rejected,
    promote_to_candidate,
)
from app.models.models import ExperienceEventRow, PreferenceAdviceRow
from app.objects.experience import (
    AdviceApplication,
    AdvicePriority,
    AdviceType,
    ExpectedEffect,
    ExperienceEvent,
    ExperienceStatus,
    PreferenceAdvice,
    ReviewDecision,
    ReviewStatus,
    SignalStrength,
    SourceSummary,
    SuggestedChange,
)
from app.services import preferences as preferences_service
from app.objects.preference import InvestmentPreference
from app.agents.experience.apply import apply_changes_to_preference
from app.services.events import record_event
from app.services.user_actions import record_user_action
from app.objects.experience import UserActionType

GENERATED_EVENT = "preference_advice.generated"
ACCEPTED_EVENT = "preference_advice.accepted"
REJECTED_EVENT = "preference_advice.rejected"
PREFERENCE_UPDATED_EVENT = "preference.updated"


@dataclass
class AdviceGenerationStats:
    scanned_events: int = 0
    generated_advice: int = 0
    skipped_events: int = 0
    updated_events: int = 0
    advice_ids: list[str] | None = None
    errors: list[str] | None = None

    def __post_init__(self) -> None:
        self.advice_ids = self.advice_ids or []
        self.errors = self.errors or []

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class PreferenceAdviceNotFound(Exception):
    pass


class InvalidAdviceReview(Exception):
    pass


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


def _valid_event(row: ExperienceEventRow) -> ExperienceEvent | None:
    try:
        event = ExperienceEvent.model_validate(row.payload or {})
    except Exception:
        return None
    if not event.experience_event_id:
        event = event.model_copy(update={"experience_event_id": str(row.id)})
    return event


def _apply_event(row: ExperienceEventRow, event: ExperienceEvent) -> None:
    signal = event.preference_signal
    row.status = _enum_value(event.status) or row.status
    row.polarity = _enum_value(signal.polarity) if signal else None
    row.strength = _enum_value(signal.strength) if signal else None
    row.confidence = signal.confidence if signal else 0.0
    row.advice_generated = bool(event.lifecycle.advice_generated)
    row.payload = event.model_dump(mode="json")


def _source_count(event: ExperienceEvent) -> int:
    return len(event.source_records.source_message_ids) + len(
        event.source_records.source_user_action_ids
    )


def _qualifies(event: ExperienceEvent) -> bool:
    """是否足够成熟，可以进入人工审阅队列。"""
    if event.status not in (ExperienceStatus.OPEN, ExperienceStatus.CANDIDATE):
        return False
    if event.lifecycle.advice_generated:
        return False
    signal = event.preference_signal
    if event.status == ExperienceStatus.CANDIDATE:
        return True
    if signal is None:
        return False
    return (
        signal.strength == SignalStrength.STRONG
        or signal.confidence >= 0.75
        or _source_count(event) >= 3
    )


def _advice_type(field_path: str) -> AdviceType:
    if field_path == "risk_boundary":
        return AdviceType.RISK_BOUNDARY_UPDATE
    if "subsector" in field_path:
        return AdviceType.SUBSECTOR_WEIGHT_ADJUSTMENT
    if "sector" in field_path:
        return AdviceType.SECTOR_WEIGHT_ADJUSTMENT
    if "industry_chain" in field_path:
        return AdviceType.INDUSTRY_CHAIN_WEIGHT_ADJUSTMENT
    if "anti_preference" in field_path:
        return AdviceType.ANTI_PREFERENCE_UPDATE
    if "scoring" in field_path:
        return AdviceType.SCORING_WEIGHT_UPDATE
    return AdviceType.PREFERENCE_WEIGHT_ADJUSTMENT


def _priority(event: ExperienceEvent) -> AdvicePriority:
    signal = event.preference_signal
    if signal and (signal.strength == SignalStrength.STRONG or signal.confidence >= 0.9):
        return AdvicePriority.HIGH
    if _source_count(event) >= 3:
        return AdvicePriority.HIGH
    if signal and signal.confidence >= 0.75:
        return AdvicePriority.MEDIUM
    return AdvicePriority.LOW


def _title(event: ExperienceEvent) -> str:
    if event.preference_impact.suggested_updates:
        first = event.preference_impact.suggested_updates[0]
        target = first.target or first.field_path
        op = "提高" if first.suggested_delta and first.suggested_delta > 0 else "降低"
        return f"建议{op}「{target}」相关偏好权重"
    return f"建议审阅经验事件：{event.title}"


def _summary(event: ExperienceEvent) -> str:
    evidence = "；".join(event.evidence_summary[:3])
    if evidence:
        return f"{event.summary or event.title}。依据：{evidence}"
    return event.summary or event.title


def _suggested_changes(event: ExperienceEvent) -> list[SuggestedChange]:
    changes: list[SuggestedChange] = []
    reason = event.evidence_summary[0] if event.evidence_summary else event.summary or event.title
    for update in event.preference_impact.suggested_updates:
        delta = update.suggested_delta
        changes.append(
            SuggestedChange(
                change_id=str(uuid.uuid4()),
                field_path=update.field_path,
                target=update.target,
                operation=update.operation,
                current_value=None,
                suggested_value=None,
                delta=delta,
                reason=reason,
            )
        )
    if not changes:
        changes.append(
            SuggestedChange(
                change_id=str(uuid.uuid4()),
                field_path="learned_preference",
                target=event.title,
                operation="review",
                reason=reason,
            )
        )
    return changes


def build_preference_advice(
    event: ExperienceEvent,
    *,
    institution_id: uuid.UUID,
    preference_id: uuid.UUID | None = None,
    base_preference_version: int | None = None,
    now: str | None = None,
) -> PreferenceAdvice:
    """把一个 ExperienceEvent 转成 PreferenceAdvice payload。"""
    now = now or _now_iso()
    changes = _suggested_changes(event)
    advice_type = _advice_type(changes[0].field_path)
    signal = event.preference_signal
    return PreferenceAdvice(
        advice_id=str(uuid.uuid4()),
        institution_id=str(institution_id),
        preference_id=str(preference_id) if preference_id else None,
        base_preference_version=(
            str(base_preference_version) if base_preference_version is not None else None
        ),
        title=_title(event),
        summary=_summary(event),
        advice_type=advice_type,
        priority=_priority(event),
        source_experience_event_ids=[event.experience_event_id] if event.experience_event_id else [],
        source_summary=SourceSummary(
            message_count=len(event.source_records.source_message_ids),
            user_action_count=len(event.source_records.source_user_action_ids),
            time_window=event.time_window,
        ),
        suggested_changes=changes,
        expected_effect=ExpectedEffect(
            affected_agents=["thesis_scout", "deal_sourcing", "pre_dd"],
            effect_summary="该建议采纳后会影响赛道前瞻、项目获取与 Pre-DD 的匹配排序和风险边界。",
        ),
        confidence=signal.confidence if signal else 0.0,
        review_status=ReviewStatus.PENDING_REVIEW,
        created_at=now,
    )


def _advice_row(advice: PreferenceAdvice, *, institution_id: uuid.UUID) -> PreferenceAdviceRow:
    advice_id = _uuid_or_none(advice.advice_id) or uuid.uuid4()
    payload = advice.model_copy(update={"advice_id": str(advice_id)}).model_dump(mode="json")
    return PreferenceAdviceRow(
        id=advice_id,
        institution_id=institution_id,
        preference_id=_uuid_or_none(advice.preference_id),
        base_preference_version=(
            int(advice.base_preference_version)
            if advice.base_preference_version is not None
            else None
        ),
        advice_type=advice.advice_type.value,
        priority=advice.priority.value,
        review_status=advice.review_status.value,
        confidence=advice.confidence,
        applied=False,
        payload=payload,
    )


async def generate_preference_advice(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    limit: int = 100,
) -> AdviceGenerationStats:
    """从成熟 ExperienceEvent 生成 PreferenceAdvice。调用方提供事务边界。"""
    stats = AdviceGenerationStats()
    preference_row = await preferences_service.get_active_row(
        db, institution_id=institution_id
    )
    rows = (
        await db.execute(
            select(ExperienceEventRow)
            .where(
                ExperienceEventRow.institution_id == institution_id,
                ExperienceEventRow.advice_generated.is_(False),
                ExperienceEventRow.status.in_(["open", "candidate"]),
            )
            .order_by(ExperienceEventRow.updated_at.asc(), ExperienceEventRow.id.asc())
            .limit(limit)
        )
    ).scalars().all()

    for row in rows:
        stats.scanned_events += 1
        try:
            event = _valid_event(row)
            if event is None or not _qualifies(event):
                stats.skipped_events += 1
                continue
            if event.status == ExperienceStatus.OPEN:
                event = promote_to_candidate(event)
            event = mark_advice_generated(event)
            advice = build_preference_advice(
                event,
                institution_id=institution_id,
                preference_id=preference_row.id if preference_row else None,
                base_preference_version=preference_row.version if preference_row else None,
            )
            advice_row = _advice_row(advice, institution_id=institution_id)
            db.add(advice_row)
            _apply_event(row, event)
            stats.updated_events += 1
            stats.generated_advice += 1
            stats.advice_ids.append(str(advice_row.id))
            await record_event(
                db,
                institution_id=institution_id,
                event_type=GENERATED_EVENT,
                subject_type="preference_advice",
                subject_id=advice_row.id,
                payload={
                    "title": advice.title,
                    "source_experience_event_ids": advice.source_experience_event_ids,
                },
            )
        except Exception as exc:
            stats.errors.append(f"experience_event:{row.id}:{exc}")
    await db.flush()
    return stats


async def list_preference_advice(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    review_status: str | None = "pending_review",
    limit: int = 100,
) -> list[dict[str, Any]]:
    stmt = (
        select(PreferenceAdviceRow)
        .where(PreferenceAdviceRow.institution_id == institution_id)
        .order_by(PreferenceAdviceRow.created_at.desc(), PreferenceAdviceRow.id.desc())
        .limit(limit)
    )
    if review_status is not None:
        stmt = stmt.where(PreferenceAdviceRow.review_status == review_status)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            **(row.payload or {}),
            "id": str(row.id),
            "review_status": row.review_status,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        }
        for row in rows
    ]


async def _get_advice_row(
    db: AsyncSession, *, institution_id: uuid.UUID, advice_id: uuid.UUID
) -> PreferenceAdviceRow:
    row = await db.scalar(
        select(PreferenceAdviceRow).where(
            PreferenceAdviceRow.id == advice_id,
            PreferenceAdviceRow.institution_id == institution_id,
        )
    )
    if row is None:
        raise PreferenceAdviceNotFound()
    return row


async def _source_event_rows(
    db: AsyncSession, *, institution_id: uuid.UUID, advice: PreferenceAdvice
) -> list[ExperienceEventRow]:
    ids = [_uuid_or_none(item) for item in advice.source_experience_event_ids]
    ids = [item for item in ids if item is not None]
    if not ids:
        return []
    return list(
        (
            await db.execute(
                select(ExperienceEventRow).where(
                    ExperienceEventRow.institution_id == institution_id,
                    ExperienceEventRow.id.in_(ids),
                )
            )
        ).scalars().all()
    )


async def apply_accepted_advice(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    advice: PreferenceAdvice,
    now: str | None = None,
) -> AdviceApplication:
    """把一条已接受的 Advice 应用到机构偏好并版本化（经验沉淀路线第 8 步）。

    读当前 active 偏好为基底（无则空偏好，可冷启动 learned_preference）→ 应用
    suggested_changes → 经 set_active_preference 创建新 active 版本（旧版置否）→ 写
    preference.updated 事件 → 返回 AdviceApplication 标记 applied 与新版本号。

    **即便强信号也只在人工 accept 后才走到这里**；若没有任何可执行改动则不创建
    噪声版本，仅标记 applied（new_preference_version=None）。调用方提供事务边界。
    """
    now = now or _now_iso()
    pref_row = await preferences_service.get_active_row(db, institution_id=institution_id)
    if pref_row is not None:
        try:
            base = InvestmentPreference.model_validate(pref_row.payload or {})
        except Exception:
            base = InvestmentPreference()
        base_version: int | None = pref_row.version
    else:
        base = InvestmentPreference()
        base_version = None

    result = apply_changes_to_preference(
        base, advice.suggested_changes, confidence=advice.confidence
    )
    if not result.changed:
        return AdviceApplication(applied=True, applied_at=now, new_preference_version=None)

    new_pref = result.preference.model_copy(
        update={
            "source_advice_ids": [advice.advice_id] if advice.advice_id else [],
            "source_experience_event_ids": list(advice.source_experience_event_ids),
            "change_summary": advice.title,
            "reviewed_by": str(user_id),
        }
    )
    new_row = await preferences_service.set_active_preference(
        db, institution_id=institution_id, payload=new_pref.model_dump(mode="json")
    )
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=PREFERENCE_UPDATED_EVENT,
        subject_type="preference",
        subject_id=new_row.id,
        payload={
            "version": new_row.version,
            "base_preference_version": base_version,
            "source_advice_id": advice.advice_id,
            "source_experience_event_ids": advice.source_experience_event_ids,
            "applied_changes": result.applied_summaries(),
        },
    )
    return AdviceApplication(
        applied=True,
        applied_at=now,
        new_preference_version=str(new_row.version),
    )


async def review_preference_advice(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    advice_id: uuid.UUID,
    decision: ReviewDecision,
    comment: str | None = None,
) -> dict[str, Any]:
    """审阅一条 PreferenceAdvice。接受/拒绝先不直接写 Preference 新版本。"""
    row = await _get_advice_row(db, institution_id=institution_id, advice_id=advice_id)
    advice = PreferenceAdvice.model_validate(row.payload or {})
    if advice.review_status != ReviewStatus.PENDING_REVIEW:
        raise InvalidAdviceReview(f"建议已审阅：{advice.review_status}")
    now = _now_iso()
    review_status = (
        ReviewStatus.ACCEPTED if decision == ReviewDecision.ACCEPT else ReviewStatus.REJECTED
    )
    advice = advice.model_copy(
        deep=True,
        update={
            "review_status": review_status,
            "review": advice.review.model_copy(
                update={
                    "reviewed_by": str(user_id),
                    "reviewed_at": now,
                    "review_decision": decision,
                    "review_comment": comment,
                }
            ),
        },
    )
    application = advice.application
    if decision == ReviewDecision.ACCEPT:
        application = await apply_accepted_advice(
            db,
            institution_id=institution_id,
            user_id=user_id,
            advice=advice,
            now=now,
        )
        advice = advice.model_copy(update={"application": application})
        row.applied = bool(application.applied)
    row.review_status = review_status.value
    row.payload = advice.model_dump(mode="json")

    event_type = ACCEPTED_EVENT if decision == ReviewDecision.ACCEPT else REJECTED_EVENT
    event_action = (
        UserActionType.ACCEPT_PREFERENCE_ADVICE
        if decision == ReviewDecision.ACCEPT
        else UserActionType.REJECT_PREFERENCE_ADVICE
    )
    updated_events: list[str] = []
    for event_row in await _source_event_rows(
        db, institution_id=institution_id, advice=advice
    ):
        event = _valid_event(event_row)
        if event is None or event.status != ExperienceStatus.ADVICE_GENERATED:
            continue
        event = mark_accepted(event) if decision == ReviewDecision.ACCEPT else mark_rejected(event)
        _apply_event(event_row, event)
        updated_events.append(str(event_row.id))

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=event_type,
        subject_type="preference_advice",
        subject_id=row.id,
        payload={
            "decision": decision.value,
            "comment": comment,
            "source_experience_event_ids": advice.source_experience_event_ids,
        },
    )
    await record_user_action(
        db,
        action_type=event_action,
        institution_id=institution_id,
        user_id=user_id,
        target_type="preference_advice",
        target_id=row.id,
        target_name=advice.title,
        extra_payload={"decision": decision.value, "comment": comment},
    )
    await db.flush()
    return {
        "id": str(row.id),
        "review_status": row.review_status,
        "updated_experience_event_ids": updated_events,
        "applied": bool(application.applied),
        "new_preference_version": application.new_preference_version,
    }
