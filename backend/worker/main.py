"""ARQ worker —— 长任务与 cron。

任务：
- run_thesis_scout：赛道前瞻全流程（1–5 分钟，对话内异步执行）
- monitor_followed_theses：已关注赛道的定期增量监控（新融资/新政策/新风险 → 更新提醒）
- distill_experience：投资经验沉淀增量扫描（Message/UserAction → ExperienceEvent）
- generate_preference_advice_job：每小时将成熟 ExperienceEvent 转成审阅队列
"""

from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models.models import Institution
from app.services.experience_distillation import scan_experience
from app.services.preference_advice import generate_preference_advice


async def run_thesis_scout(ctx: dict, *, query: str, institution_id: str, conversation_id: str):
    # TODO: thesis_scout_graph.ainvoke(...)，进度写 Redis 供 SSE 转发
    ...


async def monitor_followed_theses(ctx: dict):
    # TODO Phase 4: 遍历 status=following 的 thesis → 增量检索 → 实质变化时生成更新提醒
    ...


async def distill_experience(ctx: dict):
    """每 5 分钟扫描所有机构的新 Message / UserAction。

    P0 只落地 PreferenceSignal → ExperienceEvent；PreferenceAdvice 的 1 小时聚合
    与人工审阅在下一轮迭代补齐。
    """
    async with SessionLocal() as db:
        async with db.begin():
            institutions = (await db.execute(select(Institution))).scalars().all()
            stats: dict[str, dict] = {}
            for institution in institutions:
                result = await scan_experience(
                    db,
                    institution_id=institution.id,
                    limit=100,
                    allow_overseas=institution.allow_overseas_models,
                )
                stats[str(institution.id)] = result.as_dict()
            return stats


async def generate_preference_advice_job(ctx: dict):
    """每小时把成熟 ExperienceEvent 转成 PreferenceAdvice，进入人工审阅队列。"""
    async with SessionLocal() as db:
        async with db.begin():
            institutions = (await db.execute(select(Institution))).scalars().all()
            stats: dict[str, dict] = {}
            for institution in institutions:
                result = await generate_preference_advice(
                    db,
                    institution_id=institution.id,
                    limit=100,
                )
                stats[str(institution.id)] = result.as_dict()
            return stats


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [run_thesis_scout, distill_experience, generate_preference_advice_job]
    cron_jobs = [
        cron(monitor_followed_theses, hour=1, minute=0),   # 每日 01:00
        cron(distill_experience, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),
        cron(generate_preference_advice_job, minute=0),  # 每小时整点
    ]
