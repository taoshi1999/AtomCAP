"""对话 API —— SSE 流式。

事件协议（前端据此渲染）：
- token:     通用对话的增量正文
- react_step: Agent 可见工作过程（下一步计划、工具调用、执行结果）
- usage:     本轮 token 用量（{prompt_tokens, completion_tokens, total_tokens}），每条消息 token 数
- progress:  专用 Agent 长任务的步骤进度（如“正在收集市场信号…”）
- object:   交付结果对象就绪，payload 为 {type, deliverable_id}，前端经渲染注册表展示
- file:     文件生成工具产出，payload 为 {type, file_id, filename, download_url, ...}
- error:    本轮出错（如 LLM 网关不可用），data 为用户可读信息
- done:     本轮结束

实现说明：FastAPI ≥0.106 在流式响应体执行前就会关闭 Depends(get_db) 的会话，
因此流内部直接用 SessionLocal 开短事务（落库即提交，不跨流持锁）。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.agents.react_planner import generate_visible_react_plan
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
from app.llm.client import ModelTier, coerce_tier, stream_chat
from app.models.models import Company, Conversation, Deal, Deliverable, Document, Message
from app.objects import DeliverableType
from app.services.conversations import (
    CONVERSATION_TYPE_PROJECT_WORKSPACE,
    ConversationTypeMismatch,
    assistant_blocks,
    blocks_to_text,
    compose_user_content,
    ensure_conversation,
    list_conversation_summaries,
    load_history,
    normalize_conversation_type,
    save_message,
    set_conversation_pinned,
    soft_delete_conversation,
    text_blocks,
    to_llm_messages,
)
from app.services import preferences as preferences_service
from app.services.conversation_titles import refresh_conversation_title
from app.services.file_generation import (
    FileGenerationError,
    detect_file_generation_request,
    generate_file_from_request,
    get_generated_file,
)
from app.services.thesis_context import thesis_context_from_payload

router = APIRouter()

LLM_UNAVAILABLE_MSG = "模型服务暂时不可用，请检查 DEEPSEEK_API_KEY / LITELLM 配置后重试。"

PREFERENCE_ADVICE_SYSTEM = """你是 AtomCAP 的投资偏好 Agent。你的任务是识别用户提出的长期投资偏好修正，并给出可审阅的优化建议。
要求：
- 只围绕投资偏好、反偏好、风险边界和推荐过滤逻辑回答。
- 不要生成项目池，不要推荐项目，不要触发项目获取。
- 不要声称已经自动修改数据库；偏好变更必须由用户确认后应用。
- 输出简体中文，结构清晰，包含：识别到的偏好信号、建议修改的字段、建议值、理由、对后续推荐/评分的影响。
- 对“以后不要推荐 X 相关项目”这类请求，优先建议写入 anti_preference.disliked_sectors 或 anti_preference.disliked_subsectors，并同步补充 excluded_tracks/备注。
"""


class SendMessageRequest(BaseModel):
    content: str
    # 用户在对话框选择的模型档位（fast/standard/premium），空/非法回退标准
    model_tier: str | None = None
    # 页面级助手注入的页面上下文：只进 LLM 输入，不写入持久化消息正文/标题
    context: str | None = None
    # normal=普通会话；project_workspace=绑定具体项目的工作台会话。
    conversation_type: str = "normal"
    # 赛道详情页注入上下文时使用，但会话类型仍是 normal。
    source_thesis_id: uuid.UUID | None = None
    # 项目工作台绑定的 Deal id，仅 project_workspace 使用。
    source_deal_id: uuid.UUID | None = None


class PinConversationRequest(BaseModel):
    is_pinned: bool


AGENT_TOOL_CATALOG: list[dict[str, object]] = [
    {
        "id": "conversation_history",
        "name": "对话历史",
        "category": "上下文",
        "description": "读取当前会话最近消息，帮助保持上下文连续。",
        "enabled_by_default": True,
    },
    {
        "id": "investment_preference",
        "name": "投资偏好",
        "category": "机构知识",
        "description": "读取当前机构的投资偏好、反偏好、阶段与地域约束。",
        "enabled_by_default": True,
    },
    {
        "id": "project_library",
        "name": "项目库",
        "category": "内部数据",
        "description": "读取近期项目画像、状态和匹配度，用于项目相关问答。",
        "enabled_by_default": True,
    },
    {
        "id": "thesis_library",
        "name": "赛道库",
        "category": "内部数据",
        "description": "读取近期赛道 Thesis，用于赛道、产业链和投资方向问答。",
        "enabled_by_default": True,
    },
    {
        "id": "workspace_context",
        "name": "当前工作台",
        "category": "页面上下文",
        "description": "读取当前项目或赛道详情页传入的结构化上下文。",
        "enabled_by_default": True,
    },
    {
        "id": "document_reader",
        "name": "项目材料",
        "category": "私有材料",
        "description": "读取当前项目已上传材料和解析状态，用于材料补全与尽调问答。",
        "enabled_by_default": True,
    },
    {
        "id": "market_signal_search",
        "name": "市场信号检索",
        "category": "公开信息",
        "description": "触发或参考公开市场信号检索能力，包括财经新闻、工商、专利、论文和人事变动。",
        "enabled_by_default": True,
    },
    {
        "id": "file_generation",
        "name": "文件生成",
        "category": "生成工具",
        "description": "根据当前会话、项目或赛道上下文生成 Word、Excel、PPT 文件。",
        "enabled_by_default": True,
    },
]

AGENT_TOOL_BY_ID = {str(tool["id"]): tool for tool in AGENT_TOOL_CATALOG}
DEFAULT_AGENT_TOOL_IDS = {
    str(tool["id"]) for tool in AGENT_TOOL_CATALOG if tool.get("enabled_by_default")
}


def tool_name(tool_id: str) -> str:
    return str(AGENT_TOOL_BY_ID.get(tool_id, {}).get("name") or tool_id)


def react_step(
    *,
    loop: int,
    phase: str,
    summary: str,
    details: list[str] | None = None,
    tool_id: str | None = None,
    status: str = "completed",
) -> dict:
    payload = {
        "id": f"loop-{loop}-{phase}-{tool_id or 'none'}",
        "loop": loop,
        "phase": phase,
        "summary": summary,
        "details": details or [],
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if tool_id:
        payload["tool_id"] = tool_id
        payload["tool_name"] = tool_name(tool_id)
    return {"event": "react_step", "data": json.dumps(payload, ensure_ascii=False)}


def _preference_target_hint(content: str) -> str:
    """从显式偏好修正语句里尽力提取对象名，供 LLM 不可用兜底。"""
    text = (content or "").strip().strip("。！？!?")
    for token in (
        "以后不要推荐",
        "今后不要推荐",
        "不要再推荐",
        "别再推荐",
        "不要推荐",
        "以后不看",
        "今后不看",
        "不要再看",
        "别再看",
        "不想看",
        "不想投",
        "排除",
        "避开",
    ):
        text = text.replace(token, "")
    for token in ("相关的项目", "相关项目", "相关的公司", "相关公司", "这个赛道", "这个方向"):
        text = text.replace(token, "")
    return text.strip() or "该方向"


def _preference_advice_fallback(content: str) -> str:
    """模型不可用时仍给出确定性的偏好优化建议，避免误触项目池。"""
    target = _preference_target_hint(content)
    return "\n".join(
        [
            "已识别为长期投资偏好修正请求，不会触发项目获取。",
            "",
            "投资偏好优化建议：",
            f"1. 在 `anti_preference.disliked_subsectors` 中加入「{target}」。",
            f"2. 若「{target}」是一级赛道，也同步加入 `anti_preference.disliked_sectors`。",
            f"3. 在兼容字段 `excluded_tracks` 或偏好备注中记录「不再推荐 {target} 相关项目」。",
            "4. 后续项目获取、赛道匹配和项目评分时，对命中该方向的候选项目做过滤或显著降权。",
            "",
            "说明：我只生成建议，不会直接改写当前投资偏好；需要你在投资偏好页确认后应用。",
        ]
    )


def _compact_text(value: object, *, limit: int = 160) -> str:
    text = str(value or "").strip().replace("\n", " ")
    return text if len(text) <= limit else f"{text[:limit]}…"


async def collect_agent_tool_context(
    db,
    *,
    institution_id: uuid.UUID,
    enabled_tools: set[str],
    history: list[Message],
    active_preference,
    workspace_context: str,
    source_deal_id: uuid.UUID | None,
) -> tuple[str, list[str]]:
    """Collect high-level tool observations for the ReAct loop.

    This is intentionally summary-only: it gives the model useful context without exposing
    hidden reasoning or pretending that a tool was called when it was not available.
    """
    context_parts: list[str] = []
    observations: list[str] = []

    if "conversation_history" in enabled_tools:
        recent_lines: list[str] = []
        for message in history[-6:]:
            if message.role not in ("user", "assistant"):
                continue
            text = _compact_text(blocks_to_text(message.content), limit=120)
            if text:
                recent_lines.append(f"{message.role}: {text}")
        if recent_lines:
            context_parts.append("【工具：对话历史】\n" + "\n".join(recent_lines))
            observations.append(f"对话历史：读取最近 {len(recent_lines)} 条消息。")
        else:
            observations.append("对话历史：当前会话暂无可复用历史。")

    if "investment_preference" in enabled_tools:
        preference_context = preferences_service.describe_for_agent(active_preference)
        if preference_context.strip():
            context_parts.append("【工具：投资偏好】\n" + preference_context)
            observations.append("投资偏好：已读取当前机构偏好。")
        else:
            observations.append("投资偏好：当前机构暂无可用偏好记录。")

    if "workspace_context" in enabled_tools and workspace_context.strip():
        context_parts.append("【工具：当前工作台】\n" + workspace_context.strip())
        observations.append("当前工作台：已读取页面结构化上下文。")

    if "project_library" in enabled_tools:
        rows = (
            await db.execute(
                select(Deal, Company)
                .join(Company, Deal.company_id == Company.id)
                .where(
                    Deal.institution_id == institution_id,
                    Deal.status != "deleted",
                )
                .order_by(Deal.updated_at.desc())
                .limit(5)
            )
        ).all()
        if rows:
            lines: list[str] = []
            for deal, company in rows:
                data = deal.data or {}
                analysis = data.get("analysis") or {}
                extraction = data.get("extraction") or {}
                lines.append(
                    " / ".join(
                        part
                        for part in (
                            company.name if company else extraction.get("company_name"),
                            f"状态={deal.status}",
                            extraction.get("track"),
                            _compact_text(analysis.get("portrait"), limit=80),
                        )
                        if part
                    )
                )
            context_parts.append("【工具：项目库】\n" + "\n".join(lines))
            observations.append(f"项目库：读取最近 {len(lines)} 个项目。")
        else:
            observations.append("项目库：暂无可读取项目。")

    if "thesis_library" in enabled_tools:
        rows = (
            await db.execute(
                select(Deliverable)
                .where(
                    Deliverable.institution_id == institution_id,
                    Deliverable.type == DeliverableType.THESIS.value,
                )
                .order_by(Deliverable.updated_at.desc())
                .limit(5)
            )
        ).scalars().all()
        if rows:
            lines = []
            for row in rows:
                payload = row.payload or {}
                name = payload.get("thesis_name") or payload.get("track_name") or payload.get("name") or "未命名赛道"
                summary = payload.get("one_line_thesis") or payload.get("summary") or payload.get("recommendation")
                lines.append(f"{name} / {_compact_text(summary, limit=100)}")
            context_parts.append("【工具：赛道库】\n" + "\n".join(lines))
            observations.append(f"赛道库：读取最近 {len(lines)} 条 Thesis。")
        else:
            observations.append("赛道库：暂无可读取 Thesis。")

    if "document_reader" in enabled_tools:
        query = select(Document).where(Document.institution_id == institution_id)
        if source_deal_id is not None:
            query = query.where(Document.deal_id == source_deal_id)
        rows = (await db.execute(query.order_by(Document.updated_at.desc()).limit(6))).scalars().all()
        if rows:
            lines = [f"{doc.filename} / {doc.doc_type or '未分类'} / {doc.parse_status}" for doc in rows]
            context_parts.append("【工具：项目材料】\n" + "\n".join(lines))
            observations.append(f"项目材料：读取 {len(lines)} 份材料索引。")
        else:
            observations.append("项目材料：暂无可读取材料。")

    if "market_signal_search" in enabled_tools:
        observations.append("市场信号检索：已开放；若任务需要实时公开信息，会交由专用 Agent 或市场信号服务执行。")

    if "file_generation" in enabled_tools:
        observations.append("文件生成：已开放 Word、Excel、PPT 输出能力，可将当前上下文整理成可下载文件。")

    return "\n\n".join(part for part in context_parts if part.strip()), observations


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


@router.get("")
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """会话历史窗口：当前用户在本租户下的全部会话（分页 + 关键词过滤）。

    投影口径（标题/预览/最后活跃时间）与首页「最近会话」一致，均走
    services.conversations.list_conversation_summaries，避免两处漂移。
    - limit 收敛到 1..100，offset>=0；
    - q 在标题与最近消息预览里大小写无关匹配（Phase 1 再升级为全文检索）。
    返回 {items, total, limit, offset}，total 为过滤后总数，供前端翻页。
    """
    page_size = max(1, min(limit, 100))
    page_offset = max(0, offset)
    async with SessionLocal() as db:
        items, total = await list_conversation_summaries(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            limit=page_size,
            offset=page_offset,
            query=q,
        )
    return {
        "items": items,
        "total": total,
        "limit": page_size,
        "offset": page_offset,
    }


@router.get("/files/{file_id}")
async def download_generated_file(
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """Download a tenant-owned file generated by the conversation Agent."""
    try:
        stored = get_generated_file(institution_id=user.institution_id, file_id=file_id)
    except FileGenerationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        stored.path,
        media_type=stored.mime_type,
        filename=stored.filename,
    )


@router.patch("/{conversation_id}/pin")
async def pin_conversation(
    conversation_id: uuid.UUID,
    body: PinConversationRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """置顶或取消置顶当前用户的一条会话。"""
    async with SessionLocal() as db, db.begin():
        conversation = await set_conversation_pinned(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            conversation_id=conversation_id,
            is_pinned=body.is_pinned,
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        return {
            "conversation_id": str(conversation.id),
            "is_pinned": bool(conversation.is_pinned),
            "pinned_at": conversation.pinned_at.isoformat() if conversation.pinned_at else None,
            "event_recorded": True,
        }


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """软删除当前用户的一条会话：从列表隐藏，保留消息和事件流水。"""
    async with SessionLocal() as db, db.begin():
        conversation = await soft_delete_conversation(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            conversation_id=conversation_id,
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        return {
            "conversation_id": str(conversation.id),
            "deleted_at": conversation.deleted_at.isoformat() if conversation.deleted_at else None,
            "event_recorded": True,
        }


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
                Conversation.deleted_at.is_(None),
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
                "conversation_type": normalize_conversation_type(conversation.conversation_type),
                "source_deal_id": str(conversation.source_deal_id) if conversation.source_deal_id else None,
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
        workspace_thesis_context: dict | None = None
        workspace_thesis_name: str | None = None
        workspace_deal_context: dict | None = None
        workspace_deal_name: str | None = None
        conversation_type = normalize_conversation_type(body.conversation_type)
        enabled_tools = set(DEFAULT_AGENT_TOOL_IDS)
        tool_context = ""
        tool_observations: list[str] = []
        react_steps: list[dict[str, Any]] = []

        def emit_react_step(**kwargs) -> dict:
            event = react_step(**kwargs)
            react_steps.append(json.loads(event["data"]))
            return event

        yield emit_react_step(
            loop=1,
            phase="analysis",
            summary="已收到指令，正在分析任务类型和可用上下文。",
            details=[
                f"会话类型：{conversation_type}",
                "系统将按默认策略读取必要上下文。",
            ],
            status="running",
        )
        # 赛道页 AI 助手只注入赛道上下文，会话仍归为普通会话。
        source_thesis_id = body.source_thesis_id
        source_deal_id = (
            body.source_deal_id
            if conversation_type == CONVERSATION_TYPE_PROJECT_WORKSPACE
            else None
        )
        if conversation_type == CONVERSATION_TYPE_PROJECT_WORKSPACE and source_deal_id is None:
            yield {"event": "error", "data": "项目工作台会话必须绑定一个项目。"}
            yield {"event": "done", "data": ""}
            return
        async with SessionLocal() as db, db.begin():
            if source_thesis_id is not None:
                thesis_row = await db.scalar(
                    select(Deliverable).where(
                        Deliverable.id == source_thesis_id,
                        Deliverable.institution_id == user.institution_id,
                        Deliverable.type == DeliverableType.THESIS.value,
                    )
                )
                if thesis_row is None:
                    yield {"event": "error", "data": "赛道工作台绑定的赛道不存在。"}
                    yield {"event": "done", "data": ""}
                    return
                payload = thesis_row.payload or {}
                workspace_thesis_context = thesis_context_from_payload(payload)
                workspace_thesis_name = payload.get("thesis_name") or "未命名赛道"

            if source_deal_id is not None:
                deal_row = await db.scalar(
                    select(Deal).where(
                        Deal.id == source_deal_id,
                        Deal.institution_id == user.institution_id,
                    )
                )
                if deal_row is None:
                    yield {"event": "error", "data": "项目工作台绑定的项目不存在。"}
                    yield {"event": "done", "data": ""}
                    return
                company = await db.scalar(
                    select(Company).where(
                        Company.id == deal_row.company_id,
                        Company.institution_id == user.institution_id,
                    )
                )
                data = deal_row.data or {}
                extraction = data.get("extraction") or {}
                analysis = data.get("analysis") or {}
                workspace_deal_name = company.name if company else extraction.get("company_name") or "未命名项目"
                workspace_deal_context = {
                    "deal_id": str(deal_row.id),
                    "company_id": str(deal_row.company_id),
                    "company_name": workspace_deal_name,
                    "status": deal_row.status,
                    "source_type": data.get("source_type"),
                    "extraction": extraction,
                    "analysis": analysis,
                    "user_feedback": data.get("user_feedback") or {},
                    "workspace": data.get("workspace") or {},
                }

            title_hint = (
                f"项目工作台 · {workspace_deal_name}"
                if conversation_type == CONVERSATION_TYPE_PROJECT_WORKSPACE
                else None
            )

            try:
                await ensure_conversation(
                    db,
                    institution_id=user.institution_id,
                    user_id=user.user_id,
                    conversation_id=conversation_id,
                    title_hint=title_hint,
                    conversation_type=conversation_type,
                    source_deal_id=source_deal_id,
                )
            except ConversationTypeMismatch as exc:
                yield {"event": "error", "data": str(exc)}
                yield {"event": "done", "data": ""}
                return
            history = await load_history(
                db, institution_id=user.institution_id, conversation_id=conversation_id
            )
            active_preference = await preferences_service.get_active(
                db, institution_id=user.institution_id
            )
            workspace_context_for_tools = ""
            if workspace_thesis_context:
                workspace_context_for_tools = json.dumps(
                    workspace_thesis_context,
                    ensure_ascii=False,
                    default=str,
                )
            if workspace_deal_context:
                workspace_context_for_tools = json.dumps(
                    workspace_deal_context,
                    ensure_ascii=False,
                    default=str,
                )
            tool_context, tool_observations = await collect_agent_tool_context(
                db,
                institution_id=user.institution_id,
                enabled_tools=enabled_tools,
                history=history,
                active_preference=active_preference,
                workspace_context=workspace_context_for_tools,
                source_deal_id=source_deal_id,
            )
            await save_message(
                db,
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                role="user",
                blocks=text_blocks(body.content),
                event_payload={
                    "conversation_type": conversation_type,
                    "source_thesis_id": str(source_thesis_id) if source_thesis_id else None,
                    "source_thesis_name": workspace_thesis_name,
                    "source_deal_id": str(source_deal_id) if source_deal_id else None,
                    "source_deal_name": workspace_deal_name,
                },
            )

        target_format = detect_file_generation_request(body.content)
        if target_format:
            selected_intent = "file_generation"
            yield {"event": "progress", "data": "正在准备文件生成上下文"}
            route_plan = await generate_visible_react_plan(
                user_request=body.content,
                intent=selected_intent,
                progress="识别为文件生成任务，准备组织会话和工作台上下文",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=1,
                phase="action",
                summary=route_plan,
                details=[
                    "识别意图：file_generation",
                    "下一步会把会话、投资偏好、项目/赛道工作台上下文交给文件生成工具。",
                ],
            )
            yield emit_react_step(
                loop=1,
                phase="observation",
                summary="工具上下文读取完成，已形成文件生成输入。",
                details=tool_observations or ["本轮没有额外工具反馈。"],
            )
            yield emit_react_step(
                loop=1,
                phase="summary",
                summary="已确定需要生成可下载文件，而不是只返回文本回答。",
                details=[f"目标格式：{target_format}"],
            )

            workspace_context = ""
            if source_thesis_id and workspace_thesis_context:
                workspace_context = "\n".join(
                    [
                        "对话类型：赛道工作台",
                        f"当前操作对象：{workspace_thesis_name}",
                        f"source_thesis_id：{source_thesis_id}",
                        "当前赛道结构化上下文：",
                        json.dumps(
                            workspace_thesis_context,
                            ensure_ascii=False,
                            default=str,
                        ),
                    ]
                )
            elif source_deal_id and workspace_deal_context:
                workspace_context = "\n".join(
                    [
                        "对话类型：项目工作台",
                        f"当前操作对象：{workspace_deal_name}",
                        f"source_deal_id：{source_deal_id}",
                        "当前项目结构化上下文：",
                        json.dumps(
                            workspace_deal_context,
                            ensure_ascii=False,
                            default=str,
                        ),
                    ]
                )
            runtime_context = "\n\n".join(
                part
                for part in ((body.context or "").strip(), workspace_context, tool_context)
                if part
            )

            file_plan = await generate_visible_react_plan(
                user_request=body.content,
                intent=selected_intent,
                progress="进入文件生成工具，准备产出可下载文件",
                observations=[
                    *tool_observations,
                    f"目标格式：{target_format}",
                    f"上下文长度：{len(runtime_context)} 字符",
                ],
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=file_plan,
                details=[
                    "工具输入：用户请求、会话历史、投资偏好、项目/赛道上下文。",
                    "工具输出：可下载文件引用和文件元数据。",
                ],
                tool_id="file_generation",
                status="running",
            )
            try:
                result = await generate_file_from_request(
                    institution_id=user.institution_id,
                    user_request=body.content,
                    target_format=target_format,
                    runtime_context=runtime_context,
                    tier=coerce_tier(body.model_tier, default=ModelTier.PREMIUM),
                    allow_overseas=user.allow_overseas_models,
                )
            except FileGenerationError as exc:
                error_text = str(exc)
                yield emit_react_step(
                    loop=2,
                    phase="observation",
                    summary="文件生成工具执行失败，需要补齐依赖或调整输入后重试。",
                    details=[error_text],
                    tool_id="file_generation",
                    status="failed",
                )
                yield {"event": "error", "data": error_text}
                if conversation_type != CONVERSATION_TYPE_PROJECT_WORKSPACE:
                    await refresh_conversation_title(
                        institution_id=user.institution_id,
                        user_id=user.user_id,
                        conversation_id=conversation_id,
                        allow_overseas=user.allow_overseas_models,
                    )
                yield {"event": "done", "data": ""}
                return

            file_ref = result.file.to_ref()
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary=f"文件生成工具已产出 {result.file.filename}，准备展示下载入口。",
                details=[
                    f"文件大小：{result.file.size_bytes} bytes",
                    f"章节数：{len(result.plan.sections)}",
                    f"表格数：{len(result.plan.tables)}",
                    f"幻灯片数：{len(result.plan.slides)}",
                ],
                tool_id="file_generation",
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="文件已生成并写入当前会话，用户可以直接下载查看。",
                details=[result.file.filename],
            )
            answer = f"已生成《{result.file.title}》，可以在下方文件卡片中下载查看。"
            yield {"event": "token", "data": answer}
            yield {"event": "file", "data": json.dumps(file_ref, ensure_ascii=False)}
            if result.usage:
                yield {"event": "usage", "data": json.dumps(result.usage, ensure_ascii=False)}
            async with SessionLocal() as db, db.begin():
                await save_message(
                    db,
                    institution_id=user.institution_id,
                    user_id=user.user_id,
                    conversation_id=conversation_id,
                    role="assistant",
                    blocks=assistant_blocks(
                        answer,
                        usage=result.usage,
                        react_steps=react_steps,
                        files=[file_ref],
                    ),
                    event_payload={
                        "intent": selected_intent,
                        "target_format": target_format,
                        "file_id": result.file.file_id,
                        "filename": result.file.filename,
                        "usage": result.usage,
                        "react_step_count": len(react_steps),
                        "conversation_type": conversation_type,
                        "source_thesis_id": str(source_thesis_id) if source_thesis_id else None,
                        "source_thesis_name": workspace_thesis_name,
                        "source_deal_id": str(source_deal_id) if source_deal_id else None,
                        "source_deal_name": workspace_deal_name,
                    },
                )
            if conversation_type != CONVERSATION_TYPE_PROJECT_WORKSPACE:
                await refresh_conversation_title(
                    institution_id=user.institution_id,
                    user_id=user.user_id,
                    conversation_id=conversation_id,
                    allow_overseas=user.allow_overseas_models,
                )
            yield {"event": "done", "data": ""}
            return

        # 2) 意图路由（LLM 结构化分类；网关未就绪/超时一律降级为通用对话）。
        #    立即下发一个进度事件：既让前端确认后端已接管、也促使 SSE 通道立刻
        #    开始 flush（排除中间层缓冲）。分类限时见 classify_intent_bounded。
        yield {"event": "progress", "data": "正在理解你的问题"}
        intent = None if source_deal_id else await classify_intent_bounded(body.content)
        selected_intent = intent.intent.value if intent else "chat"
        route_plan = await generate_visible_react_plan(
            user_request=body.content,
            intent=selected_intent,
            progress="完成任务分类，准备选择处理流程",
            observations=tool_observations,
            allow_overseas=user.allow_overseas_models,
        )
        yield emit_react_step(
            loop=1,
            phase="action",
            summary=route_plan,
            details=[
                f"识别意图：{selected_intent}",
                "下一步会根据意图、页面上下文和工具反馈决定执行路径。",
            ],
        )
        yield emit_react_step(
            loop=1,
            phase="observation",
            summary="工具上下文读取完成，已形成第一轮反馈。",
            details=tool_observations or ["本轮没有可用工具反馈。"],
        )
        yield emit_react_step(
            loop=1,
            phase="summary",
            summary="已确定任务类型和下一轮执行方向。",
            details=[
                f"识别意图：{selected_intent}",
                "下一轮会进入专用 Agent、工具增强问答或普通回答生成。",
            ],
        )

        if intent and intent.intent is Intent.PREFERENCE_ADVICE and intent.confidence >= 0.7:
            tier = coerce_tier(body.model_tier)
            preference_plan = await generate_visible_react_plan(
                user_request=body.content,
                agent="preference_advice",
                intent=Intent.PREFERENCE_ADVICE.value,
                progress="进入投资偏好建议流程",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=preference_plan,
                details=tool_observations,
                status="running",
            )
            yield {"event": "progress", "data": "正在生成投资偏好优化建议"}
            runtime_context = "\n\n".join(
                part
                for part in ((body.context or "").strip(), tool_context)
                if part
            )
            llm_messages: list[dict[str, str]] = [{"role": "system", "content": PREFERENCE_ADVICE_SYSTEM}]
            for message in history:
                if message.role not in ("user", "assistant"):
                    continue
                text = blocks_to_text(message.content)
                if text:
                    llm_messages.append({"role": message.role, "content": text})
            llm_messages.append(
                {
                    "role": "user",
                    "content": compose_user_content(body.content, runtime_context),
                }
            )

            parts: list[str] = []
            usage: dict | None = None
            failed = False
            try:
                async for chunk in stream_chat(
                    tier,
                    llm_messages,
                    allow_overseas=user.allow_overseas_models,
                ):
                    if chunk.text:
                        parts.append(chunk.text)
                        yield {"event": "token", "data": chunk.text}
                    if chunk.usage:
                        usage = chunk.usage
            except Exception:  # noqa: BLE001
                failed = True
                fallback = _preference_advice_fallback(body.content)
                parts = [fallback]
                yield {"event": "token", "data": fallback}

            if usage:
                yield {"event": "usage", "data": json.dumps(usage, ensure_ascii=False)}
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary="偏好优化工具已返回结果，准备进入本轮总结。",
                details=[
                    "已生成可审阅的偏好调整建议。",
                    "如模型不可用，本轮会使用确定性兜底建议。",
                ],
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="已基于偏好上下文生成建议。",
                details=["输出为建议草稿，不会直接修改机构偏好。"],
            )

            answer = "".join(parts)
            if answer:
                async with SessionLocal() as db, db.begin():
                    await save_message(
                        db,
                        institution_id=user.institution_id,
                        user_id=user.user_id,
                        conversation_id=conversation_id,
                        role="assistant",
                        blocks=assistant_blocks(answer, usage=usage, react_steps=react_steps),
                        event_payload={
                            "intent": Intent.PREFERENCE_ADVICE.value,
                            "tier": tier.value,
                            "truncated": failed,
                            "usage": usage,
                            "react_step_count": len(react_steps),
                            "conversation_type": conversation_type,
                        },
                    )
        elif intent and intent.intent is Intent.THESIS_SCOUT and intent.confidence >= 0.7:
            thesis_plan = await generate_visible_react_plan(
                user_request=body.content,
                agent="thesis_scout",
                intent=Intent.THESIS_SCOUT.value,
                progress="进入赛道前瞻 Agent 流程",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=thesis_plan,
                details=["流程：赛道定义拆解、市场信号收集、产业链分析、机构匹配度计算。"],
                status="running",
            )
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
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary="赛道前瞻 Agent 已完成工具链执行，准备整理生成结果。",
                details=["已接收专用 Agent 返回的进度、对象引用或执行结果。"],
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="赛道前瞻 Agent 已返回执行结果。",
                details=["若生成 Thesis，结果会以交付物卡片展示。"],
            )
        elif intent and intent.intent is Intent.DEAL_SOURCING and intent.confidence >= 0.7:
            sourcing_plan = await generate_visible_react_plan(
                user_request=body.content,
                agent="deal_sourcing",
                intent=Intent.DEAL_SOURCING.value,
                progress="进入项目挖掘 Agent 流程",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=sourcing_plan,
                details=["流程：项目搜索策略、公开信号挖掘、实体识别、工商核验、匹配度排序。"],
                status="running",
            )
            # 3a') 项目获取（Deal Sourcing 搜寻流）：同 run 生命周期编排，产出 DealList。
            #      自然语言触发走公开信号挖掘；从 Thesis「生成项目池」触发由专用端点传 thesis_id。
            async for ev in run_deal_sourcing(
                institution_id=user.institution_id,
                user_id=user.user_id,
                allow_overseas=user.allow_overseas_models,
                conversation_id=conversation_id,
                query=body.content,
                source_thesis_id=source_thesis_id,
                thesis_context=workspace_thesis_context,
            ):
                yield ev
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary="项目挖掘 Agent 已完成工具链执行，准备整理生成结果。",
                details=["已接收专用 Agent 返回的进度、对象引用或执行结果。"],
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="项目挖掘 Agent 已返回执行结果。",
                details=["若生成项目池，结果会以交付物卡片展示。"],
            )
        elif intent and intent.intent is Intent.DEAL_INTAKE and intent.confidence >= 0.7:
            intake_plan = await generate_visible_react_plan(
                user_request=body.content,
                agent="deal_intake",
                intent=Intent.DEAL_INTAKE.value,
                progress="进入项目 Intake Agent 流程",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=intake_plan,
                details=["流程：材料解析、外部信息补全、实体对齐、项目画像和初筛分析。"],
                status="running",
            )
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
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary="项目 Intake Agent 已完成工具链执行，准备整理生成结果。",
                details=["已接收专用 Agent 返回的进度、对象引用或执行结果。"],
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="项目 Intake Agent 已返回执行结果。",
                details=["若生成项目，结果会以项目工作台卡片展示。"],
            )
        else:
            # 3b) 通用对话：llm.stream_chat() 结构化流式。
            #     正文走 token 事件；可见工作过程统一走 react_step 事件。
            #     展示；末块 token 用量走 usage 事件并落库，用于统计每条消息 token 数。
            #     先发进度事件，让前端确认通用 Agent 已接管（与分类阶段区分开）。
            tier = coerce_tier(body.model_tier)
            chat_plan = await generate_visible_react_plan(
                user_request=body.content,
                intent=selected_intent,
                progress="进入通用回答生成流程",
                observations=tool_observations,
                allow_overseas=user.allow_overseas_models,
            )
            yield emit_react_step(
                loop=2,
                phase="action",
                summary=chat_plan,
                details=tool_observations or ["没有额外工具上下文，直接进入回答生成。"],
                status="running",
            )
            yield {"event": "progress", "data": "正在生成回答"}
            workspace_context = ""
            if source_thesis_id and workspace_thesis_context:
                workspace_context = "\n".join(
                    [
                        "对话类型：赛道工作台",
                        f"当前操作对象：{workspace_thesis_name}",
                        f"source_thesis_id：{source_thesis_id}",
                        "所有分析、建议和可执行操作必须围绕当前赛道，不要默认作用于整个赛道库。",
                        "当前赛道结构化上下文：",
                        json.dumps(
                            workspace_thesis_context,
                            ensure_ascii=False,
                            default=str,
                        ),
                    ]
                )
            elif source_deal_id and workspace_deal_context:
                workspace_context = "\n".join(
                    [
                        "对话类型：项目工作台",
                        f"当前操作对象：{workspace_deal_name}",
                        f"source_deal_id：{source_deal_id}",
                        "所有分析、建议和可执行操作必须围绕当前项目，不要新建或默认切换到其他项目。",
                        "当前项目结构化上下文：",
                        json.dumps(
                            workspace_deal_context,
                            ensure_ascii=False,
                            default=str,
                        ),
                    ]
                )
            runtime_context = "\n\n".join(
                part
                for part in ((body.context or "").strip(), workspace_context, tool_context)
                if part
            )
            llm_messages = to_llm_messages(
                history, compose_user_content(body.content, runtime_context)
            )
            parts: list[str] = []
            usage: dict | None = None
            failed = False
            try:
                async for chunk in stream_chat(
                    tier,
                    llm_messages,
                    allow_overseas=user.allow_overseas_models,
                ):
                    if chunk.text:
                        parts.append(chunk.text)
                        yield {"event": "token", "data": chunk.text}
                    if chunk.usage:
                        usage = chunk.usage
            except Exception as exc:  # noqa: BLE001
                # 把真实错误透出给前端（连接超时 / 401 / 模型不存在 / 余额不足等），
                # 便于用户直接定位环境问题，而不是停在静默的“正在理解你的问题”。
                failed = True
                detail = f"{type(exc).__name__}: {exc}".strip()
                yield {"event": "error", "data": f"{LLM_UNAVAILABLE_MSG}（{detail[:300]}）"}

            # token 用量末事件：让前端在气泡下方显示本条消息的 token 数
            if usage:
                yield {"event": "usage", "data": json.dumps(usage, ensure_ascii=False)}
            yield emit_react_step(
                loop=2,
                phase="observation",
                summary="模型生成已返回，准备输出本轮结论。",
                details=[
                    f"模型档位：{tier.value}",
                    "已完成默认上下文增强。",
                ],
            )
            yield emit_react_step(
                loop=2,
                phase="summary",
                summary="已结合工具观察生成最终回答。",
                details=[
                    f"模型档位：{tier.value}",
                    "本轮回答已写入当前会话。",
                ],
            )

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
                        blocks=assistant_blocks(answer, usage=usage, react_steps=react_steps),
                        event_payload={
                            "intent": intent.intent.value if intent else "chat",
                            "tier": tier.value,
                            "truncated": failed,
                            "usage": usage,
                            "react_step_count": len(react_steps),
                            "conversation_type": conversation_type,
                            "source_thesis_id": str(source_thesis_id) if source_thesis_id else None,
                            "source_thesis_name": workspace_thesis_name,
                            "source_deal_id": str(source_deal_id) if source_deal_id else None,
                            "source_deal_name": workspace_deal_name,
                        },
                    )

        if conversation_type != CONVERSATION_TYPE_PROJECT_WORKSPACE:
            await refresh_conversation_title(
                institution_id=user.institution_id,
                user_id=user.user_id,
                conversation_id=conversation_id,
                allow_overseas=user.allow_overseas_models,
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
                title_hint=None,
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

        await refresh_conversation_title(
            institution_id=user.institution_id,
            user_id=user.user_id,
            conversation_id=conversation_id,
            allow_overseas=user.allow_overseas_models,
        )
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_stream())
