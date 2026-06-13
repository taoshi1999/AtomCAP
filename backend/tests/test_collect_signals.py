"""collect_signals 证据链单元测试 —— 不连库、不连真实数据源。"""

from __future__ import annotations

import asyncio
import json
import uuid

import httpx

import app.agents.thesis_scout.nodes as nodes
from app.config import settings
from app.connectors.base import Source
from app.connectors.bocha import BochaConnector
from app.connectors.registry import MAX_SIGNALS, active_connectors, gather_signals
from app.evidence.service import (
    referenced_evidence_ids,
    sanitize_evidence_ids,
    save_collected,
)
from app.models.models import EvidenceItemRow
from app.objects.base import Claim


def _src(title, url=None, date=None):
    return Source(source_type="web_search", title=title, url=url,
                  snippet=f"{title} 摘要", published_at=date, connector="fake", raw={"title": title})


class FakeConnector:
    region = "cn"

    def __init__(self, name="fake", news=None, funding=None, fail=False):
        self.name = name
        self._news = news or []
        self._funding = funding if funding is not None else NotImplementedError
        self._fail = fail
        self.calls = []

    async def search_news(self, query, *, days=90):
        self.calls.append(f"news:{query}")
        if self._fail:
            raise RuntimeError("配额耗尽")
        return self._news

    async def company_lookup(self, name):
        raise NotImplementedError

    async def funding_events(self, track, *, days=180):
        self.calls.append(f"funding:{track}")
        if isinstance(self._funding, type) and issubclass(self._funding, Exception):
            raise self._funding
        return self._funding


def test_active_connectors_gated_by_keys_and_compliance(monkeypatch):
    monkeypatch.setattr(settings, "bocha_api_key", "k1")
    monkeypatch.setattr(settings, "qcc_app_key", "")
    monkeypatch.setattr(settings, "qcc_secret_key", "")
    monkeypatch.setattr(settings, "tavily_api_key", "k2")
    assert [c.name for c in active_connectors(allow_overseas=False)] == ["bocha"]
    assert [c.name for c in active_connectors(allow_overseas=True)] == ["bocha", "tavily"]


def test_active_connectors_empty_without_keys(monkeypatch):
    for f in ("bocha_api_key", "qcc_app_key", "qcc_secret_key", "tavily_api_key"):
        monkeypatch.setattr(settings, f, "")
    assert active_connectors(allow_overseas=True) == []


def test_gather_merges_dedupes_sorts_and_survives_failures():
    good = FakeConnector(name="good", news=[
        _src("旧闻", "https://e.com/old", "2026-01-01"),
        _src("新闻", "https://e.com/new", "2026-06-01"),
        _src("无时间", "https://e.com/undated"),
    ], funding=[_src("新闻重复", "https://e.com/new", "2026-06-01")])
    bad = FakeConnector(name="bad", fail=True)
    out = asyncio.run(gather_signals([good, bad], keywords=["AI 硬件", "edge AI"], track="AI 硬件"))
    assert [s.url for s in out] == ["https://e.com/new", "https://e.com/old", "https://e.com/undated"]
    assert good.calls == ["news:AI 硬件", "news:edge AI", "funding:AI 硬件"]


def test_gather_caps_total_signals():
    many = [_src(f"信号{i}", f"https://e.com/{i}", "2026-05-01") for i in range(MAX_SIGNALS + 20)]
    out = asyncio.run(gather_signals([FakeConnector(news=many)], keywords=["k"]))
    assert len(out) == MAX_SIGNALS


def test_gather_empty_inputs():
    assert asyncio.run(gather_signals([], keywords=["k"], track="t")) == []
    assert asyncio.run(gather_signals([FakeConnector()], keywords=[], track="")) == []


def test_collect_signals_assigns_aligned_evidence_ids(monkeypatch):
    sources = [_src("信号A", "https://e.com/a", "2026-06-01")]
    captured = {}

    async def fake_gather(connectors, *, keywords, track, days=90, allow_overseas=False, cache=None):
        captured.update(keywords=keywords, track=track, connectors=connectors)
        return sources

    monkeypatch.setattr(nodes, "active_connectors", lambda *, allow_overseas: ["stub"])
    monkeypatch.setattr(nodes, "cached_gather_signals", fake_gather)
    out = asyncio.run(nodes.collect_signals({
        "query": "AI硬件还有什么机会", "allow_overseas": False,
        "track_definition": {"name": "AI 硬件", "search_keywords": ["AI 硬件", "edge AI chip"]},
    }))
    assert captured["keywords"] == ["AI 硬件", "edge AI chip"]
    assert captured["track"] == "AI 硬件"
    [raw] = out["raw_signals"]
    [es] = out["evidence_sources"]
    assert raw["evidence_id"] == es["evidence_id"]
    uuid.UUID(raw["evidence_id"])
    assert "raw" not in raw and es["raw"] == {"title": "信号A"}
    assert raw["title"] == "信号A" and es["connector"] == "fake"
    assert out["progress"]


