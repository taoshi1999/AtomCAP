"""项目库 / 项目工作台 API：列表 / 详情 / 管线流转 / 用户反馈动作。

设计依据《项目获取Agent》：Deal Intake 分析流创建 Deal 后自动进入项目工作台，
搜寻流候选沉淀到项目库；本路由提供项目进系统后的读取与推进能力。

全部端点带租户行级过滤；状态流转与用户动作必须写 domain_events（核心约定 4）。
"""

from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.models import Company, Deal, Deliverable
from app.objects import DeliverableType
from app.objects.base import Claim
from app.objects.dd_report import DDReport, PreDDMeetingQuestion
from app.objects.deal import (
    DealAnalysis,
    DealExtraction,
    DealProfile,
    DealStatus,
    DealUserFeedback,
    DealWorkspace,
    DealWorkspaceSummary,
    PreDDMaterialCollectionStatus,
    infer_workspace_summary,
)
from app.objects.experience import ActionContext, UserActionType
from app.objects.deal_list import DealSourceType
from app.services.deals import (
    USER_ACTIONS,
    DealNotFound,
    InvalidPreDDMaterialStatus,
    InvalidTransition,
    deal_summary,
    apply_deal_action,
    export_deal_information_xlsx,
    get_deal_detail,
    list_deals,
    soft_delete_deal,
    transition_deal_status,
    update_pre_dd_material_status,
    update_workspace_summary,
)
from app.services.deal_market_signals import DealSignalTargetNotFound, collect_deal_market_signals
from app.services.deal_materials import (
    DealMaterialNotFound,
    DealMaterialTargetNotFound,
    InvalidDealMaterialCategory,
    collect_pre_dd_public_materials,
    confirm_deal_material_categories,
    delete_deal_material,
    list_deal_materials,
    save_deal_material,
    search_deal_materials,
)
from app.services.document_extract import DependencyMissingError, DocumentError
from app.services.market_signal_research import MarketSignalCollectOptions
from app.services import deal_assistant
from app.services.deliverables import save_deliverable
from app.services.evidence_projection import evidence_items_for_payload
from app.services.events import record_event
from app.services.meeting_minutes import (
    MeetingMinutesError,
    MeetingMinutesNotFound,
    create_meeting_minutes,
    export_meeting_minutes_docx,
    get_meeting_audio_file,
)
from app.services.pre_dd import build_pre_dd_workspace
from app.services.pre_dd_brief import (
    PreDDReportExportError,
    PreDDReportNotFound,
    build_pre_dd_report,
    export_pre_dd_report_docx,
    list_pre_dd_reports,
)
from app.services.user_actions import record_user_action, snapshot_from_deal

router = APIRouter()


def _sse(event: str, data: object) -> str:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


class CreateDealBody(BaseModel):
    company_name: str = Field(min_length=1, max_length=255, description="公司/项目名称")
    one_line_intro: str | None = Field(default=None, max_length=1000, description="一句话介绍")
    track: str | None = Field(default=None, max_length=100, description="所属赛道")
    sub_direction: str | None = Field(default=None, max_length=100, description="子方向")
    funding_stage: str | None = Field(default=None, max_length=100, description="融资阶段")
    source_note: str | None = Field(default=None, max_length=2000, description="补充材料或来源说明")


