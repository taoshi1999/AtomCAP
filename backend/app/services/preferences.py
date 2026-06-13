"""机构投资偏好读取服务（preferences 表 active 版本）。

fit_score 的输入。版本化：同机构可能存在多行（历史版本），
取 is_active=True 中 version 最大的一行；payload 经 InvestmentPreference
校验后才进入子图——脏数据降级为空偏好并告警，不让 Agent 执行崩掉。
"""

from __future__ import annotations

import logging
import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Preference
from app.objects.preference import InvestmentPreference

logger = logging.getLogger(__name__)


async def get_active(db: AsyncSession, *, institution_id: uuid.UUID) -> dict:
    """返回机构当前生效的投资偏好（InvestmentPreference 形状的 dict）。

    无记录返回 {}（fit_score 对空偏好有明确的 50 分回退语义）。
    """
    row = (
        await db.execute(
            select(Preference)
            .where(
                Preference.institution_id == institution_id,
                Preference.is_active.is_(True),
            )
            .order_by(Preference.version.desc())
            .limit(1)
        )
    ).scalars().first()
    if row is None:
        return {}
    try:
        return InvestmentPreference.model_validate(row.payload or {}).model_dump(mode="json")
    except ValidationError:
        logger.warning("preferences 表 active 版本校验失败，按空偏好处理 id=%s", row.id)
        return {}
