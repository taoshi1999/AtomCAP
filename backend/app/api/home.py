"""首页聚合 API。

首页是用户进入系统后的真实工作台，数据必须来自当前租户数据库，而不是前端静态占位。
本端点聚合首屏需要的轻量数据：用户/机构、当前偏好、会话、交付物、项目与基础统计。
深度对象详情仍由各领域端点按需读取。
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.models import Conversation, Deal, Deliverable, Institution, Message, User
from app.services import preferences as preferences_service
from app.services.conversations import blocks_to_text
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


def _conversation_title(row: Conversation) -> str:
    return row.title or "未命名对话"


async def _latest_message_preview(
    db: AsyncSession, *, institution_id: uuid.UUID, conversation_id: uuid.UUID
) -> str | None:
    message = (
        await db.execute(
            select(Message)
            .where(
                Message.institution_id == institution_id,
                Message.conversation_id == conversation_id,
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
    ).scalars().first()
    if message is None:
        return None
    text = blocks_to_text(message.content)
    return text[:80] if text else None


async def _conversation_items(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    last_message = (
        select(
            Message.conversation_id.label("conversation_id"),
            func.max(Message.created_at).label("last_message_at"),
        )
        .where(Message.institution_id == institution_id)
        .group_by(Message.conversation_id)
        .subquery()
    )
    stmt = (
        select(Conversation, last_message.c.last_message_at)
        .outerjoin(last_message, Conversation.id == last_message.c.conversation_id)
        .where(
            Conversation.institution_id == institution_id,
            Conversation.user_id == user_id,
        )
        .order_by(desc(func.coalesce(last_message.c.last_message_at, Conversation.updated_at)))
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).all()

    items: list[dict[str, Any]] = []
    for conversation, last_message_at in rows:
        preview = await _latest_message_preview(
            db, institution_id=institution_id, conversation_id=conversation.id
        )
        items.append(
            {
                "id": str(conversation.id),
                "title": _conversation_title(conversation),
                "preview": preview,
                "updated_at": (last_message_at or conversation.updated_at).isoformat(),
            }
        )
    return items


async def _deliverable_items(
    db: AsyncSession, *, institution_id: uuid.UUID, limit: int | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(Deliverable)
        .where(Deliverable.institution_id == institution_id)
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
            .where(Deal.institution_id == institution_id)
            .group_by(Deal.status)
        )
    ).all()
    return {status: count for status, count in rows}


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
            "deal_status_counts": status_counts,
        },
    }
