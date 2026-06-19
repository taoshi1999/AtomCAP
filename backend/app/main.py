"""AtomCAP 后端入口。"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db import engine
from app.models.models import Base

from app.api.auth import router as auth_router
from app.api.conversations import router as conversations_router
from app.api.deals import router as deals_router
from app.api.deliverables import router as deliverables_router
from app.api.experience import router as experience_router
from app.api.home import router as home_router
from app.api.models import router as models_router
from app.api.preference_advice import router as preference_advice_router
from app.api.preference_profiles import router as preference_profiles_router
from app.api.preferences import router as preferences_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """启动钩子：确保（缺失的）表存在，避免新表未迁移时端点 500。

    create_all 幂等：checkfirst 只创建尚不存在的表，绝不改动已被 Alembic 管理的
    现有表；先确保 pgvector 扩展，供含向量列的表在全新库上也能建。**生产环境仍以
    `alembic upgrade head` 为权威迁移路径**，本钩子只为开发/首次启用新功能时免去手动迁移。
    任何失败（DB 未就绪、权限不足等）只告警、不阻断启动。
    """
    # 扩展与建表分两个独立事务：PostgreSQL 一旦某语句报错会中止整个事务，
    # 故扩展失败（权限不足/已存在）不应连累建表（preference_profiles 无向量列，不依赖扩展）。
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("CREATE EXTENSION vector 跳过：%s", exc)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # noqa: BLE001 —— 建表失败不应阻断服务启动
        logger.warning("启动自动建表跳过（生产请用 alembic upgrade head）：%s", exc)
    yield


app = FastAPI(title="AtomCAP API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(conversations_router, prefix="/api/conversations", tags=["conversations"])
app.include_router(deals_router, prefix="/api/deals", tags=["deals"])
app.include_router(deliverables_router, prefix="/api/deliverables", tags=["deliverables"])
app.include_router(experience_router, prefix="/api/experience", tags=["experience"])
app.include_router(home_router, prefix="/api/home", tags=["home"])
app.include_router(models_router, prefix="/api/models", tags=["models"])
app.include_router(
    preference_advice_router,
    prefix="/api/preference-advice",
    tags=["preference-advice"],
)
app.include_router(
    preference_profiles_router,
    prefix="/api/preference-profiles",
    tags=["preference-profiles"],
)
app.include_router(preferences_router, prefix="/api/preferences", tags=["preferences"])


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
