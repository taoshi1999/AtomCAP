"""专用 Agent 执行编排：run 生命周期 + 交付物落库 + SSE 事件流。"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.agents.deal_sourcing.graph import deal_sourcing_graph
from app.agents.thesis_scout.graph import thesis_scout_graph
from app.db import SessionLocal
from app.evidence import service as evidence_service
from app.objects import DeliverableType
from app.services import preferences as preferences_service
from app.services.agent_runs import finish_run, start_run
from app.services.conversations import save_message
from app.services.deliverables import save_deliverable
from app.services.events import recent_history, record_event

AGENT_FAILED_MSG = "赛道前瞻分析执行失败，请稍后重试。"
EMPTY_THESIS_ERROR = "子图执行完成但未产出 Thesis 对象"

DEAL_SOURCING_FAILED_MSG = "项目获取执行失败，请稍后重试。"
EMPTY_DEAL_LIST_ERROR = "子图执行完成但未产出 DealList 对象"


async def run_thesis_scout(
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    allow_overseas: bool,
    conversation_id: uuid.UUID,
    query: str,
) -> AsyncIterator[dict[str, str]]:
    async with SessionLocal() as db, db.begin():
        run = await start_run(
            db,
            institution_id=institution_id,
            user_id=user_id,
            agent="thesis_scout",
            conversation_id=conversation_id,
        )
        preference_input = await preferences_service.get_active(
            db, institution_id=institution_id
        )
        history_events = await recent_history(db, institution_id=institution_id)
    run_id = run.id

    trail: list[str] = []
    final_state: dict[str, Any] = {}
    try:
        async for chunk in thesis_scout_graph.astream(
            {
                "query": query,
                "institution_id": str(institution_id),
                "conversation_id": str(conversation_id),
                "allow_overseas": allow_overseas,
                "preference_input": preference_input,
                "history_events": history_events,
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

        evidence_sources = final_state.get("evidence_sources") or []
        valid_ids = {str(es["evidence_id"]) for es in evidence_sources}
        thesis_payload = evidence_service.sanitize_evidence_ids(thesis_payload, valid_ids)

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
                payload={
                    "agent_run_id": str(run_id),
                    "track": thesis_payload.get("thesis_name"),
                    "one_line_view": thesis_payload.get("one_line_view"),
                },
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
    except Exception as e:  # noqa: BLE001
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


async def run_deal_sourcing(
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    allow_overseas: bool,
    conversation_id: uuid.UUID,
    query: str,
    source_thesis_id: uuid.UUID | None = None,
    thesis_context: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, str]]:
    async with SessionLocal() as db, db.begin():
        run = await start_run(
            db,
            institution_id=institution_id,
            user_id=user_id,
            agent="deal_sourcing",
            conversation_id=conversation_id,
        )
        preference_input = await preferences_service.get_active(
            db, institution_id=institution_id
        )
        history_events = await recent_history(db, institution_id=institution_id)
    run_id = run.id

    trail: list[str] = []
    final_state: dict[str, Any] = {}
    try:
        async for chunk in deal_sourcing_graph.astream(
            {
                "query": query,
                "institution_id": str(institution_id),
                "conversation_id": str(conversation_id),
                "allow_overseas": allow_overseas,
                "preference_input": preference_input,
                "history_events": history_events,
                "thesis_context": thesis_context or {},
                "source_thesis_id": str(source_thesis_id) if source_thesis_id else None,
            },
            stream_mode="values",
        ):
            final_state = chunk
            progress = chunk.get("progress")
            if progress and (not trail or trail[-1] != progress):
                trail.append(progress)
                yield {"event": "progress", "data": progress}

        deal_payload = final_state.get("deal_list")
        if not deal_payload:
            raise RuntimeError(EMPTY_DEAL_LIST_ERROR)

        evidence_sources = final_state.get("evidence_sources") or []
        valid_ids = {str(es["evidence_id"]) for es in evidence_sources}
        deal_payload = evidence_service.sanitize_evidence_ids(deal_payload, valid_ids)

        async with SessionLocal() as db, db.begin():
            if evidence_sources:
                await evidence_service.save_collected(
                    db, institution_id=institution_id, evidence_sources=evidence_sources
                )
            deliverable = await save_deliverable(
                db,
                institution_id=institution_id,
                dtype=DeliverableType.DEAL_LIST,
                payload=deal_payload,
                source_conversation_id=conversation_id,
                created_by_run_id=run_id,
            )
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
                event_type=f"{DeliverableType.DEAL_LIST.value}.created",
                subject_type=DeliverableType.DEAL_LIST.value,
                subject_id=deliverable.id,
                payload={
                    "agent_run_id": str(run_id),
                    "track": deal_payload.get("name"),
                    "candidate_count": len(deal_payload.get("candidates") or []),
                    "source_thesis_id": str(source_thesis_id) if source_thesis_id else None,
                },
            )
            count = len(deal_payload.get("candidates") or [])
            summary = deal_payload.get("summary") or f"已生成候选项目池（{count} 个候选）"
            await save_message(
                db,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                role="assistant",
                blocks=[
                    {"type": "text", "text": f"项目获取完成：{summary}"},
                    {"type": "object_ref", "deliverable_id": str(deliverable.id)},
                ],
                event_payload={
                    "intent": "deal_sourcing",
                    "agent_run_id": str(run_id),
                    "deliverable_id": str(deliverable.id),
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_sourcing",
                status="succeeded",
                steps={"trail": trail},
                deliverable_id=deliverable.id,
            )

        yield {
            "event": "object",
            "data": json.dumps(
                {
                    "type": DeliverableType.DEAL_LIST.value,
                    "deliverable_id": str(deliverable.id),
                },
                ensure_ascii=False,
            ),
        }
    except Exception as e:  # noqa: BLE001
        async with SessionLocal() as db, db.begin():
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_sourcing",
                status="failed",
                steps={"trail": trail},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": DEAL_SOURCING_FAILED_MSG}
