"""项目库 / 项目工作台 API：列表 / 详情 / 管线流转 / 用户反馈动作。

设计依据《项目获取Agent》：Deal Intake 分析流创建 Deal 后自动进入项目工作台，
搜寻流候选沉淀到项目库；本路由提供项目进系统后的读取与推进能力。

全部端点带租户行级过滤；状态流转与用户动作必须写 domain_events（核心约定 4）。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.objects.deal import DealStatus
from app.services.deals import (
    USER_ACTIONS,
    DealNotFound,
    InvalidTransition,
    apply_deal_action,
    get_deal_detail,
    list_deals,
    transition_deal_status,
)

router = APIRouter()


@router.get("")
async def get_deals(
    status: str | None = Query(default=None, description="按管线状态过滤"),
    in_library: bool | None = Query(default=None, description="按是否已加入项目库过滤"),
    limit: int = Query(default=100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目库列表视图（租户隔离）。"""
    if status is not None and status not in {s.value for s in DealStatus}:
        raise HTTPException(status_code=422, detail=f"未知状态: {status}")
    items = await list_deals(
        db,
        institution_id=user.institution_id,
        status=status,
        in_library=in_library,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@router.get("/{deal_id}")
async def get_deal(
    deal_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目工作台详情：完整画像 + 关联 Company。"""
    detail = await get_deal_detail(
        db, institution_id=user.institution_id, deal_id=deal_id
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return detail


class TransitionBody(BaseModel):
    to_status: str = Field(description="目标管线状态")


@router.post("/{deal_id}/transition")
async def transition(
    deal_id: uuid.UUID,
    body: TransitionBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """管线状态流转（sourced→screening→pre_dd→ic_ready→approved/rejected）。"""
    try:
        deal = await transition_deal_status(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            to_status=body.to_status,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidTransition as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"deal_id": str(deal.id), "status": deal.status, "event_recorded": True}


@router.post("/{deal_id}/actions/{action}")
async def trigger_action(
    deal_id: uuid.UUID,
    action: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目库/工作台用户动作：add_to_library / follow / dismiss / abandon / create_workspace。"""
    if action not in USER_ACTIONS:
        raise HTTPException(status_code=422, detail=f"未知动作: {action}")
    ctx: dict = {}
    if action == "create_workspace":
        # 用户在项目库手动创建工作台时新建承载会话（Deal Intake 自动流已自带会话）
        ctx["conversation_id"] = uuid.uuid4()
    try:
        deal = await apply_deal_action(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            action=action,
            ctx=ctx,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidTransition as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {
        "deal_id": str(deal.id),
        "action": action,
        "status": deal.status,
        "user_feedback": (deal.data or {}).get("user_feedback"),
        "workspace": (deal.data or {}).get("workspace"),
        "event_recorded": True,
    }
