"""机构投资偏好 API —— 读 / 写（版本化）。

读路径供前端展示与回填表单；写路径覆盖偏好、创建新 active 版本，并写
preference.updated 事件（核心约定 4：用户操作必须记账，是经验沉淀 Agent 的数据
来源）。租户行级隔离：偏好按 user.institution_id 读写，机构内共享一份生效偏好。

写路径事务：依赖 get_db（session.begin()）——set_active_preference 与 record_event
同一事务，要么一起落盘要么一起回滚，绝不出现"改了偏好没记账"。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.objects.preference import InvestmentPreference
from app.services import preferences as preferences_service
from app.services.events import record_event

router = APIRouter()


@router.get("")
async def get_preference(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """机构当前生效偏好。无记录返回 exists=False + InvestmentPreference 默认值，
    前端可直接据此渲染空表单。"""
    row = await preferences_service.get_active_row(db, institution_id=user.institution_id)
    if row is None:
        return {
            "exists": False,
            "version": 0,
            "preference": InvestmentPreference().model_dump(mode="json"),
        }
    return {
        "exists": True,
        "version": row.version,
        "updated_at": row.updated_at.isoformat(),
        "preference": preferences_service.validate_payload(row),
    }


@router.put("")
async def update_preference(
    body: InvestmentPreference,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """覆盖机构投资偏好：创建新 active 版本 + preference.updated 事件。

    body 经 InvestmentPreference 校验（FastAPI 自动 422）；版本号由服务层分配，
    忽略 body.version（前端只提交内容，不掌管版本）。
    """
    row = await preferences_service.set_active_preference(
        db, institution_id=user.institution_id, payload=body.model_dump()
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="preference.updated",
        subject_type="preference",
        subject_id=row.id,
        user_id=user.user_id,
        payload={
            "version": row.version,
            # 偏好变更的关键维度随事件落盘（事后无法补），供经验沉淀 Agent 复盘偏好演进
            "track_preferences": row.payload.get("track_preferences", []),
            "excluded_tracks": row.payload.get("excluded_tracks", []),
        },
    )
    return {"version": row.version, "preference": row.payload, "event_recorded": True}
