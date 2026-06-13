"""交付结果对象 API：详情 / 动作（关注赛道、生成项目池…）。

全部端点带租户过滤；动作必须写 domain_events（核心约定 4），
状态流转与记账成对出现。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.models import Deliverable
from app.services.events import record_event

router = APIRouter()

# 动作 → domain_events 事件后缀（事件名 = f"{对象 type}.{后缀}"，如 thesis.followed）
ACTION_EVENT_SUFFIX = {
    "follow_track": "followed",
    "generate_deal_pool": "deal_pool_requested",
    "generate_briefing": "briefing_requested",
    "re_recommend": "re_recommend_requested",
}


async def _get_owned(
    db: AsyncSession, deliverable_id: uuid.UUID, user: CurrentUser
) -> Deliverable:
    row = await db.scalar(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.institution_id == user.institution_id,  # 租户行级隔离
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="对象不存在")
    return row


@router.get("/{deliverable_id}")
async def get_deliverable(
    deliverable_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await _get_owned(db, deliverable_id, user)
    return {
        "id": str(row.id),
        "type": row.type,
        "schema_version": row.schema_version,
        "status": row.status,
        "payload": row.payload,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


@router.post("/{deliverable_id}/actions/{action}")
async def trigger_action(
    deliverable_id: uuid.UUID,
    action: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """对象上的动作按钮：follow_track / generate_deal_pool / generate_briefing / re_recommend。"""
    if action not in ACTION_EVENT_SUFFIX:
        raise HTTPException(status_code=422, detail=f"未知动作: {action}")

    row = await _get_owned(db, deliverable_id, user)

    if action == "follow_track":
        row.status = "followed"  # 已关注 → 进入定时监控（Phase 4 cron）

    await record_event(
        db,
        institution_id=user.institution_id,
        event_type=f"{row.type}.{ACTION_EVENT_SUFFIX[action]}",
        subject_type=row.type,
        subject_id=row.id,
        user_id=user.user_id,
        payload={
            "action": action,
            # 赛道上下文随事件落盘（事后无法补）：load_history 按赛道回放的匹配依据
            "track": (row.payload or {}).get("thesis_name"),
        },
    )
    # TODO Phase 1: 入 ARQ 队列触发对应 agent run（生成项目池/简报/重新推荐）
    return {
        "deliverable_id": str(row.id),
        "action": action,
        "status": row.status,
        "event_recorded": True,
    }
