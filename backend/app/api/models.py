"""模型自检端点：前端据此展示当前配置的可用模型并切换对话档位。"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, get_current_user
from app.llm.client import available_models

router = APIRouter()


@router.get("")
async def list_models(user: CurrentUser = Depends(get_current_user)) -> dict:
    """返回当前 Provider 与各对话档位对应的具体模型。

    premium（可能路由海外模型）受机构 allow_overseas_models 约束：未开启时
    该选项 available=False，前端禁用，后端档位路由也会自动降级到 standard。
    """
    return available_models(allow_overseas=user.allow_overseas_models)
