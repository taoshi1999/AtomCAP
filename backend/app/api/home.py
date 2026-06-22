"""首页聚合 API。

首页是用户进入系统后的真实工作台，数据必须来自当前租户数据库，而不是前端静态占位。
本端点聚合首屏需要的轻量数据：用户/机构、当前偏好、会话、交付物、项目与基础统计。
深度对象详情仍由各领域端点按需读取。
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.models import Deal, Deliverable, Institution, PreferenceProfileRow, User
from app.objects.thesis import ThesisStatus
from app.services import preferences as preferences_service
from app.services.conversations import list_conversation_summaries
from app.services.deals import list_deals

router = APIRouter()


def _deliverable_title(row: Deliverable) -> str:
    payload = row.payload or {}
    if row.type == "thesis":
        name = payload.get("thesis_name") or "未命名赛道"
        return f"{name}赛道前瞻"
    if row.type == "deal_list":
        return payload.get("pool_name") or payload.get("title") or "候选项目池"
    return payload.get("title") or f"{row.type} 交付对象"


async def _conversation_items(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """会话列表投影——复用 services.conversations 的统一口径（与历史窗口同源）。"""
    items, _total = await list_conversation_summaries(
        db, institution_id=institution_id, user_id=user_id, limit=limit
    )
    return items


async def _deliverable_items(
    db: AsyncSession, *, institution_id: uuid.UUID, limit: int | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(Deliverable)
        .where(
            Deliverable.institution_id == institution_id,
            or_(Deliverable.status.is_(None), Deliverable.status != ThesisStatus.DELETED.value),
        )
        .order_by(Deliverable.updated_at.desc(), Deliverable.created_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(row.id),
            "type": row.type,
            "title": _deliverable_title(row),
            "status": row.status,
            "updated_at": row.updated_at.isoformat(),
        }
        for row in rows
    ]


async def _deal_status_counts(
    db: AsyncSession, *, institution_id: uuid.UUID
) -> dict[str, int]:
    rows = (
        await db.execute(
            select(Deal.status, func.count())
            .where(
                Deal.institution_id == institution_id,
                or_(Deal.status.is_(None), Deal.status != "deleted"),
            )
            .group_by(Deal.status)
        )
    ).all()
    return {status: count for status, count in rows}


async def _preference_profile_count(
    db: AsyncSession, *, institution_id: uuid.UUID
) -> int:
    """当前机构未归档的命名投资偏好卡片数量。"""
    count = await db.scalar(
        select(func.count())
        .select_from(PreferenceProfileRow)
        .where(
            PreferenceProfileRow.institution_id == institution_id,
            PreferenceProfileRow.archived.is_(False),
        )
    )
    return int(count or 0)


@router.get("")
async def get_home(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """首页首屏数据。所有查询都以 CurrentUser 的 institution_id 做租户过滤。"""
    user_row = await db.get(User, user.user_id)
    institution = await db.get(Institution, user.institution_id)
    preference_row = await preferences_service.get_active_row(
        db, institution_id=user.institution_id
    )
    preference = (
        {
            "exists": True,
            "version": preference_row.version,
            "updated_at": preference_row.updated_at.isoformat(),
            "preference": preferences_service.validate_payload(preference_row),
        }
        if preference_row is not None
        else {"exists": False, "version": 0, "preference": {}}
    )
    conversations = await _conversation_items(
        db, institution_id=user.institution_id, user_id=user.user_id
    )
    deliverables = await _deliverable_items(
        db, institution_id=user.institution_id
    )
    deals = await list_deals(db, institution_id=user.institution_id, limit=None)
    status_counts = await _deal_status_counts(db, institution_id=user.institution_id)
    preference_profile_count = await _preference_profile_count(
        db, institution_id=user.institution_id
    )

    return {
        "user": {
            "id": str(user.user_id),
            "name": user_row.name if user_row is not None else "",
            "email": user_row.email if user_row is not None else "",
        },
        "institution": {
            "id": str(user.institution_id),
            "name": institution.name if institution is not None else "",
            "allow_overseas_models": bool(user.allow_overseas_models),
        },
        "preference": preference,
        "conversations": conversations,
        "deliverables": deliverables,
        "deals": deals,
        "recent_conversations": conversations[:8],
        "recent_deliverables": deliverables[:8],
        "recent_deals": deals[:8],
        "stats": {
            "conversation_count": len(conversations),
            "deliverable_count": len(deliverables),
            "preference_profile_count": preference_profile_count,
            "deal_status_counts": status_counts,
        },
    }
