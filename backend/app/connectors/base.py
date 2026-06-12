"""数据源 Connector 抽象。

所有数据源实现统一接口，返回统一的 Source 结构（直接落 evidence_items），
可插拔、可按区域路由（国内/海外）。商业 API 按量计费，注意配额与缓存。
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field


class Source(BaseModel):
    """Connector 返回的统一结构，与 EvidenceItem 字段对齐。"""

    source_type: str
    title: str
    url: str | None = None
    snippet: str = ""
    published_at: str | None = None
    connector: str = ""
    raw: dict | None = Field(default=None)


class Connector(Protocol):
    name: str
    region: str  # cn / global

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]: ...
    async def company_lookup(self, name: str) -> list[Source]: ...
    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]: ...
