"""赛道前瞻 LLM 节点单元测试 + 子图全链路集成测试 —— 不连网关、不连库。

覆盖：
- 各节点档位选择（约定 3：拆解/分类 FAST，综合判断 STANDARD，组装 PREMIUM）
- allow_overseas 合规开关全节点透传（约定 5）
- classify_signals 空输入守卫（无信号不调 LLM）
- fit_score 评分合并：按名匹配、缺失回退机构整体分、草稿不丢失
- 真实 LangGraph 子图 astream 端到端：并行分支汇聚后产出可入库的 thesis payload
"""

from __future__ import annotations

import asyncio


import app.agents.thesis_scout.nodes as nodes
from app.agents.thesis_scout.graph import build_thesis_scout_graph
from app.agents.thesis_scout.schemas import (
    ClassifiedSignals,
    FitAssessment,
    SubDirectionDraft,
    SubDirectionDrafts,
    SubDirectionFit,
    TrackDefinition,
)
from app.llm.client import ModelTier
from app.objects.thesis import (
    FitScoreBreakdown,
    MarketSignal,
    Thesis,
    ValueChain,
    ValueChainSegment,
)
from tests.test_agent_runner import _fit, thesis_payload


def _draft(name: str) -> SubDirectionDraft:
    return SubDirectionDraft(
        name=name,
        detail="细分详情",
        investment_reasons=[
            {"text": "推荐理由 1", "inferred": True},
            {"text": "推荐理由 2", "inferred": True},
            {"text": "推荐理由 3", "inferred": True},
        ],
        key_risks=[
            {"text": "风险点 1", "inferred": True},
            {"text": "风险点 2", "inferred": True},
            {"text": "风险点 3", "inferred": True},
        ],
        suitable_stage="A轮",
    )


def _fake_llm(monkeypatch):
    """schema → 实例的假 complete_structured，记录每次调用。"""
    calls: list[dict] = []
    responses = {
        TrackDefinition: lambda: TrackDefinition(
            name="AI硬件", includes=["端侧推理"], excludes=["纯软件"], search_keywords=["AI hardware"]
        ),
        ClassifiedSignals: lambda: ClassifiedSignals(
            signals=[MarketSignal(kind="structural", title="成本下降", summary={"text": "推理成本下降", "inferred": True})]
        ),
        ValueChain: lambda: ValueChain(upstream=[ValueChainSegment(name="芯片")]),
        SubDirectionDrafts: lambda: SubDirectionDrafts(
            sub_directions=[_draft("子A"), _draft("子B"), _draft("子C")]
        ),
        FitAssessment: lambda: FitAssessment(
            institution_fit=FitScoreBreakdown(**_fit()),
            sub_direction_fits=[
                SubDirectionFit(name="子A", fit=FitScoreBreakdown(**{**_fit(), "total": 90})),
                SubDirectionFit(name="子C", fit=FitScoreBreakdown(**{**_fit(), "total": 30})),
            ],
        ),
        Thesis: lambda: Thesis.model_validate(thesis_payload()),
    }

    async def fake(tier, messages, schema, *, allow_overseas=False, **kw):
        calls.append({"tier": tier, "schema": schema, "allow_overseas": allow_overseas,
                      "user": messages[-1]["content"]})
        return responses[schema]()

    monkeypatch.setattr(nodes, "complete_structured", fake)
    return calls


# ---------- 各节点 ----------

def test_parse_track_fast_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.parse_track({"query": "AI硬件还有机会吗", "allow_overseas": True}))
    [c] = calls
    assert c["tier"] is ModelTier.FAST
    assert c["allow_overseas"] is True
    assert "AI硬件还有机会吗" in c["user"]
    assert out["track_definition"]["name"] == "AI硬件"
    assert out["progress"]


def test_classify_signals_empty_skips_llm(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.classify_signals({"raw_signals": []}))
    assert calls == []                      # 无信号不调 LLM（控成本）
    assert out["classified_signals"] == []


