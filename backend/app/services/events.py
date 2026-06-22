"""domain_events 记账服务。

所有用户操作与对象状态流转都必须经这里写入事件流水——
它是投资经验沉淀 Agent 的唯一数据来源，事后无法补。
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
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


# 赛道前瞻 load_history 关心的事件类型：机构关注过什么赛道、生成过项目池、
# 哪些判断被证伪、划款进行/否决/退出——这些是"越用越准"的历史因子。
# thesis.invalidated / deal.* 部分由后续 Phase 产生，先纳入过滤集，出现即被回放。
THESIS_HISTORY_EVENT_TYPES: tuple[str, ...] = (
    "thesis.created",
    "thesis.followed",
    "thesis.deal_pool_requested",
    "thesis.briefing_requested",
    "thesis.re_recommend_requested",
    "thesis.invalidated",
    "deal.approved",
    "deal.rejected",
    "deal.exited",
)


async def recent_history(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    event_types: tuple[str, ...] = THESIS_HISTORY_EVENT_TYPES,
    limit: int = 200,
) -> list[dict]:
    """按机构回放最近的关键历史事件（新→旧），供子图 load_history 按赛道过滤。

    返回轻量 dict 视图（不带 ORM 对象），事件 payload 原样保留——
    track 等上下文字段由各记账点写入（runner / deliverable 动作端点已带 track）。
    """
    rows = (
        await db.execute(
            select(DomainEvent)
            .where(
                DomainEvent.institution_id == institution_id,
                DomainEvent.event_type.in_(event_types),
            )
            .order_by(DomainEvent.occurred_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "event_type": r.event_type,
            "subject_type": r.subject_type,
            "subject_id": str(r.subject_id) if r.subject_id else None,
            "occurred_at": r.occurred_at.isoformat(),
            "payload": r.payload or {},
        }
        for r in rows
    ]
