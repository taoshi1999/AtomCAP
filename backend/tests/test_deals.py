"""项目库 / 项目工作台服务单测（不连库，与 test_auth 同风格）。

覆盖纯函数决策逻辑：
- 管线状态流转守卫（is_allowed_transition）
- 用户反馈动作补丁（apply_user_action）+ 入库前 DealProfile 强校验
- summary 投影（deal_summary）
- DealProfile 向后兼容（既有无 user_feedback/workspace 的 data 仍校验通过）

接库的列表/详情/记账集成测试待 compose 环境就绪后补（与 auth 接库测试同批，见 README）。
"""

from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from types import SimpleNamespace

import pytest

import app.api.deals as deals_api
from app.models.models import Chunk, Document, EvidenceItemRow
from app.api.deps import CurrentUser
from app.connectors.base import Source
from app.objects.deal import DealMarketSignalCategory, DealProfile, DealStatus, PreDDMaterialCollectionStatus
from app.objects.dd_report import DDReport
from app.services import deal_market_signals
from app.services.deals import (
    USER_ACTIONS,
    append_status_history,
    apply_user_action,
    deal_matches_query,
    deal_summary,
    update_pre_dd_material_status,
    soft_delete_deal,
    is_allowed_transition,
)
from app.services.deal_market_signals import collect_deal_market_signals, deal_market_signal_queries
from app.services.deal_materials import project_deal_material, save_deal_material, search_material_records
from app.services.pre_dd import build_pre_dd_workspace, infer_material_task_hits, suggest_material_category
from app.services.pre_dd_brief import build_pre_dd_brief_report, project_pre_dd_brief


def _valid_data(**overrides) -> dict:
    """构造一份可经 DealProfile 强校验的最小 deals.data。"""
    data = {
        "source_type": "bp_upload",
        "status": "screening",
        "extraction": {"company_name": "光羽科技", "track": "AI硬件"},
        "analysis": {"portrait": "AI 眼镜光学模组方案商", "overall_fit": 89},
    }
    data.update(overrides)
    return data


# ---------- 管线状态流转守卫 ----------

def test_forward_transitions_allowed():
    assert is_allowed_transition("sourced", "screening")
    assert is_allowed_transition("screening", "pre_dd")
    assert is_allowed_transition("pre_dd", "approved")
    assert is_allowed_transition("approved", "exited")


def test_reject_allowed_from_nonterminal():
    assert is_allowed_transition("screening", "rejected")
    assert is_allowed_transition("pre_dd", "rejected")
    assert is_allowed_transition("ic_ready", "rejected")


def test_terminal_states_have_no_exit():
    assert not is_allowed_transition("exited", "rejected")
    assert not is_allowed_transition("rejected", "screening")
    assert not is_allowed_transition("deleted", "screening")


def test_skip_and_self_transition_rejected():
    assert not is_allowed_transition("sourced", "approved")  # 跳级
    assert not is_allowed_transition("screening", "screening")  # 自环


def test_ic_ready_can_fallback_to_pre_dd():
    assert is_allowed_transition("ic_ready", "pre_dd")


def test_status_history_records_actual_branch():
    data = _valid_data()
    assert append_status_history(data, "screening", "rejected") == ["screening", "rejected"]

    data["status_history"] = ["screening", "pre_dd"]
    assert append_status_history(data, "pre_dd", "rejected") == ["screening", "pre_dd", "rejected"]


# ---------- 用户反馈动作补丁 ----------

def test_add_to_library_sets_flag_and_validates():
    out = apply_user_action(_valid_data(), "add_to_library")
    assert out["user_feedback"]["is_in_library"] is True
    DealProfile.model_validate(out)  # 入库前强校验通过


def test_follow_and_dismiss_are_mutually_exclusive():
    followed = apply_user_action(_valid_data(), "follow")
    assert followed["user_feedback"]["is_liked"] is True
    assert followed["user_feedback"]["is_disliked"] is False

    dismissed = apply_user_action(followed, "dismiss")
    assert dismissed["user_feedback"]["is_disliked"] is True
    assert dismissed["user_feedback"]["is_liked"] is False


