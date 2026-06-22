"""用户自建命名投资偏好卡片 API —— 创建 / 列表 / 详情 / 更新 + 维度 AI 推荐。

「投资偏好」界面：右上「创建偏好」→ 创建命名卡片（五维增量配置）；卡片列表；点击卡片
进入详情并可编辑。所有写操作连带写 domain_events（约定 4），与写入同事务原子落盘。
租户行级隔离：一律按 user.institution_id 读写。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.objects.preference_profile import DIMENSION_LABELS, PreferenceProfile
from app.services import preference_profiles as profiles_service
from app.services import preferences as preferences_service
from app.services import preference_assistant as assistant_service
from app.services import preference_recommendations as rec_service
from app.services.events import record_event

router = APIRouter()


class AssistantRequest(BaseModel):
    instruction: str


def _dimension_summary(profile: PreferenceProfile) -> dict:
    """偏好维度随事件落盘（事后无法补），供经验沉淀 Agent 复盘偏好演进。"""
    return profiles_service.profile_event_payload(profile)


@router.get("")
async def list_preference_profiles(
    include_archived: bool = Query(False),
    q: str | None = Query(None, max_length=100, description="按偏好名称、维度取值或备注搜索"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """机构下的偏好卡片列表（投资偏好界面渲染卡片用）。"""
    rows = await profiles_service.list_profiles(
        db, institution_id=user.institution_id, include_archived=include_archived, q=q
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


@router.post("/assistant")
async def preference_assistant_endpoint(
    body: AssistantRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """会话栏指令助手：解析自然语言 → 自动创建 / 筛选偏好，或提示无关请求。

    - create：解析出新偏好并落库（写 domain_events，约定 4），返回新卡片详情，前端在右侧栏刷新出现；
    - filter：返回筛选关键词，前端据此在右侧栏过滤已有卡片；
    - unrelated：返回提示，引导用户输入与投资偏好相关的请求。
    """
    result = await assistant_service.interpret_instruction(
        body.instruction, allow_overseas=user.allow_overseas_models
    )
    if result.action == assistant_service.ACTION_CREATE and result.profile is not None:
        row = await profiles_service.create_profile(
            db,
            institution_id=user.institution_id,
            created_by=user.user_id,
            profile=result.profile,
        )
        await record_event(
            db,
            institution_id=user.institution_id,
            event_type="preference_profile.created",
            subject_type="preference_profile",
            subject_id=row.id,
            user_id=user.user_id,
            payload={**_dimension_summary(result.profile), "source": "assistant"},
        )
        return {
            "action": "create",
            "message": result.message,
            "profile": profiles_service.profile_detail(row),
        }
    if result.action == assistant_service.ACTION_FILTER:
        return {
            "action": "filter",
            "message": result.message,
            "filter_keywords": result.filter_keywords,
        }
    return {
        "action": "unrelated",
        "message": result.message or assistant_service.UNRELATED_MESSAGE,
    }


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


@router.get("/{profile_id}/versions")
async def list_preference_profile_versions(
    profile_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """查看单张偏好卡片的历史版本（基于 domain_events 快照回放）。"""
    row = await profiles_service.get_profile(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="偏好不存在")
    versions = await profiles_service.list_profile_versions(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    return {"items": versions, "count": len(versions)}


@router.post("/{profile_id}/apply")
async def apply_preference_profile(
    profile_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """把一张命名偏好卡片应用为机构当前生效偏好。"""
    row = await profiles_service.get_profile(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="偏好不存在")
    profile = PreferenceProfile.model_validate(row.payload or {})
    pref_row = await preferences_service.set_active_preference(
        db,
        institution_id=user.institution_id,
        payload=profiles_service.profile_to_investment_preference(profile),
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference.updated",
        subject_type="preference",
        subject_id=pref_row.id,
        user_id=user.user_id,
        payload={
            "version": pref_row.version,
            "source": "preference_profile",
            "source_profile_id": str(row.id),
            **profiles_service.profile_event_payload(profile),
        },
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference_profile.applied",
        subject_type="preference_profile",
        subject_id=row.id,
        user_id=user.user_id,
        payload={
            **profiles_service.profile_event_payload(profile),
            "applied_preference_id": str(pref_row.id),
            "applied_preference_version": pref_row.version,
        },
    )
    return {
        "profile": profiles_service.profile_detail(row),
        "applied_preference": {
            "id": str(pref_row.id),
            "version": pref_row.version,
            "preference": pref_row.payload,
        },
    }


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


@router.delete("/{profile_id}")
async def delete_preference_profile(
    profile_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除一张投资偏好卡片（软删除：归档并从默认列表隐藏）。"""
    row = await profiles_service.get_profile(
        db, institution_id=user.institution_id, profile_id=profile_id
    )
    if row is None or row.archived:
        raise HTTPException(status_code=404, detail="偏好不存在")
    profile = PreferenceProfile.model_validate(row.payload or {})
    row = await profiles_service.archive_profile(db, row=row)
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference_profile.deleted",
        subject_type="preference_profile",
        subject_id=row.id,
        user_id=user.user_id,
        payload=_dimension_summary(profile),
    )
    return {"profile_id": str(row.id), "archived": True, "event_recorded": True}
