"""交付结果对象 API：详情 / 动作（关注赛道、生成项目池…）。

全部端点带租户过滤；动作必须写 domain_events（核心约定 4），
状态流转与记账成对出现。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.runner import run_deal_sourcing
from app.api.deps import CurrentUser, get_current_user
from app.db import SessionLocal, get_db
from app.models.models import Deliverable
from app.objects import DeliverableType
from app.objects.base import Claim
from app.objects.thesis import (
    FitScoreBreakdown,
    SubDirection,
    Thesis,
    ThesisStatus,
    ValueChain,
)
from app.services.conversations import ensure_conversation, save_message, text_blocks
from app.services.deliverables import save_deliverable
from app.services.events import record_event
from app.services import track_assistant
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
    "join_project_library": "project_library_joined",
    "dismiss_track": "dismissed",
}


class CreateThesisBody(BaseModel):
    thesis_name: str = Field(min_length=1, max_length=120, description="赛道名称")
    one_line_view: str | None = Field(default=None, max_length=500, description="一句话判断")
    opportunity_level: str = Field(default="中", max_length=20)
    risk_level: str = Field(default="中", max_length=20)
    advice: str | None = Field(default=None, max_length=500)
    sub_directions: list[str] = Field(default_factory=list, description="子方向名称，少于 3 个会自动补足")


class DeliverableActionBody(BaseModel):
    source_sub_direction: str | None = Field(
        default=None,
        max_length=120,
        description="触发动作的子赛道名称；为空表示作用于整份 Thesis。",
    )
    note: str | None = Field(default=None, max_length=500)


def _manual_fit(rationale: str) -> FitScoreBreakdown:
    return FitScoreBreakdown(
        track_preference=50,
        stage_match=50,
        moat_match=50,
        geo_match=50,
        risk_appetite_match=50,
        history_similarity=50,
        exclusion_penalty=0,
        total=50,
        rationale=rationale,
    )


def _manual_thesis_payload(body: CreateThesisBody) -> Thesis:
    thesis_name = body.thesis_name.strip()
    names = [name.strip() for name in body.sub_directions if name.strip()]
    while len(names) < 3:
        names.append(f"{thesis_name} 子方向 {len(names) + 1}")

    sub_directions = [
        SubDirection(
            name=name,
            detail="用户手动创建的子方向，等待进一步研究与证据补充。",
            investment_reasons=[
                Claim(text="该方向由用户手动加入赛道库，需补充市场信号与证据链。", inferred=True)
            ],
            suitable_stage="待确认",
            fit_score=_manual_fit("手动创建草稿，暂无完整机构匹配度评分。"),
        )
        for name in names[:7]
    ]
    return Thesis(
        thesis_name=thesis_name,
        one_line_view=body.one_line_view or f"{thesis_name} 是用户手动创建的赛道草稿。",
        opportunity_level=body.opportunity_level,
        risk_level=body.risk_level,
        advice=body.advice or "建议通过赛道前瞻 Agent 补充信号、证据链与机构匹配度。",
        sub_directions=sub_directions,
        investment_reason=[
            Claim(text="用户手动创建赛道，系统尚未完成外部信号验证。", inferred=True)
        ],
        institution_fit_score=_manual_fit("手动创建草稿，需进一步结合机构偏好评分。"),
        value_chain=ValueChain(),
        key_risks=[
            Claim(text="缺少公开信号、代表公司与竞争格局验证。", inferred=True)
        ],
        status=ThesisStatus.DRAFT,
    )


@router.post("/manual-thesis")
async def create_manual_thesis(
    body: CreateThesisBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """手动创建赛道 Thesis 草稿，进入赛道库。"""
    payload = _manual_thesis_payload(body)
    row = await save_deliverable(
        db,
        institution_id=user.institution_id,
        dtype=DeliverableType.THESIS,
        payload=payload.model_dump(mode="json"),
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="thesis.created",
        subject_type=DeliverableType.THESIS.value,
        subject_id=row.id,
        payload={"source": "manual", "track": payload.thesis_name},
    )
    return {
        "id": str(row.id),
        "type": row.type,
        "title": payload.thesis_name,
        "status": row.status,
        "updated_at": row.updated_at.isoformat(),
    }


class TrackAssistantRequest(BaseModel):
    instruction: str


@router.post("/tracks/assistant")
async def track_assistant_endpoint(
    body: TrackAssistantRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """赛道库会话栏指令助手：解析自然语言 → 自动创建 / 筛选赛道，或提示无关请求。

    - create：解析出赛道草稿并复用手动建赛道逻辑落库（写 thesis.created，source=assistant），
      返回新赛道摘要，前端在右侧栏刷新出现；
    - filter：返回筛选关键词，前端据此在右侧栏过滤已有赛道；
    - unrelated：返回提示，引导用户输入与赛道相关的请求。
    """
    result = await track_assistant.interpret_instruction(
        body.instruction, allow_overseas=user.allow_overseas_models
    )
    if result.action == track_assistant.ACTION_CREATE and result.thesis is not None:
        draft = result.thesis
        payload = _manual_thesis_payload(
            CreateThesisBody(
                thesis_name=draft.thesis_name,
                one_line_view=draft.one_line_view,
                opportunity_level=draft.opportunity_level,
                risk_level=draft.risk_level,
                sub_directions=draft.sub_directions,
            )
        )
        row = await save_deliverable(
            db,
            institution_id=user.institution_id,
            dtype=DeliverableType.THESIS,
            payload=payload.model_dump(mode="json"),
        )
        await record_event(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            event_type="thesis.created",
            subject_type=DeliverableType.THESIS.value,
            subject_id=row.id,
            payload={"source": "assistant", "track": payload.thesis_name},
        )
        return {
            "action": "create",
            "message": result.message,
            "deliverable": {
                "id": str(row.id),
                "type": row.type,
                "title": payload.thesis_name,
                "status": row.status,
                "updated_at": row.updated_at.isoformat(),
            },
        }
    if result.action == track_assistant.ACTION_FILTER:
        return {
            "action": "filter",
            "message": result.message,
            "filter_keywords": result.filter_keywords,
        }
    return {
        "action": "unrelated",
        "message": result.message or track_assistant.UNRELATED_MESSAGE,
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
    body: DeliverableActionBody | None = Body(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """对象上的动作按钮：关注、生成项目池、简报、加入项目库、不感兴趣等。"""
    if action not in ACTION_EVENT_SUFFIX:
        raise HTTPException(status_code=422, detail=f"未知动作: {action}")

    row = await _get_owned(db, deliverable_id, user)
    action_body = body or DeliverableActionBody()
    source_sub_direction = action_body.source_sub_direction

    if action in {"follow_track", "join_project_library"}:
        row.status = ThesisStatus.FOLLOWING.value  # 已关注 → 进入定时监控（Phase 4 cron）
    elif action == "dismiss_track" and not source_sub_direction:
        # 子赛道级“不感兴趣”只记录偏好信号；整份 Thesis 级动作才隐藏该赛道。
        row.status = ThesisStatus.DELETED.value

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
            "source_sub_direction": source_sub_direction,
            "note": action_body.note,
        },
    )
    # 约定 4 强化：关注赛道/生成项目池落结构化 UserAction，快照存赛道名供经验沉淀复盘。
    ua_type = THESIS_ACTIONS.get(action)
    if ua_type is not None:
        snapshot = snapshot_from_thesis(row.payload)
        if source_sub_direction:
            snapshot.sub_sector = source_sub_direction
        await record_user_action(
            db,
            action_type=ua_type,
            institution_id=user.institution_id,
            user_id=user.user_id,
            target_type=row.type,
            target_id=row.id,
            target_name=(row.payload or {}).get("thesis_name"),
            snapshot=snapshot,
            extra_payload={
                "source_sub_direction": source_sub_direction,
                "note": action_body.note,
            },
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
    body: DeliverableActionBody | None = Body(default=None),
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
    action_body = body or DeliverableActionBody()
    source_sub_direction = action_body.source_sub_direction
    if source_sub_direction:
        sub_directions = thesis_context.get("sub_directions")
        if isinstance(sub_directions, list):
            selected = [
                item
                for item in sub_directions
                if isinstance(item, dict) and item.get("name") == source_sub_direction
            ]
            if selected:
                thesis_context["sub_directions"] = selected
                thesis_context["selected_sub_direction"] = selected[0]
        thesis_context["scope"] = {
            "source_sub_direction": source_sub_direction,
            "instruction": "仅围绕该子赛道生成候选项目池",
        }
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
                        "source_sub_direction": source_sub_direction,
                        "conversation_id": str(conversation_id),
                    },
                )
                snapshot = snapshot_from_thesis(owned.payload)
                if source_sub_direction:
                    snapshot.sub_sector = source_sub_direction
                await record_user_action(
                    wdb,
                    action_type=THESIS_ACTIONS["generate_deal_pool"],
                    institution_id=institution_id,
                    user_id=user_id,
                    target_type=DeliverableType.THESIS.value,
                    target_id=owned.id,
                    target_name=thesis_name,
                    snapshot=snapshot,
                    extra_payload={"source_sub_direction": source_sub_direction},
                )
            await ensure_conversation(
                wdb,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                title_hint=(
                    f"{thesis_name} · {source_sub_direction} 项目池"
                    if source_sub_direction
                    else f"{thesis_name} 项目池"
                ),
            )
            await save_message(
                wdb,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                role="user",
                blocks=text_blocks(
                    f"根据《{thesis_name}》中的「{source_sub_direction}」子赛道判断生成候选项目池"
                    if source_sub_direction
                    else f"根据《{thesis_name}》赛道判断生成候选项目池"
                ),
                event_payload={
                    "intent": "deal_sourcing",
                    "source_thesis_id": str(deliverable_id),
                    "source_sub_direction": source_sub_direction,
                },
            )

        # 2) 进 deal_sourcing 搜寻流：source_thesis_id + thesis_context 驱动策略，DealList 回链
        query = (
            f"根据《{thesis_name}》中的「{source_sub_direction}」子赛道判断，找一批匹配的候选项目"
            if source_sub_direction
            else f"根据《{thesis_name}》赛道判断，找一批匹配的候选项目"
        )
        async for ev in run_deal_sourcing(
            institution_id=institution_id,
            user_id=user_id,
            allow_overseas=allow_overseas,
            conversation_id=conversation_id,
            query=query,
            source_thesis_id=deliverable_id,
            thesis_context=thesis_context,
        ):
            yield ev

        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_stream())
