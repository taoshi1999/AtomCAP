"""专用 Agent 执行编排：run 生命周期 + 交付物落库 + SSE 事件流。"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any

from app.agents.deal_intake.graph import deal_intake_graph
from app.agents.deal_sourcing.graph import deal_sourcing_graph
from app.agents.react_planner import agent_label, generate_visible_react_plan
from app.agents.thesis_scout.graph import thesis_scout_graph
from app.db import SessionLocal
from app.evidence import service as evidence_service
from app.llm.client import begin_usage_collection, end_usage_collection
from app.objects import DeliverableType
from app.services import business as business_service
from app.services import preferences as preferences_service
from app.services.agent_runs import finish_run, start_run
from app.services.conversations import react_steps_block, save_message, usage_block
from app.services.deliverables import save_deliverable
from app.services.events import recent_history, record_event

AGENT_FAILED_MSG = "赛道前瞻分析执行失败，请稍后重试。"
EMPTY_THESIS_ERROR = "子图执行完成但未产出 Thesis 对象"

DEAL_SOURCING_FAILED_MSG = "项目获取执行失败，请稍后重试。"
EMPTY_DEAL_LIST_ERROR = "子图执行完成但未产出 DealList 对象"

DEAL_INTAKE_FAILED_MSG = "项目分析执行失败，请稍后重试。"
EMPTY_DEAL_PROFILE_ERROR = "子图执行完成但未产出 DealProfile 对象"


def _merge_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = usage.get(key)
        if isinstance(value, int):
            total[key] = total.get(key, 0) + value


def _usage_payload(total: dict[str, int]) -> dict[str, int | bool]:
    return {**total, "estimated": False}


def _drain_usage_events(
    usage_events: list[dict[str, int]],
    cursor: int,
    usage_total: dict[str, int],
) -> tuple[int, dict[str, str] | None]:
    if cursor >= len(usage_events):
        return cursor, None
    for usage in usage_events[cursor:]:
        _merge_usage(usage_total, usage)
    return len(usage_events), {
        "event": "usage",
        "data": json.dumps(_usage_payload(usage_total), ensure_ascii=False),
    }


def _count(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def _agent_reasoning(agent: str, progress: str, state: dict[str, Any]) -> str:
    """High-level agent reasoning trace for the UI; avoids exposing hidden chain-of-thought."""
    details: list[str] = [progress]
    if agent == "thesis_scout":
        track = (state.get("track_definition") or {}).get("track_name")
        if track:
            details.append(f"已锁定赛道：{track}")
        evidence_count = _count(state.get("evidence_sources"))
        if evidence_count:
            details.append(f"已收集 {evidence_count} 条外部信号")
        sub_count = _count(state.get("sub_directions"))
        if sub_count:
            details.append(f"已生成 {sub_count} 个子方向")
        if state.get("thesis"):
            details.append("正在将判断、证据和机构匹配度组装成交付对象")
    elif agent == "deal_sourcing":
        strategy = state.get("search_strategy") or {}
        themes = strategy.get("themes") or []
        if themes:
            details.append(f"搜索主题：{' / '.join(map(str, themes[:3]))}")
        evidence_count = _count(state.get("evidence_sources"))
        if evidence_count:
            details.append(f"已收集 {evidence_count} 条公开信号")
        candidates = _count(state.get("candidates"))
        if candidates:
            details.append(f"正在评估 {candidates} 个候选项目")
        if state.get("deal_list"):
            details.append("正在把候选项目整理成项目池交付物")
    elif agent == "deal_intake":
        extraction = (state.get("deal_profile") or {}).get("extraction") or state.get("extraction") or {}
        company = extraction.get("company_name")
        if company:
            details.append(f"已识别公司：{company}")
        evidence_count = _count(state.get("evidence_sources"))
        if evidence_count:
            details.append(f"已补全 {evidence_count} 条外部信号")
        if state.get("matched_company_id"):
            details.append("已匹配到项目库中的既有公司")
        if state.get("deal_profile"):
            details.append("正在形成项目初步分析并写入项目工作台")
    return "；".join(details) + "\n"


def _usage_blocks(usage_total: dict[str, int]) -> list[dict[str, Any]]:
    return [usage_block(_usage_payload(usage_total))] if usage_total else []


def _react_step_payload(
    *,
    agent: str,
    loop: int,
    phase: str,
    summary: str,
    details: list[str] | None = None,
    status: str = "completed",
    tool_id: str | None = None,
    tool_name: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": f"{agent}-loop-{loop}-{phase}",
        "loop": loop,
        "phase": phase,
        "summary": summary,
        "details": details or [],
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if tool_id or tool_name:
        payload["tool_id"] = tool_id or tool_name
        payload["tool_name"] = tool_name or tool_id
    return payload


def _progress_details(agent: str, progress: str, state: dict[str, Any]) -> list[str]:
    return [
        part.strip()
        for part in _agent_reasoning(agent, progress, state).strip().split("；")
        if part.strip()
    ]


def _progress_tool(progress: str) -> tuple[str, str] | tuple[None, None]:
    text = progress or ""
    if "市场信号" in text or "公开数据" in text or "相关资料" in text:
        return "public_signal_search", "公开信息检索"
    if "工商核验" in text:
        return "business_registry_check", "工商信息核验"
    if "解析项目材料" in text or "材料解析" in text:
        return "document_reader", "项目材料读取"
    return None, None


def _append_react_step(
    events: list[dict[str, str]],
    react_steps: list[dict[str, Any]],
    **kwargs,
) -> None:
    payload = _react_step_payload(**kwargs)
    react_steps.append(payload)
    events.append({"event": "react_step", "data": json.dumps(payload, ensure_ascii=False)})


def _trail_react_steps(agent: str, trail: list[str]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for index, progress in enumerate(trail, start=1):
        details = [progress]
        tool_id, tool_name = _progress_tool(progress)
        steps.append(
            _react_step_payload(
                agent=agent,
                loop=index,
                phase="summary",
                summary=f"{agent_label(agent)}已进入“{progress}”阶段，系统会结合当前状态评估下一步需要补充的信息。",
                details=details,
            )
        )
        if tool_id or tool_name:
            steps.append(
                _react_step_payload(
                    agent=agent,
                    loop=index,
                    phase="action",
                    summary=f"使用{tool_name}支撑当前步骤。",
                    details=details,
                    tool_id=tool_id,
                    tool_name=tool_name,
                )
            )
        steps.append(
            _react_step_payload(
                agent=agent,
                loop=index,
                phase="observation",
                summary="当前步骤执行完成，已进入下一轮规划。",
                details=[progress],
            )
        )
    return steps


async def _agent_step_events(
    *,
    agent: str,
    user_request: str,
    progress: str | None,
    state: dict[str, Any],
    trail: list[str],
    react_steps: list[dict[str, Any]],
    usage_events: list[dict[str, int]],
    usage_cursor: int,
    usage_total: dict[str, int],
    allow_overseas: bool,
) -> tuple[int, list[dict[str, str]]]:
    events: list[dict[str, str]] = []
    if progress and (not trail or trail[-1] != progress):
        trail.append(progress)
        loop = len(trail)
        details = _progress_details(agent, progress, state)
        plan = await generate_visible_react_plan(
            user_request=user_request,
            agent=agent,
            intent=agent,
            progress=progress,
            observations=details,
            state_snapshot="；".join(details),
            allow_overseas=allow_overseas,
        )
        tool_id, tool_name = _progress_tool(progress)
        events.append({"event": "progress", "data": progress})
        _append_react_step(
            events,
            react_steps,
            agent=agent,
            loop=loop,
            phase="summary",
            summary=plan,
            details=details,
        )
        if tool_id or tool_name:
            _append_react_step(
                events,
                react_steps,
                agent=agent,
                loop=loop,
                phase="action",
                summary=f"我会使用{tool_name}支撑当前步骤。",
                details=details,
                status="running",
                tool_id=tool_id,
                tool_name=tool_name,
            )
        _append_react_step(
            events,
            react_steps,
            agent=agent,
            loop=loop,
            phase="observation",
            summary="当前阶段已完成，系统会基于新状态继续规划下一步。",
            details=details,
        )
    usage_cursor, usage_event = _drain_usage_events(usage_events, usage_cursor, usage_total)
    if usage_event:
        events.append(usage_event)
    return usage_cursor, events


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
    react_steps: list[dict[str, Any]] = []
    final_state: dict[str, Any] = {}
    usage_token, usage_events = begin_usage_collection()
    usage_cursor = 0
    usage_total: dict[str, int] = {}
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
            usage_cursor, events = await _agent_step_events(
                agent="thesis_scout",
                user_request=query,
                progress=chunk.get("progress"),
                state=chunk,
                trail=trail,
                react_steps=react_steps,
                usage_events=usage_events,
                usage_cursor=usage_cursor,
                usage_total=usage_total,
                allow_overseas=allow_overseas,
            )
            for event in events:
                yield event

        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event

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
                    *_usage_blocks(usage_total),
                    react_steps_block(react_steps or _trail_react_steps("thesis_scout", trail)),
                ],
                event_payload={
                    "intent": "thesis_scout",
                    "agent_run_id": str(run_id),
                    "deliverable_id": str(deliverable.id),
                    "usage": _usage_payload(usage_total) if usage_total else None,
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="thesis_scout",
                status="succeeded",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
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
        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event
        async with SessionLocal() as db, db.begin():
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="thesis_scout",
                status="failed",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": AGENT_FAILED_MSG}
    finally:
        end_usage_collection(usage_token)


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
    react_steps: list[dict[str, Any]] = []
    final_state: dict[str, Any] = {}
    usage_token, usage_events = begin_usage_collection()
    usage_cursor = 0
    usage_total: dict[str, int] = {}
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
            usage_cursor, events = await _agent_step_events(
                agent="deal_sourcing",
                user_request=query,
                progress=chunk.get("progress"),
                state=chunk,
                trail=trail,
                react_steps=react_steps,
                usage_events=usage_events,
                usage_cursor=usage_cursor,
                usage_total=usage_total,
                allow_overseas=allow_overseas,
            )
            for event in events:
                yield event

        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event

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
                    *_usage_blocks(usage_total),
                    react_steps_block(react_steps or _trail_react_steps("deal_sourcing", trail)),
                ],
                event_payload={
                    "intent": "deal_sourcing",
                    "agent_run_id": str(run_id),
                    "deliverable_id": str(deliverable.id),
                    "usage": _usage_payload(usage_total) if usage_total else None,
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_sourcing",
                status="succeeded",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
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
        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event
        async with SessionLocal() as db, db.begin():
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_sourcing",
                status="failed",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": DEAL_SOURCING_FAILED_MSG}
    finally:
        end_usage_collection(usage_token)



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
    react_steps: list[dict[str, Any]] = []
    final_state: dict[str, Any] = {}
    usage_token, usage_events = begin_usage_collection()
    usage_cursor = 0
    usage_total: dict[str, int] = {}
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
            usage_cursor, events = await _agent_step_events(
                agent="deal_intake",
                user_request=material,
                progress=chunk.get("progress"),
                state=chunk,
                trail=trail,
                react_steps=react_steps,
                usage_events=usage_events,
                usage_cursor=usage_cursor,
                usage_total=usage_total,
                allow_overseas=allow_overseas,
            )
            for event in events:
                yield event

        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event

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
                    *_usage_blocks(usage_total),
                    react_steps_block(react_steps or _trail_react_steps("deal_intake", trail)),
                ],
                event_payload={
                    "intent": "deal_intake",
                    "agent_run_id": str(run_id),
                    "deal_id": str(deal.id),
                    "usage": _usage_payload(usage_total) if usage_total else None,
                },
            )
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_intake",
                status="succeeded",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
            )

        yield {
            "event": "object",
            "data": json.dumps(
                {"type": "deal", "deal_id": str(deal.id), "company_id": str(company.id)},
                ensure_ascii=False,
            ),
        }
    except Exception as e:  # noqa: BLE001
        usage_cursor, usage_event = _drain_usage_events(
            usage_events, usage_cursor, usage_total
        )
        if usage_event:
            yield usage_event
        async with SessionLocal() as db, db.begin():
            await finish_run(
                db,
                institution_id=institution_id,
                user_id=user_id,
                run_id=run_id,
                agent="deal_intake",
                status="failed",
                steps={"trail": trail, "usage": _usage_payload(usage_total) if usage_total else None},
                error=str(e)[:2000],
            )
        yield {"event": "error", "data": DEAL_INTAKE_FAILED_MSG}
    finally:
        end_usage_collection(usage_token)