def test_collect_signals_falls_back_to_query_keyword(monkeypatch):
    captured = {}

    async def fake_gather(connectors, *, keywords, track, days=90, allow_overseas=False, cache=None):
        captured["keywords"] = keywords
        return []

    monkeypatch.setattr(nodes, "active_connectors", lambda *, allow_overseas: ["stub"])
    monkeypatch.setattr(nodes, "cached_gather_signals", fake_gather)
    out = asyncio.run(nodes.collect_signals({"query": "具身智能值得投吗"}))
    assert captured["keywords"] == ["具身智能值得投吗"]
    assert out["raw_signals"] == [] and out["evidence_sources"] == []


def test_collect_signals_no_connectors_is_empty_path(monkeypatch):
    monkeypatch.setattr(nodes, "active_connectors", lambda *, allow_overseas: [])
    out = asyncio.run(nodes.collect_signals({"query": "AI硬件", "track_definition": {}}))
    assert out["raw_signals"] == [] and out["evidence_sources"] == []


def test_bocha_request_and_defensive_parsing(monkeypatch):
    monkeypatch.setattr(settings, "bocha_api_key", "test-key")
    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"code": 200, "data": {"webPages": {"value": [
            {"name": "AI 芯片融资新闻", "url": "https://news.example.com/1", "snippet": "短摘要",
             "summary": "长摘要优先", "datePublished": "2026-06-01T08:00:00+08:00"},
            {"url": "https://news.example.com/2"},
        ]}}})

    c = BochaConnector(transport=httpx.MockTransport(handler))
    out = asyncio.run(c.search_news("AI 芯片", days=30))
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["query"] == "AI 芯片" and seen["body"]["freshness"] == "oneMonth"
    [full, bare] = out
    assert full.title == "AI 芯片融资新闻"
    assert full.snippet == "长摘要优先"
    assert full.published_at == "2026-06-01"
    assert full.connector == "bocha" and full.source_type == "web_search"
    assert bare.title == "(无标题)" and bare.published_at is None


def test_bocha_empty_payload(monkeypatch):
    monkeypatch.setattr(settings, "bocha_api_key", "test-key")
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"code": 200}))
    assert asyncio.run(BochaConnector(transport=transport).search_news("任意")) == []


class _FakeDB:
    def __init__(self):
        self.rows = []

    def add_all(self, objs):
        self.rows.extend(objs)

    async def flush(self):
        pass


def test_save_collected_preserves_preassigned_ids():
    eid = uuid.uuid4()
    db = _FakeDB()
    ids = asyncio.run(save_collected(db, institution_id=uuid.uuid4(), evidence_sources=[
        {"evidence_id": str(eid), "source_type": "web_search", "title": "信号A",
         "url": "https://e.com/a", "snippet": "摘要", "published_at": "2026-06-01",
         "connector": "bocha", "raw": {"k": "v"}}]))
    assert ids == [eid]
    [row] = db.rows
    assert isinstance(row, EvidenceItemRow) and row.id == eid and row.title == "信号A"


def test_sanitize_strips_unknown_ids_then_schema_auto_infers():
    real, fake = str(uuid.uuid4()), str(uuid.uuid4())
    payload = {"claims": [
        {"text": "有据", "evidence_ids": [real, fake], "inferred": False},
        {"text": "纯幻觉", "evidence_ids": [fake], "inferred": False}],
        "nested": [{"deep": {"evidence_ids": [fake]}}]}
    clean = sanitize_evidence_ids(payload, {real})
    assert clean["claims"][0]["evidence_ids"] == [real]
    assert clean["claims"][1]["evidence_ids"] == []
    assert clean["nested"][0]["deep"]["evidence_ids"] == []
    assert Claim(**clean["claims"][1]).inferred is True
    assert Claim(**clean["claims"][0]).inferred is False


def test_referenced_evidence_ids_walks_nested_payload():
    a, b = uuid.uuid4(), uuid.uuid4()
    payload = {"key_risks": [{"evidence_ids": [str(a)]}],
               "sub": [{"reasons": [{"evidence_ids": [str(b), "not-a-uuid"]}]}],
               "evidence_ids": "不是列表，应忽略"}
    assert referenced_evidence_ids(payload) == {a, b}
