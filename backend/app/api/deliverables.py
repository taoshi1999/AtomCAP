"""交付结果对象 API：详情 / 动作（关注赛道、生成项目池…）。

全部端点带租户过滤；动作必须写 domain_events（核心约定 4），
状态流转与记账成对出现。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.runner import run_deal_sourcing
from app.api.deps import CurrentUser, get_current_user
from app.db import SessionLocal, get_db
from app.models.models import Deliverable
from app.objects import DeliverableType
from app.objects.thesis import ThesisStatus
from app.services.conversations import ensure_conversation, save_message, text_blocks
from app.services.events import record_event
from app.services.thesis_context import thesis_context_from_payload
from app.services.user_actions import (
    THESIS_ACTIONS,
    record_user_action,
    snapshot_from_thesis,
)

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
    # 约定 4 强化：关注赛道/生成项目池落结构化 UserAction，快照存赛道名供经验沉淀复盘。
    ua_type = THESIS_ACTIONS.get(action)
    if ua_type is not None:
        await record_user_action(
            db,
            action_type=ua_type,
            institution_id=user.institution_id,
            user_id=user.user_id,
            target_type=row.type,
            target_id=row.id,
            target_name=(row.payload or {}).get("thesis_name"),
            snapshot=snapshot_from_thesis(row.payload),
        )
    # 生成项目池有专用 SSE 端点（见 generate_deal_pool）真正驱动 deal_sourcing 子图；
    # 简报/重新推荐待 Phase 1 入 ARQ 队列触发对应 agent run。
    return {
        "deliverable_id": str(row.id),
        "action": action,
        "status": row.status,
        "event_recorded": True,
    }


GENERATE_DEAL_POOL_FAILED_MSG = "生成项目池失败，请稍后重试。"


@router.post("/{deliverable_id}/generate-deal-pool")
async def generate_deal_pool(
    deliverable_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Thesis「生成项目池」专用端点：从赛道判断驱动 deal_sourcing，SSE 流式产出 DealList。

    与自然语言触发的公开信号挖掘不同——本端点加载**整份 Thesis 视图**
    （子赛道 / 产业链位置 / 机构匹配度 / 风险）构建 thesis_context，喂给
    gen_search_strategy 据整个赛道判断拆搜索策略（设计文档流程一 Step 2），
    产出的 DealList 自动 source_type=thesis_generated 且回链 source_thesis_id。

    租户过滤 + 类型校验在流前完成（返回 404/422）；真正的状态翻转 / 记账 / 子图执行
    全部在生成器内用 SessionLocal 短事务，避免 FastAPI 在流式响应前关闭请求级会话。
    SSE 事件协议与对话端点一致：progress / object / error / done。
    """
    row = await _get_owned(db, deliverable_id, user)
    if row.type != DeliverableType.THESIS.value:
        raise HTTPException(status_code=422, detail="仅 Thesis 对象可生成项目池")

    thesis_payload = row.payload or {}
    thesis_context = thesis_context_from_payload(thesis_payload)
    thesis_name = thesis_payload.get("thesis_name") or "赛道"
    institution_id = user.institution_id
    user_id = user.user_id
    allow_overseas = user.allow_overseas_models
    conversation_id = uuid.uuid4()  # 为本次项目池生成新建会话承载 run 与 assistant 消息

    async def event_stream():
        # 1) 短事务：翻转 Thesis 状态 → 记账 thesis.deal_pool_requested → 建会话 + 种下用户消息
        async with SessionLocal() as wdb, wdb.begin():
            owned = await wdb.scalar(
                select(Deliverable).where(
                    Deliverable.id == deliverable_id,
                    Deliverable.institution_id == institution_id,
                )
            )
            if owned is not None:
                owned.status = ThesisStatus.DEAL_POOL_GENERATED.value
                await record_event(
                    wdb,
                    institution_id=institution_id,
                    user_id=user_id,
                    event_type=f"{DeliverableType.THESIS.value}.deal_pool_requested",
                    subject_type=DeliverableType.THESIS.value,
                    subject_id=owned.id,
                    payload={
                        "action": "generate_deal_pool",
                        "track": thesis_name,
                        "conversation_id": str(conversation_id),
                    },
                )
            await ensure_conversation(
                wdb,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                title_hint=f"{thesis_name} 项目池",
            )
            await save_message(
                wdb,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                role="user",
                blocks=text_blocks(f"根据《{thesis_name}》赛道判断生成候选项目池"),
                event_payload={
                    "intent": "deal_sourcing",
                    "source_thesis_id": str(deliverable_id),
            