def test_abandon_sets_flag():
    out = apply_user_action(_valid_data(), "abandon")
    assert out["user_feedback"]["is_abandoned"] is True


def test_create_workspace_records_conversation():
    conv = uuid.uuid4()
    out = apply_user_action(_valid_data(), "create_workspace", {"conversation_id": conv})
    assert out["workspace"]["created"] is True
    assert out["workspace"]["conversation_id"] == str(conv)
    DealProfile.model_validate(out)


def test_apply_user_action_does_not_mutate_input():
    data = _valid_data()
    apply_user_action(data, "add_to_library")
    assert "user_feedback" not in data or not data["user_feedback"].get("is_in_library")


def test_unknown_action_raises():
    with pytest.raises(ValueError, match="未知动作"):
        apply_user_action(_valid_data(), "nope")


def test_all_user_actions_keep_data_valid():
    for action in USER_ACTIONS:
        out = apply_user_action(_valid_data(), action, {"conversation_id": uuid.uuid4()})
        DealProfile.model_validate(out)  # 每个动作产物都可入库


# ---------- DealProfile 向后兼容 ----------

def test_legacy_data_without_feedback_blocks_validates():
    """既有 deals.data（无 user_feedback / workspace）仍能校验，且默认块就位。"""
    profile = DealProfile.model_validate(_valid_data())
    assert profile.user_feedback.is_in_library is False
    assert profile.workspace.created is False


def test_default_status_screening():
    profile = DealProfile.model_validate(_valid_data())
    assert profile.status == DealStatus.SCREENING


def test_legacy_data_defaults_empty_market_signals():
    profile = DealProfile.model_validate(_valid_data())
    assert profile.market_signals == []


def test_legacy_data_defaults_empty_pre_dd_material_statuses():
    profile = DealProfile.model_validate(_valid_data())
    assert profile.pre_dd_material_statuses == {}


def test_deal_market_signal_queries_cover_five_categories():
    profile = DealProfile.model_validate(
        _valid_data(
            extraction={
                "company_name": "光羽科技",
                "aliases": ["LightWing"],
                "track": "AI 硬件",
                "product": "光学模组",
                "founders": ["张三"],
            }
        )
    )

    queries = deal_market_signal_queries(profile)

    assert set(queries) == set(DealMarketSignalCategory)
    assert "光羽科技" in queries[DealMarketSignalCategory.BUSINESS_REGISTRY]
    assert any("融资" in item for item in queries[DealMarketSignalCategory.FINANCE_NEWS])
    assert any("专利" in item for item in queries[DealMarketSignalCategory.PATENT])
    assert any("论文" in item for item in queries[DealMarketSignalCategory.PAPER])
    assert any("张三" in item for item in queries[DealMarketSignalCategory.PERSONNEL])


# ---------- summary 投影 ----------

def _fake_deal(data: dict, status: str = "screening"):
    now = dt.datetime(2026, 6, 15, 10, 0, 0)
    return SimpleNamespace(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        status=status,
        data=data,
        created_at=now,
        updated_at=now,
    )


def test_deal_summary_projects_key_fields():
    deal = _fake_deal(apply_user_action(_valid_data(), "follow"))
    company = SimpleNamespace(name="深圳光羽智能科技有限公司")
    s = deal_summary(deal, company)
    assert s["company_name"] == "深圳光羽智能科技有限公司"
    assert s["status"] == "screening"
    assert s["overall_fit"] == 89
    assert s["portrait"] == "AI 眼镜光学模组方案商"
    assert s["is_liked"] is True
    assert s["is_abandoned"] is False


def test_deal_summary_tolerates_missing_company():
    deal = _fake_deal(_valid_data())
    s = deal_summary(deal, None)
    assert s["company_name"] is None
    assert s["is_in_library"] is False


def test_deal_matches_query_uses_name_portrait_source_and_status():
    deal = _fake_deal(_valid_data(source_type="user_input"))
    summary = deal_summary(deal, SimpleNamespace(name="深圳光羽智能科技有限公司"))

    assert deal_matches_query(summary, "光羽智能")
    assert deal_matches_query(summary, "AI眼镜")
    assert deal_matches_query(summary, "user input")
    assert deal_matches_query(summary, "screening")
    assert not deal_matches_query(summary, "新能源电池")


