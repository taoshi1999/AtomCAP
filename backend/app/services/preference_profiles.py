"""用户自建命名投资偏好卡片（preference_profiles 表）读写服务。

多租户行级隔离：一律按 institution_id 过滤。与机构唯一生效偏好 Preference
（services/preferences.py）分离，互不影响 fit_score / 经验沉淀主链路。

写路径只入会话（add/flush），由 API 层 get_db（session.begin()）与 record_event
同事务原子落盘——创建 / 更新偏好卡片是用户操作，必须连带写 domain_events（约定 4）。
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PreferenceProfileRow
from app.objects.preference_profile import PreferenceProfile


def profile_summary(row: PreferenceProfileRow) -> dict:
    """列表卡片投影（够渲染卡片即可，五维取值随卡片直接展示）。"""
    payload = row.payload or {}
    return {
        "id": str(row.id),
        "name": row.name,
        "sectors": payload.get("sectors", []),
        "stages": payload.get("stages", []),
        "regions": payload.get("regions", []),
        "risk_levels": payload.get("risk_levels", []),
        "check_sizes": payload.get("check_sizes", []),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def profile_detail(row: PreferenceProfileRow) -> dict:
    """详情投影（含完整 payload，经 PreferenceProfile 归一化）。"""
    return {
        "id": str(row.id),
        "name": row.name,
        "archived": bool(row.archived),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "profile": PreferenceProfile.model_validate(row.payload or {}).model_dump(mode="json"),
    }


async def list_profiles(
    db: AsyncSession, *, institution_id: uuid.UUID, include_archived: bool = False
) -> list[PreferenceProfileRow]:
    """机构下的偏好卡片列表，按最近更新倒序。默认不含已归档。"""
    stmt = select(PreferenceProfileRow).where(
        PreferenceProfileRow.institution_id == institution_id
    )
    if not include_archived:
        stmt = stmt.where(PreferenceProfileRow.archived.is_(False))
    stmt = stmt.order_by(PreferenceProfileRow.updated_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def get_profile(
    db: AsyncSession, *, institution_id: uuid.UUID, profile_id: uuid.UUID
) -> PreferenceProfileRow | None:
    """按 id + 租户取单张卡片（行级隔离：他机构 id 取不到）。"""
    return (
        await db.execute(
            select(PreferenceProfileRow).where(
                PreferenceProfileRow.id == profile_id,
                PreferenceProfileRow.institution_id == institution_id,
            )
        )
    ).scalars().first()


async def create_profile(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    created_by: uuid.UUID | None,
    profile: PreferenceProfile,
) -> PreferenceProfileRow:
    """新建一张偏好卡片（入会话 + flush，提交由调用方事务负责）。"""
    row = PreferenceProfileRow(
        institution_id=institution_id,
        created_by=created_by,
        name=profile.name,
        archived=False,
        payload=profile.model_dump(mode="json"),
    )
    db.add(row)
    await db.flush()
    return row


async def update_profile(
    db: AsyncSession, *, row: PreferenceProfileRow, profile: PreferenceProfile
) -> PreferenceProfileRow:
    """整体覆盖一张已有卡片的名称与五维内容（前端提交完整内容）。"""
    row.name = profile.name
    row.payload = profile.model_dump(mode="json")
    await db.flush()
    return row
