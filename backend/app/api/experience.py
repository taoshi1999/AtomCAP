"""经验沉淀 Agent API。

MVP 阶段先提供手动触发增量扫描入口，便于本地验证与自动化任务调用。
真正的 PreferenceAdvice 审阅 API 在下一轮增量补齐。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.services.experience_distillation import scan_experience

router = APIRouter()


class ExperienceScanRequest(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    include_messages: bool = True
    include_user_actions: bool = True


@router.post("/scan")
async def scan_current_institution_experience(
    body: ExperienceScanRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """手动触发当前机构的一轮经验沉淀增量扫描。"""
    body = body or ExperienceScanRequest()
    stats = await scan_experience(
        db,
        institution_id=user.institution_id,
        user_id=None,
        limit=body.limit,
        include_messages=body.include_messages,
        include_user_actions=body.include_user_actions,
        allow_overseas=user.allow_overseas_models,
    )
    return {"status": "ok", "stats": stats.as_dict()}
