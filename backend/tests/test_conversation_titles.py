"""会话标题模型摘要测试。"""

from __future__ import annotations

import asyncio

import app.services.conversation_titles as title_service
from app.models.models import Message
from app.services.conversation_titles import (
    ConversationTitleDraft,
    generate_conversation_title,
    sanitize_conversation_title,
    title_transcript,
)
from app.services.conversations import text_blocks


def _messages() -> list[Message]:
    return [
        Message(
            role="user",
            content=text_blocks("帮我看看新能源行业最近有哪些值得关注的投资方向？"),
        ),
        Message(
            role="assistant",
            content=text_blocks("可以重点关注储能、固态电池和电网数字化三个方向。"),
        ),
    ]


def test_title_transcript_contains_both_sides():
    transcript, raw = title_transcript(_messages())
    assert "用户：帮我看看新能源行业" in transcript
    assert "助手：可以重点关注储能" in transcript
    assert len(raw) == 2


def test_generate_title_uses_llm_summary(monkeypatch):
    captured = {}

    async def fake_complete(tier, messages, schema, **kwargs):
        captured.update(tier=tier, messages=messages, schema=schema, kwargs=kwargs)
        return ConversationTitleDraft(title="新能源投资方向研判")

    monkeypatch.setattr(title_service.llm_client, "complete_structured", fake_complete)
    title = asyncio.run(generate_conversation_title(_messages(), allow_overseas=False))

    assert title == "新能源投资方向研判"
    assert "不能直接复制" in captured["messages"][0]["content"]
    assert "用户：" in captured["messages"][1]["content"]
    assert "助手：" in captured["messages"][1]["content"]


def test_generate_title_rejects_verbatim_message(monkeypatch):
    async def fake_complete(*_args, **_kwargs):
        return ConversationTitleDraft(title="帮我看看新能源行业最近有哪些值得关注的投资方向？")

    monkeypatch.setattr(title_service.llm_client, "complete_structured", fake_complete)
    assert asyncio.run(generate_conversation_title(_messages(), allow_overseas=False)) is None


def test_generate_title_requires_completed_exchange(monkeypatch):
    async def should_not_call(*_args, **_kwargs):
        raise AssertionError("不应调用模型")

    monkeypatch.setattr(title_service.llm_client, "complete_structured", should_not_call)
    only_user = [Message(role="user", content=text_blocks("只有用户消息"))]
    assert asyncio.run(generate_conversation_title(only_user, allow_overseas=False)) is None


def test_sanitize_title_removes_model_wrapping():
    assert sanitize_conversation_title("会话标题：《新能源投资研判》。") == "新能源投资研判"
    assert sanitize_conversation_title("  ") is None