def _clean_optional(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


class WorkspaceSummaryBody(BaseModel):
    founded_at: str | None = Field(default=None, max_length=100)
    region: str | None = Field(default=None, max_length=100)
    main_business: str | None = Field(default=None, max_length=500)
    valuation: str | None = Field(default=None, max_length=200)

    def to_summary(self) -> DealWorkspaceSummary:
        return DealWorkspaceSummary(
            founded_at=_clean_optional(self.founded_at),
            region=_clean_optional(self.region),
            main_business=_clean_optional(self.main_business),
            valuation=_clean_optional(self.valuation),
        )


class PreDDMeetingQuestionsBody(BaseModel):
    questions: list[PreDDMeetingQuestion] = Field(default_factory=list, max_length=50)


class ExportDealInfoBody(BaseModel):
    deal_ids: list[uuid.UUID] = Field(min_length=1, max_length=500, description="需要导出的项目 ID 列表")


def _manual_deal_profile(body: CreateDealBody) -> DealProfile:
    """把手动录入表单组装成 DealProfile 草稿（纯函数，便于离线校验与复用）。

    手动建档是 Deal Intake Agent 之外的人工录入口：先落一个 screening 草稿、
    自动加入项目库并建工作台，后续用户可在页面对话框要求系统补分析/查证据/推进管线。
    """
    name = body.company_name.strip()
    intro = body.one_line_intro or body.source_note or f"{name} 是用户手动创建的项目。"
    extraction = DealExtraction(
        company_name=name,
        one_line_intro=body.one_line_intro,
        track=body.track,
        sub_direction=body.sub_direction,
        funding_stage=body.funding_stage,
    )
    analysis = DealAnalysis(
        portrait=intro,
        track_judgement=body.track,
        overall_fit=50,
        highlights=[
            Claim(text="用户手动创建项目，需进一步补充材料与外部验证。", inferred=True)
        ],
        info_gaps=[
            "融资信息",
            "核心团队",
            "收入与客户",
            "竞争格局",
        ],
        open_questions=[
            "该项目是否符合当前机构投资偏好？",
            "是否已有可验证的客户、收入或融资信号？",
        ],
        next_steps=[
            Claim(text="补充 BP、官网或访谈纪要后进行项目初步分析。", inferred=True)
        ],
    )
    return DealProfile(
        source_type=DealSourceType.USER_INPUT,
        status=DealStatus.SCREENING,
        extraction=extraction,
        analysis=analysis,
        user_feedback=DealUserFeedback(is_in_library=True),
        workspace=DealWorkspace(
            created=True,
            summary=infer_workspace_summary(extraction, analysis),
        ),
    )


@router.post("")
async def create_deal(
    body: CreateDealBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """手动创建项目：创建 Company + Deal 草稿，并进入项目库。

    这不是替代 Deal Intake Agent，而是给用户一个明确的人工录入口；后续可在
    页面底部对话框继续要求系统补分析、查证据或推进管线。
    """
    name = body.company_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="公司/项目名称不能为空")

    company = Company(
        institution_id=user.institution_id,
        name=name,
        profile={
            "source": "manual",
            "one_line_intro": body.one_line_intro,
            "track": body.track,
        },
    )
    db.add(company)
    await db.flush()

    profile = _manual_deal_profile(body)
    deal = Deal(
        institution_id=user.institution_id,
        company_id=company.id,
        status=DealStatus.SCREENING.value,
        data=profile.model_dump(mode="json"),
    )
    db.add(deal)
    await db.flush()

    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.created",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "source": "manual",
            "company_id": str(company.id),
            "track": body.track,
        },
    )
    return deal_summary(deal, company)