class _FakeDealDb:
    def __init__(self, deal):
        self.deal = deal
        self.flushes = 0

    async def scalar(self, _stmt):
        return self.deal

    async def flush(self):
        self.flushes += 1


def test_soft_delete_deal_marks_deleted_and_records_history(monkeypatch):
    deal = _fake_deal(_valid_data(status_history=["screening", "pre_dd"]), status="pre_dd")
    db = _FakeDealDb(deal)
    events = []

    async def fake_record_event(*_args, **kwargs):
        events.append(kwargs)

    monkeypatch.setattr("app.services.deals.record_event", fake_record_event)

    out = asyncio.run(
        soft_delete_deal(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal.id,
        )
    )

    assert out.status == "deleted"
    assert out.data["status"] == "deleted"
    assert out.data["status_history"] == ["screening", "pre_dd", "deleted"]
    assert db.flushes == 1
    assert events[0]["event_type"] == "deal.deleted"
    assert events[0]["payload"]["from_status"] == "pre_dd"


def test_update_pre_dd_material_status_persists_manual_override(monkeypatch):
    deal = _fake_deal(_valid_data())
    db = _FakeDealDb(deal)
    events = []

    async def fake_record_event(*_args, **kwargs):
        events.append(kwargs)

    monkeypatch.setattr("app.services.deals.record_event", fake_record_event)

    out = asyncio.run(
        update_pre_dd_material_status(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal.id,
            task_key="financials",
            collection_status=PreDDMaterialCollectionStatus.COLLECTED,
        )
    )

    assert out.data["pre_dd_material_statuses"]["financials"] == "collected"
    assert DealProfile.model_validate(out.data).pre_dd_material_statuses["financials"] == PreDDMaterialCollectionStatus.COLLECTED
    assert db.flushes == 1
    assert events[0]["event_type"] == "deal.pre_dd_material_status_updated"
    assert events[0]["payload"]["task_key"] == "financials"

    out = asyncio.run(
        update_pre_dd_material_status(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal.id,
            task_key="financials",
            collection_status=PreDDMaterialCollectionStatus.PENDING,
        )
    )

    assert out.data["pre_dd_material_statuses"]["financials"] == "pending"
    assert DealProfile.model_validate(out.data).pre_dd_material_statuses["financials"] == PreDDMaterialCollectionStatus.PENDING
    assert db.flushes == 2
    assert events[1]["event_type"] == "deal.pre_dd_material_status_updated"
    assert events[1]["payload"]["collection_status"] == "pending"


def test_pre_dd_material_status_endpoint_switches_both_directions(monkeypatch):
    deal = _fake_deal(_valid_data())
    db = _FakeDealDb(deal)
    events = []
    user = CurrentUser(user_id=uuid.uuid4(), institution_id=uuid.uuid4())

    async def fake_record_event(*_args, **kwargs):
        events.append(kwargs)

    monkeypatch.setattr("app.services.deals.record_event", fake_record_event)

    collected = asyncio.run(
        deals_api.set_pre_dd_material_status(
            deal_id=deal.id,
            task_key="bp_product",
            body=deals_api.PreDDMaterialStatusBody(
                collection_status=PreDDMaterialCollectionStatus.COLLECTED
            ),
            user=user,
            db=db,
        )
    )
    assert collected["collection_status"] == "collected"
    assert deal.data["pre_dd_material_statuses"]["bp_product"] == "collected"

    pending = asyncio.run(
        deals_api.set_pre_dd_material_status(
            deal_id=deal.id,
            task_key="bp_product",
            body=deals_api.PreDDMaterialStatusBody(
                collection_status=PreDDMaterialCollectionStatus.PENDING
            ),
            user=user,
            db=db,
        )
    )
    assert pending["collection_status"] == "pending"
    assert deal.data["pre_dd_material_statuses"]["bp_product"] == "pending"
    assert db.flushes == 2
    assert [event["payload"]["collection_status"] for event in events] == ["collected", "pending"]


