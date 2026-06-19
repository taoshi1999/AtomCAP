"""模型自检端点：前端据此展示当前配置的可用模型并切换对话档位。"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, get_current_user
from app.llm.client import available_models

router = APIRouter()


@router.get("")
async def list_models(user: CurrentUser = Depends(get_current_user)) -> dict:
    """返回当前 Provider 与各对话档位对应的具体模型。

    模型可用性由 provider API token 与具体模型配置决定；allow_overseas_models
    继续传入是为了兼容底层签名，但不再用于禁用 premium 模型。
    """
    return available_models(allow_overseas=user.allow_overseas_models)
