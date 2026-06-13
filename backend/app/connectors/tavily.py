"""Tavily —— 海外市场搜索源（海外区部署时启用，region=global 受 allow_overseas 闸控）。"""

from __future__ import annotations

import httpx

from app.config import settings
from app.connectors.base import Source

API_URL = "https://api.tavily.com/search"
MAX_RESULTS = 10


def _time_range(days: int) -> str:
    if days <= 1:
        return "day"
    if days <= 7:
        return "week"
    if days <= 31:
        return "month"
    return "year"


class TavilyConnector:
    name = "tavily"
    region = "global"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self._transport = transport

    async def _search(self, query: str, *, days: int, topic: str) -> list[Source]:
        async with httpx.AsyncClient(transport=self._transport, timeout=15) as client:
            resp = await client.post(
                API_URL,
                headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
                json={
                    "query": query,
                    "topic": topic,
                    "time_range": _time_range(days),
                    "search_depth": "basic",
                    "max_results": MAX_RESULTS,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        results = data.get("results") or []
        return [
            Source(
                source_type="web_search",
                title=str(r.get("title") or "(无标题)"),
                url=r.get("url"),
                snippet=str(r.get("content") or ""),
                published_at=str(r.get("published_date") or "")[:10] or None,
                connector=self.name,
                raw=r,
            )
            for r in results
            if isinstance(r, dict)
        ]

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        return await self._search(query, days=days, topic="news")

    async def company_lookup(self, name: str) -> list[Source]:
        return await self._search(name, days=3650, topic="general")

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        return await self._search(f"{track} funding round investment", days=days, topic="news")
