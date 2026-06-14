"""项目获取（Deal Sourcing）子图节点单元测试 + 子图全链路集成测试 —— 不连网关、不连库。

覆盖：
- 各节点档位（约定 3：策略 FAST，候选/评分 STANDARD，池级组装 PREMIUM）
- allow_overseas 合规开关全 LLM 节点透传（约定 5）
- generate_candidates / score_candidates 空输入守卫（无信号/无候选不调 LLM）
- dedupe_candidates 纯函数实体去重：名称规范化、别名合并、入选理由合并
- score_candidates 评分按名合并、缺失中性回退、按分排序、不丢候选
- 空候选兜底：仍产出合法 DealList（空池）
- 真实 LangGraph 子图 astream 端到端：产出可经 SCHEMA_REGISTRY 入库的 DealList payload
"""

from __future__ import annotations

import asyncio
import uuid

import app.agents.deal_sourcing.nodes as nodes
from app.agents.deal_sourcing.graph import build_deal_sourcing_graph
from app.agents.deal_sourcing.schemas import (
    CandidateDraft,
    CandidateDrafts,
    DealListSummary,
    ScoredCandidate,
    ScoredCandidates,
    SearchStrategy,
)
from app.llm.client import ModelTier
from app.objects.deal_list import DealList, RecommendationTier
from app.objects.thesis import FitScoreBreakdown
from tests.test_agent_runner import _fit


def _draft(name: str, aliases=None, eid="e1") -> CandidateDraft:
    return CandidateDraft(
        company_name=name,
        aliases=aliases or [],
        sub_direction="AI眼镜光学模组",
        selection_reasons=[{"text": f"{name} 触发信号",
                            "evidence_ids": [str(uuid.uuid5(uuid.NAMESPACE_DNS, eid))],
                            "inferred": False}],
    )


def _fake_llm(monkeypatch):
    """schema → 实例的假 complete_structured，记录每次调用。"""
    calls: list[dict] = []
    responses = {
        SearchStrategy: lambda: SearchStrategy(
            themes=["AI 眼镜光学模组", "端侧 AI 芯片"],
            priority_signals=["新融资", "专利增长"],
            keywords=["AI glasses optics", "端侧推理芯片"],
            regions=[],
        ),
        CandidateDrafts: lambda: CandidateDrafts(
            candidates=[_draft("光羽科技"), _draft("星海智能", eid="e2")]
        ),
        ScoredCandidates: lambda: ScoredCandidates(
            candidates=[
                ScoredCandidate(
                    company_name="光羽科技",
                    fit_score=FitScoreBreakdown(**{**_fit(), "total": 92}),
                    recommendation_tier=RecommendationTier.STRONG,
                    recommendation_reasons=[{"text": "上游光学交互",
                                             "evidence_ids": [str(uuid.uuid5(uuid.NAMESPACE_DNS, "e1"))],
                                             "inferred": False}],
                    initial_risks=[{"text": "客户集中度待验证", "evidence_ids": [], "inferred": True}],
                ),
                ScoredCandidate(
                    company_name="星海智能",
                    fit_score=FitScoreBreakdown(**{**_fit(), "total": 70}),
                    recommendation_tier=RecommendationTier.WATCH,
                ),
            ]
        ),
        DealListSummary: lambda: DealListSummary(
            name="AI 硬件上游候选项目池", summary="覆盖光学模组与端侧芯片，2 个候选"
        ),
    }

    async def fake(tier, messages, schema, *, allow_overseas=False, **kw):
        calls.append({"tier": tier, "schema": schema, "allow_overseas": allow_overseas,
                      "user": messages[-1]["content"]})
        return responses[schema]()

    monkeypatch.setattr(nodes, "complete_structured", fake)
    return calls


# ---------- 各节点 ----------

def test_gen_search_strategy_fast_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.gen_search_strategy({"query": "帮我找一批 AI 硬件上游项目", "allow_overseas": True}))
    [c] = calls
    assert c["tier"] is ModelTier.FAST
    assert c["allow_overseas"] is True
    assert out["search_strategy"]["themes"][0] == "AI 眼镜光学模组"
    assert out["progress"]


def test_generate_candidates_empty_skips_llm(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.generate_candidates({"raw_signals": []}))
    assert calls == []                      # 无信号不调 LLM
    assert out["candidates"] == []


def test_generate_candidates_standard_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(
        nodes.generate_candidates({"raw_signals": [{"title": "x", "evidence_id": "e1"}]})
    )
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    assert {d["company_name"] for d in out["candidates"]} == {"光羽科技", "星海智能"}


