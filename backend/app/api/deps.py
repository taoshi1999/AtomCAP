"""API 依赖。TODO Phase 0：JWT 解码 + 多租户上下文（institution_id 强制注入）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class CurrentUser:
    user_id: uuid.UUID
    institution_id: uuid.UUID
    allow_overseas_models: bool = False


async def get_current_user() -> CurrentUser:
    # TODO: 替换为 JWT 校验；开发期返回固定租户
    return CurrentUser(
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        institution_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    )
