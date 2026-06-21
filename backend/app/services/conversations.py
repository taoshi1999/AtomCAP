"""对话与消息持久化 + domain_events 记账。

消息 content 为块数组（与 Message ORM 注释一致）：
  [{"type": "text", "text": "..."} | {"type": "object_ref", "deliverable_id": "..."} | {"type": "deal_ref", "deal_id": "..."}]

核心约定 4：消息落库属于用户操作/状态流转，必须写 domain_events。
与 services/deliverables.py 同约定：服务层收 institution_id/user_id 原始值，
强制租户过滤，不依赖 API 层对象。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Conversation, Message
from app.services.events import record_event

# 会话类型只保留两个稳定业务类型。legacy 值只用于兼容旧前端入参。
CONVERSATION_TYPE_NORMAL = "normal"
CONVERSATION_TYPE_PROJECT_WORKSPACE = "project_workspace"
LEGACY_CONVERSATION_TYPE_DEAL_WORKSPACE = "deal_workspace"
LEGACY_CONVERSATION_TYPE_TRACK_WORKSPACE = "track_workspace"
VALID_CONVERSATION_TYPES = {
    CONVERSATION_TYPE_NORMAL,
    CONVERSATION_TYPE_PROJECT_WORKSPACE,
}


class ConversationTypeMismatch(ValueError):
    """Raised when a caller tries to reuse a conversation with another fixed type or project."""


def normalize_conversation_type(value: str | None) -> str:
    """Map legacy request values to the two durable conversation categories."""
    raw = (value or CONVERSATION_TYPE_NORMAL).strip()
    if raw == LEGACY_CONVERSATION_TYPE_DEAL_WORKSPACE:
        return CONVERSATION_TYPE_PROJECT_WORKSPACE
    if raw == LEGACY_CONVERSATION_TYPE_TRACK_WORKSPACE:
        return CONVERSATION_TYPE_NORMAL
    if raw in VALID_CONVERSATION_TYPES:
        return raw
    return CONVERSATION_TYPE_NORMAL

# 通用对话默认带的最近历史条数（防 token 膨胀，Phase 1 再做摘要压缩）
HISTORY_LIMIT = 20

CHAT_SYSTEM_PROMPT = (
    "你是 AtomCAP——一级市场（VC/PE）机构的投资研究助手。"
    "回答机构内部的投研问题、解释系统里的交付对象（投资逻辑 Thesis、项目清单、尽调报告）。"
    "事实性结论要谨慎：没有证据支撑时明确说明是推断。用简体中文回答。"
)


def text_blocks(text: str) -> list[dict[str, Any]]:
    return [{"type": "text", "text": text}]


def usage_block(usage: dict[str, Any]) -> dict[str, Any]:
    """token 用量块（每条消息 token 数）——非文本块，不进 LLM 上下文、不计入历史正文。"""
    return {"type": "usage", "usage": usage}


def assistant_blocks(
    text: str, *, usage: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """assistant 消息块：正文文本块 + 可选 token 用量块。

    用量以独立块持久化（迁移无关，直接追加进 JSONB content）；blocks_to_text / to_llm_messages
    只认 text / object_ref 块，故用量块对 LLM 上下文与历史正文完全透明，前端单独读取展示。
    """
    blocks: list[dict[str, Any]] = text_blocks(text)
    if usage:
        blocks.append(usage_block(usage))
    return blocks


def blocks_to_text(blocks: list[dict[str, Any]] | dict[str, Any]) -> str:
    """把块数组拍平成纯文本（喂给 LLM 的历史）。对象引用以占位符表示。"""
    if isinstance(blocks, dict):  # 兼容历史脏数据
        blocks = blocks.get("blocks", [])
    parts: list[str] = []
    for b in blocks:
        if b.get("type") == "text":
            parts.append(b.get("text", ""))
        elif b.get("type") == "object_ref":
            parts.append(f"[交付对象 {b.get('deliverable_id')}]")
        elif b.get("type") == "deal_ref":
            parts.append(f"[项目工作台 {b.get('deal_id')}]")
    return "".join(parts)


def to_llm_messages(history: list[Message], new_user_content: str) -> list[dict[str, str]]:
    """历史消息 + 本轮用户输入 → LLM messages（带系统提示词）。"""
    msgs: list[dict[str, str]] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    for m in history:
        if m.role not in ("user", "assistant"):
            continue
        text = blocks_to_text(m.content)
        if text:
            msgs.append({"role": m.role, "content": text})
    msgs.append({"role": "user", "content": new_user_content})
    return msgs


def compose_user_content(content: str, context: str | None) -> str:
    """把页面上下文（可选）与用户正文拼成喂给 LLM 的内容。

    上下文只进 LLM 输入，**不写入持久化的用户消息正文与会话标题**——保证会话历史里
    记录的是用户真实问题，而不是「当前页面：…」之类的上下文前缀（页面级助手如
    PageAssistant 即借此让其会话以干净标题进入历史）。
    """
    ctx = (context or "").strip()
    if not ctx:
        return content
    return f"{ctx}\n\n用户需求：{content}"


async def ensure_conversation(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    title_hint: str | None = None,
    conversation_type: str = CONVERSATION_TYPE_NORMAL,
    source_deal_id: uuid.UUID | None = None,
) -> Conversation:
    """取会话（租户过滤）；不存在则以客户端给定 id 创建并记账。"""
    normalized_type = normalize_conversation_type(conversation_type)
    if normalized_type == CONVERSATION_TYPE_PROJECT_WORKSPACE and source_deal_id is None:
        raise ConversationTypeMismatch("项目工作台会话必须绑定一个项目")
    if normalized_type == CONVERSATION_TYPE_NORMAL:
        source_deal_id = None

    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.institution_id == institution_id,
            )
        )
    ).scalar_one_or_none()
    if conv is not None:
        existing_type = normalize_conversation_type(conv.conversation_type)
        if existing_type != normalized_type:
            raise ConversationTypeMismatch("会话类型已经固定，不能切换为其他类型")
        if (
            normalized_type == CONVERSATION_TYPE_PROJECT_WORKSPACE
            and conv.source_deal_id != source_deal_id
        ):
            raise ConversationTypeMismatch("项目工作台会话已经绑定到另一个项目")
        return conv

    conv = Conversation(
        id=conversation_id,
        institution_id=institution_id,
        user_id=user_id,
        title=(title_hint or "")[:50] or None,
        conversation_type=normalized_type,
        source_deal_id=source_deal_id,
    )
    db.add(conv)
    await db.flush()
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="conversation.created",
        subject_type="conversation",
        subject_id=conv.id,
        payload={
            "conversation_type": normalized_type,
            "source_deal_id": str(source_deal_id) if source_deal_id else None,
        },
    )
    return conv


async def save_message(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    role: str,
    blocks: list[dict[str, Any]],
    event_payload: dict[str, Any] | None = None,
) -> Message:
    """消息落库 + 记账。user → message.sent；assistant → message.completed。"""
    msg = Message(
        institution_id=institution_id,
        conversation_id=conversation_id,
        role=role,
        content=blocks,
    )
    db.add(msg)
    await db.flush()
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id if role == "user" else None,
        event_type="message.sent" if role == "user" else "message.completed",
        subject_type="message",
        subject_id=msg.id,
        payload={"conversation_id": str(conversation_id), **(event_payload or {})},
    )
    return msg


async def load_history(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    conversation_id: uuid.UUID,
    limit: int = HISTORY_LIMIT,
) -> list[Message]:
    """最近 limit 条消息，按时间正序返回。

    注意：通用对话流程先 load_history 再落本轮用户消息，避免重复入上下文。
    """
    rows = (
        await db.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.institution_id == institution_id,
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return list(reversed(rows))


# ===== 会话历史列表（会话历史窗口 / 首页「最近会话」共用口径） =====
# DB 读取与纯函数投影分离：_fetch_conversation_records 取行，project_conversations
# 做过滤/排序/分页（纯函数、离线可测）。两处入口共用同一口径，避免标题/预览/
# 排序在首页与历史窗口之间漂移。

PREVIEW_LIMIT = 80
CONVERSATION_TITLE_FALLBACK = "未命名对话"


def preview_from_content(content: Any) -> str | None:
    """从一条消息的块数组生成预览（取前 PREVIEW_LIMIT 字，object_ref 计占位符）。空则 None。"""
    text = blocks_to_text(content)
    if not text:
        return None
    return text[:PREVIEW_LIMIT]


@dataclass
class ConversationRecord:
    """会话列表投影的中间行：已带最后消息时间与预览，供纯函数排序/过滤/分页。"""

    id: uuid.UUID
    title: str | None
    updated_at: datetime
    last_message_at: datetime | None
    preview: str | None
    conversation_type: str = CONVERSATION_TYPE_NORMAL
    source_deal_id: uuid.UUID | None = None


def _record_sort_key(record: "ConversationRecord") -> datetime:
    # 最后活跃时间：有消息取最后一条消息时间，否则回退会话更新时间（与首页一致）
    return record.last_message_at or record.updated_at


def _record_matches_query(record: "ConversationRecord", needle: str) -> bool:
    """大小写无关地在标题 + 最近消息预览里匹配关键词。"""
    haystack = f"{record.title or ''}\n{record.preview or ''}".lower()
    return needle in haystack


def project_conversations(
    records: list["ConversationRecord"],
    *,
    query: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """纯函数：按关键词过滤 -> 按最后活跃时间倒序 -> 分页 -> 投影成前端列表项。

    返回 (当前页 items, 过滤后总数)。total 反映过滤后、分页前的条数，供前端翻页。
    排序口径与首页「最近会话」一致；时间相同以 id 兜底稳定排序（SQL 层无显式兜底，
    这里补上只影响并列项的确定性，不改变可观察行为）。
    """
    needle = (query or "").strip().lower()
    filtered = [r for r in records if not needle or _record_matches_query(r, needle)]
    ordered = sorted(
        filtered,
        key=lambda r: (_record_sort_key(r), str(r.id)),
        reverse=True,
    )
    total = len(ordered)
    start = max(0, offset)
    page = ordered[start : start + limit] if limit is not None else ordered[start:]
    items = [
        {
            "id": str(r.id),
            "title": r.title or CONVERSATION_TITLE_FALLBACK,
            "preview": r.preview,
            "updated_at": _record_sort_key(r).isoformat(),
            "conversation_type": normalize_conversation_type(r.conversation_type),
            "source_deal_id": str(r.source_deal_id) if r.source_deal_id else None,
        }
        for r in page
    ]
    return items, total


async def _fetch_conversation_records(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list["ConversationRecord"]:
    """读取当前用户在本租户下的全部会话，并补齐最后消息时间与预览。"""
    last_message = (
        select(
            Message.conversation_id.label("conversation_id"),
            func.max(Message.created_at).label("last_message_at"),
        )
        .where(Message.institution_id == institution_id)
        .group_by(Message.conversation_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Conversation, last_message.c.last_message_at)
            .outerjoin(last_message, Conversation.id == last_message.c.conversation_id)
            .where(
                Conversation.institution_id == institution_id,
                Conversation.user_id == user_id,
            )
        )
    ).all()

    records: list[ConversationRecord] = []
    for conversation, last_message_at in rows:
        latest = (
            await db.execute(
                select(Message)
                .where(
                    Message.institution_id == institution_id,
                    Message.conversation_id == conversation.id,
                )
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalars().first()
        records.append(
            ConversationRecord(
                id=conversation.id,
                title=conversation.title,
                updated_at=conversation.updated_at,
                last_message_at=last_message_at,
                preview=preview_from_content(latest.content) if latest else None,
                conversation_type=normalize_conversation_type(conversation.conversation_type),
                source_deal_id=conversation.source_deal_id,
            )
        )
    return records


async def list_conversation_summaries(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int | None = None,
    offset: int = 0,
    query: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """会话历史列表（租户 + 用户过滤）。

    DB 读取（_fetch_conversation_records）与纯函数投影（project_conversations）分离，
    后者可离线单测。首页聚合与独立历史端点共用同一口径。
    """
    records = await _fetch_conversation_records(
        db, institution_id=institution_id, user_id=user_id
    )
    return project_conversations(records, query=query, limit=limit, offset=offset)
