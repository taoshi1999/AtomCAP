"""信号检索缓存单元测试 —— 不连 redis、不连真实数据源。

覆盖：
- build_cache_key：关键词大小写/顺序无关；合规开关、启用源集合、赛道、时间窗任一变化即换键
- RedisSignalCache：序列化往返、未命中、脏缓存当未命中、redis 异常优雅降级
- cached_gather_signals：未命中检索后回填、命中复用（不再打数据源）、
  空结果不回填、合规开关不同不跨闸门复用
"""

from __future__ import annotations

import asyncio

import app.connectors.registry as registry
from app.connectors.base import Source
from app.connectors.cache import (
    RedisSignalCache,
    build_cache_key,
    get_signal_cache,
)


def _src(title: str, url: str | None = None, date: str | None = None) -> Source:
    return Source(
        source_type="web_search",
        title=title,
        url=url,
        snippet=f"{title} 摘要",
        published_at=date,
        connector="fake",
        raw={"title": title},
    )


class FakeRedis:
    """最小内存 redis 替身，支持 get/set(ex=...)。"""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.last_ex: int | None = None

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        self.last_ex = ex


class BrokenRedis:
    async def get(self, key):
        raise ConnectionError("redis down")

    async def set(self, key, value, ex=None):
        raise ConnectionError("redis down")


class FakeConnector:
    region = "cn"

    def __init__(self, name="fake", news=None):
        self.name = name
        self._news = news or []
        self.calls: list[str] = []

    async def search_news(self, query, *, days=90):
        self.calls.append(f"news:{query}")
        return self._news

    async def company_lookup(self, name):
        raise NotImplementedError

    async def funding_events(self, track, *, days=180):
        self.calls.append(f"funding:{track}")
        raise NotImplementedError


# ---------- build_cache_key ----------

def test_key_is_order_and_case_insensitive():
    base = dict(connectors=["bocha", "tavily"], track="AI 硬件", days=90, allow_overseas=True)
    k1 = build_cache_key(keywords=["AI 硬件", "edge AI"], **base)
    k2 = build_cache_key(keywords=["edge ai", "ai 硬件"], **base)  # 顺序+大小写不同
    k3 = build_cache_key(keywords=["AI 硬件", "edge AI"],
                         connectors=["tavily", "bocha"], track="AI 硬件", days=90, allow_overseas=True)
    assert k1 == k2 == k3
    assert k1.startswith("atomcap:signals:")


def test_key_changes_with_compliance_sources_track_and_window():
    common = dict(connectors=["bocha"], keywords=["x"], track="t", days=90, allow_overseas=False)
    base = build_cache_key(**common)
    assert base != build_cache_key(**{**common, "allow_overseas": True})   # 合规开关
    assert base != build_cache_key(**{**common, "connectors": ["bocha", "tavily"]})  # 源集合
    assert base != build_cache_key(**{**common, "track": "t2"})            # 赛道
    assert base != build_cache_key(**{**common, "days": 30})               # 时间窗
    assert base != build_cache_key(**{**common, "keywords": ["y"]})        # 关键词


# ---------- RedisSignalCache ----------

def test_cache_roundtrip_and_ttl():
    cache = RedisSignalCache(FakeRedis(), ttl_seconds=86400)
    sources = [_src("信号A", "https://e.com/a", "2026-06-01"), _src("信号B")]
    asyncio.run(cache.set("k", sources))
    assert cache._client.last_ex == 86400
    out = asyncio.run(cache.get("k"))
    assert [s.title for s in out] == ["信号A", "信号B"]
    assert out[0].raw == {"title": "信号A"} and out[0].url == "https://e.com/a"


def test_cache_miss_returns_none():
    assert asyncio.run(RedisSignalCache(FakeRedis(), ttl_seconds=1).get("nope")) is None


def test_corrupt_cache_treated_as_miss():
    fake = FakeRedis()
    fake.store["k"] = "{不是合法 json"
    assert asyncio.run(RedisSignalCache(fake, ttl_seconds=1).get("k")) is None


def test_redis_errors_degrade_gracefully():
    cache = RedisSignalCache(BrokenRedis(), ttl_seconds=1)
    assert asyncio.run(cache.get("k")) is None          # get 异常→未命中
    asyncio.run(cache.set("k", [_src("x")]))            # set 异常→静默不抛


# ---------- cached_gather_signals ----------

def test_cached_gather_miss_then_hit():
    cache = RedisSignalCache(FakeRedis(), ttl_seconds=1)
    conn = FakeConnector(news=[_src("信号A", "https://e.com/a", "2026-06-01")])

    out1 = asyncio.run(registry.cached_gather_signals(
        [conn], keywords=["AI 硬件"], track="AI 硬件", allow_overseas=False, cache=cache))
    assert [s.title for s in out1] == ["信号A"]
    calls_after_first = list(conn.calls)
    assert calls_after_first  # 第一次确实打了数据源

    out2 = asyncio.run(registry.cached_gather_signals(
        [conn], keywords=["AI 硬件"], track="AI 硬件", allow_overseas=False, cache=cache))
    assert [s.title for s in out2] == ["信号A"]
    assert conn.calls == calls_after_first  # 命中缓存：未再打数据源


def test_cached_gather_does_not_cache_empty():
    cache = RedisSignalCache(FakeRedis(), ttl_seconds=1)
    conn = FakeConnector(news=[])  # 全空结果
    out = asyncio.run(registry.cached_gather_signals(
        [conn], keywords=["x"], track="t", cache=cache))
    assert out == []
    assert cache._client.store == {}  # 空结果不回填，避免钉死 24h


def test_cached_gather_compliance_isolation():
    """同关键词不同合规开关：键不同 → 不会把一个的结果透给另一个。"""
    cache = RedisSignalCache(FakeRedis(), ttl_seconds=1)
    cn = FakeConnector(name="cn", news=[_src("国内信号", "https://e.com/cn", "2026-06-01")])
    asyncio.run(registry.cached_gather_signals(
        [cn], keywords=["k"], track="t", allow_overseas=False, cache=cache))

    overseas = FakeConnector(name="cn", news=[_src("含海外信号", "https://e.com/g", "2026-06-02")])
    out = asyncio.run(registry.cached_gather_signals(
        [overseas], keywords=["k"], track="t", allow_overseas=True, cache=cache))
    # allow_overseas=True 是不同的键，必须重新检索而非复用 False 的缓存
    assert [s.title for s in out] == ["含海外信号"]
    assert overseas.calls  # 确实重新打了源


def test_cached_gather_empty_inputs_short_circuit():
    assert asyncio.run(registry.cached_gather_signals([], keywords=["k"], track="t")) == []
    assert asyncio.run(
        registry.cached_gather_signals([FakeConnector()], keywords=[], track="")) == []


# ---------- get_signal_cache ----------

def test_get_signal_cache_disabled_without_redis_url(monkeypatch):
    import app.connectors.cache as cache_mod
    from app.config import settings

    monkeypatch.setattr(cache_mod, "_cache_resolved", False)
    monkeypatch.setattr(cache_mod, "_cache_singleton", None)
    monkeypatch.setattr(settings, "redis_url", "")
    assert get_signal_cache() is None
