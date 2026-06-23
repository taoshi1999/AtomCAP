"""EvidenceItem 前端投影。

交付对象 payload 里的 Claim 只保存 evidence_ids。前端要把这些 id 变成可打开的
网页或私有材料入口，需要一个轻量、租户隔离的来源摘要。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.evidence.service import referenced_evidence_ids
from app.models.models import EvidenceItemRow


def project_evidence_item(row: EvidenceItemRow) -> dict[str, Any]:
    """把证据行投影成稳定 API 结构。"""
    return {
        "id": str(row.id),
        "source_type": row.source_type,
        "title": row.title,
        "url": row.url,
        "snippet": row.snippet,
        "published_at": row.published_at,
        "connector": row.connector,
        "raw": row.raw or {},
    }


async def evidence_items_for_payload(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    payload: object,
) -> list[dict[str, Any]]:
    """读取 payload 中实际引用到的证据来源。

    不返回同租户下所有证据，避免把无关证据暴露给当前交付物。
    """
    ids = sorted(referenced_evidence_ids(payload), key=str)
    if not ids:
        return []

    rows = (
        await db.execute(
            select(EvidenceItemRow).where(
                EvidenceItemRow.institution_id == institution_id,
                EvidenceItemRow.id.in_(ids),
            )
        )
    ).scalars().all()
    order = {evidence_id: index for index, evidence_id in enumerate(ids)}
    return [
        project_evidence_item(row)
        for row in sorted(rows, key=lambda item: order.get(item.id, len(order)))
    ]
