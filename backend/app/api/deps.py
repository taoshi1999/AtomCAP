"""API 依赖：JWT 解码 + 多租户上下文。

所有业务端点必须依赖 get_current_user 获取租户上下文：
- institution_id 用于行级隔离过滤（核心约定：服务层强制过滤）
- allow_overseas_models 每次请求从库里读最新值（合规开关不缓存在 token 里）

开发回退：AUTH_DEV_FALLBACK=true 且请求未携带凭证时返回固定开发租户
（前端登录 UI 接通前的过渡，生产必须关闭）。携带了凭证则一律严格校验。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.models import Institution, User
from app.security import TokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

_DEV_TENANT = uuid.UUID("00000000-0000-0000-0000-000000000001")


@dataclass(frozen=True)
class CurrentUser:
    user_id: uuid.UUID
    institution_id: uuid.UUID
    allow_overseas_models: bool = False


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        if settings.auth_dev_fallback:
            return CurrentUser(user_id=_DEV_TENANT, institution_id=_DEV_TENANT)
        raise _unauthorized("缺少 Bearer 凭证")

    try:
        claims = decode_access_token(credentials.credentials)
    except TokenError as e:
        raise _unauthorized(str(e)) from e

    row = (
        await db.execute(
            select(User, Institution)
            .join(Institution, User.institution_id == Institution.id)
            .where(User.id == claims.user_id)
        )
    ).first()
    if row is None:
        raise _unauthorized("用户不存在")

    user, institution = row
    if user.institution_id != claims.institution_id:
        # token 声明与库中归属不一致（密钥泄露伪造 / 用户被迁移），拒绝
        raise _unauthorized("租户上下文不一致")

    return CurrentUser(
        user_id=user.id,
        institution_id=institution.id,
        allow_overseas_models=institution.allow_overseas_models,
    )
