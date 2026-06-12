"""专用 Agent 执行编排：run 生命周期 + 交付物落库 + SSE 事件流。

职责边界：
- 子图节点保持纯函数（state in → state out），不碰数据库
- 本模块负责 DB 短事务：run 创建/收尾、证据落库与连边（幻觉 evidence_id
  先剥除，核心约定 2）、deliverable 强校验入库、assistant 消息（object_ref 块）
  落库——用户可见动作全部写 domain_events（核心约定 1/4）
- 产出 SSE 事件字典（progress / object / error），done 由 API 层统一收尾

生产形态是 ARQ 队列 + Postgres checkpointer 异步执行；当前内联在请求流中，
编排逻辑与执行位置解耦，迁移时本模块整体搬进 worker 即可。
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.agents.thesis_scout.graph import thesis_scout_graph
from app.db import SessionLocal
from app.evidence import service as evidence_service
from app.objects import DeliverableType
from app.services.agent_runs import finish_run, start_run
from app.services.conversations import save_message
from app.services.deliverables import save_deliverable
from app.services.events import record_event

AGENT_FAILED_MSG = "赛道前瞻分析执行失败，请稍后重试。"
EMPTY_THESIS_ERROR = "子图执行完成但未产出 Thesis 对象"


async def run_thesis_scout(
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    allow_overseas: bool,
    conversation_id: uuid.UUID,
    query: str,
) -> AsyncIterator[dict[str, str]]:
    """执行赛道前瞻子图，yield SSE 事件。

    成功：progress* → object（真实 deliverable_id）；失败：progress* → error。
    无论成败，agent_runs 与 domain_events 都有完整记录。
    """
    # 1) 创建 run（短事务先提交，长任务全程可观测）
    async with SessionLocal() as db, db.begin():
        run = await start_run(
            db,
            institution_id=institution_id,
            user_id=user_id,
            agent="thesis_scout",
            conversation_id=conversation_id,
        )
    run_id = run.id

    # 2) 执行子图。values 模式逐超步产出全量 state，progress 去重后实时推送
    trail: list[str] = []
    final_state: dict[str, Any] = {}
    try:
        async for chunk in thesis_scout_graph.astream(
            {
                "query": query,
                "institution_id": str(institution_id),
                "conversation_id": str(conversation_id),
                "allow_overseas": allow_overseas,
            },
            stream_mode="values",
        ):
            final_state = chunk
            progress = chunk.get("progress")
            if progress and (not trail or trail[-1] != progress):
                trail.append(progress)
                yield {"event": "progress", "data": progress}

        thesis_payload = final_state.get("thesis")
        if not thesis_payload:
            raise RuntimeError(EMPTY_THESIS_ERROR)

        # 证据链前置：剥除不属于本次采集的 evidence_id（LLM 幻觉防线，约定 2）。
        # 剥空的 Claim 在入库强校验时自动 inferred=True，绝不静默放行伪造引用。
        evidence_sources = final_state.get("evidence_sources") or []
        valid_ids = {str(es["evidence_id"]) for es in evidence_sources}
        thesis_payload = evidence_service.sanitize_evidence_ids(thesis_payload, valid_ids)

        # 3) 成功收尾（单事务）：证据落库 → deliverable 入库（SCHEMA_REGISTRY 强校验）
        #    → 引用证据连边 → thesis.created → assistant 消息（object_ref 块）→ run succeeded
        async with SessionLocal() as db, db.begin():
            if evidence_sources:
                await evidence_service.save_collected(
                    db, institution_id=institution_id, evidence_sources=evidence_sources
                )
            deliverable = await save_deliverable(
                db,
                institution_id=institution_id,
                dtype=DeliverableType.THESIS,
                payload=thesis_payload,
                source_conversation_id=conversation_id,
                created_by_run_id=run_id,
            )
            # Claim 实际引用的证据与交付物连边（前端证据链展开的查询入口）
            for eid in sorted(evidence_service.referenced_evidence_ids(deliverable.payload)):
                await evidence_service.link(
                    db,
                    institution_id=institution_id,
                    from_id=eid,
                    to_id=deliverable.id,
                    relation="supports",
                )
            await record_event(
                db,
                institution_id=institution_id,
                user_id=user_id,
                event_type=f"{DeliverableType.THESIS.value}.created",
                subject_type=DeliverableType.THESIS.value,
                subject_id=deliverable.id,
                payload={"agent_run_id": str(run_id)},
            )
            one_line = thesis_payload.get("one_line_view") or "分析完成"
            await save_message(
                db,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                role="assistant",
                blocks=[
                    {"type": "text", "text": f"赛道前瞻分析完成：{one_line}"},
                    {"type": "object_ref", "deliverable_id": str(deliverable.id)},
                ],
                event_payload={
                    "intent": "thesis_scout",
                    "agent_run_id": str(run_id),
                    "deliverable_id": str(deliverable.id),
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="thesis_scout",
                status="succeeded",
                steps={"trail": trail},
                deliverable_id=deliverable.id,
            )

        yield {
            "event": "object",
            "data": json.dumps(
                {
                    "type": DeliverableType.THESIS.value,
                    "deliverable_id": str(deliverable.id),
                },
                ensure_ascii=False,
            ),
        }
    except Exception as e:  # noqa: BLE001  子图/LLM/落库任一环节失败都走统一失败收尾
        async with SessionLocal() as db, db.begin():
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="thesis_scout",
                status="failed",
                steps={"trail": trail},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": AGENT_FAILED_MSG}