class _FakeMarketSignalDb:
    def __init__(self, deal):
        self.deal = deal
        self.added = []
        self.flushes = 0

    async def scalar(self, _stmt):
        return self.deal

    def add_all(self, objs):
        self.added.extend(objs)

    async def flush(self):
        self.flushes += 1
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()


def test_collect_deal_market_signals_saves_evidence_and_updates_profile(monkeypatch):
    deal = _fake_deal(_valid_data())
    db = _FakeMarketSignalDb(deal)
    events = []

    async def fake_sources(profile, *, deal_id, allow_overseas):
        assert profile.extraction.company_name == "光羽科技"
        assert deal_id == deal.id
        assert allow_overseas is False
        return {
            DealMarketSignalCategory.FINANCE_NEWS: [
                Source(
                    source_type="web_search",
                    title="光羽科技完成新一轮融资",
                    url="https://example.com/news",
                    snippet="公司获得产业资本投资。",
                    published_at="2026-06-20",
                    connector="fake",
                    raw={"deal_id": str(deal.id), "market_signal_category": "finance_news"},
                )
            ],
            DealMarketSignalCategory.BUSINESS_REGISTRY: [
                Source(
                    source_type="company_registry",
                    title="光羽科技工商照面",
                    snippet="成立日期：2025-01-01",
                    published_at="2025-01-01",
                    connector="qcc",
                    raw={"deal_id": str(deal.id), "market_signal_category": "business_registry"},
                )
            ],
            DealMarketSignalCategory.PATENT: [],
            DealMarketSignalCategory.PAPER: [],
            DealMarketSignalCategory.PERSONNEL: [],
        }

    async def fake_record_event(*_args, **kwargs):
        events.append(kwargs)

    monkeypatch.setattr(deal_market_signals, "collect_deal_market_signal_sources", fake_sources)
    monkeypatch.setattr(deal_market_signals, "record_event", fake_record_event)

    result = asyncio.run(
        collect_deal_market_signals(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal.id,
            allow_overseas=False,
        )
    )

    assert result["count"] == 2
    assert len([obj for obj in db.added if isinstance(obj, EvidenceItemRow)]) == 2
    assert deal.data["market_signals"][0]["category"] == "finance_news"
    assert deal.data["market_signals"][0]["evidence_id"]
    assert deal.data["market_signals"][0]["analysis"].count("。") == 4
    assert DealProfile.model_validate(deal.data).market_signals[1].category == DealMarketSignalCategory.BUSINESS_REGISTRY
    assert events[0]["event_type"] == "deal.market_signals_collected"
    assert events[0]["payload"]["by_category"]["finance_news"] == 1


# ---------- 项目材料投影 ----------

def test_deal_material_projection_uses_chunk_meta_and_preview():
    now = dt.datetime(2026, 6, 22, 9, 30, 0)
    evidence_id = uuid.uuid4()
    document = SimpleNamespace(
        id=uuid.uuid4(),
        filename="光羽科技 BP.pdf",
        doc_type="bp",
        parse_status="completed",
        created_at=now,
        updated_at=now,
    )
    chunk = SimpleNamespace(
        content=" 光羽科技是一家 AI 眼镜光学模组方案商。\n\n团队来自头部消费电子公司，已有头部客户订单，去年收入约 1200 万。 ",
        meta={
            "fmt": "pdf",
            "source_type": "bp_upload",
            "unit_count": 12,
            "text_chars": 1280,
            "warnings": ["第 3 页文字较少"],
            "evidence_id": str(evidence_id),
        },
    )

    item = project_deal_material(document, chunk)

    assert item["id"] == str(document.id)
    assert item["evidence_id"] == str(evidence_id)
    assert item["filename"] == "光羽科技 BP.pdf"
    assert item["doc_type"] == "bp"
    assert item["parse_status"] == "completed"
    assert item["source_type"] == "bp_upload"
    assert item["fmt"] == "pdf"
    assert item["unit_count"] == 12
    assert item["text_chars"] == 1280
    assert item["text_preview"].startswith("光羽科技是一家")
    assert item["material_category_suggestion"]["key"] == "bp_product"
    assert item["material_category_suggestion"]["is_background"] is False
    assert {"financials", "customers"} <= set(item["pre_dd_task_keys"])
    assert item["pre_dd_task_hits"][0]["filename"] == "光羽科技 BP.pdf"
    assert item["pre_dd_task_hits"][0]["evidence_id"] == str(evidence_id)
    assert item["warnings"] == ["第 3 页文字较少"]


