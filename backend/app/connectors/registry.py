"""Connector 注册与聚合检索。"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine

from app.config import settings
from app.connectors.base import Connector, Source
from app.connectors.bocha import BochaConnector
from app.connectors.cache import SignalCache, build_cache_key, get_signal_cache
from app.connectors.qcc import QccConnector
from app.connectors.tavily import TavilyConnector

logger = logging.getLogger(__name__)

MAX_SIGNALS = 40
MAX_KEYWORDS = 6


def active_connectors(*, allow_overseas: bool) -> list[Connector]:
    candidates: list[Connector] = []
    if settings.bocha_api_key:
        candidates.append(BochaConnector())
    if settings.qcc_app_key and settings.qcc_secret_key:
        candidates.append(QccConnector())
    if settings.tavily_api_key:
        candidates.append(TavilyConnector())
    return [c for c in candidates if c.region == "cn" or allow_overseas]


async def _safe(coro, *, connector, what):
    try:
        return await coro
    except NotImplementedError:
        return []
    except Exception as e:  # noqa: BLE001
        logger.warning("connector %s %s 检索失败：%s", connector, what, e)
        return []


async def gather_signals(connectors, *, keywords, track="", days=90):
    keywords = [k for k in keywords if k][:MAX_KEYWORDS]
    if not connectors or not (keywords or track):
        return []
    tasks = []
    for c in connectors:
        for kw in keywords:
            tasks.append(_safe(c.search_news(kw, days=days), connector=c.name, what=f"news:{kw}"))
        if track:
            tasks.append(_safe(c.funding_events(track, days=days * 2), connector=c.name, what="funding"))
    batches = await asyncio.gather(*tasks)
    seen = set()
    merged = []
    for batch in batches:
        for s in batch:
            key = (s.url or s.title).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(s)
    merged.sort(key=lambda s: s.published_at or "", reverse=True)
    return merged[:MAX_SIGNALS]


async def lookup_company(connectors, name: str) -> list[Source]:
    """企业实体补全：对支持 company_lookup 的源（企查查工商/股东/对外投资）并发查询。

    供 Deal Intake 分析流外部信息补全用（设计文档流程二 Step 4）。
    单源失败降级、按 (url|title) 去重；不实现 company_lookup 的源由 _safe 吞掉 NotImplementedError。
    company_lookup 走工商源（region=cn），连接器集合本身已按 allow_overseas 过滤。
    """
    if not connectors or not name:
        return []
    batches = await asyncio.gather(
        *(_safe(c.company_lookup(name), connector=c.name, what="company") for c in connectors)
    )
    seen: set[str] = set()
    merged: list[Source] = []
    for batch in batches:
        for s in batch:
            key = (s.url or s.title).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(s)
    return merged


async def cached_gather_signals(connectors, *, keywords, track="", days=90,
                                allow_overseas=False, cache=None):
    keywords = [k for k in keywords if k][:MAX_KEYWORDS]
    if not connectors or not (keywords or track):
        return []
    if cache is None:
        cache = get_signal_cache()
    key = ""
    if cache is not None:
        key = build_cache_key(connectors=[c.name for c in connectors], keywords=keywords,
                              track=track, days=days, allow_overseas=allow_overseas)
        hit = await cache.get(key)
        if hit is not None:
            logger.info("signal cache 命中（%d 条）：%s", len(hit), key)
            return hit
    sources = await gather_signals(connectors, keywords=keywords, track=track, days=days)
    if cache is not None and sources:
        await cache.set(key, sources)
    return sources
