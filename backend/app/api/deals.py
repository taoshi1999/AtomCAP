"""项目库 / 项目工作台 API：列表 / 详情 / 管线流转 / 用户反馈动作。

设计依据《项目获取Agent》：Deal Intake 分析流创建 Deal 后自动进入项目工作台，
搜寻流候选沉淀到项目库；本路由提供项目进系统后的读取与推进能力。

全部端点带租户行级过滤；状态流转与用户动作必须写 domain_events（核心约定 4）。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.models import Company, Deal
from app.objects import DeliverableType
from app.objects.base import Claim
from app.objects.deal import (
    DealAnalysis,
    DealExtraction,
    DealProfile,
    DealStatus,
    DealUserFeedback,
    DealWorkspace,
)
from app.objects.experience import ActionContext, UserActionType
from app.objects.deal_list import DealSourceType
from app.services.deals import (
    USER_ACTIONS,
    DealNotFound,
    InvalidTransition,
    deal_summary,
    apply_deal_action,
    get_deal_detail,
    list_deals,
    soft_delete_deal,
    transition_deal_status,
)
from app.services.deal_materials import DealMaterialTargetNotFound, save_deal_material, search_deal_materials
from app.services.document_extract import DependencyMissingError, DocumentError
from app.services import deal_assistant
from app.services.deliverables import save_deliverable
from app.services.events import record_event
from app.services.pre_dd import build_pre_dd_workspace
from app.services.pre_dd_brief import build_pre_dd_brief_report, list_pre_dd_briefs
from app.services.user_actions import record_user_action, snapshot_from_deal

router = APIRouter()


class CreateDealBody(BaseModel):
    company_name: str = Field(min_length=1, max_length=255, description="公司/项目名称")
    one_line_intro: str | None = Field(default=None, max_length=1000, description="一句话介绍")
    track: str | None = Field(default=None, max_length=100, description="所属赛道")
    sub_direction: str | None = Field(default=None, max_length=100, description="子方向")
    funding_stage: str | None = Field(default=None, max_length=100, description="融资阶段")
    source_note: str | None = Field(default=None, max_length=2000, description="补充材料或来源说明")


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
        workspace=DealWorkspace(created=True),
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
        )
    except DealMaterialTargetNotFound:
        raise HTTPException(status_code=404, detail="项目不存在") from None
    except DependencyMissingError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except DocumentError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{deal_id}/pre-dd/brief")
async def generate_pre_dd_brief(
    deal_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """基于当前 DealProfile 生成结构化 Pre-DD Brief 草稿。

    MVP 版本不调用长流程 Agent，只整理已有项目画像和 Pre-DD 任务树；生成结果以
    dd_report 交付对象入库，并写事件 / UserAction 供经验沉淀 Agent 使用。
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
    pre_dd = build_pre_dd_workspace(profile)
    company_name = company.name if company is not None else profile.extraction.company_name
    report = build_pre_dd_brief_report(
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
        event_type="deal.pre_dd_brief_generated",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "deliverable_id": str(row.id),
            "company_id": str(deal.company_id),
            "completion_score": report.brief.completion_score if report.brief else None,
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
    return {
        "deal_id": str(deal.id),
        "deliverable_id": str(row.id),
        "type": DeliverableType.DD_REPORT.value,
        "payload": row.payload,
        "event_recorded": True,
    }


@router.get("/{deal_id}/pre-dd/briefs")
async def get_pre_dd_briefs(
    deal_id: uuid.UUID,
    limit: int = Query(default=10, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """项目工作台 Brief 历史：返回当前项目最近生成的 dd_report Brief。"""
    exists = await db.scalar(
        select(Deal.id).where(
            Deal.id == deal_id,
            Deal.institution_id == user.institution_id,
        )
    )
    if exists is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    items = await list_pre_dd_briefs(
        db,
        institution_id=user.institution_id,
        deal_id=deal_id,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


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
