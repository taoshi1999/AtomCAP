"""项目获取（Deal Intake 分析流）子图节点单元测试 + 子图全链路集成测试 —— 不连网关、不连库。

覆盖：
- parse_material 档位（STANDARD）、allow_overseas 透传（约定 5）、空材料守卫（不调 LLM）
- enrich_external 无数据源 key / 未识别项目守卫 → 空信号路径
- align_entity 纯函数实体对齐：uscc 精确命中、规范化名/别名命中、无已有公司 → 不命中
- assemble_deal 档位（PREMIUM）、source_type 透传、产出可经 DealProfile 强校验的 payload
- 真实 LangGraph 子图 astream 端到端：产出合法 DealProfile（无 Connector key → 空证据）
"""

from __future__ import annotations

import asyncio
import uuid

import app.agents.deal_intake.nodes as nodes
from app.agents.deal_intake.graph import build_deal_intake_graph
from app.agents.deal_intake.schemas import DealAnalysis, DealExtraction
from app.llm.client import ModelTier
from app.objects.deal import DealProfile, DealStatus
from app.objects.deal_list import DealSourceType
from app.objects.thesis import FitScoreBreakdown
from tests.test_agent_runner import _fit

EID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "e1"))


def _fake_llm(monkeypatch):
    """schema → 实例的假 complete_structured，记录每次调用。"""
    calls: list[dict] = []
    responses = {
        DealExtraction: lambda: DealExtraction(
            company_name="光羽科技",
            aliases=["Guangyu Vision"],
            track="AI 硬件",
            sub_direction="AI 眼镜光学模组",
            funding_stage="Pre-A",
            founders=["张三"],
        ),
        DealAnalysis: lambda: DealAnalysis(
            portrait="光羽科技是一家 AI 眼镜光学模组与空间交互方案提供商。",
            track_judgement="AI 硬件上游光学交互",
            fit_score=FitScoreBreakdown(**{**_fit(), "total": 89}),
            overall_fit=89,
            highlights=[
                {"text": "位于 AI 硬件上游光学交互环节", "evidence_ids": [EID], "inferred": False}
            ],
            initial_risks=[
                {"text": "客户集中度待验证", "evidence_ids": [], "inferred": True}
            ],
            info_gaps=["头部客户收入占比未知"],
            open_questions=["是否已有稳定量产订单？"],
            next_steps=[{"text": "安排创始人访谈", "evidence_ids": [], "inferred": True}],
        ),
    }

    async def fake(tier, messages, schema, *, allow_overseas=False, **kw):
        calls.append({"tier": tier, "schema": schema, "allow_overseas": allow_overseas,
                      "user": messages[-1]["content"]})
        return responses[schema]()

    monkeypatch.setattr(nodes, "complete_structured", fake)
    return calls


# ---------- Step 3：材料解析 ----------

def test_parse_material_standard_tier(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.parse_material(
        {"material": "光羽科技，AI 眼镜光学模组，Pre-A 轮", "allow_overseas": True}
    ))
    [c] = calls
    assert c["tier"] is ModelTier.STANDARD
    assert c["allow_overseas"] is True
    assert out["extraction"]["company_name"] == "光羽科技"
    assert out["progress"]


def test_parse_material_empty_skips_llm(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.parse_material({"material": "   "}))
    assert calls == []                                # 空材料不调 LLM
    assert out["extraction"]["company_name"] == "未识别项目"


# ---------- Step 4：外部信息补全 ----------

def test_enrich_no_connectors_returns_empty(monkeypatch):
    """无数据源 key（active_connectors 为空）→ 空证据路径，不报错。"""
    out = asyncio.run(nodes.enrich_external(
        {"extraction": {"company_name": "光羽科技", "track": "AI 硬件"}, "allow_overseas": False}
    ))
    assert out["raw_signals"] == []
    assert out["evidence_sources"] == []


def test_enrich_unidentified_guard():
    out = asyncio.run(nodes.enrich_external({"extraction": {"company_name": "未识别项目"}}))
    assert out["evidence_sources"] == []


# ---------- Step 5：实体对齐（纯函数） ----------

def test_align_entity_uscc_exact_match():
    known_id = str(uuid.uuid4())
    out = nodes.align_entity({
        "extraction": {"company_name": "随便写的名", "uscc": "91440300MA5XXXXX1A"},
        "known_companies": [
            {"id": str(uuid.uuid4()), "name": "别家", "uscc": "9144030000000000XX"},
            {"id": known_id, "name": "光羽科技", "uscc": "91440300MA5XXXXX1A"},
        ],
    })
    assert out["matched_company_id"] == known_id


