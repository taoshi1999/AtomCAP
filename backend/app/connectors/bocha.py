"""博查 Bocha Web Search —— 国内合规网页/新闻搜索（MVP 首选源之一）。"""

from __future__ import annotations

from app.connectors.base import Source


class BochaConnector:
    name = "bocha"
    region = "cn"

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        # TODO: POST https://api.bochaai.com/v1/web-search  (BOCHA_API_KEY)
        raise NotImplementedError

    async def company_lookup(self, name: str) -> list[Source]:
        raise NotImplementedError

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        raise NotImplementedError
