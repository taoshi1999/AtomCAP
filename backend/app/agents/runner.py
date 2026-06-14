"""专用 Agent 执行编排：run 生命周期 + 交付物落库 + SSE 事件流。"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.agents.deal_intake.graph import deal_intake_graph
from app.agents.deal_sourcing.graph import deal_sourcing_graph
from app.agents.thesis_scout.graph import thesis_scout_graph
from app.db import SessionLocal
from app.evidence import service as evidence_service
from app.objects import DeliverableType
from app.services import business as business_service
from app.services import preferences as preferences_service
from app.services.agent_runs import finish_run, start_run
from app.services.conversations import save_message
from app.services.deliverables import save_deliverable
from app.services.events import recent_history, record_event

AGENT_FAILED_MSG = "赛道前瞻分析执行失败，请稍后重试。"
EMPTY_THESIS_ERROR = "子图执行完成但未产出 Thesis 对象"

DEAL_SOURCING_FAILED_MSG = "项目获取执行失败，请稍后重试。"
EMPTY_DEAL_LIST_ERROR = "子图执行完成但未产出 DealList 对象"

DEAL_INTAKE_FAILED_MSG = "项目分析执行失败，请稍后重试。"
EMPTY_DEAL_PROFILE_ERROR = "子图执行完成但未产出 DealProfile 对象"


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



async def run_deal_intake(
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    allow_overseas: bool,
    conversation_id: uuid.UUID,
    material: str,
    source_type: str = "user_input",
) -> AsyncIterator[dict[str, str]]:
    """项目获取（Deal Intake 分析流）执行编排（设计文档流程二）。

    与赛道前瞻 / Deal Sourcing 同构，但产出是**业务对象**（Company + Deal），而非交付对象：
      run 生命周期 → 子图执行（材料解析→外部补全→实体对齐→初步分析）
      → 证据剥伪 → upsert Company → DealProfile 强校验建 Deal（deals.data）
      → 被引用证据与 Deal 连边 → `deal.created` 记账（约定 4）
      → assistant 消息带 deal_ref 块（前端据此进入项目工作台）→ run 收尾。
    失败路径统一 agent_run.failed + error 事件，不落脏数据。
    """
    async with SessionLocal() as db, db.begin():
        run = await start_run(
            db,
            institution_id=institution_id,
            user_id=user_id,
            agent="deal_intake",
            conversation_id=conversation_id,
        )
        preference_input = await preferences_service.get_active(
            db, institution_id=institution_id
        )
        history_events = await recent_history(db, institution_id=institution_id)
        known_companies = await business_service.load_known_companies(
            db, institution_id=institution_id
        )
    run_id = run.id

    trail: list[str] = []
    final_state: dict[str, Any] = {}
    try:
        async for chunk in deal_intake_graph.astream(
            {
                "material": material,
                "source_type": source_type,
                "institution_id": str(institution_id),
                "conversation_id": str(conversation_id),
                "allow_overseas": allow_overseas,
                "preference_input": preference_input,
                "history_events": history_events,
                "known_companies": known_companies,
            },
            stream_mode="values",
        ):
            final_state = chunk
            progress = chunk.get("progress")
            if progress and (not trail or trail[-1] != progress):
                trail.append(progress)
                yield {"event": "progress", "data": progress}

        profile_payload = final_state.get("deal_profile")
        if not profile_payload:
            raise RuntimeError(EMPTY_DEAL_PROFILE_ERROR)

        evidence_sources = final_state.get("evidence_sources") or []
        valid_ids = {str(es["evidence_id"]) for es in evidence_sources}
        profile_payload = evidence_service.sanitize_evidence_ids(profile_payload, valid_ids)
        matched_id = final_state.get("matched_company_id")
        extraction = profile_payload.get("extraction") or {}

        async with SessionLocal() as db, db.begin():
            if evidence_sources:
                await evidence_service.save_collected(
                    db, institution_id=institution_id, evidence_sources=evidence_sources
                )
            company = await business_service.upsert_company(
                db,
                institution_id=institution_id,
                extraction=extraction,
                matched_company_id=uuid.UUID(matched_id) if matched_id else None,
            )
            deal = await business_service.create_deal(
                db,
                institution_id=institution_id,
                company_id=company.id,
                profile=profile_payload,
            )
            for eid in sorted(evidence_service.referenced_evidence_ids(deal.data)):
                await evidence_service.link(
                    db,
                    institution_id=institution_id,
                    from_id=eid,
                    to_id=deal.id,
                    relation="supports",
                )
            await record_event(
                db,
                institution_id=institution_id,
                user_id=user_id,
                event_type="deal.created",
                subject_type="deal",
                subject_id=deal.id,
                payload={
                    "agent_run_id": str(run_id),
                    "company_id": str(company.id),
                    "company_name": company.name,
                    "source_type": source_type,
                    "overall_fit": (profile_payload.get("analysis") or {}).get("overall_fit"),
                    "matched_existing": bool(matched_id),
                },
            )
            portrait = (profile_payload.get("analysis") or {}).get("portrait") or "项目初步分析完成"
            await save_message(
                db,
                institution_id=institution_id,
                user_id=user_id,
                conversation_id=conversation_id,
                role="assistant",
                blocks=[
                    {"type": "text", "text": f"项目分析完成：{portrait}（已进入项目工作台）"},
                    {"type": "deal_ref", "deal_id": str(deal.id), "company_id": str(company.id)},
                ],
                event_payload={
                    "intent": "deal_intake",
                    "agent_run_id": str(run_id),
                    "deal_id": str(deal.id),
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_intake",
                status="succeeded",
                steps={"trail": trail},
            )

        yield {
            "event": "object",
            "data": json.dumps(
                {"type": "deal", "deal_id": str(deal.id), "company_id": str(company.id)},
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
                agent="deal_intake",
                status="failed",
                steps={"trail": trail},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": DEAL_INTAKE_FAILED_MSG}