def test_material_category_suggestion_recommends_background_when_unmatched():
    background = suggest_material_category(
        filename="参访路线.txt",
        text="展台照片、来访路线与接待安排记录。",
    )
    assert background["key"] == "background"
    assert background["title"] == "背景材料"
    assert background["is_background"] is True

    financials = suggest_material_category(
        filename="2025 利润表.xlsx",
        text="本表包含营收、收入、现金流与资产负债表摘要。",
    )
    assert financials["key"] == "financials"
    assert financials["title"] == "财务指标"
    assert financials["confidence"] == "high"
    assert {"利润表", "营收", "收入"} <= set(financials["matched_keywords"])


class _FakeMaterialDB:
    def __init__(self, deal):
        self.deal = deal
        self.added = []
        self.flushes = 0

    async def scalar(self, _stmt):
        return self.deal

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushes += 1
        now = dt.datetime(2026, 6, 22, 11, 0, 0)
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if hasattr(obj, "created_at") and getattr(obj, "created_at", None) is None:
                obj.created_at = now
            if hasattr(obj, "updated_at") and getattr(obj, "updated_at", None) is None:
                obj.updated_at = now


def test_save_deal_material_creates_private_evidence(monkeypatch):
    deal_id = uuid.uuid4()
    db = _FakeMaterialDB(SimpleNamespace(id=deal_id))
    events = []

    async def fake_record_event(*_args, **kwargs):
        events.append(kwargs["payload"])

    monkeypatch.setattr("app.services.deal_materials.record_event", fake_record_event)

    item = asyncio.run(
        save_deal_material(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal_id,
            filename="客户访谈.txt",
            data="客户 A 已完成试用，预计今年收入 1200 万。".encode("utf-8"),
            content_type="text/plain",
        )
    )

    [document] = [obj for obj in db.added if isinstance(obj, Document)]
    [chunk] = [obj for obj in db.added if isinstance(obj, Chunk)]
    [evidence] = [obj for obj in db.added if isinstance(obj, EvidenceItemRow)]
    assert evidence.source_type == "private_material"
    assert evidence.connector == "upload"
    assert evidence.raw["deal_id"] == str(deal_id)
    assert evidence.raw["document_id"] == str(document.id)
    assert evidence.raw["chunk_id"] == str(chunk.id)
    assert chunk.meta["evidence_id"] == str(evidence.id)
    assert item["evidence_id"] == str(evidence.id)
    assert item["material_category_suggestion"]["key"] == "customers"
    assert events[0]["evidence_id"] == str(evidence.id)
    assert events[0]["material_category_suggestion"]["key"] == "customers"


def test_save_deal_material_honors_pre_dd_card_category(monkeypatch):
    deal_id = uuid.uuid4()
    db = _FakeMaterialDB(SimpleNamespace(id=deal_id))

    async def fake_record_event(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.services.deal_materials.record_event", fake_record_event)

    item = asyncio.run(
        save_deal_material(
            db,
            institution_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            deal_id=deal_id,
            filename="补充说明.txt",
            data="这是一份由用户主动上传并指定归档位置的材料。".encode("utf-8"),
            content_type="text/plain",
            pre_dd_task_key="financials",
        )
    )

    [chunk] = [obj for obj in db.added if isinstance(obj, Chunk)]
    assert chunk.meta["assigned_pre_dd_task_key"] == "financials"
    assert item["pre_dd_task_keys"][0] == "financials"
    assert item["pre_dd_task_hits"][0]["keyword"] == "用户指定"
    assert item["material_category_suggestion"]["key"] == "financials"
    assert item["material_category_suggestion"]["confidence"] == "high"


def test_material_search_records_rank_and_snippet_matches():
    now = dt.datetime(2026, 6, 22, 10, 0, 0)
    evidence_id = uuid.uuid4()
    document_a = SimpleNamespace(
        id=uuid.uuid4(),
        filename="客户访谈纪要.txt",
        doc_type="meeting_note",
        updated_at=now,
    )
    chunk_a = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_a.id,
        content="客户 A 已完成试用，预计今年收入 1200 万，后续订单仍需核实。",
        meta={"evidence_id": str(evidence_id)},
    )
    document_b = SimpleNamespace(
        id=uuid.uuid4(),
        filename="团队介绍.txt",
        doc_type="bp",
        updated_at=now,
    )
    chunk_b = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_b.id,
        content="创始团队来自头部消费电子公司。",
    )

    results = search_material_records(
        [(document_a, chunk_a), (document_b, chunk_b)],
        query="客户 收入",
        limit=5,
    )

    assert len(results) == 1
    assert results[0]["filename"] == "客户访谈纪要.txt"
    assert results[0]["evidence_id"] == str(evidence_id)
    assert results[0]["matched_terms"] == ["客户", "收入"]
    assert "收入 1200 万" in results[0]["snippet"]


