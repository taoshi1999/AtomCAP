"""ARQ worker —— 长任务与 cron。

任务：
- run_thesis_scout：赛道前瞻全流程（1–5 分钟，对话内异步执行）
- monitor_followed_theses：已关注赛道的定期增量监控（新融资/新政策/新风险 → 更新提醒）
- distill_experience：投资经验沉淀（消费 domain_events，产出偏好 diff / 复盘 / LP 汇报）
"""

from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings

from app.config import settings


async def run_thesis_scout(ctx: dict, *, query: str, institution_id: str, conversation_id: str):
    # TODO: thesis_scout_graph.ainvoke(...)，进度写 Redis 供 SSE 转发
    ...


async def monitor_followed_theses(ctx: dict):
    # TODO Phase 4: 遍历 status=following 的 thesis → 增量检索 → 实质变化时生成更新提醒
    ...


async def distill_experience(ctx: dict):
    # TODO Phase 4: 经验沉淀 Agent
    ...


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [run_thesis_scout]
    cron_jobs = [
        cron(monitor_followed_theses, hour=1, minute=0),   # 每日 01:00
        cron(distill_experience, weekday=0, hour=2, minute=0),  # 每周一 02:00
    ]
