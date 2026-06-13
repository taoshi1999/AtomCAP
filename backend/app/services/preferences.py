"""机构投资偏好读写服务（preferences 表，版本化）。

读：fit_score 与前端展示的输入。同机构可能多行（历史版本），取 is_active=True
中 version 最大的一行；payload 经 InvestmentPreference 校验——读路径脏数据降级为
空偏好并告警，不让 Agent 执行崩掉。

写：用户直接维护机构偏好（经验沉淀 Agent 的 diff 建议 Phase 4 复用本写路径）。
每次写入分配新版本号、旧 active 行置否（保留历史可审计），写路径校验失败直接抛错
——脏输入要反馈给用户，不能像读路径那样静默降级。
"""

from __future__ import annotations

import logging
import uuid

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Preference
from app.objects.preference import InvestmentPreference

logger = logging.getLogger(__name__)


async def get_active_row(
    db: AsyncSession, *, institution_id: uuid.UUID
) -> Preference | None:
    """机构当前生效的偏好行（is_active 且 version 最大），无则 None。"""
    return (
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


def validate_payload(row: Preference) -> dict:
    """校验并归一化一行偏好的 payload（InvestmentPreference 形状的 dict）。

    脏数据（历史 schema 漂移）降级为空偏好并告警——与 get_active 同语义，
    供 GET 端点拿到行后复用，避免重复查询。
    """
    try:
        return InvestmentPreference.model_validate(row.payload or {}).model_dump(mode="json")
    except ValidationError:
        logger.warning("preferences 行校验失败，按空偏好处理 id=%s", row.id)
        return {}


async def get_active(db: AsyncSession, *, institution_id: uuid.UUID) -> dict:
    """返回机构当前生效的投资偏好（InvestmentPreference 形状的 dict）。

    无记录返回 {}（fit_score 对空偏好有明确的 50 分回退语义）。
    """
    row = await get_active_row(db, institution_id=institution_id)
    return validate_payload(row) if row is not None else {}


async def set_active_preference(
    db: AsyncSession, *, institution_id: uuid.UUID, payload: dict
) -> Preference:
    """覆盖机构投资偏好：分配新版本号 → 旧 active 行置否 → 写入新 active 行。

    入参经 InvestmentPreference 校验，**校验失败直接抛错**（写路径不静默降级，
    脏输入要反馈给用户）。版本号由服务层分配（机构现有最大 version + 1，含已停用
    历史版本），忽略入参里的 version——避免前端回传旧版本号造成回退。旧版本行保留
    （is_active=False），偏好演进可审计、可回溯。

    仅入会话（add/flush），不在此提交：由调用方（get_db 依赖的 session.begin()）
    与记账 record_event 同事务原子落盘。
    """
    validated = InvestmentPreference.model_validate(payload)  # 不吞校验异常

    max_version = (
        await db.execute(
            select(func.max(Preference.version)).where(
                Preference.institution_id == institution_id
            )
        )
    ).scalar()
    validated.version = (max_version or 0) + 1

    # 旧 active 行批量置否（保留历史，仅切换"当前生效"指针）
    await db.execute(
        update(Preference)
        .where(
            Preference.institution_id == institution_id,
            Preference.is_active.is_(True),
        )
        .values(is_active=False)
    )

    row = Preference(
        institution_id=institution_id,
        version=validated.version,
        payload=validated.model_dump(mode="json"),
        is_active=True,
    )
    db.add(row)
    await db.flush()
    return row
