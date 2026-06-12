"""证据链服务：Source → evidence_items 落库；结论与证据连边。"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import Source
from app.models.models import EvidenceItemRow, EvidenceLinkRow


async def save_sources(
    db: AsyncSession, *, institution_id: uuid.UUID, sources: list[Source]
) -> list[uuid.UUID]:
    rows = [
        EvidenceItemRow(
            institution_id=institution_id,
            source_type=s.source_type,
            title=s.title,
            url=s.url,
            snippet=s.snippet,
            published_at=s.published_at,
            connector=s.connector,
            raw=s.raw,
        )
        for s in sources
    ]
    db.add_all(rows)
    await db.flush()
    return [r.id for r in rows]


async def link(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    from_id: uuid.UUID,
    to_id: uuid.UUID,
    relation: str = "supports",
) -> None:
    db.add(
        EvidenceLinkRow(
            institution_id=institution_id, from_id=from_id, to_id=to_id, relation=relation
        )
    )
    await db.flush()
