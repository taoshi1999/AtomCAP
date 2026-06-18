"""对话与消息持久化 + domain_events 记账。

消息 content 为块数组（与 Message ORM 注释一致）：
  [{"type": "text", "text": "..."} | {"type": "object_ref", "deliverable_id": "..."}]

核心约定 4：消息落库属于用户操作/状态流转，必须写 domain_events。
与 services/deliverables.py 同约定：服务层收 institution_id/user_id 原始值，
强制租户过滤，不依赖 API 层对象。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Conversation, Message
from app.services.events import record_event

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
    """把块数组拍平成纯文本（喂给 LLM 的历史）。object_ref 以占位符表示。"""
    if isinstance(blocks, dict):  # 兼容历史脏数据
        blocks = blocks.get("blocks", [])
    parts: list[str] = []
    for b in blocks:
        if b.get("type") == "text":
            parts.append(b.get("text", ""))
        elif b.get("type") == "object_ref":
            parts.append(f"[交付对象 {b.get('deliverable_id')}]")
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


async def ensure_conversation(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    title_hint: str | None = None,
) -> Conversation:
    """取会话（租户过滤）；不存在则以客户端给定 id 创建并记账。"""
    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.institution_id == institution_id,
            )
        )
    ).scalar_one_or_none()
    if conv is not None:
        return conv

    conv = Conversation(
        id=conversation_id,
        institution_id=institution_id,
        user_id=user_id,
        title=(title_hint or "")[:50] or None,
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