def test_classify_signals_fast_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(
        nodes.classify_signals(
            {"raw_signals": [{"title": "x", "evidence_id": "e1"}], "track_definition": {}}
        )
    )
    [c] = calls
    assert c["tier"] is ModelTier.FAST
    assert out["classified_signals"][0]["kind"] == "structural"


def test_value_chain_standard_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.value_chain({"track_definition": {"name": "AI硬件"}}))
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    assert out["value_chain"]["upstream"][0]["name"] == "芯片"


def test_gen_sub_directions_standard_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.gen_sub_directions({"track_definition": {}}))
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    names = [d["name"] for d in out["sub_directions"]]
    assert names == ["子A", "子B", "子C"]
    assert all("fit_score" not in d for d in out["sub_directions"])  # 草稿不含评分


def test_fit_score_merges_and_falls_back(monkeypatch):
    calls = _fake_llm(monkeypatch)
    drafts = [d.model_dump(mode="json") for d in SubDirectionDrafts(
        sub_directions=[_draft("子A"), _draft("子B"), _draft("子C")]
    ).sub_directions]
    out = asyncio.run(nodes.fit_score({"sub_directions": drafts, "preference": {}}))
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    merged = {d["name"]: d["fit_score"]["total"] for d in out["sub_directions"]}
    assert merged["子A"] == 90 and merged["子C"] == 30   # 按名合并
    assert merged["子B"] == _fit()["total"]              # 缺失回退机构整体分
    assert out["fit"]["total"] == _fit()["total"]
    assert len(out["sub_directions"]) == len(drafts)     # 草稿不丢失


def test_all_llm_nodes_pass_compliance_flag(monkeypatch):
    """约定 5：每个 LLM 节点都必须透传 allow_overseas。"""
    calls = _fake_llm(monkeypatch)
    state = {
        "query": "q", "allow_overseas": True, "track_definition": {},
        "raw_signals": [{"title": "x"}], "classified_signals": [], "value_chain": {},
        "sub_directions": [], "preference": {}, "history": [], "fit": {},
    }
    for node in (nodes.parse_track, nodes.classify_signals, nodes.value_chain,
                 nodes.gen_sub_directions, nodes.fit_score, nodes.assemble_thesis):
        asyncio.run(node(dict(state)))
    assert len(calls) == 6
    assert all(c["allow_overseas"] is True for c in calls)


# ---------- 子图全链路 ----------

def test_graph_end_to_end_produces_thesis(monkeypatch):
    """真实 LangGraph 图（并行分支 + 汇聚）端到端：最终 state 有可入库的 thesis。"""
    calls = _fake_llm(monkeypatch)
    graph = build_thesis_scout_graph()

    async def run():
        chunks = []
        async for chunk in graph.astream(
            {"query": "AI硬件", "allow_overseas": False, "conversation_id": ""},
            stream_mode="values",
        ):
            chunks.append(chunk)
        return chunks

    chunks = asyncio.run(run())
    final = chunks[-1]

    # 产出可直接经 SCHEMA_REGISTRY 校验入库的 payload
    assert final["thesis"]["thesis_name"] == "AI 硬件"
    Thesis.model_validate(final["thesis"])

    # 中间产物齐备：定义 → 产业链 → 子赛道（带评分）
    assert final["track_definition"]["name"] == "AI硬件"
    assert final["sub_directions"][0]["fit_score"]["total"] == 90

    # 调用链：parse(FAST) → value_chain/sub_directions/fit(STANDARD) → assemble(PREMIUM)
    # raw_signals 为空 → classify 不调 LLM
    tiers = [c["tier"] for c in calls]
    assert tiers == [ModelTier.FAST, ModelTier.STANDARD, ModelTier.STANDARD,
                     ModelTier.STANDARD, ModelTier.PREMIUM]
    assert all(c["allow_overseas"] is False for c in calls)

    # progress 全程推送
    seen = [c.get("progress") for c in chunks if c.get("progress")]
    assert "Thesis 已生成" in seen
