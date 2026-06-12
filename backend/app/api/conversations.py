"""对话 API —— SSE 流式。

事件协议（前端据此渲染）：
- token:    通用对话的增量文本
- progress: 专用 Agent 长任务的步骤进度（如“正在收集市场信号…”）
- object:   交付结果对象就绪，payload 为 {type, deliverable_id}，前端经渲染注册表展示
- done:     本轮结束

骨架阶段：意图路由已接通，赛道前瞻子图以占位方式运行。
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

router = APIRouter()


class SendMessageRequest(BaseModel):
    content: str


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """接收用户消息，SSE 返回流式结果。

    租户上下文已注入：后续消息落库/Agent run 归属 user.institution_id；
    海外模型调用前需检查 user.allow_overseas_models（核心约定 5）。
    """

    async def event_stream():
        # 1) 意图路由（LLM 结构化分类；网关未就绪时降级为 chat）
        try:
            intent = await classify_intent(body.content)
        except Exception:
            intent = None

        if intent and intent.intent is Intent.THESIS_SCOUT and intent.confidence >= 0.7:
            # 2a) 专用 Agent：异步跑赛道前瞻子图，步骤进度实时推送
            #     生产实现：入 ARQ 队列 + Postgres checkpointer，此处骨架先内联执行
            async for chunk in thesis_scout_graph.astream(
                {"query": body.content, "conversation_id": str(conversation_id)},
                stream_mode="values",
            ):
                if chunk.get("progress"):
                    yield {"event": "progress", "data": chunk["progress"]}
                await asyncio.sleep(0)
            # TODO: 子图完成后 → save_deliverable() → 推送对象引用
            yield {"event": "object", "data": '{"type": "thesis", "deliverable_id": null}'}
        else:
            # 2b) 通用对话（TODO: 接 complete() 流式 + 工具调用）
            yield {"event": "token", "data": "（通用对话能力接入中）"}

        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_stream())
