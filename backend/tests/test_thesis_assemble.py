"""assemble_thesis 节点单元测试 —— 不连网关。

覆盖：PREMIUM 档位、合规开关透传（核心约定 3/5）、conversation 回链、
输出为可直接入库的 JSON payload。
"""

from __future__ import annotations

import asyncio
import uuid

import app.agents.thesis_scout.nodes as nodes
from app.llm.client import ModelTier
from app.objects.thesis import Thesis
from tests.test_agent_runner import thesis_payload


def test_assemble_thesis_premium_and_compliance(monkeypatch):
    calls: list[dict] = []

    async def fake_structured(tier, messages, schema, *, allow_overseas=False, **kw):
        calls.append(
            {"tier": tier, "messages": messages, "schema": schema, "allow_overseas": allow_overseas}
        )
        return Thesis.model_validate(thesis_payload())

    monkeypatch.setattr(nodes, "complete_structured", fake_structured)
    conv = uuid.uuid4()

    out = asyncio.run(
        nodes.assemble_thesis(
            {
                "query": "AI硬件",
                "conversation_id": str(conv),
                "allow_overseas": True,
                "track_definition": {"name": "AI硬件"},
            }
        )
    )

    [call] = calls
    assert call["tier"] is ModelTier.PREMIUM        # 最终组装用 premium 档（约定 3：只用别名）
    assert call["allow_overseas"] is True           # 合规开关必须透传（约定 5）
    assert call["schema"] is Thesis
    assert "AI硬件" in call["messages"][1]["content"]

    # 输出：JSON payload + 会话回链，可直接交给 save_deliverable 强校验入库
    payload = out["thesis"]
    assert payload["created_from_conversation"] == str(conv)
    assert payload["schema_version"] == 1
    Thesis.model_validate(payload)


def test_assemble_thesis_defaults_no_overseas(monkeypatch):
    """state 未带 allow_overseas 时必须默认 False（合规默认收紧）。"""
    seen = {}

    async def fake_structured(tier, messages, schema, *, allow_overseas=False, **kw):
        seen["allow_overseas"] = allow_overseas
        return Thesis.model_validate(thesis_payload())

    monkeypatch.setattr(nodes, "complete_structured", fake_structured)
    asyncio.run(nodes.assemble_thesis({"query": "机器人"}))
    assert seen["allow_overseas"] is False
