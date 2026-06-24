"""普通会话标题的模型摘要生成与持久化。"""

from __future__ import annotations

import asyncio
import re
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.db import SessionLocal
from app.llm import client as llm_client
from app.llm.client import ModelTier
from app.models.models import Conversation, Message
from app.services.conversations import (
    CONVERSATION_TYPE_NORMAL,
    blocks_to_text,
    normalize_conversation_type,
)
from app.services.events import record_event

TITLE_HISTORY_LIMIT = 12
TITLE_CONTEXT_CHARS = 6000
TITLE_TIMEOUT_SECONDS = 12.0


class ConversationTitleDraft(BaseModel):
    title: str = Field(min_length=2, max_length=30)


def _compact(value: str) -> str:
    return " ".join((value or "").split())


def _canonical(value: str) -> str:
    return re.sub(r"[\s，。！？、；：,.!?;:'\"“”‘’《》【】（）()\-—_]+", "", value).lower()


def sanitize_conversation_title(value: str) -> str | None:
    title = _compact(value)
    title = re.sub(r"^(会话标题|对话标题|标题)\s*[:：]\s*", "", title)
    title = title.strip(" \"'“”‘’《》【】[]()（）:：-—·.。!?！？")
    if len(title) < 2:
        return None
    return title[:30]


def title_transcript(messages: list[Message]) -> tuple[str, list[str]]:
    """构造有限长度的对话文本，并返回用于防止照抄的原始消息列表。"""
    rows: list[str] = []
    raw_messages: list[str] = []
    total = 0
    for message in messages[-TITLE_HISTORY_LIMIT:]:
        if message.role not in {"user", "assistant"}:
            continue
        text = _compact(blocks_to_text(message.content))
        if not text:
            continue
        text = text[:1000]
        prefix = "用户" if message.role == "user" else "助手"
        row = f"{prefix}：{text}"
        if total + len(row) > TITLE_CONTEXT_CHARS:
            remaining = TITLE_CONTEXT_CHARS - total
            if remaining <= 0:
                break
            row = row[:remaining]
        rows.append(row)
        raw_messages.append(text)
        total += len(row)
    return "\n".join(rows), raw_messages


async def generate_conversation_title(
    messages: list[Message],
    *,
    allow_overseas: bool,
) -> str | None:
    roles = {message.role for message in messages}
    if not {"user", "assistant"} <= roles:
        return None
    transcript, raw_messages = title_transcript(messages)
    if not transcript:
        return None

    draft = await llm_client.complete_structured(
        ModelTier.FAST,
        [
            {
                "role": "system",
                "content": (
                    "你负责为投资研究助手中的一段会话生成名称。"
                    "请根据用户与助手共同讨论的内容抽象概括核心主题，不能直接复制用户或助手的原句。"
                    "标题使用简体中文，建议 6-18 个字，最多 30 个字；"
                    "不要使用引号、句号、问号、冒号，不要写“会话标题”或“关于”。"
                ),
            },
            {"role": "user", "content": transcript},
        ],
        ConversationTitleDraft,
        allow_overseas=allow_overseas,
    )
    title = sanitize_conversation_title(draft.title)
    if not title:
        return None
    canonical_title = _canonical(title)
    if any(canonical_title == _canonical(message) for message in raw_messages):
        return None
    return title


async def refresh_conversation_title(
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    allow_overseas: bool,
) -> str | None:
    """按当前完整会话重新生成标题；失败时保留旧标题，不影响主流程。"""
    try:
        async with SessionLocal() as db:
            conversation = await db.scalar(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.institution_id == institution_id,
                    Conversation.user_id == user_id,
                )
            )
            if (
                conversation is None
                or normalize_conversation_type(conversation.conversation_type)
                != CONVERSATION_TYPE_NORMAL
            ):
                return None
            messages = (
                await db.execute(
                    select(Message)
                    .where(
                        Message.conversation_id == conversation_id,
                        Message.institution_id == institution_id,
                    )
                    .order_by(Message.created_at.desc(), Message.id.desc())
                    .limit(TITLE_HISTORY_LIMIT)
                )
            ).scalars().all()
            history = list(reversed(messages))

        title = await asyncio.wait_for(
            generate_conversation_title(history, allow_overseas=allow_overseas),
            timeout=TITLE_TIMEOUT_SECONDS,
        )
        if not title:
            return None

        async with SessionLocal() as db, db.begin():
            conversation = await db.scalar(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.institution_id == institution_id,
                    Conversation.user_id == user_id,
                )
            )
            if (
                conversation is None
                or normalize_conversation_type(conversation.conversation_type)
                != CONVERSATION_TYPE_NORMAL
            ):
                return None
            previous_title = conversation.title
            if previous_title == title:
                return title
            conversation.title = title
            await record_event(
                db,
                institution_id=institution_id,
                user_id=user_id,
                event_type="conversation.title_generated",
                subject_type="conversation",
                subject_id=conversation.id,
                payload={"previous_title": previous_title, "title": title},
            )
        return title
    except Exception:  # noqa: BLE001 - 标题生成绝不能阻断会话主流程
        return None