def test_material_search_records_empty_query_returns_empty():
    assert search_material_records([], query="   ") == []


# ---------- Pre-DD 工作台只读视图 ----------

def test_pre_dd_material_hits_classify_uploaded_text_to_task_keys():
    evidence_id = uuid.uuid4()
    hits = infer_material_task_hits(
        document_id=str(uuid.uuid4()),
        filename="Founder Call 纪要.txt",
        text="公司本轮融资 3000 万，已有头部客户订单，去年收入约 1200 万，竞争对手包括 A 与 B。",
        doc_type="bp",
        evidence_id=str(evidence_id),
    )

    keys = {hit["task_key"] for hit in hits}
    assert {"financing", "customers", "financials", "competitors"} <= keys
    assert all(hit["snippet"] for hit in hits)
    assert all(hit["evidence_id"] == str(evidence_id) for hit in hits)


def test_pre_dd_workspace_uses_uploaded_material_hits_as_partial_coverage():
    profile = DealProfile.model_validate(_valid_data())
    document_id = uuid.uuid4()
    evidence_id = uuid.uuid4()
    material_hits = [
        {
            "document_id": str(document_id),
            "evidence_id": str(evidence_id),
            "filename": "Founder Call 纪要.txt",
            "task_key": "financials",
            "keyword": "收入",
            "snippet": "去年收入约 1200 万，毛利率待核实。",
        }
    ]

    view = build_pre_dd_workspace(profile, material_hits=material_hits)
    financials = next(item for item in view["items"] if item["key"] == "financials")

    assert financials["status"] == "partial"
    assert financials["collection_status"] == "pending"
    assert financials["materials"] == material_hits
    assert financials["collected_materials"][0]["kind"] == "机构材料"
    assert financials["collected_materials"][0]["evidence_id"] == str(evidence_id)
    assert any("收入" in suggestion or "继续补充" in suggestion for suggestion in financials["suggestions"])
    assert view["completion"]["partial"] >= 1
    assert view["completion"]["collected"] == 0
    assert view["completion"]["pending"] == 14


def test_pre_dd_workspace_builds_material_tree_from_profile():
    profile = DealProfile.model_validate(
        _valid_data(
            extraction={
                "company_name": "光羽科技",
                "one_line_intro": "AI 眼镜光学模组方案商",
                "product": "光学模组",
                "founders": ["张三"],
                "customers": ["头部消费电子客户"],
                "funding_stage": "Pre-A",
                "funding_amount": "3000 万元",
            },
            analysis={
                "portrait": "AI 眼镜光学模组方案商",
                "overall_fit": 89,
                "initial_risks": [{"text": "客户集中度待验证", "evidence_ids": [], "inferred": True}],
                "info_gaps": ["估值与股权结构仍需补充"],
                "open_questions": ["核心客户收入占比是多少？"],
                "next_steps": [{"text": "安排 Founder Call", "evidence_ids": [], "inferred": True}],
            },
        )
    )

    view = build_pre_dd_workspace(profile)
    assert view["completion"]["total"] == 14
    assert view["completion"]["score"] > 0
    bp = next(item for item in view["items"] if item["key"] == "bp_product")
    assert bp["status"] == "complete"
    assert bp["collection_status"] == "pending"
    assert "最新版 BP" in bp["intro"]
    assert bp["suggestions"] == ["材料收集完成"]
    assert any("产品方案" in item for item in bp["provided"])
    assert any(item["kind"] == "系统捕获" for item in bp["collected_materials"])
    equity = next(item for item in view["items"] if item["key"] == "equity")
    assert equity["status"] in {"partial", "public_data_possible"}
    assert equity["collection_status"] == "pending"
    assert equity["suggestions"]
    assert view["priority_questions"] == ["核心客户收入占比是多少？"]
    assert view["risk_queue"] == ["客户集中度待验证"]


