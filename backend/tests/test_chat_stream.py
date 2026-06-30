"""通用对话流式单元测试（不连库、不连网关）。

覆盖：
- complete_stream 增量产出与档位/合规降级（核心约定 3、5）
- 消息块 ↔ LLM 上下文的纯函数转换
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import app.llm.client as llm_client
from app.llm.client import ModelTier, complete_stream, resolve_model, resolve_provider
from app.models.models import Message
from app.services.conversations import (
    CHAT_SYSTEM_PROMPT,
    assistant_blocks,
    blocks_to_text,
    compose_user_content,
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


def test_complete_stream_premium_uses_configured_model(monkeypatch):
    """premium 是否可用由 provider token/config 决定，不再因 allow_overseas 降级。"""
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
    assert fake.calls[0]["model"] == "premium"

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
    assert resolve_model(ModelTier.PREMIUM, allow_overseas=False) == "deepseek-v4-pro"
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


def test_assistant_blocks_persist_react_steps_without_polluting_text():
    steps = [
        {
            "id": "loop-1-summary-none",
            "loop": 1,
            "phase": "summary",
            "summary": "读取项目材料。",
            "details": ["读取材料索引"],
        }
    ]

    blocks = assistant_blocks("已完成。", react_steps=steps)

    assert blocks_to_text(blocks) == "已完成。"
    assert blocks[-1] == {"type": "react_steps", "steps": steps}


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


def test_compose_user_content_keeps_clean_content():
    """页面上下文只进 LLM 输入，不污染会持久化的用户正文（会话历史保持干净）。"""
    # 无上下文：原样返回（历史标题/预览即用户真实问题）
    assert compose_user_content("找半导体项目", None) == "找半导体项目"
    assert compose_user_content("找半导体项目", "   ") == "找半导体项目"
    # 有上下文：上下文前置、正文以「用户需求：」结尾，供 LLM 理解页面语境
    out = compose_user_content("找半导体项目", "当前页面：投资偏好")
    assert out.startswith("当前页面：投资偏好")
    assert out.endswith("用户需求：找半导体项目")


# ---------- 意图分类限时兜底（通用对话不被分类阶段卡死） ----------

import app.api.conversations as conv_api  # noqa: E402
from app.api.conversations import classify_intent_bounded  # noqa: E402
from app.api.conversations import _preference_advice_fallback, _preference_target_hint  # noqa: E402
from app.api.conversations import _first_deal_reference_id  # noqa: E402


def test_classify_bounded_returns_result(monkeypatch):
    """分类正常返回时原样透传（不影响专用 Agent 路由）。"""
    sentinel = object()

    async def _fake(content):
        return sentinel

    monkeypatch.setattr(conv_api, "classify_intent", _fake)
    monkeypatch.setattr(conv_api.settings, "intent_classify_timeout_seconds", 5.0)
    assert asyncio.run(classify_intent_bounded("你好")) is sentinel


def test_classify_bounded_times_out_to_none(monkeypatch):
    """分类挂起时必须限时降级为 None（→ 通用对话），不能阻塞整条 SSE 流。"""

    async def _hang(content):
        await asyncio.sleep(10)
        return "unreachable"

    monkeypatch.setattr(conv_api, "classify_intent", _hang)
    monkeypatch.setattr(conv_api.settings, "intent_classify_timeout_seconds", 0.05)
    assert asyncio.run(classify_intent_bounded("你是什么模型?")) is None


def test_classify_bounded_swallows_errors(monkeypatch):
    """分类抛错（网关 401/模型不存在等）也降级为 None，由通用对话兜底。"""

    async def _boom(content):
        raise RuntimeError("gateway down")

    monkeypatch.setattr(conv_api, "classify_intent", _boom)
    monkeypatch.setattr(conv_api.settings, "intent_classify_timeout_seconds", 5.0)
    assert asyncio.run(classify_intent_bounded("你好")) is None


def test_first_deal_reference_id_reads_normal_conversation_reference():
    deal_id = uuid.uuid4()

    assert _first_deal_reference_id([
        {"kind": "thesis", "id": str(uuid.uuid4()), "title": "新能源"},
        {"kind": "deal", "id": str(deal_id), "title": "光羽科技"},
    ]) == deal_id
    assert _first_deal_reference_id([
        {"kind": "deal", "id": "not-a-uuid", "title": "坏引用"},
    ]) is None


def test_preference_advice_fallback_mentions_anti_preference():
    assert _preference_target_hint("以后不要推荐太阳能电池相关的项目") == "太阳能电池"
    text = _preference_advice_fallback("以后不要推荐太阳能电池相关的项目")

    assert "长期投资偏好修正" in text
    assert "anti_preference.disliked_subsectors" in text
    assert "太阳能电池" in text
