"""信号检索缓存（技术规划 Step 3：控按量计费成本）。"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Protocol, runtime_checkable

from app.config import settings
from app.connectors.base import Source

logger = logging.getLogger(__name__)

CACHE_VERSION = "v1"
_KEY_PREFIX = "atomcap:signals"


def build_cache_key(*, connectors, keywords, track, days, allow_overseas):
    conn = ",".join(sorted(c.strip().lower() for c in connectors if c.strip()))
    kws = "|".join(sorted(k.strip().lower() for k in keywords if k.strip()))
    raw = f"{CACHE_VERSION}|{int(allow_overseas)}|{conn}|{track.strip().lower()}|{kws}|{days}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"{_KEY_PREFIX}:{digest}"


def _dump(sources):
    return json.dumps([s.model_dump(mode="json") for s in sources], ensure_ascii=False)


def _load(text):
    return [Source.model_validate(d) for d in json.loads(text)]


@runtime_checkable
class SignalCache(Protocol):
    async def get(self, key): ...
    async def set(self, key, sources): ...


class RedisSignalCache:
    def __init__(self, client, *, ttl_seconds):
        self._client = client
        self._ttl = ttl_seconds

    async def get(self, key):
        try:
            raw = await self._client.get(key)
        except Exception as e:  # noqa: BLE001
            logger.warning("signal cache get 失败，降级为不缓存：%s", e)
            return None
        if raw is None:
            return None
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            return _load(raw)
        except Exception as e:  # noqa: BLE001
            logger.warning("signal cache 反序列化失败，当未命中：%s", e)
            return None

    async def set(self, key, sources):
        try:
            await self._client.set(key, _dump(sources), ex=self._ttl)
        except Exception as e:  # noqa: BLE001
            logger.warning("signal cache set 失败：%s", e)


_cache_singleton = None
_cache_resolved = False


def get_signal_cache():
    global _cache_singleton, _cache_resolved
    if _cache_resolved:
        return _cache_singleton
    _cache_resolved = True
    if not settings.redis_url:
        _cache_singleton = None
        return None
    try:
        import redis.asyncio as aioredis
    except Exception as e:  # noqa: BLE001
        logger.warning("redis 不可用，信号缓存关闭：%s", e)
        _cache_singleton = None
        return None
    client = aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    _cache_singleton = RedisSignalCache(client, ttl_seconds=settings.signal_cache_ttl_seconds)
    return _cache_singleton