@router.get("")
async def get_deals(
    status: str | None = Query(default=None, description="按管线状态过滤"),
    in_library: bool | None = Query(default=None, description="按是否已加入项目库过滤"),
    q: str | None = Query(default=None, max_length=100, description="按项目名、画像、来源或状态搜索"),
    limit: int = Query(default=100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目库列表视图（租户隔离）。"""
    if status is not None and status not in {s.value for s in DealStatus}:
        raise HTTPException(status_code=422, detail=f"未知状态: {status}")
    items = await list_deals(
        db,
        institution_id=user.institution_id,
        status=status,
        in_library=in_library,
        q=q,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@router.post("/export")
async def export_deal_information(
    body: ExportDealInfoBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """将用户勾选的项目库项目信息导出为 Excel。"""
    try:
        result = await export_deal_information_xlsx(
            db,
            institution_id=user.institution_id,
            deal_ids=body.deal_ids,
        )
    except DealNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.information_exported",
        subject_type="deal",
        payload={
            "deal_ids": result["deal_ids"],
            "count": result["count"],
            "file": result["file"],
        },
    )
    return {**result, "event_recorded": True}


class DealAssistantRequest(BaseModel):
    instruction: str


@router.post("/assistant")
async def deal_assistant_endpoint(
    body: DealAssistantRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目库会话栏指令助手：解析自然语言 → 自动创建 / 筛选项目，或提示无关请求。

    - create：解析出项目草稿并复用手动建项目逻辑建 Company+Deal（写 deal.created，source=assistant），
      返回项目摘要，前端在右侧栏刷新出现；
    - filter：返回筛选关键词，前端据此在右侧栏过滤已有项目；
    - unrelated：返回提示，引导用户输入与项目相关的请求。
    """
    result = await deal_assistant.interpret_instruction(
        body.instruction, allow_overseas=user.allow_overseas_models
    )
    if result.action == deal_assistant.ACTION_CREATE and result.deal is not None:
        draft = result.deal
        cbody = CreateDealBody(
            company_name=draft.company_name,
            one_line_intro=draft.one_line_intro,
            track=draft.track,
            funding_stage=draft.funding_stage,
        )
        name = cbody.company_name.strip()
        company = Company(
            institution_id=user.institution_id,
            name=name,
            profile={"source": "assistant", "one_line_intro": cbody.one_line_intro, "track": cbody.track},
        )
        db.add(company)
        await db.flush()
        profile = _manual_deal_profile(cbody)
        deal = Deal(
            institution_id=user.institution_id,
            company_id=company.id,
            status=DealStatus.SCREENING.value,
            data=profile.model_dump(mode="json"),
        )
        db.add(deal)
        await db.flush()
        await record_event(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            event_type="deal.created",
            subject_type="deal",
            subject_id=deal.id,
            payload={"source": "assistant", "company_id": str(company.id), "track": cbody.track},
        )
        return {"action": "create", "message": result.message, "deal": deal_summary(deal, company)}
    if result.action == deal_assistant.ACTION_FILTER:
        return {
            "action": "filter",
            "message": result.message,
            "filter_keywords": result.filter_keywords,
        }
    return {
        "action": "unrelated",
        "message": result.message or deal_assistant.UNRELATED_MESSAGE,
    }


@router.get("/meeting-minutes/audio/{file_id}")
async def download_meeting_audio(
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """播放/下载当前租户的会议录音。"""
    try:
        path, metadata = get_meeting_audio_file(
            institution_id=user.institution_id,
            file_id=file_id,
        )
    except MeetingMinutesNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return FileResponse(
        path,
        filename=str(metadata.get("filename") or path.name),
        media_type=str(metadata.get("content_type") or "audio/webm"),
    )


@router.get("/{deal_id}")
async def get_deal(
    deal_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目工作台详情：完整画像 + 关联 Company。"""
    detail = await get_deal_detail(
        db, institution_id=user.institution_id, deal_id=deal_id
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return detail


@router.patch("/{deal_id}/workspace-summary")
async def patch_workspace_summary(
    deal_id: uuid.UUID,
    body: WorkspaceSummaryBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update the editable four-field project workspace summary."""
    try:
        deal = await update_workspace_summary(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            summary=body.to_summary(),
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None

    workspace = (deal.data or {}).get("workspace") or {}
    return {
        "deal_id": str(deal.id),
        "summary": workspace.get("summary") or {},
        "event_recorded": True,
    }


@router.delete("/{deal_id}")
async def delete_deal(
    deal_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """软删除项目：从项目库/工作台默认列表隐藏，保留历史事件与材料。"""
    try:
        deal = await soft_delete_deal(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    return {"deal_id": str(deal.id), "status": deal.status, "event_recorded": True}


@router.post("/{deal_id}/market-signals/collect")
async def collect_market_signals(
    deal_id: uuid.UUID,
    options: MarketSignalCollectOptions | None = Body(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """收集项目近期市场信号：财经新闻、工商信息、专利、论文和人事变动。"""
    try:
        return await collect_deal_market_signals(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            allow_overseas=user.allow_overseas_models,
            max_search_rounds=(options or MarketSignalCollectOptions()).max_search_rounds,
        )
    except DealSignalTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None


@router.get("/{deal_id}/materials/search")
async def search_materials(
    deal_id: uuid.UUID,
    q: str = Query(min_length=1, max_length=200, description="材料全文检索关键词"),
    limit: int = Query(default=10, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目材料全文检索：MVP 先基于已解析 Chunk 做关键词片段召回。"""
    try:
        items = await search_deal_materials(
            db,
            institution_id=user.institution_id,
            deal_id=deal_id,
            query=q,
            limit=limit,
        )
    except DealMaterialTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    return {"items": items, "count": len(items)}


@router.post("/{deal_id}/materials")
async def upload_deal_material(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    task_key: str | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目工作台上传材料：解析文本并绑定到当前 Deal 的材料库。"""
    data = await file.read()
    try:
        return await save_deal_material(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            filename=file.filename,
            data=data,
            content_type=file.content_type,
            pre_dd_task_key=task_key,
        )
    except DealMaterialTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidDealMaterialCategory as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except DependencyMissingError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except DocumentError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{deal_id}/meeting-minutes")
async def upload_meeting_minutes_audio(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    mode: str = Form(default="upload"),
    transcript_text: str | None = Form(default=None),
    transcript_segments: str | None = Form(default=None),
    duration_seconds: float | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """上传录音或实时录音片段，并生成项目会议纪要。"""
    if mode not in {"upload", "live"}:
        raise HTTPException(status_code=422, detail="mode 必须是 upload 或 live")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="录音文件为空")
    try:
        materials = await list_deal_materials(
            db,
            institution_id=user.institution_id,
            deal_id=deal_id,
        )
        minutes = await create_meeting_minutes(
            db,
            institution_id=user.institution_id,
            deal_id=deal_id,
            audio_bytes=audio_bytes,
            filename=file.filename or "meeting.webm",
            content_type=file.content_type,
            mode=mode,  # type: ignore[arg-type]
            transcript_text=transcript_text,
            transcript_segments_json=transcript_segments,
            duration_seconds=duration_seconds,
            materials=materials,
        )
        await record_event(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            event_type="deal.meeting_minutes_generated",
            subject_type="deal",
            subject_id=deal_id,
            payload={
                "minutes_id": minutes["id"],
                "mode": mode,
                "audio_filename": minutes["audio_filename"],
                "key_info_count": len(minutes.get("key_infos") or []),
                "qa_count": len(minutes.get("qa_pairs") or []),
            },
        )
        return {"deal_id": str(deal_id), "minutes": minutes, "event_recorded": True}
    except DealMaterialTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except MeetingMinutesError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{deal_id}/meeting-minutes/{minutes_id}/export")
async def export_meeting_minutes(
    deal_id: uuid.UUID,
    minutes_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """把会议纪要一键导出为 Word 文档。"""
    try:
        result = await export_meeting_minutes_docx(
            db,
            institution_id=user.institution_id,
            deal_id=deal_id,
            minutes_id=minutes_id,
        )
    except MeetingMinutesNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except MeetingMinutesError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.meeting_minutes_exported",
        subject_type="deal",
        subject_id=deal_id,
        payload={"minutes_id": minutes_id, "file": result["file"]},
    )
    return {"deal_id": str(deal_id), **result, "event_recorded": True}


@router.delete("/{deal_id}/materials/{document_id}")
async def delete_material(
    deal_id: uuid.UUID,
    document_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除项目工作台中的一条材料。"""
    try:
        await delete_deal_material(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            document_id=document_id,
        )
    except DealMaterialNotFound:
        raise HTTPException(status_code=404, detail="材料不存在") from None
    return {"deal_id": str(deal_id), "document_id": str(document_id), "deleted": True}


class ConfirmMaterialCategoriesBody(BaseModel):
    task_keys: list[str] = Field(default_factory=list, description="用户确认归入的 Pre-DD 资料类别")
    rejected_task_keys: list[str] = Field(default_factory=list, description="用户明确拒绝的系统建议类别")


@router.post("/{deal_id}/materials/{document_id}/categories/confirm")
async def confirm_material_categories(
    deal_id: uuid.UUID,
    document_id: uuid.UUID,
    body: ConfirmMaterialCategoriesBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """保存一条项目材料的 Pre-DD 类别决定。"""
    try:
        return await confirm_deal_material_categories(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            document_id=document_id,
            task_keys=body.task_keys,
            rejected_task_keys=body.rejected_task_keys,
        )
    except DealMaterialNotFound:
        raise HTTPException(status_code=404, detail="材料不存在") from None
    except InvalidDealMaterialCategory as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/{deal_id}/pre-dd/materials/{task_key}/collect")
async def collect_pre_dd_materials(
    deal_id: uuid.UUID,
    task_key: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """自动检索公开信息，并把结果保存为对应 Pre-DD 维度下的项目材料。"""
    try:
        result = await collect_pre_dd_public_materials(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            task_key=task_key,
            allow_overseas=user.allow_overseas_models,
        )
    except DealMaterialTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidDealMaterialCategory as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"deal_id": str(deal_id), "task_key": task_key, **result}


@router.post("/{deal_id}/pre-dd/materials/{task_key}/collect/stream")
async def stream_collect_pre_dd_materials(
    deal_id: uuid.UUID,
    task_key: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream Pre-DD public material collection steps while the collector is running."""

    async def event_stream():
        queue: asyncio.Queue[tuple[str, object]] = asyncio.Queue()

        async def on_step(step: dict) -> None:
            await queue.put(("react_step", step))

        async def run_collect() -> None:
            try:
                result = await collect_pre_dd_public_materials(
                    db,
                    institution_id=user.institution_id,
                    user_id=user.user_id,
                    deal_id=deal_id,
                    task_key=task_key,
                    allow_overseas=user.allow_overseas_models,
                    on_step=on_step,
                )
                await queue.put(("result", {"deal_id": str(deal_id), "task_key": task_key, **result}))
            except DealMaterialTargetNotFound:
                await queue.put(("error", "项目不存在"))
            except InvalidDealMaterialCategory as e:
                await queue.put(("error", str(e)))
            except Exception:
                await queue.put(("error", "自动收集资料失败，请稍后重试"))
            finally:
                await queue.put(("done", {}))

        task = asyncio.create_task(run_collect())
        try:
            while True:
                event, data = await queue.get()
                yield _sse(event, data)
                if event == "done":
                    break
            await task
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{deal_id}/pre-dd/brief")
async def generate_pre_dd_brief(
    deal_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """基于当前 DealProfile 生成结构化 Pre-DD Report 草稿。

    MVP 版本整理已有项目画像、工作台概览和 Pre-DD 任务树；生成结果以 dd_report
    交付对象入库，并写事件 / UserAction 供经验沉淀 Agent 使用。
    """
    deal = await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == user.institution_id,
        )
    )
    if deal is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    company = await db.scalar(
        select(Company).where(
            Company.id == deal.company_id,
            Company.institution_id == user.institution_id,
        )
    )
    profile = DealProfile.model_validate(deal.data or {})
    materials = await list_deal_materials(
        db,
        institution_id=user.institution_id,
        deal_id=deal.id,
    )
    material_hits = [
        hit
        for material in materials
        for hit in material.get("pre_dd_task_hits", [])
    ]
    pre_dd = build_pre_dd_workspace(profile, material_hits=material_hits)
    company_name = company.name if company is not None else profile.extraction.company_name
    report = build_pre_dd_report(
        deal_id=deal.id,
        company_name=company_name,
        profile=profile,
        pre_dd=pre_dd,
    )
    row = await save_deliverable(
        db,
        institution_id=user.institution_id,
        dtype=DeliverableType.DD_REPORT,
        payload=report.model_dump(mode="json"),
    )
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.pre_dd_report_generated",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "deliverable_id": str(row.id),
            "company_id": str(deal.company_id),
            "completion_score": report.report.completion_score if report.report else None,
            "track": profile.extraction.track,
        },
    )
    await record_user_action(
        db,
        action_type=UserActionType.GENERATE_PRE_DD_BRIEF,
        institution_id=user.institution_id,
        user_id=user.user_id,
        target_type="deal",
        target_id=deal.id,
        snapshot=snapshot_from_deal(deal.data),
        context=ActionContext(source_page="project_workspace"),
        extra_payload={"deliverable_id": str(row.id)},
    )
    evidence_items = await evidence_items_for_payload(
        db,
        institution_id=user.institution_id,
        payload=row.payload,
    )
    return {
        "deal_id": str(deal.id),
        "deliverable_id": str(row.id),
        "type": DeliverableType.DD_REPORT.value,
        "payload": row.payload,
        "evidence_items": evidence_items,
        "event_recorded": True,
    }


@router.get("/{deal_id}/pre-dd/briefs")
async def get_pre_dd_briefs(
    deal_id: uuid.UUID,
    limit: int = Query(default=10, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目工作台 Report 历史：返回当前项目最近生成的 dd_report Report。"""
    exists = await db.scalar(
        select(Deal.id).where(
            Deal.id == deal_id,
            Deal.institution_id == user.institution_id,
        )
    )
    if exists is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    items = await list_pre_dd_reports(
        db,
        institution_id=user.institution_id,
        deal_id=deal_id,
        limit=limit,
    )
    for item in items:
        item["evidence_items"] = await evidence_items_for_payload(
            db,
            institution_id=user.institution_id,
            payload=item.get("payload") or {},
        )
    return {"items": items, "count": len(items)}


@router.patch("/{deal_id}/pre-dd/briefs/{deliverable_id}/meeting-questions")
async def update_pre_dd_meeting_questions(
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    body: PreDDMeetingQuestionsBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """保存某个 Pre-DD Report 版本的会议问题列表编辑结果。"""
    row = await db.scalar(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.institution_id == user.institution_id,
            Deliverable.type == DeliverableType.DD_REPORT.value,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Pre-DD Report 不存在")
    report = DDReport.model_validate(row.payload or {})
    if report.deal_id != deal_id or report.report is None:
        raise HTTPException(status_code=404, detail="Pre-DD Report 不属于当前项目")

    cleaned = [
        question
        for question in body.questions
        if question.question.strip() and question.purpose.strip()
    ]
    updated_report = report.report.model_copy(update={"meeting_questions": cleaned})
    updated = report.model_copy(
        update={
            "report": updated_report,
            "open_questions": [item.question for item in cleaned],
        }
    )
    row.payload = updated.model_dump(mode="json")
    row.schema_version = updated.schema_version
    await db.flush()
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.pre_dd_report_meeting_questions_updated",
        subject_type="deal",
        subject_id=deal_id,
        payload={
            "deliverable_id": str(row.id),
            "question_count": len(cleaned),
        },
    )
    evidence_items = await evidence_items_for_payload(
        db,
        institution_id=user.institution_id,
        payload=row.payload,
    )
    return {
        "deal_id": str(deal_id),
        "deliverable_id": str(row.id),
        "type": DeliverableType.DD_REPORT.value,
        "payload": row.payload,
        "evidence_items": evidence_items,
        "event_recorded": True,
    }


@router.post("/{deal_id}/pre-dd/briefs/{deliverable_id}/export")
async def export_pre_dd_report(
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """将某个 Pre-DD Report 版本导出为 Word 文档。"""
    try:
        result = await export_pre_dd_report_docx(
            db,
            institution_id=user.institution_id,
            deal_id=deal_id,
            deliverable_id=deliverable_id,
        )
    except PreDDReportNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PreDDReportExportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_event(
        db,
        institution_id=user.institution_id,
        user_id=user.user_id,
        event_type="deal.pre_dd_report_exported",
        subject_type="deal",
        subject_id=deal_id,
        payload={
            "deliverable_id": str(deliverable_id),
            "file": result["file"],
        },
    )
    return {
        "deal_id": str(deal_id),
        "deliverable_id": str(deliverable_id),
        "type": DeliverableType.DD_REPORT.value,
        **result,
        "event_recorded": True,
    }


class PreDDMaterialStatusBody(BaseModel):
    collection_status: PreDDMaterialCollectionStatus = Field(description="资料项人工状态：已收集或待收集")


@router.post("/{deal_id}/pre-dd/materials/{task_key}/status")
async def set_pre_dd_material_status(
    deal_id: uuid.UUID,
    task_key: str,
    body: PreDDMaterialStatusBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """手动切换 Pre-DD 14 类资料项的已收集/待收集状态。"""
    try:
        deal = await update_pre_dd_material_status(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            task_key=task_key,
            collection_status=body.collection_status,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidPreDDMaterialStatus as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {
        "deal_id": str(deal.id),
        "task_key": task_key,
        "collection_status": body.collection_status.value,
        "event_recorded": True,
    }


class TransitionBody(BaseModel):
    to_status: str = Field(description="目标管线状态")


@router.post("/{deal_id}/transition")
async def transition(
    deal_id: uuid.UUID,
    body: TransitionBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """管线状态流转（sourced→screening→pre_dd→approved→exited，推进阶段可 rejected）。"""
    try:
        deal = await transition_deal_status(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            to_status=body.to_status,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidTransition as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"deal_id": str(deal.id), "status": deal.status, "event_recorded": True}


@router.post("/{deal_id}/actions/{action}")
async def trigger_action(
    deal_id: uuid.UUID,
    action: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目库/工作台用户动作：add_to_library / follow / dismiss / abandon / create_workspace。"""
    if action not in USER_ACTIONS:
        raise HTTPException(status_code=422, detail=f"未知动作: {action}")
    ctx: dict = {}
    if action == "create_workspace":
        # 用户在项目库手动创建工作台时新建承载会话（Deal Intake 自动流已自带会话）
        ctx["conversation_id"] = uuid.uuid4()
    try:
        deal = await apply_deal_action(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            deal_id=deal_id,
            action=action,
            ctx=ctx,
        )
    except DealNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except InvalidTransition as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {
        "deal_id": str(deal.id),
        "action": action,
        "status": deal.status,
        "user_feedback": (deal.data or {}).get("user_feedback"),
        "workspace": (deal.data or {}).get("workspace"),
        "event_recorded": True,
    }
