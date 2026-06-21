"""通用 Agent 意图路由的高精度保护层测试。"""

from __future__ import annotations

import asyncio

import pytest

from app.agents import router
from app.agents.router import Intent, high_precision_intent_hint


def test_project_recommendation_routes_to_deal_sourcing():
    result = high_precision_intent_hint("最近有什么项目值得看？")

    assert result is not None
    assert result.intent == Intent.DEAL_SOURCING
    assert result.confidence >= 0.9


def test_long_term_anti_preference_routes_to_preference_advice():
    result = high_precision_intent_hint("以后不要推荐太阳能电池相关的项目")

    assert result is not None
    assert result.intent == Intent.PREFERENCE_ADVICE
    assert result.confidence >= 0.9


def test_preference_update_takes_priority_over_project_sourcing():
    result = high_precision_intent_hint("以后不要推荐储能相关项目，帮我调整投资偏好")

    assert result is not None
    assert result.intent == Intent.PREFERENCE_ADVICE


def test_track_opportunity_still_uses_llm_router():
    assert high_precision_intent_hint("最近有什么赛道值得看？") is None


def test_single_project_analysis_routes_to_deal_intake():
    result = high_precision_intent_hint("帮我分析一下这个项目值不值得投")

    assert result is not None
    assert result.intent == Intent.DEAL_INTAKE


def test_existing_project_library_query_does_not_trigger_sourcing():
    assert high_precision_intent_hint("项目库里当前有多少项目？") is None


def test_classify_intent_short_circuits_clear_project_sourcing(monkeypatch):
    async def fail_complete_structured(*_args, **_kwargs):
        raise AssertionError("clear project sourcing requests should not call LLM router")

    monkeypatch.setattr(router, "complete_structured", fail_complete_structured)

    result = asyncio.run(router.classify_intent("最近有什么项目值得看？"))

    assert result.intent == Intent.DEAL_SOURCING


def test_classify_intent_short_circuits_clear_preference_update(monkeypatch):
    async def fail_complete_structured(*_args, **_kwargs):
        raise AssertionError("clear preference updates should not call LLM router")

    monkeypatch.setattr(router, "complete_structured", fail_complete_structured)

    result = asyncio.run(router.classify_intent("以后不要推荐太阳能电池相关的项目"))

    assert result.intent == Intent.PREFERENCE_ADVICE


def test_classify_intent_keeps_llm_for_non_guarded_requests(monkeypatch):
    expected = router.IntentResult(intent=Intent.THESIS_SCOUT, confidence=0.88)
    called = False

    async def fake_complete_structured(*_args, **_kwargs):
        nonlocal called
        called = True
        return expected

    monkeypatch.setattr(router, "complete_structured", fake_complete_structured)

    result = asyncio.run(router.classify_intent("AI 硬件最近有什么机会？"))

    assert called is True
    assert result is expected
