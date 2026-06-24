"""近期市场信号 ReAct 检索编排测试。"""

from __future__ import annotations

import asyncio

import app.services.market_signal_research as research
from app.connectors.base import Source
from app.services.market_signal_research import (
    CandidateAssessment,
    MarketSignalResearchSubject,
    MarketSignalRoundDecision,
    NextSearchTarget,
    run_market_signal_research,
)


def _source(title: str, *, snippet: str = "", url: str = "") -> Source:
    return Source(
        source_type="web_search",
        title=title,
        snippet=snippet or title,
        url=url or f"https://example.com/{title}",
        connector="fake",
        published_at="2026-06-20",
    )


def _analysis(prefix: str) -> str:
    return f"{prefix}。这与研究目标直接相关。它提示需要调整当前判断。后续应核验主体和商业影响。"


def test_react_research_uses_model_next_target_for_second_round(monkeypatch):
    subject = MarketSignalResearchSubject(
        kind="deal",
        name="光羽科技",
        track="AI 眼镜",
        focus_terms=["光学模组"],
    )
    search_calls: list[tuple[int, dict[str, list[str]]]] = []

    async def fake_search(queries, round_number):
        search_calls.append((round_number, queries))
        if round_number == 1:
            return {
                "finance_news": [
                    _source("光羽科技完成融资", snippet="光羽科技获得产业资本投资。"),
                    _source("高中物理试题答案", snippet="光学基础练习。"),
                ]
            }
        return {
            "finance_news": [
                _source("光羽科技获得头部客户订单", snippet="公司披露新增量产订单。")
            ]
        }

    async def fake_assess(*, candidates, round_number, **_kwargs):
        if round_number == 1:
            return MarketSignalRoundDecision(
                assessments=[
                    CandidateAssessment(
                        candidate_id=candidates[0].candidate_id,
                        relevant=True,
                        relevance_score=92,
                        signal_analysis=_analysis("该融资信号验证了项目的资本关注度"),
                    ),
                    CandidateAssessment(
                        candidate_id=candidates[1].candidate_id,
                        relevant=False,
                        relevance_score=5,
                    ),
                ],
                next_search_targets=[
                    NextSearchTarget(
                        category="finance_news",
                        queries=["光羽科技 客户 订单 量产"],
                    )
                ],
            )
        return MarketSignalRoundDecision(
            assessments=[
                CandidateAssessment(
                    candidate_id=candidates[0].candidate_id,
                    relevant=True,
                    relevance_score=88,
                    signal_analysis=_analysis("该订单信号验证了项目的商业进展"),
                )
            ],
            stop=True,
        )

    monkeypatch.setattr(research, "assess_market_signal_round", fake_assess)

    result = asyncio.run(
        run_market_signal_research(
            subject=subject,
            initial_queries={"finance_news": ["光羽科技 融资"]},
            search_round=fake_search,
            max_search_rounds=2,
        )
    )

    assert [round_number for round_number, _ in search_calls] == [1, 2]
    assert search_calls[1][1]["finance_news"] == ["光羽科技 客户 订单 量产"]
    assert [item.title for item in result["finance_news"]] == [
        "光羽科技完成融资",
        "光羽科技获得头部客户订单",
    ]
    assert all((item.raw or {})["relevance_score"] >= 65 for item in result["finance_news"])


def test_search_depth_one_forces_single_round(monkeypatch):
    subject = MarketSignalResearchSubject(kind="thesis", name="钙钛矿电池", track="钙钛矿电池")
    search_rounds: list[int] = []

    async def fake_search(_queries, round_number):
        search_rounds.append(round_number)
        return {"patent": [_source("钙钛矿电池封装专利获授权")]}

    async def fake_assess(*, candidates, **_kwargs):
        return MarketSignalRoundDecision(
            assessments=[
                CandidateAssessment(
                    candidate_id=candidates[0].candidate_id,
                    relevant=True,
                    relevance_score=90,
                    signal_analysis=_analysis("该专利直接涉及赛道关键封装环节"),
                )
            ],
            next_search_targets=[
                NextSearchTarget(category="patent", queries=["钙钛矿电池 量产 专利"])
            ],
        )

    monkeypatch.setattr(research, "assess_market_signal_round", fake_assess)

    result = asyncio.run(
        run_market_signal_research(
            subject=subject,
            initial_queries={"patent": ["钙钛矿电池 专利"]},
            search_round=fake_search,
            max_search_rounds=1,
        )
    )

    assert search_rounds == [1]
    assert len(result["patent"]) == 1


def test_llm_failure_fallback_rejects_unrelated_exam_document(monkeypatch):
    subject = MarketSignalResearchSubject(
        kind="deal",
        name="光羽科技",
        track="钙钛矿电池",
        focus_terms=["薄膜太阳能电池"],
    )

    async def fail_llm(*_args, **_kwargs):
        raise RuntimeError("model unavailable")

    async def fake_search(_queries, _round_number):
        return {
            "finance_news": [
                _source(
                    "安徽省寿县高三物理试题答案",
                    snippet="题目涉及薄膜太阳能电池的基础知识。",
                )
            ]
        }

    monkeypatch.setattr(research, "complete_structured", fail_llm)

    result = asyncio.run(
        run_market_signal_research(
            subject=subject,
            initial_queries={"finance_news": ["光羽科技 财经新闻"]},
            search_round=fake_search,
            max_search_rounds=1,
        )
    )

    assert result["finance_news"] == []
