"""对话 API —— SSE 流式。

事件协议（前端据此渲染）：
- token:    通用对话的增量文本
- progress: 专用 Agent 长任务的步骤进度（如“正在收集市场信号…”）
- object:   交付结果对象就绪，payload 为 {type, deliverable_id}，前端经渲染注册表展示
- error:    本轮出错（如 LLM 网关不可用），data 为用户可读信息
- done:     本轮结束

实现说明：FastAPI ≥0.106 在流式响应体执行前就会关闭 Depends(get_db) 的会话，
因此流内部直接用 SessionLocal 开短事务（落库即提交，不跨流持锁）。
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.router import Intent, classify_intent
from app.agents.thesis_scout.graph import thesis_scout_graph
from app.api.deps import CurrentUser, get_current_user
from app.db import SessionLocal
from app.llm.client import ModelTier, complete_stream
from app.services.conversations import (
    ensure_conversation,
    load_history,
    save_message,
    text_blocks,
    to_llm_messages,
)

router = APIRouter()

LLM_UNAVAILABLE_MSG = "模型网关暂时不可用，请稍后重试。"


class SendMessageRequest(BaseModel):
    content: str


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """接收用户消息，SSE 返回流式结果。

    租户上下文已注入：消息落库/Agent run 归属 user.institution_id；
    海外模型调用经 allow_overseas 传入档位路由做合规降级（核心约定 5）。
    """

    async def event_stream():
        # 1) 短事务：建会话（如需）→ 取历史 → 用户消息落库 + 记账
        async with SessionLocal() as db, db.begin():
            await ensure_conversation(
                db,
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                title_hint=body.content,
            )
            history = await load_history(
                db, institution_id=user.institution_id, conversation_id=conversation_id
            )
            await save_message(
                db,
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                role="user",
                blocks=text_blocks(body.content),
            )

        # 2) 意图路由（LLM 结构化分类；网关未就绪时降级为 chat）
        try:
            intent = await classify_intent(body.content)
        except Exception:
            intent = None

        if intent and intent.intent is Intent.THESIS_SCOUT and intent.confidence >= 0.7:
            # 3a) 专用 Agent：异步跑赛道前瞻子图，步骤进度实时推送
            #     生产实现：入 ARQ 队列 + Postgres checkpointer，此处骨架先内联执行
            async for chunk in thesis_scout_graph.astream(
                {"query": body.content, "conversation_id": str(conversation_id)},
                stream_mode="values",
            ):
                if chunk.get("progress"):
                    yield {"event": "progress", "data": chunk["progress"]}
                await asyncio.sleep(0)
            # TODO: 子图完成后 → save_deliverable() → 推送对象引用 + assistant 消息落库
            yield {"event": "object", "data": '{"type": "thesis", "deliverable_id": null}'}
        else:
            # 3b) 通用对话：llm.complete_stream() 流式，token 逐段下发
            llm_messages = to_llm_messages(history, body.content)
            parts: list[str] = []
            failed = False
            try:
                async for delta in complete_stream(
                    ModelTier.STANDARD,
                    llm_messages,
                    allow_overseas=user.allow_overseas_models,
                ):
                    parts.append(delta)
                    yield {"event": "token", "data": delta}
            except Exception:
                failed = True
                yield {"event": "error", "data": LLM_UNAVAILABLE_MSG}

            # 4) assistant 消息落库 + 记账（部分成功也落，保住已生成内容）
            answer = "".join(parts)
            if answer:
                async with SessionLocal() as db, db.begin():
                    await save_message(
                        db,
                        institution_id=user.institution_id,
                        user_id=user.user_id,
                        conversation_id=conversation_id,
                        role="assistant",
                        blocks=text_blocks(answer),
                        event_payload={
                            "intent": intent.intent.value if intent else "chat",
                            "tier": ModelTier.STANDARD.value,
                            "truncated": failed,
                        },
                    )

        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_stream())


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
):
    """拉取会话历史（前端刷新/回放用），租户过滤。"""
    async with SessionLocal() as db:
        history = await load_history(
            db,
            institution_id=user.institution_id,
            conversation_id=conversation_id,
            limit=200,
        )
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in history
    ]
