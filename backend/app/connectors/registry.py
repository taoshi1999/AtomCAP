"""Connector 注册与聚合检索。

- active_connectors()：按已配置的 API key 决定启用哪些数据源；
  global 区源仅在机构 allow_overseas=True 时启用——检索词出境与模型调用
  同等对待（核心约定 5 的精神延伸）
- gather_signals()：多源 × 多关键词并发检索。单源失败只降级不拖垮整体
  （按量计费的商业 API 偶发超时/限流是常态），按 URL/标题去重，
  按发布时间排序后截断（LLM 上下文与 token 成本约束）

TODO：按「赛道 × 关键词」做 24h Redis 缓存控成本（技术规划 Step 3）。
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine

from app.config import settings
from app.connectors.base import Connector, Source
from app.connectors.bocha import BochaConnector
from app.connectors.qcc import QccConnector
from app.connectors.tavily import TavilyConnector

logger = logging.getLogger(__name__)

MAX_SIGNALS = 40        # 单次研究进入下游分析的信号上限
MAX_KEYWORDS = 6        # 检索关键词上限（控制按量计费 API 的调用次数）


def active_connectors(*, allow_overseas: bool) -> list[Connector]:
    """按配置与合规开关返回可用数据源。未配置任何 key 时返回空（空信号路径）。"""
    candidates: list[Connector] = []
    if settings.bocha_api_key:
        candidates.append(BochaConnector())
    if settings.qcc_app_key and settings.qcc_secret_key:
        candidates.append(QccConnector())
    if settings.tavily_api_key:
        candidates.append(TavilyConnector())
    return [c for c in candidates if c.region == "cn" or allow_overseas]


async def _safe(
    coro: Coroutine[None, None, list[Source]], *, connector: str, what: str
) -> list[Source]:
    """单路检索的容错壳：桩（NotImplementedError）与运行时异常都降级为空结果。"""
    try:
        return await coro
    except NotImplementedError:
        return []  # 接口桩：对应能力的付费 key 尚未接入（README 已标注）
    except Exception as e:  # noqa: BLE001  商业 API 超时/限流不拖垮整次研究
        logger.warning("connector %s %s 检索失败：%s", connector, what, e)
        return []


async def gather_signals(
    connectors: list[Connector],
    *,
    keywords: list[str],
    track: str = "",
    days: int = 90,
) -> list[Source]:
    """并发聚合检索：news × 关键词 + 融资事件 × 赛道，去重排序截断。"""
    keywords = [k for k in keywords if k][:MAX_KEYWORDS]
    if not connectors or not (keywords or track):
        return []
    tasks = []
    for c in connectors:
        for kw in keywords:
            tasks.append(_safe(c.search_news(kw, days=days), connector=c.name, what=f"news:{kw}"))
        if track:
            tasks.append(
                _safe(c.funding_events(track, days=days * 2), connector=c.name, what="funding")
            )
    batches = await asyncio.gather(*tasks)

    seen: set[str] = set()
    merged: list[Source] = []
    for batch in batches:
        for s in batch:
            key = (s.url or s.title).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(s)
    merged.sort(key=lambda s: s.published_at or "", reverse=True)  # 新信号优先，无时间的最后
    return merged[:MAX_SIGNALS]