def test_dedupe_merges_aliases_and_reasons():
    """纯函数：同一公司不同名称/别名合并，入选理由按 text 去重合并。"""
    state = {
        "candidates": [
            _draft("光羽科技", eid="e1").model_dump(mode="json"),
            # 工商全称 + 品牌别名指向同一实体
            _draft("深圳光羽智能科技有限公司", aliases=["光羽科技", "Guangyu Vision"], eid="e2").model_dump(mode="json"),
            _draft("星海智能", eid="e3").model_dump(mode="json"),
        ]
    }
    out = nodes.dedupe_candidates(state)
    names = [c["company_name"] for c in out["candidates"]]
    # 光羽两条合并为一，星海独立 → 2 条
    assert len(out["candidates"]) == 2
    guangyu = next(c for c in out["candidates"] if "光羽" in c["company_name"])
    assert "Guangyu Vision" in guangyu["aliases"]
    # 两条不同 evidence 的入选理由都保留
    assert len(guangyu["selection_reasons"]) == 2
    assert "星海智能" in names


def test_dedupe_empty_passthrough():
    assert nodes.dedupe_candidates({"candidates": []})["candidates"] == []


def test_score_candidates_empty_skips_llm(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.score_candidates({"candidates": []}))
    assert calls == []
    assert out["candidates"] == []


def test_score_candidates_merges_sorts_and_falls_back(monkeypatch):
    calls = _fake_llm(monkeypatch)
    cands = [
        _draft("光羽科技").model_dump(mode="json"),
        _draft("星海智能", eid="e2").model_dump(mode="json"),
        _draft("无评分公司", eid="e3").model_dump(mode="json"),  # LLM 未返回评分 → 回退
    ]
    out = asyncio.run(nodes.score_candidates({"candidates": cands, "preference_input": {}}))
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    result = out["candidates"]
    # 按 initial_score 降序：光羽(92) > 星海(70) > 无评分(50 回退)
    assert [r["company_name"] for r in result] == ["光羽科技", "星海智能", "无评分公司"]
    assert result[0]["recommendation_tier"] == "strong"
    fallback = result[-1]
    assert fallback["initial_score"] == 50.0
    assert fallback["fit_score"] is None
    assert fallback["recommendation_tier"] == "observe"   # 45<=50<65
    assert len(result) == 3                                 # 候选不丢失


def test_assemble_empty_produces_valid_deal_list(monkeypatch):
    """无候选也产出合法 DealList（空池是有效结论）。"""
    _fake_llm(monkeypatch)
    out = asyncio.run(nodes.assemble_deal_list({"candidates": [], "search_strategy": {"themes": ["AI硬件"]}}))
    DealList.model_validate(out["deal_list"])
    assert out["deal_list"]["candidates"] == []
    assert out["deal_list"]["search_themes"] == ["AI硬件"]


def test_assemble_premium_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    cands = [
        {**_draft("光羽科技").model_dump(mode="json"), "initial_score": 92,
         "recommendation_tier": "strong", "fit_score": {**_fit(), "total": 92}},
    ]
    out = asyncio.run(nodes.assemble_deal_list(
        {"candidates": cands, "search_strategy": {"themes": ["AI硬件"]}}
    ))
    [c] = calls
    assert c["tier"] is ModelTier.PREMIUM
    DealList.model_validate(out["deal_list"])
    assert out["deal_list"]["name"] == "AI 硬件上游候选项目池"


def test_all_llm_nodes_pass_compliance_flag(monkeypatch):
    """约定 5：每个 LLM 节点都必须透传 allow_overseas。"""
    calls = _fake_llm(monkeypatch)
    cands = [_draft("光羽科技").model_dump(mode="json")]
    base = {"allow_overseas": True, "search_strategy": {"themes": ["t"]},
            "raw_signals": [{"title": "x", "evidence_id": "e1"}], "preference_input": {}}
    asyncio.run(nodes.gen_search_strategy(dict(base, query="q")))
    asyncio.run(nodes.generate_candidates(dict(base)))
    asyncio.run(nodes.score_candidates(dict(base, candidates=cands)))
    asyncio.run(nodes.assemble_deal_list(dict(base, candidates=cands)))
    assert len(calls) == 4
    assert all(c["allow_overseas"] is True for c in calls)


# ---------- 子图全链路 ----------

