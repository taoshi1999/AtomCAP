"""博查 Bocha Web Search —— 国内合规网页/新闻搜索（MVP 首选源之一）。

POST /v1/web-search（Bearer BOCHA_API_KEY），响应对齐 Bing 风格：
data.webPages.value[].{name,url,snippet,summary,datePublished,...}。
解析全程防御式取值——商业 API 字段时有增减，缺字段降级而不报错；
真实 key 冒烟测试待接入（离线用 httpx.MockTransport 验证请求与解析契约）。
"""

from __future__ import annotations

import httpx

from app.config import settings
from app.connectors.base import Source

API_URL = "https://api.bochaai.com/v1/web-search"
PAGE_SIZE = 10


def _freshness(days: int) -> str:
    if days <= 7:
        return "oneWeek"
    if days <= 30:
        return "oneMonth"
    if days <= 365:
        return "oneYear"
    return "noLimit"


class BochaConnector:
    name = "bocha"
    region = "cn"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        # transport 注入口：测试时传 httpx.MockTransport 离线验证
        self._transport = transport

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        async with httpx.AsyncClient(transport=self._transport, timeout=15) as client:
            resp = await client.post(
                API_URL,
                headers={"Authorization": f"Bearer {settings.bocha_api_key}"},
                json={
                    "query": query,
                    "freshness": _freshness(days),
                    "summary": True,
                    "count": PAGE_SIZE,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        pages = (((data.get("data") or {}).get("webPages") or {}).get("value")) or []
        return [
            Source(
                source_type="web_search",
                title=str(p.get("name") or "(无标题)"),
                url=p.get("url"),
                snippet=str(p.get("summary") or p.get("snippet") or ""),
                published_at=str(p.get("datePublished") or "")[:10] or None,
                connector=self.name,
                raw=p,
            )
            for p in pages
            if isinstance(p, dict)
        ]

    async def company_lookup(self, name: str) -> list[Source]:
        raise NotImplementedError  # 工商数据走企查查，博查不提供

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        # 博查无独立融资事件接口，用组合检索词覆盖（后续可换专业融资数据源）
        return await self.search_news(f"{track} 融资", days=days)
