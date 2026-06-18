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

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.agents.router import Intent, classify_intent
from app.agents.runner import run_deal_intake, run_deal_sourcing, run_thesis_scout
from app.api.deps import CurrentUser, get_current_user
from app.config import settings
from app.services.document_extract import (
    DependencyMissingError,
    DocumentError,
    extract_text,
)
from app.db import SessionLocal
from app.llm.client import ModelTier, complete_stream
from app.models.models import Conversation, Message
from app.services.conversations import (
    ensure_conversation,
    load_history,
    save_message,
    text_blocks,
    to_llm_messages,
)

router = APIRouter()

LLM_UNAVAILABLE_MSG = "模型服务暂时不可用，请检查 DEEPSEEK_API_KEY / LITELLM 配置后重试。"


class SendMessageRequest(BaseModel):
    content: str


async def classify_intent_bounded(content: str):
    """限时意图分类——通用 Agent 主图第一步的兜底封装。

    分类是一次额外的结构化 LLM 调用（complete_structured 最多两次串行调用、
    每次按请求超时阻塞）。一旦网关慢或不可达，未限时就会让整条 SSE 流静默卡在
    “正在理解你的问题”，通用对话 Agent 永远不被触发。这里用 wait_for 设上限，
    超时或任何异常都返回 None，由调用方降级为通用对话。
    """
    try:
        return await asyncio.wait_for(
            classify_intent(content),
            timeout=settings.intent_classify_timeout_seconds,
        )
    except Exception:
        return None


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """读取当前用户的一条会话历史，用于首页「最近」打开真实上下文。"""
    async with SessionLocal() as db:
        conversation = await db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.institution_id == user.institution_id,
                Conversation.user_id == user.user_id,
            )
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        messages = (
            await db.execute(
                select(Message)
                .where(
                    Message.conversation_id == conversation_id,
                    Message.institution_id == user.institution_id,
                )
                .order_by(Message.created_at.asc(), Message.id.asc())
            )
        ).scalars().all()
        return {
            "conversation": {
                "id": str(conversation.id),
                "title": conversation.title,
                "updated_at": conversation.updated_at.isoformat(),
            },
            "messages": [
                {
                    "id": str(message.id),
                    "role": message.role,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                }
                for message in messages
            ],
        }


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

        # 2) 意图路由（LLM 结构化分类；网关未就绪/超时一律降级为通用对话）。
        #    立即下发一个进度事件：既让前端确认后端已接管、也促使 SSE 通道立刻
        #    开始 flush（排除中间层缓冲）。分类限时见 classify_intent_bounded。
        yield {"event": "progress", "data": "正在理解你的问题"}
        intent = await classify_intent_bounded(body.content)

        if intent and intent.intent is Intent.THESIS_SCOUT and intent.confidence >= 0.7:
            # 3a) 专用 Agent：run 生命周期 + 子图执行 + deliverable 入库 +
            #     assistant 消息（object_ref）全部由 agents/runner.py 编排，
            #     状态流转写 domain_events。生产形态迁 ARQ 队列 + checkpointer。
            async for ev in run_thesis_scout(
                institution_id=user.institution_id,
                user_id=user.user_id,
                allow_overseas=user.allow_overseas_models,
                conversation_id=conversation_id,
                query=body.content,
            ):
                yield ev
        elif intent and intent.intent is Intent.DEAL_SOURCING and intent.confidence >= 0.7:
            # 3a') 项目获取（Deal Sourcing 搜寻流）：同 run 生命周期编排，产出 DealList。
            #      自然语言触发走公开信号挖掘；从 Thesis「生成项目池」触发由专用端点传 thesis_id。
            async for ev in run_deal_sourcing(
                institution_id=user.institution_id,
                user_id=user.user_id,
                allow_overseas=user.allow_overseas_models,
                conversation_id=conversation_id,
                query=body.content,
            ):
                yield ev
        elif intent and intent.intent is Intent.DEAL_INTAKE and intent.confidence >= 0.7:
            # 3a'') 项目获取（Deal Intake 分析流）：用户带入某个具体项目（粘贴介绍/公司名/BP 文本）。
            #       产出 Company + Deal 业务对象并进入项目工作台。文件型 BP 解析（上传 PDF/Word）
            #       由专用上传端点抽取文本后再走本流，自然语言触发以消息正文为材料。
            async for ev in run_deal_intake(
                institution_id=user.institution_id,
                user_id=user.user_id,
                allow_overseas=user.allow_overseas_models,
                conversation_id=conversation_id,
                material=body.content,
                source_type="user_input",
            ):
                yield ev
        else:
            # 3b) 通用对话：llm.complete_stream() 流式，token 逐段下发。
            #     先发进度事件，让前端确认通用 Agent 已接管（与分类阶段区分开）。
            yield {"event": "progress", "data": "正在生成回答"}
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
            except Exception as exc:  # noqa: BLE001
                # 把真实错误透出给前端（连接超时 / 401 / 模型不存在 / 余额不足等），
                # 便于用户直接定位环境问题，而不是停在静默的“正在理解你的问题”。
                failed = True
                detail = f"{type(exc).__name__}: {exc}".strip()
                yield {"event": "error", "data": f"{LLM_UNAVAILABLE_MSG}（{detail[:300]}）"}

            # 4) assistant 消息落库 + 记账（部分成功也落，保住已生成内容）
            answer = "".join(parts)
            if not answer and not failed:
                # 模型返回了空内容：给用户一个明确提示，避免气泡停在进度文案；
                # 空响应不落库以保持历史干净。
                yield {"event": "token", "data": "（模型未返回内容，请重试或换一种问法）"}
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


@router.post("/{conversation_id}/upload")
async def upload_material(
    conversation_id: uuid.UUID,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """上传 BP / 项目表（PDF/Word/Excel/文本）→ 抽取文本 → 走 Deal Intake 分析流（SSE）。

    文件型材料触发：先在 API 层把文件抽成纯文本（app/services/document_extract.py，纯函数、
    离线可测），再以同一个 run_deal_intake 编排产出 Company + Deal 业务对象进入项目工作台。
    source_type 由文件类型推断：Excel→internal_excel（内部项目表），PDF/Word/文本→bp_upload。
    解析失败（格式不支持/超限/空文件）返回 4xx；依赖缺失（部署遗漏）返回 503。
    """
    data = await file.read()
    try:
        result = extract_text(
            filename=file.filename or "",
            data=data,
            content_type=file.content_type,
        )
    except DependencyMissingError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except DocumentError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    async def event_stream():
        # 1) 短事务：建会话（如需）→ 把「已上传 BP」记成一条 user 消息（材料正文落库可回放）
        async with SessionLocal() as db, db.begin():
            await ensure_conversation(
                db,
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                title_hint=file.filename or "上传项目材料",
            )
            await save_message(
                db,
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                role="user",
                blocks=text_blocks(f"[上传文件] {file.filename}\n\n{result.text}"),
            )

        # 2) 抽取层告警（如扫描件 PDF 抽不到文字）以 progress 先行下发，便于前端提示
        for w in result.warnings:
            yield {"event": "progress", "data": w}

        # 3) 直接进 Deal Intake 分析流（上传即「分析一个具体项目」，无需再过意图分类）
        async for ev in run_deal_intake(
            institution_id=user.institution_id,
            user_id=user.user_id,
            allow_overseas=user.allow_overseas_models,
            conversation_id=conversation_id,
            material=result.text,
            source_type=result.source_type.value,
        ):
            yield ev

        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_stream())
