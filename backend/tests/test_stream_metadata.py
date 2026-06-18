"""结构化流式（思考过程 reasoning + token 用量 usage）单元测试 —— 不连库、不连网关。

覆盖用户对话框需求：
- ② 思考过程同步可展开：stream_chat 把 delta.reasoning_content 透出为 StreamChunk.reasoning
- ③ 每条消息 Token 数：stream_options.include_usage 末块 usage 透出为 StreamChunk.usage
- complete_stream 向后兼容（仅产正文，reasoning/usage 不污染纯文本视图）
- assistant_blocks 把 usage 落成独立块，且对 LLM 上下文/历史正文完全透明
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import app.llm.client as llm_client
from app.llm.client import (
    ModelTier,
    _chunk_usage,
    complete_stream,
    stream_chat,
)
from app.models.models import Message
from app.services.conversations import (
    assistant_blocks,
    blocks_to_text,
    to_llm_messages,
    usage_block,
)


def _delta(content=None, reasoning=None):
    d = SimpleNamespace(content=content)
    if reasoning is not None:
        d.reasoning_content = reasoning
    return SimpleNamespace(choices=[SimpleNamespace(delta=d)])


def _usage(prompt, completion, total):
    return SimpleNamespace(
        choices=[],
        usage=SimpleNamespace(
            prompt_tokens=prompt, completion_tokens=completion, total_tokens=total
        ),
    )


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


def _install(monkeypatch, chunks):
    monkeypatch.setattr(llm_client.settings, "llm_provider", "litellm")
    fake = _FakeClient(chunks)
    monkeypatch.setattr(llm_client, "_client", fake)
    monkeypatch.setattr(llm_client, "_client_signature", None)
    return fake


def _run_stream(*args, **kwargs):
    async def run():
        return [c async for c in stream_chat(*args, **kwargs)]

    return asyncio.run(run())


# ---------- stream_chat：reasoning / text / usage 分流 ----------

def test_stream_chat_splits_reasoning_text_usage(monkeypatch):
    fake = _install(
        monkeypatch,
        [
            _delta(reasoning="先分析一下"),
            _delta(reasoning="再确认"),
            _delta(content="结论是"),
            SimpleNamespace(choices=[]),  # keep-alive 空块跳过
            _delta(content=None),         # 空正文跳过
            _delta(content="A"),
            _usage(12, 8, 20),
        ],
    )
    chunks = _run_stream(ModelTier.STANDARD, [{"role": "user", "content": "hi"}])
    assert "".join(c.reasoning for c in chunks if c.reasoning) == "先分析一下再确认"
    assert "".join(c.text for c in chunks if c.text) == "结论是A"
    assert [c.usage for c in chunks if c.usage] == [
        {"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20}
    ]
    # include_usage 必须随请求带上（否则网关不补用量末块）
    assert fake.calls[0]["stream_options"] == {"include_usage": True}
    assert fake.calls[0]["stream"] is True


def test_stream_chat_reasoning_via_model_extra(monkeypatch):
    """SDK 把未知字段塞进 model_extra 时也能取到 reasoning_content。"""
    delta = SimpleNamespace(content=None, model_extra={"reasoning_content": "隐藏思考"})
    _install(
        monkeypatch,
        [SimpleNamespace(choices=[SimpleNamespace(delta=delta)]), _delta(content="正文")],
    )
    chunks = _run_stream(ModelTier.STANDARD, [{"role": "user", "content": "hi"}])
    assert "".join(c.reasoning for c in chunks if c.reasoning) == "隐藏思考"
    assert "".join(c.text for c in chunks if c.text) == "正文"


def test_stream_chat_without_usage_chunk_degrades(monkeypatch):
    """网关不支持 include_usage（无末块）时安全降级：无 usage 透出，正文照常。"""
    _install(monkeypatch, [_delta(content="只"), _delta(content="有正文")])
    chunks = _run_stream(ModelTier.STANDARD, [{"role": "user", "content": "hi"}])
    assert "".join(c.text for c in chunks if c.text) == "只有正文"
    assert [c.usage for c in chunks if c.usage] == []


def test_stream_chat_overseas_downgrade(monkeypatch):
    """核心约定 5：未开海外模型时 premium 流式调用降级 standard。"""
    fake = _install(monkeypatch, [_delta(content="ok")])
    _run_stream(ModelTier.PREMIUM, [{"role": "user", "content": "hi"}], allow_overseas=False)
    assert fake.calls[0]["model"] == "standard"


def test_complete_stream_backward_compatible(monkeypatch):
    """complete_stream 仍只产正文（reasoning/usage 不污染纯文本视图）。"""
    _install(
        monkeypatch,
        [_delta(reasoning="思考"), _delta(content="正"), _delta(content="文"), _usage(1, 2, 3)],
    )

    async def run():
        return [d async for d in complete_stream(ModelTier.STANDARD, [{"role": "user", "content": "hi"}])]

    assert asyncio.run(run()) == ["正", "文"]


# ---------- _chunk_usage 防御取值 ----------

def test_chunk_usage_dict_form_and_missing():
    assert _chunk_usage(
        SimpleNamespace(usage={"prompt_tokens": 3, "completion_tokens": 4, "total_tokens": 7})
    ) == {"prompt_tokens": 3, "completion_tokens": 4, "total_tokens": 7}
    # 无 usage 属性 → None
    assert _chunk_usage(SimpleNamespace(choices=[])) is None
    # bool 不应被当作 token 数；部分字段缺失只取到的
    partial = SimpleNamespace(usage=SimpleNamespace(prompt_tokens=True, completion_tokens=4, total_tokens=7))
    assert _chunk_usage(partial) == {"completion_tokens": 4, "total_tokens": 7}


# ---------- usage 持久化块对上下文透明 ----------

def test_assistant_blocks_appends_usage_block():
    usage = {"prompt_tokens": 5, "completion_tokens": 7, "total_tokens": 12}
    blocks = assistant_blocks("回答正文", usage=usage)
    assert blocks[0] == {"type": "text", "text": "回答正文"}
    assert blocks[-1] == {"type": "usage", "usage": usage}
    # 用量块对 LLM 历史正文透明
    assert blocks_to_text(blocks) == "回答正文"
    msgs = to_llm_messages([Message(role="assistant", content=blocks)], "下一问")
    assert {"role": "assistant", "content": "回答正文"} in msgs
    assert all("usage" not in m for m in msgs)


def test_assistant_blocks_without_usage():
    assert assistant_blocks("仅正文") == [{"type": "text", "text": "仅正文"}]
    assert assistant_blocks("空用量也不加", usage=None) == [{"type": "text", "text": "空用量也不加"}]


def test_usage_block_shape():
    assert usage_block({"total_tokens": 9}) == {"type": "usage", "usage": {"total_tokens": 9}}