def test_pre_dd_workspace_manual_collection_status_overrides_group_only():
    profile = DealProfile.model_validate(
        _valid_data(pre_dd_material_statuses={"equity": "collected", "bp_product": "pending"})
    )
    view = build_pre_dd_workspace(profile)
    equity = next(item for item in view["items"] if item["key"] == "equity")
    bp = next(item for item in view["items"] if item["key"] == "bp_product")

    assert equity["collection_status"] == "collected"
    assert equity["status"] == "public_data_possible"
    assert bp["collection_status"] == "pending"
    assert view["completion"]["collected"] + view["completion"]["pending"] == 14


def test_pre_dd_workspace_empty_profile_has_no_fake_questions_or_risks():
    profile = DealProfile.model_validate(_valid_data())
    view = build_pre_dd_workspace(profile)
    assert view["completion"]["total"] == 14
    assert view["priority_questions"] == []
    assert view["risk_queue"] == []
    assert all(item["collection_status"] == "pending" for item in view["items"])
    assert all(item["status"] in {"missing", "partial", "public_data_possible", "complete"} for item in view["items"])


def test_pre_dd_brief_builds_valid_dd_report_from_workspace():
    deal_id = uuid.uuid4()
    profile = DealProfile.model_validate(
        _valid_data(
            extraction={
                "company_name": "光羽科技",
                "one_line_intro": "AI 眼镜光学模组方案商",
                "track": "AI 硬件",
                "sub_direction": "光学模组",
                "product": "轻量化光学模组",
                "funding_stage": "Pre-A",
                "funding_amount": "3000 万元",
                "founders": ["张三"],
                "customers": ["头部消费电子客户"],
            },
            analysis={
                "portrait": "AI 眼镜光学模组方案商",
                "overall_fit": 88,
                "highlights": [{"text": "切入 AI 眼镜上游核心部件", "evidence_ids": [], "inferred": True}],
                "initial_risks": [{"text": "客户集中度待验证", "evidence_ids": [], "inferred": True}],
                "info_gaps": ["估值与股权结构仍需补充"],
                "open_questions": ["核心客户收入占比是多少？"],
                "next_steps": [{"text": "安排 Founder Call", "evidence_ids": [], "inferred": True}],
            },
        )
    )
    workspace = build_pre_dd_workspace(profile)

    report = build_pre_dd_brief_report(
        deal_id=deal_id,
        company_name="深圳光羽智能科技有限公司",
        profile=profile,
        pre_dd=workspace,
    )
    payload = report.model_dump(mode="json")
    validated = DDReport.model_validate(payload)

    assert validated.deal_id == deal_id
    assert validated.company_name == "深圳光羽智能科技有限公司"
    assert validated.brief is not None
    assert validated.brief.completion_score == workspace["completion"]["score"]
    assert "资料完整度" in validated.brief.completion_summary
    assert validated.brief.key_highlights[0].text == "切入 AI 眼镜上游核心部件"
    assert validated.brief.top_risks[0].text == "客户集中度待验证"
    assert validated.brief.priority_questions == ["核心客户收入占比是多少？"]
    assert validated.brief.recommended_next_steps[0].text == "安排 Founder Call"
    assert len(validated.checklist) == workspace["completion"]["total"]

    material_evidence_id = uuid.uuid4()
    material_workspace = build_pre_dd_workspace(
        DealProfile.model_validate(_valid_data()),
        material_hits=[
            {
                "document_id": str(uuid.uuid4()),
                "evidence_id": str(material_evidence_id),
                "filename": "BP.pdf",
                "task_key": "financials",
                "keyword": "收入",
                "snippet": "收入约 1200 万",
            }
        ],
    )
    material_report = build_pre_dd_brief_report(
        deal_id=uuid.uuid4(),
        company_name="光羽科技",
        profile=DealProfile.model_validate(_valid_data()),
        pre_dd=material_workspace,
    )
    financial_check = next(item for item in material_report.checklist if item.question == "财务指标")
    assert financial_check.answer is not None
    assert "相关材料" in financial_check.answer.text
    assert financial_check.answer.evidence_ids == [material_evidence_id]
    assert financial_check.answer.inferred is False


