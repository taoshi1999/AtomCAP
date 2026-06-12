"""交付结果对象 API：列表 / 详情 / 动作（关注赛道、生成项目池…）。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter

router = APIRouter()


@router.get("/{deliverable_id}")
async def get_deliverable(deliverable_id: uuid.UUID) -> dict:
    # TODO: 查询 deliverables 表（带租户过滤），返回 payload
    return {"id": str(deliverable_id), "todo": True}


@router.post("/{deliverable_id}/actions/{action}")
async def trigger_action(deliverable_id: uuid.UUID, action: str) -> dict:
    """对象上的动作按钮：follow_track / generate_deal_pool / generate_briefing / re_recommend。
    必须写 domain_events（经验沉淀 Agent 的数据来源）。"""
    # TODO: record_event() + 触发对应 agent run
    return {"deliverable_id": str(deliverable_id), "action": action, "todo": True}
