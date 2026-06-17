"""通用对话流式单元测试（不连库、不连网关）。

覆盖：
- complete_stream 增量产出与档位/合规降级（核心约定 3、5）
- 消息块 ↔ LLM 上下文的纯函数转换
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

import app.llm.client as llm_client
from app.llm.client import ModelTier, complete_stream, resolve_model, resolve_provider
from app.models.models import Message
from app.services.conversations import (
    CHAT_SYSTEM_PROMPT,
    blocks_to_text,
    text_blocks,
    to_llm_messages,
)


# ---------- complete_stream ----------

def _chunk(content: str | None):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = iter(chunks)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._chunks)
        except StopIteration:
            raise StopAsyncIteration


class _FakeClient:
    def __init__(self, chunks):
        self.calls: list[dict] = []
        outer = self

        async def create(**kwargs):
            outer.calls.append(kwargs)
            return _FakeStream(chunks)

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


def test_complete_stream_yields_deltas(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "llm_provider", "litellm")
    fake = _FakeClient(
        [
            _chunk("你好"),
            SimpleNamespace(choices=[]),  # keep-alive 空块应被跳过
            _chunk(None),                 # 空 delta 应被跳过
            _chunk("，世界"),
        ]
    )
    monkeypatch.setattr(llm_client, "_client", fake)

    async def run():
        return [d async for d in complete_stream(ModelTier.STANDARD, [{"role": "user", "content": "hi"}])]

    deltas = asyncio.run(run())
    assert deltas == ["你好", "，世界"]
    assert fake.calls[0]["stream"] is True
    assert fake.calls[0]["model"] == "standard"


def test_complete_stream_overseas_downgrade(monkeypatch):
    """核心约定 5：未开海外模型时 premium 流式调用降级 standard。"""
    monkeypatch.setattr(llm_client.settings, "llm_provider", "litellm")
    fake = _FakeClient([_chunk("ok")])
    monkeypatch.setattr(llm_client, "_client", fake)

    async def run():
        return [
            d
            async for d in complete_stream(
                ModelTier.PREMIUM, [{"role": "user", "content": "hi"}], allow_overseas=False
            )
        ]

    asyncio.run(run())
    assert fake.calls[0]["model"] == "standard"

    async def run_allowed():
        return [
            d
            async for d in complete_stream(
                ModelTier.PREMIUM, [{"role": "user", "content": "hi"}], allow_overseas=True
            )
        ]

    asyncio.run(run_allowed())
    assert fake.calls[1]["model"] == "premium"


def test_auto_provider_prefers_deepseek_models(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "llm_provider", "auto")
    monkeypatch.setattr(llm_client.settings, "deepseek_api_key", "sk-test")
    monkeypatch.setattr(llm_client.settings, "openai_api_key", "")

    assert resolve_provider() == "deepseek"
    assert resolve_model(ModelTier.FAST) == "deepseek-v4-flash"
    assert resolve_model(ModelTier.STANDARD) == "deepseek-v4-flash"
    assert resolve_model(ModelTier.PREMIUM, allow_overseas=False) == "deepseek-v4-flash"
    assert resolve_model(ModelTier.PREMIUM, allow_overseas=True) == "deepseek-v4-pro"


def test_complete_stream_uses_direct_deepseek_model(monkeypatch):
    fake = _FakeClient([_chunk("ok")])
    monkeypatch.setattr(llm_client, "_client", fake)
    monkeypatch.setattr(llm_client, "_client_signature", None)
    monkeypatch.setattr(llm_client.settings, "llm_provider", "auto")
    monkeypatch.setattr(llm_client.settings, "deepseek_api_key", "sk-test")
    monkeypatch.setattr(llm_client.settings, "openai_api_key", "")

    async def run():
        return [
            d
            async for d in complete_stream(
                ModelTier.STANDARD,
                [{"role": "user", "content": "hi"}],
            )
        ]

    asyncio.run(run())
    assert fake.calls[0]["model"] == "deepseek-v4-flash"
    assert fake.calls[0]["stream"] is True


# ---------- 消息块转换 ----------

def test_blocks_to_text_mixed():
    blocks = [
        {"type": "text", "text": "请看"},
        {"type": "object_ref", "deliverable_id": "abc-123"},
        {"type": "text", "text": "的结论"},
    ]
    assert blocks_to_text(blocks) == "请看[交付对象 abc-123]的结论"
    assert blocks_to_text({"blocks": [{"type": "text", "text": "兼容"}]}) == "兼容"


def test_to_llm_messages_order_and_filter():
    history = [
        Message(role="user", content=text_blocks("第一问")),
        Message(role="assistant", content=text_blocks("第一答")),
        Message(role="system", content=text_blocks("应被过滤")),
        Message(role="assistant", content=[]),  # 空内容应被过滤
    ]
    msgs = to_llm_messages(history, "第二问")
    assert msgs[0] == {"role": "system", "content": CHAT_SYSTEM_PROMPT}
    assert msgs[1:] == [
        {"role": "user", "content": "第一问"},
        {"role": "assistant", "content": "第一答"},
        {"role": "user", "content": "第二问"},
    ]
