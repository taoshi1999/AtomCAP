"""投资偏好指令助手 —— 离线单元测试（启发式纯函数 + LLM monkeypatch + 降级）。"""

from __future__ import annotations

import asyncio

from app.services import preference_assistant as svc
from app.services.preference_assistant import (
    ACTION_CREATE,
    ACTION_FILTER,
    ACTION_UNRELATED,
    PreferenceInstructionResult,
    heuristic_interpret,
    interpret_instruction,
)


# ----------------------------- 启发式 -----------------------------

def test_heuristic_create_extracts_dimensions():
    r = heuristic_interpret("帮我创建一个关注半导体、A 轮的投资偏好")
    assert r.action == ACTION_CREATE
    assert r.profile is not None
    assert "半导体" in r.profile.sectors
    assert "A 轮" in r.profile.stages
    assert r.profile.name  # 非空名称
    assert "半导体" in r.profile.name


def test_heuristic_filter_extracts_keywords():
    r = heuristic_interpret("筛选出半导体相关的投资偏好")
    assert r.action == ACTION_FILTER
    assert r.filter_keywords == ["半导体"]


def test_heuristic_unrelated():
    r = heuristic_interpret("今天天气怎么样")
    assert r.action == ACTION_UNRELATED
    assert r.message  # 有提示文案


def test_heuristic_empty_unrelated():
    assert heuristic_interpret("   ").action == ACTION_UNRELATED


# --------------------------- LLM 路径 ---------------------------

def test_interpret_uses_llm_result(monkeypatch):
    async def fake_cs(tier, messages, schema, **kw):
        return PreferenceInstructionResult(
            action=ACTION_FILTER, filter_keywords=["新能源"], message="已筛选"
        )

    monkeypatch.setattr(svc.llm_client, "complete_structured", fake_cs)
    r = asyncio.run(interpret_instruction("帮我看看新能源的"))
    assert r.action == ACTION_FILTER and r.filter_keywords == ["新能源"]


def test_interpret_falls_back_to_heuristic_on_error(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("无可用 LLM key")

    monkeypatch.setattr(svc.llm_client, "complete_structured", boom)
    r = asyncio.run(interpret_instruction("筛选出半导体相关的投资偏好"))
    assert r.action == ACTION_FILTER and r.filter_keywords == ["半导体"]


def test_interpret_create_without_profile_falls_back(monkeypatch):
    async def no_profile(tier, messages, schema, **kw):
        return PreferenceInstructionResult(action=ACTION_CREATE, profile=None, message="x")

    monkeypatch.setattr(svc.llm_client, "complete_structured", no_profile)
    r = asyncio.run(interpret_instruction("创建一个关注新能源的投资偏好"))
    # 模型说 create 却没给 profile → 退回启发式补出 profile
    assert r.action == ACTION_CREATE and r.profile is not None
    assert "新能源" in r.profile.sectors


def test_interpret_empty_unrelated():
    r = asyncio.run(interpret_instruction(""))
    assert r.action == ACTION_UNRELATED
