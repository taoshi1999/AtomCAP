"""domain_events 记账服务。

所有用户操作与对象状态流转都必须经这里写入事件流水——
它是投资经验沉淀 Agent 的唯一数据来源，事后无法补。
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DomainEvent


async def record_event(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    event_type: str,        # 如 thesis.followed / deal.approved / thesis.invalidated
    subject_type: str,
    subject_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> DomainEvent:
    ev = DomainEvent(
        institution_id=institution_id,
        user_id=user_id,
        event_type=event_type,
        subject_type=subject_type,
        subject_id=subject_id,
        payload=payload or {},
    )
    db.add(ev)
    await db.flush()
    return ev
