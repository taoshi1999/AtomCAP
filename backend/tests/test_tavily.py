"""Tavily Connector 离线契约测试 —— 不连真实数据源，httpx.MockTransport 验证请求与解析。"""

from __future__ import annotations

import asyncio
import json

import httpx

from app.config import settings
from app.connectors.tavily import TavilyConnector, _time_range


def test_time_range_maps_days_to_buckets():
    assert _time_range(1) == "day"
    assert _time_range(7) == "week"
    assert _time_range(30) == "month"
    assert _time_range(90) == "year"
    assert _time_range(3650) == "year"


def test_search_news_request_and_defensive_parsing(monkeypatch):
    monkeypatch.setattr(settings, "tavily_api_key", "tvly-test-key")
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"query": "AI chips", "results": [
            {"title": "AI chip startup raises $100M", "url": "https://news.example.com/1",
             "content": "正文摘要", "score": 0.91, "published_date": "2026-06-01T08:00:00Z"},
            {"url": "https://news.example.com/2"},  # 缺标题/正文/日期，降级不报错
            "garbage",  # 非 dict 元素被过滤
        ]})

    c = TavilyConnector(transport=httpx.MockTransport(handler))
    out = asyncio.run(c.search_news("AI chips", days=30))

    assert seen["url"] == "https://api.tavily.com/search"
    assert seen["auth"] == "Bearer tvly-test-key"
    assert seen["body"]["query"] == "AI chips"
    assert seen["body"]["topic"] == "news"
    assert seen["body"]["time_range"] == "month"
    assert seen["body"]["max_results"] == 10

    [full, bare] = out
    assert full.title == "AI chip startup raises $100M"
    assert full.snippet == "正文摘要"
    assert full.published_at == "2026-06-01"
    assert full.connector == "tavily" and full.source_type == "web_search"
    assert full.raw["score"] == 0.91
    assert bare.title == "(无标题)" and bare.snippet == "" and bare.published_at is None


def test_company_lookup_uses_general_topic(monkeypatch):
    monkeypatch.setattr(settings, "tavily_api_key", "k")
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"results": []})

    c = TavilyConnector(transport=httpx.MockTransport(handler))
    asyncio.run(c.company_lookup("OpenAI"))
    assert seen["body"]["topic"] == "general"
    assert seen["body"]["query"] == "OpenAI"
    assert seen["body"]["time_range"] == "year"  # days=3650 → year


def test_funding_events_combines_keywords(monkeypatch):
    monkeypatch.setattr(settings, "tavily_api_key", "k")
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"results": []})

    c = TavilyConnector(transport=httpx.MockTransport(handler))
    asyncio.run(c.funding_events("humanoid robotics", days=180))
    assert "humanoid robotics" in seen["body"]["query"]
    assert "funding" in seen["body"]["query"]
    assert seen["body"]["topic"] == "news"


def test_empty_payload_degrades_gracefully(monkeypatch):
    monkeypatch.setattr(settings, "tavily_api_key", "k")
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"query": "x"}))
    assert asyncio.run(TavilyConnector(transport=transport).search_news("任意")) == []
