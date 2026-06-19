"""用户自建命名投资偏好卡片 API —— 创建 / 列表 / 详情 / 更新 + 维度 AI 推荐。

「投资偏好」界面：右上「创建偏好」→ 创建命名卡片（五维增量配置）；卡片列表；点击卡片
进入详情并可编辑。所有写操作连带写 domain_events（约定 4），与写入同事务原子落盘。
租户行级隔离：一律按 user.institution_id 读写。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.objects.preference_profile import DIMENSION_LABELS, PreferenceProfile
from app.services import preference_profiles as profiles_service
from app.services import preference_recommendations as rec_service
from app.services.events import record_event

router = APIRouter()


def _dimension_summary(profile: PreferenceProfile) -> dict:
    """偏好维度随事件落盘（事后无法补），供经验沉淀 Agent 复盘偏好演进。"""
    return {
        "name": profile.name,
        "sectors": profile.sectors,
        "stages": profile.stages,
        "regions": profile.regions,
        "risk_levels": profile.risk_levels,
        "check_sizes": profile.check_sizes,
    }


@router.get("")
async def list_preference_profiles(
    include_archived: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """机构下的偏好卡片列表（投资偏好界面渲染卡片用）。"""
    rows = await profiles_service.list_profiles(
        db, institution_id=user.institution_id, include_archived=include_archived
    )
    return {"items": [profiles_service.profile_summary(r) for r in rows], "count": len(rows)}


# 注意：/recommendations 必须声明在 /{profile_id} 之前，否则会被 UUID 路径吞掉
@router.get("/recommendations")
async def recommend_values(
    dimension: str = Query(..., description="sectors/stages/regions/risk_levels/check_sizes"),
    name: str | None = Query(None, description="偏好名称，供 AI 生成上下文相关候选"),
    existing: str | None = Query(None, description="逗号分隔的已选取值（结果会排除它们）"),
    limit: int = Query(rec_service.DEFAULT_LIMIT, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """某维度「添加」时的推荐候选：AI 生成优先，失败回退精选清单（source 标识来源）。"""
    if dimension not in DIMENSION_LABELS:
        raise HTTPException(status_code=422, detail=f"未知维度: {dimension}")
    existing_list = [e for e in (existing or "").split(",") if e.strip()]
    values, source = await rec_service.ai_recommend_dimension_values(
        dimension,
        name=name,
        existing=existing_list,
        allow_overseas=user.allow_overseas_models,
        limit=limit,
    )
    return {"dimension": dimension, "recommendations": values, "source": source}


@router.post("", status_code=201)
async def create_preference_profile(
    body: PreferenceProfile,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建一张命名偏好卡片（body 经 PreferenceProfile 校验）+ 写 domain_events。"""
    row = await profiles_service.create_profile(
        db,
        institution_id=user.institution_id,
        created_by=user.user_id,
        profile=body,
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference_profile.created",
        subject_type="preference_profile",
        subject_id=row.id,
        user_id=user.user_id,
        payload=_dimension_summary(body),
    )
    return profiles_service.profile_detail(row)


@router.get("/{profile_id}")
async def get_preference_profile(
    profile_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """单张卡片详情（点击卡片进入详情 / 编辑界面）。"""
    row = await profiles_service.get_profile(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="偏好不存在")
    return profiles_service.profile_detail(row)


@router.put("/{profile_id}")
async def update_preference_profile(
    profile_id: uuid.UUID,
    body: PreferenceProfile,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """整体覆盖一张已有卡片（详情界面编辑保存）+ 写 domain_events。"""
    row = await profiles_service.get_profile(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="偏好不存在")
    row = await profiles_service.update_profile(db, row=row, profile=body)
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference_profile.updated",
        subject_type="preference_profile",
        subject_id=row.id,
        user_id=user.user_id,
        payload=_dimension_summary(body),
    )
    return profiles_service.profile_detail(row)