def test_align_entity_name_and_alias_match():
    """规范化后等值对齐（去后缀/括注/大小写），非子串包含——与 deal_sourcing 去重同构。"""
    known_id = str(uuid.uuid4())
    # 主名经规范化等值命中：'光羽科技有限公司' → '光羽' == 已有 '光羽科技' → '光羽'
    out = nodes.align_entity({
        "extraction": {"company_name": "光羽科技有限公司"},
        "known_companies": [{"id": known_id, "name": "光羽科技"}],
    })
    assert out["matched_company_id"] == known_id
    # 别名跨字段命中：抽取别名规范化 == 已有公司名规范化
    out2 = nodes.align_entity({
        "extraction": {"company_name": "某 AI 眼镜公司", "aliases": ["Guangyu Vision"]},
        "known_companies": [{"id": known_id, "name": "GUANGYU vision", "aliases": []}],
    })
    assert out2["matched_company_id"] == known_id


def test_align_entity_no_known_returns_none():
    out = nodes.align_entity({"extraction": {"company_name": "光羽科技"}, "known_companies": []})
    assert out["matched_company_id"] is None


# ---------- Step 8：项目初步分析 ----------

def test_assemble_deal_premium_and_source_type(monkeypatch):
    calls = _fake_llm(monkeypatch)
    out = asyncio.run(nodes.assemble_deal({
        "extraction": DealExtraction(company_name="光羽科技").model_dump(mode="json"),
        "raw_signals": [{"title": "x", "evidence_id": EID}],
        "source_type": DealSourceType.BP_UPLOAD.value,
        "conversation_id": str(uuid.uuid4()),
        "allow_overseas": True,
    }))
    [c] = calls
    assert c["tier"] is ModelTier.PREMIUM
    assert c["allow_overseas"] is True
    # 产出可经 DealProfile 强校验
    profile = DealProfile.model_validate(out["deal_profile"])
    assert profile.source_type is DealSourceType.BP_UPLOAD
    assert profile.status is DealStatus.SCREENING
    assert profile.analysis.overall_fit == 89
    assert profile.analysis.highlights[0].evidence_ids == [uuid.UUID(EID)]


def test_all_llm_nodes_pass_compliance_flag(monkeypatch):
    """约定 5：parse_material 与 assemble_deal 都必须透传 allow_overseas。"""
    calls = _fake_llm(monkeypatch)
    asyncio.run(nodes.parse_material({"material": "光羽科技", "allow_overseas": True}))
    asyncio.run(nodes.assemble_deal({
        "extraction": DealExtraction(company_name="光羽科技").model_dump(mode="json"),
        "raw_signals": [], "allow_overseas": True,
    }))
    assert len(calls) == 2
    assert all(c["allow_overseas"] is True for c in calls)


# ---------- 子图全链路 ----------

def test_graph_end_to_end_produces_deal_profile(monkeypatch):
    """真实 LangGraph 图端到端：最终 state 有可入库的 deal_profile（无 Connector key → 空证据）。"""
    calls = _fake_llm(monkeypatch)
    graph = build_deal_intake_graph()

    async def run():
        chunks = []
        async for chunk in graph.astream(
            {
                "material": "光羽科技，AI 眼镜光学模组，Pre-A 轮，团队来自大厂光学团队",
                "source_type": "user_input",
                "allow_overseas": False,
                "conversation_id": "",
                "known_companies": [],
            },
            stream_mode="values",
        ):
            chunks.append(chunk)
        return chunks

    chunks = asyncio.run(run())
    final = chunks[-1]

    profile = DealProfile.model_validate(final["deal_profile"])
    assert profile.extraction.company_name == "光羽科技"
    assert profile.analysis.portrait
    assert final["matched_company_id"] is None

    # 无证据（无数据源 key）→ highlights 引用被 schema 后处理或 runner sanitize 时标记推断；
    # 这里子图未过 runner，evidence_ids 原样保留，验证调用链档位即可。
    tiers = [c["tier"] for c in calls]
    assert tiers == [ModelTier.STANDARD, ModelTier.PREMIUM]   # parse + assemble，enrich/align 无 LLM
    assert all(c["allow_overseas"] is False for c in calls)

    seen = [c.get("progress") for c in chunks if c.get("progress")]
    assert "项目初步分析完成" in seen
