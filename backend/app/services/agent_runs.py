"""agent_runs 生命周期服务 —— 状态流转必须写 domain_events（核心约定 4）。

专用 Agent 的每次执行对应一条 agent_runs 记录：running → succeeded / failed。
状态流转事件（agent_run.started / succeeded / failed）是经验沉淀 Agent
还原「机构曾让系统做过什么、结果如何」的依据，与消息/对象事件同等重要。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AgentRun
from app.services.events import record_event


async def start_run(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    agent: str,
    conversation_id: uuid.UUID | None = None,
) -> AgentRun:
    """创建 run（status=running）并记账 agent_run.started。"""
    run = AgentRun(
        institution_id=institution_id,
        agent=agent,
        conversation_id=conversation_id,
        status="running",
    )
    db.add(run)
    await db.flush()
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="agent_run.started",
        subject_type="agent_run",
        subject_id=run.id,
        payload={
            "agent": agent,
            "conversation_id": str(conversation_id) if conversation_id else None,
        },
    )
    return run


async def finish_run(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    run_id: uuid.UUID,
    agent: str,
    status: str,  # succeeded / failed
    steps: dict[str, Any] | None = None,
    error: str | None = None,
    deliverable_id: uuid.UUID | None = None,
) -> None:
    """收尾：UPDATE 状态 + 记账 agent_run.{status}。

    用 UPDATE 语句而非携带 ORM 对象跨会话——失败路径里
    上一个事务可能已回滚，内存中的 run 对象状态不可信。
    """
    values: dict[str, Any] = {"status": status, "error": error}
    if steps is not None:
        values["steps"] = steps
    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.institution_id == institution_id)
        .values(**values)
    )
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=f"agent_run.{status}",
        subject_type="agent_run",
        subject_id=run_id,
        payload={
            "agent": agent,
            "deliverable_id": str(deliverable_id) if deliverable_id else None,
            "error": error,
        },
    )
