"""Tavily —— 海外市场搜索源（海外区部署时启用）。"""

from __future__ import annotations

from app.connectors.base import Source


class TavilyConnector:
    name = "tavily"
    region = "global"

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        raise NotImplementedError

    async def company_lookup(self, name: str) -> list[Source]:
        raise NotImplementedError

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        raise NotImplementedError
