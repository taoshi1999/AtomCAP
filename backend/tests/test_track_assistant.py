"""赛道库指令助手 —— 离线单元测试（启发式纯函数 + LLM monkeypatch + 降级）。"""

from __future__ import annotations

import asyncio

from app.services import track_assistant as svc
from app.services.track_assistant import (
    ACTION_CREATE,
    ACTION_FILTER,
    ACTION_UNRELATED,
    TrackInstructionResult,
    heuristic_interpret,
    interpret_instruction,
)


def test_heuristic_create_extracts_topic():
    r = heuristic_interpret("帮我创建一个关注固态电池的赛道")
    assert r.action == ACTION_CREATE
    assert r.thesis is not None
    assert "固态电池" in r.thesis.thesis_name


def test_heuristic_filter_extracts_keyword():
    r = heuristic_interpret("筛选出半导体相关的赛道")
    assert r.action == ACTION_FILTER
    assert r.filter_keywords == ["半导体"]


def test_heuristic_unrelated_no_domain():
    assert heuristic_interpret("今天天气怎么样").action == ACTION_UNRELATED
    # 有创建动词但与赛道无关（无领域词）→ 仍然 unrelated
    assert heuristic_interpret("帮我创建一个文档").action == ACTION_UNRELATED


def test_heuristic_empty_unrelated():
    assert heuristic_interpret("   ").action == ACTION_UNRELATED


def test_interpret_uses_llm_result(monkeypatch):
    async def fake_cs(tier, messages, schema, **kw):
        return TrackInstructionResult(action=ACTION_FILTER, filter_keywords=["新能源"], message="已筛选")

    monkeypatch.setattr(svc.llm_client, "complete_structured", fake_cs)
    r = asyncio.run(interpret_instruction("看看新能源相关的赛道"))
    assert r.action == ACTION_FILTER and r.filter_keywords == ["新能源"]


def test_interpret_falls_back_on_error(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("无可用 LLM key")

    monkeypatch.setattr(svc.llm_client, "complete_structured", boom)
    r = asyncio.run(interpret_instruction("筛选出半导体相关的赛道"))
    assert r.action == ACTION_FILTER and r.filter_keywords == ["半导体"]


def test_interpret_create_without_thesis_falls_back(monkeypatch):
    async def no_thesis(tier, messages, schema, **kw):
        return TrackInstructionResult(action=ACTION_CREATE, thesis=None, message="x")

    monkeypatch.setattr(svc.llm_client, "complete_structured", no_thesis)
    r = asyncio.run(interpret_instruction("创建一个关注新能源的赛道"))
    assert r.action == ACTION_CREATE and r.thesis is not None
    assert "新能源" in r.thesis.thesis_name