def test_graph_end_to_end_produces_deal_list(monkeypatch):
    """真实 LangGraph 图端到端：最终 state 有可入库的 deal_list（无 Connector key → 空信号）。"""
    calls = _fake_llm(monkeypatch)
    graph = build_deal_sourcing_graph()

    async def run():
        chunks = []
        async for chunk in graph.astream(
            {"query": "帮我找一批 AI 硬件上游项目", "allow_overseas": False, "conversation_id": ""},
            stream_mode="values",
        ):
            chunks.append(chunk)
        return chunks

    chunks = asyncio.run(run())
    final = chunks[-1]

    # 无数据源 key → mine_signals 空 → generate/score 不调 LLM → 空池兜底
    DealList.model_validate(final["deal_list"])
    assert final["deal_list"]["candidates"] == []
    assert final["search_strategy"]["themes"][0] == "AI 眼镜光学模组"

    # 调用链：仅策略(FAST)。空信号 → 候选生成/评分守卫跳过 → 空池兜底不调 PREMIUM。
    tiers = [c["tier"] for c in calls]
    assert tiers == [ModelTier.FAST]
    assert all(c["allow_overseas"] is False for c in calls)

    seen = [c.get("progress") for c in chunks if c.get("progress")]
    assert "项目池已生成" in seen


# ---------- Step 5：工商核验 verify_candidates ----------

from app.connectors.base import Source  # noqa: E402


def _registry_sources(name: str, *, uscc="91440300MA5XXXXXXX", status="存续"):
    """模拟企查查 company_lookup 返回：工商照面 + 一条股东。"""
    return [
        Source(
            source_type="company_registry",
            title=f"{name} 工商照面",
            connector="qcc",
            raw={"Name": name, "CreditCode": uscc, "Status": status, "KeyNo": "k1"},
        ),
        Source(
            source_type="company_shareholder",
            title=f"{name} 股东：张三",
            connector="qcc",
            raw={"StockName": "张三", "StockPercent": "60%"},
        ),
    ]


def _patch_verify(monkeypatch, lookup):
    """让 verify_candidates 走到 lookup：active_connectors 非空 + 注入假 lookup_company。"""
    monkeypatch.setattr(nodes, "active_connectors", lambda **kw: [object()])

    async def fake_lookup(connectors, name):
        return lookup(name)

    monkeypatch.setattr(nodes, "lookup_company", fake_lookup)


def test_verify_enriches_hit_candidate_and_appends_evidence(monkeypatch):
    """命中工商照面：补 uscc + 规范名别名 + 绑定证据的核验 Claim，并累加 evidence_sources。"""
    _patch_verify(monkeypatch, lambda name: _registry_sources("深圳光羽智能科技有限公司"))
    cand = _draft("光羽科技").model_dump(mode="json")
    state = {"candidates": [cand], "evidence_sources": [{"evidence_id": "pre", "title": "旧信号"}]}
    out = asyncio.run(nodes.verify_candidates(state))

    c = out["candidates"][0]
    assert c["uscc"] == "91440300MA5XXXXXXX"
    assert "深圳光羽智能科技有限公司" in c["aliases"]
    # 原信号理由 + 新核验理由
    assert len(c["selection_reasons"]) == 2
    verify_claim = c["selection_reasons"][-1]
    assert "工商核验" in verify_claim["text"]
    assert verify_claim["inferred"] is False
    assert len(verify_claim["evidence_ids"]) == 1
    # 旧证据保留 + 工商照面/股东两条新证据落入，核验 Claim 指向照面 evidence_id
    eids = {es["evidence_id"] for es in out["evidence_sources"]}
    assert "pre" in eids
    assert verify_claim["evidence_ids"][0] in eids
    assert len(out["evidence_sources"]) == 3


def test_verify_miss_keeps_candidate_and_no_fake_evidence(monkeypatch):
    """未命中：候选保持原样、不补 uscc、不造证据（约定 2 不伪造）。"""
    _patch_verify(monkeypatch, lambda name: [])
    cand = _draft("查无此司").model_dump(mode="json")
    state = {"candidates": [cand], "evidence_sources": []}
    out = asyncio.run(nodes.verify_candidates(state))
    c = out["candidates"][0]
    assert c.get("uscc") in (None, "")
    assert len(c["selection_reasons"]) == 1          # 仅原信号理由
    assert out["evidence_sources"] == []


def test_verify_empty_or_no_connector_passthrough(monkeypatch):
    """无候选直接透传；无工商源 key（active_connectors 空）不查不改。"""
    assert asyncio.run(nodes.verify_candidates({"candidates": []}))["candidates"] == []
    monkeypatch.setattr(nodes, "active_connectors", lambda **kw: [])
    cand = _draft("光羽科技").model_dump(mode="json")
    out = asyncio.run(nodes.verify_candidates({"candidates": [cand]}))
    assert len(out["candidates"][0]["selection_reasons"]) == 1
    assert "evidence_sources" not in out             # 无源时不动证据
