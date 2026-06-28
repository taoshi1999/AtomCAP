"""赛道库读取与推荐赛道去重标记服务。"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Deliverable
from app.objects import DeliverableType
from app.objects.thesis import ThesisStatus


_TRACK_NOISE = re.compile(r"(赛道|子赛道|方向|领域|track|sector)", re.IGNORECASE)
_NON_ALNUM = re.compile(r"[\s\.,，。、；;:：_\-/&|｜()（）\[\]【】]+")


def _norm_track_name(value: str | None) -> str:
    """Normalize track names for same-institution duplicate detection."""
    text = _TRACK_NOISE.sub("", value or "")
    text = _NON_ALNUM.sub("", text)
    return text.strip().lower()


@dataclass(frozen=True)
class ThesisLibraryMatchEntry:
    deliverable_id: uuid.UUID
    names: tuple[str, ...]


def mark_thesis_library_matches(payload: dict, entries: list[ThesisLibraryMatchEntry]) -> dict:
    """Mark generated sub-directions that already exist in the track library."""
    sub_directions = payload.get("sub_directions")
    if not isinstance(sub_directions, list):
        return payload

    by_name: dict[str, ThesisLibraryMatchEntry] = {}
    for entry in entries:
        for name in entry.names:
            norm = _norm_track_name(name)
            if norm:
                by_name.setdefault(norm, entry)

    next_payload = dict(payload)
    marked: list[dict] = []
    for raw_sub in sub_directions:
        if not isinstance(raw_sub, dict):
            marked.append(raw_sub)
            continue
        sub = dict(raw_sub)
        match = by_name.get(_norm_track_name(str(sub.get("name") or "")))
        if match is not None:
            sub["deliverable_id"] = str(match.deliverable_id)
            sub["is_in_library"] = True
        else:
            sub["is_in_library"] = False
        marked.append(sub)
    next_payload["sub_directions"] = marked
    return next_payload


def _thesis_library_entry(row: Deliverable) -> ThesisLibraryMatchEntry | None:
    payload = row.payload or {}
    names = [
        payload.get("thesis_name"),
        *[
            item.get("name")
            for item in (payload.get("sub_directions") or [])
            if isinstance(item, dict)
        ],
    ]
    normalized_names = tuple(str(name).strip() for name in names if str(name or "").strip())
    if not normalized_names:
        return None
    return ThesisLibraryMatchEntry(deliverable_id=row.id, names=normalized_names)


async def annotate_thesis_library_matches(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    payload: dict,
) -> dict:
    """Check generated sub-directions against existing same-institution Thesis records."""
    rows = (
        await db.execute(
            select(Deliverable).where(
                Deliverable.institution_id == institution_id,
                Deliverable.type == DeliverableType.THESIS.value,
                or_(Deliverable.status.is_(None), Deliverable.status != ThesisStatus.DELETED.value),
            )
        )
    ).scalars().all()
    entries = [
        entry
        for row in rows
        if (entry := _thesis_library_entry(row)) is not None
    ]
    return mark_thesis_library_matches(payload, entries)