def test_pre_dd_brief_projection_filters_by_deal_and_requires_brief():
    deal_id = uuid.uuid4()
    other_id = uuid.uuid4()
    now = dt.datetime(2026, 6, 21, 12, 0, 0)
    report = build_pre_dd_brief_report(
        deal_id=deal_id,
        company_name="光羽科技",
        profile=DealProfile.model_validate(_valid_data()),
        pre_dd=build_pre_dd_workspace(DealProfile.model_validate(_valid_data())),
    )
    row = SimpleNamespace(
        id=uuid.uuid4(),
        payload=report.model_dump(mode="json"),
        created_at=now,
        updated_at=now,
    )

    item = project_pre_dd_brief(row, deal_id=deal_id)
    assert item is not None
    assert item["deliverable_id"] == str(row.id)
    assert item["payload"]["deal_id"] == str(deal_id)
    assert item["payload"]["brief"]["completion_score"] >= 0

    assert project_pre_dd_brief(row, deal_id=other_id) is None

    legacy = SimpleNamespace(
        id=uuid.uuid4(),
        payload={
            "deal_id": str(deal_id),
            "company_name": "光羽科技",
            "checklist": [],
            "sections": [],
            "open_questions": [],
        },
        created_at=now,
        updated_at=now,
    )
    assert project_pre_dd_brief(legacy, deal_id=deal_id) is None


def test_generate_pre_dd_brief_reads_current_uploaded_materials(monkeypatch):
    deal_id = uuid.uuid4()
    company_id = uuid.uuid4()
    evidence_id = uuid.uuid4()
    deal = SimpleNamespace(
        id=deal_id,
        company_id=company_id,
        data=_valid_data(),
    )
    company = SimpleNamespace(id=company_id, name="光羽科技")

    class FakeDb:
        def __init__(self):
            self.scalar_calls = 0

        async def scalar(self, _stmt):
            self.scalar_calls += 1
            return deal if self.scalar_calls == 1 else company

    async def fake_list_materials(*_args, **_kwargs):
        return [
            {
                "pre_dd_task_hits": [
                    {
                        "document_id": str(uuid.uuid4()),
                        "evidence_id": str(evidence_id),
                        "filename": "财务报表.xlsx",
                        "task_key": "financials",
                        "keyword": "用户指定",
                        "snippet": "2025 年收入与现金流数据",
                    }
                ]
            }
        ]

    async def fake_save_deliverable(*_args, payload, **_kwargs):
        return SimpleNamespace(id=uuid.uuid4(), payload=payload)

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(deals_api, "list_deal_materials", fake_list_materials)
    monkeypatch.setattr(deals_api, "save_deliverable", fake_save_deliverable)
    monkeypatch.setattr(deals_api, "record_event", noop)
    monkeypatch.setattr(deals_api, "record_user_action", noop)

    result = asyncio.run(
        deals_api.generate_pre_dd_brief(
            deal_id,
            user=CurrentUser(user_id=uuid.uuid4(), institution_id=uuid.uuid4()),
            db=FakeDb(),
        )
    )

    financials = next(
        item for item in result["payload"]["checklist"] if item["question"] == "财务指标"
    )
    assert financials["answer"]["evidence_ids"] == [str(evidence_id)]
    assert "财务报表.xlsx" in financials["answer"]["text"]
