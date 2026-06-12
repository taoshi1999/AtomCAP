"""企查查开放平台 —— 工商信息（MVP 首选源之一）。按量计费，先小额度验证。"""

from __future__ import annotations

from app.connectors.base import Source


class QccConnector:
    name = "qcc"
    region = "cn"

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        return []

    async def company_lookup(self, name: str) -> list[Source]:
        # TODO: 企业工商照面 / 股东 / 对外投资接口（QCC_APP_KEY / QCC_SECRET_KEY）
        raise NotImplementedError

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        return []
