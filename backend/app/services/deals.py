"""项目库 / 项目工作台 读取 + 状态流转 + 用户动作记账服务。

设计依据《项目获取Agent》：
- 流程一 Step 10 / 流程二 Step 9：项目获取 Agent 把项目带进系统后，
  项目库（候选池）与项目工作台负责让项目继续推进。
- 设计字段 10「项目状态」、11「用户反馈」、12「项目工作台」。

两层职责分离，避免破坏既有约定：
- `deals.status` 列承载**管线状态机**（DealStatus：sourced→screening→pre_dd→approved→exited，任意推进阶段可 rejected），
  状态流转由系统管控并写 domain_events（约定 4）。流转事件名 `deal.{to_status}`，
  其中 deal.approved / deal.rejected / deal.exited 已在 events 历史回放白名单中，供经验沉淀 Agent 使用。
- **用户反馈动作**（加入项目库 / 关注 / 不感兴趣 / 放弃 / 创建工作台）不挪动管线状态，
  而是更新 `deals.data` 的 user_feedback / workspace 块并各写一条 domain_event。

纯函数（状态守卫、动作映射、反馈补丁、summary 投影）与 async DB 编排分离，便于离线单测。
所有 DB 读写强制 institution_id 行级过滤（核心约定）。
"""

from __future__ import annotations

import uuid
from collections.abc import Callable

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Company, Deal
from app.objects.deal import DealProfile, DealStatus
from app.objects.experience import ActionContext
from app.services.events import record_event
from app.services.user_actions import (
    DEAL_FEEDBACK_ACTIONS,
    DEAL_TRANSITION_ACTIONS,
    record_user_action,
    snapshot_from_deal,
)
from app.services.pre_dd import build_pre_dd_workspace
from app.services.deal_materials import list_deal_materials

# ---------- 管线状态机：允许的前向流转 ----------

# 工作台主链路：初筛中 -> 尽调中 -> 进行中 -> 已退出；否决可从推进阶段触发。
# ic_ready 是旧版“可上会”状态，保留兼容已有数据，但新 UI 不再主动进入。
PIPELINE_TRANSITIONS: dict[str, set[str]] = {
    DealStatus.SOURCED.value: {DealStatus.SCREENING.value, DealStatus.REJECTED.value},
    DealStatus.SCREENING.value: {DealStatus.PRE_DD.value, DealStatus.REJECTED.value},
    DealStatus.PRE_DD.value: {DealStatus.APPROVED.value, DealStatus.REJECTED.value},
    DealStatus.IC_READY.value: {
        DealStatus.APPROVED.value,
        DealStatus.REJECTED.value,
        DealStatus.PRE_DD.value,  # 立项会要求补尽调，回退
    },
    DealStatus.APPROVED.value: {DealStatus.EXITED.value},
    DealStatus.EXITED.value: set(),     # 终态
    DealStatus.REJECTED.value: set(),   # 终态
    DealStatus.DELETED.value: set(),    # 软删除终态
}


def is_allowed_transition(current: str, to: str) -> bool:
    """当前状态能否流转到目标状态（确定性守卫，端点据此 422）。"""
    if current == to:
        return False
    return to in PIPELINE_TRANSITIONS.get(current, set())


def append_status_history(data: dict, from_status: str, to_status: str) -> list[str]:
    """补齐并追加状态路径，用于前端还原实际变迁图。"""
    known = {s.value for s in DealStatus}
    history = [str(s) for s in (data.get("status_history") or []) if str(s) in known]
    if not history:
        history = [from_status]
    elif history[-1] != from_status:
        history.append(from_status)
    if history[-1] != to_status:
        history.append(to_status)
    return history


# ---------- 用户反馈动作 → (事件后缀, data.user_feedback / workspace 补丁) ----------

def _patch_add_to_library(data: dict, ctx: dict) -> None:
    data.setdefault("user_feedback", {})["is_in_library"] = True


def _patch_follow(data: dict, ctx: dict) -> None:
    fb = data.setdefault("user_feedback", {})
    fb["is_liked"] = True
    fb["is_disliked"] = False


def _patch_dismiss(data: dict, ctx: dict) -> None:
    fb = data.setdefault("user_feedback", {})
    fb["is_disliked"] = True
    fb["is_liked"] = False


def _patch_abandon(data: dict, ctx: dict) -> None:
    data.setdefault("user_feedback", {})["is_abandoned"] = True


def _patch_create_workspace(data: dict, ctx: dict) -> None:
    ws = data.setdefault("workspace", {})
    ws["created"] = True
    if ctx.get("conversation_id"):
        ws["conversation_id"] = str(ctx["conversation_id"])


# action -> (event_suffix, patch_fn)
USER_ACTIONS: dict[str, tuple[str, Callable[[dict, dict], None]]] = {
    "add_to_library": ("added_to_library", _patch_add_to_library),
    "follow": ("followed", _patch_follow),
    "dismiss": ("dismissed", _patch_dismiss),
    "abandon": ("abandoned", _patch_abandon),
    "create_workspace": ("workspace_created", _patch_create_workspace),
}


def apply_user_action(data: dict, action: str, ctx: dict | None = None) -> dict:
    """对 deals.data 应用一次用户反馈动作，返回更新后的 data（不触库，便于单测）。

    入库前由调用方经 DealProfile 强校验——补丁只写 schema 已定义的可选块，绝不落脏数据。
    """
    if action not in USER_ACTIONS:
        raise ValueError(f"未知动作: {action}")
    out = dict(data)
    out["user_feedback"] = dict(out.get("user_feedback") or {})
    out["workspace"] = dict(out.get("workspace") or {})
    _, patch_fn = USER_ACTIONS[action]
    patch_fn(out, ctx or {})
    return out


# ---------- summary 投影（项目库列表视图，纯函数） ----------

def deal_summary(deal: Deal, company: Company | None) -> dict:
    """项目库列表行视图：公司名 + 管线状态 + 匹配度 + 来源 + 反馈标记。

    设计：项目库右侧列表对已放弃项目只展示项目名 + 时间，前端据 is_abandoned 收起详情。
    """
    data = deal.data or {}
    analysis = data.get("analysis") or {}
    feedback = data.get("user_feedback") or {}
    return {
        "id": str(deal.id),
        "company_id": str(deal.company_id),
        "company_name": company.name if company is not None else None,
        "status": deal.status,
        "source_type": data.get("source_type"),
        "overall_fit": analysis.get("overall_fit"),
        "portrait": analysis.get("portrait"),
        "is_in_library": bool(feedback.get("is_in_library")),
        "is_liked": bool(feedback.get("is_liked")),
        "is_abandoned": bool(feedback.get("is_abandoned")),
        "created_at": deal.created_at.isoformat(),
        "updated_at": deal.updated_at.isoformat(),
    }


def _norm_query(value: str | None) -> str:
    compact = "".join((value or "").split())
    return compact.replace("_", "").replace("-", "").replace("－", "").lower()


def deal_matches_query(summary: dict, query: str | None) -> bool:
    needle = _norm_query(query)
    if not needle:
        return True
    hay = _norm_query(
        "\n".join(
            str(item or "")
            for item in (
                summary.get("company_name"),
                summary.get("portrait"),
                summary.get("source_type"),
                summary.get("status"),
            )
        )
    )
    return needle in hay


# ---------- async DB 编排（全部租户过滤） ----------

async def _get_owned(
    db: AsyncSession, *, institution_id: uuid.UUID, deal_id: uuid.UUID
) -> Deal | None:
    return await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,  # 租户行级隔离
        )
    )


async def list_deals(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    status: str | None = None,
    in_library: bool | None = None,
    q: str | None = None,
    include_deleted: bool = False,
    limit: int | None = 100,
) -> list[dict]:
    """项目库列表：租户过滤，可按管线状态过滤；附公司名（一次性批量取，免 N+1）。"""
    stmt = select(Deal).where(Deal.institution_id == institution_id)
    if status is not None:
        stmt = stmt.where(Deal.status == status)
    elif not include_deleted:
        stmt = stmt.where(or_(Deal.status.is_(None), Deal.status != DealStatus.DELETED.value))
    stmt = stmt.order_by(Deal.created_at.desc())
    deals = (await db.execute(stmt)).scalars().all()

    if in_library is not None:
        deals = [
            d for d in deals
            if bool((d.data or {}).get("user_feedback", {}).get("is_in_library")) == in_library
        ]

    company_ids = {d.company_id for d in deals}
    companies: dict[uuid.UUID, Company] = {}
    if company_ids:
        rows = (
            await db.execute(
                select(Company).where(
                    Company.id.in_(company_ids),
                    Company.institution_id == institution_id,
                )
            )
        ).scalars().all()
        companies = {c.id: c for c in rows}
    summaries = [deal_summary(d, companies.get(d.company_id)) for d in deals]
    if q:
        summaries = [item for item in summaries if deal_matches_query(item, q)]
    return summaries if limit is None else summaries[:limit]


async def get_deal_detail(
    db: AsyncSession, *, institution_id: uuid.UUID, deal_id: uuid.UUID
) -> dict | None:
    """项目工作台详情：完整 deals.data + 关联 Company 客观信息。"""
    deal = await _get_owned(db, institution_id=institution_id, deal_id=deal_id)
    if deal is None or deal.status == DealStatus.DELETED.value:
        return None
    company = await db.scalar(
        select(Company).where(
            Company.id == deal.company_id,
            Company.institution_id == institution_id,
        )
    )
    profile = DealProfile.model_validate(deal.data or {})
    materials = await list_deal_materials(
        db,
        institution_id=institution_id,
        deal_id=deal.id,
    )
    material_hits = [
        hit
        for material in materials
        for hit in material.get("pre_dd_task_hits", [])
    ]
    return {
        "id": str(deal.id),
        "company_id": str(deal.company_id),
        "status": deal.status,
        "data": profile.model_dump(mode="json"),
        "pre_dd": build_pre_dd_workspace(profile, material_hits=material_hits),
        "materials": materials,
        "company": (
            {
                "id": str(company.id),
                "name": company.name,
                "uscc": company.uscc,
                "profile": company.profile,
            }
            if company is not None
            else None
        ),
        "created_at": deal.created_at.isoformat(),
        "updated_at": deal.updated_at.isoformat(),
    }


class DealNotFound(Exception):
    """目标 Deal 不存在或不属于当前租户。"""


class InvalidTransition(Exception):
    """非法的管线状态流转。"""


async def soft_delete_deal(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
) -> Deal:
    """软删除项目：隐藏出项目库，并保留审计事件与历史材料。"""
    deal = await _get_owned(db, institution_id=institution_id, deal_id=deal_id)
    if deal is None or deal.status == DealStatus.DELETED.value:
        raise DealNotFound(str(deal_id))
    previous_status = deal.status
    data = dict(deal.data or {})
    data["status"] = DealStatus.DELETED.value
    data["status_history"] = append_status_history(data, previous_status, DealStatus.DELETED.value)
    DealProfile.model_validate(data)
    deal.status = DealStatus.DELETED.value
    deal.data = data
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.deleted",
        subject_type="deal",
        subject_id=deal.id,
        payload={"from_status": previous_status, "to_status": DealStatus.DELETED.value},
    )
    await db.flush()
    return deal


async def transition_deal_status(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    to_status: str,
) -> Deal:
    """管线状态流转：守卫 → 改 deals.status 与 data.status → 记 `deal.{to_status}` 事件（约定 4）。"""
    deal = await _get_owned(db, institution_id=institution_id, deal_id=deal_id)
    if deal is None:
        raise DealNotFound(str(deal_id))
    if to_status not in {s.value for s in DealStatus}:
        raise InvalidTransition(f"未知状态: {to_status}")
    if not is_allowed_transition(deal.status, to_status):
        raise InvalidTransition(f"{deal.status} → {to_status} 不允许")

    from_status = deal.status
    deal.status = to_status
    data = dict(deal.data or {})
    data["status"] = to_status
    data["status_history"] = append_status_history(data, from_status, to_status)
    deal.data = DealProfile.model_validate(data).model_dump(mode="json")
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=f"deal.{to_status}",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "from_status": from_status,
            "to_status": to_status,
            "company_id": str(deal.company_id),
            "track": (data.get("extraction") or {}).get("track"),
        },
    )
    # 约定 4 强化：有明确偏好语义的流转（进 Pre-DD/上会/否决）落结构化 UserAction，
    # 保存当时画像快照供经验沉淀复盘（系统初筛推进/立项通过暂无对应类型，见映射表注释）。
    action_type = DEAL_TRANSITION_ACTIONS.get(to_status)
    if action_type is not None:
        await record_user_action(
            db,
            action_type=action_type,
            institution_id=institution_id,
            user_id=user_id,
            target_type="deal",
            target_id=deal.id,
            snapshot=snapshot_from_deal(data),
            extra_payload={"from_status": from_status, "to_status": to_status},
        )
    return deal


async def apply_deal_action(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    action: str,
    ctx: dict | None = None,
) -> Deal:
    """用户反馈动作：更新 data.user_feedback/workspace（经 DealProfile 强校验）+ 记 domain_event。"""
    if action not in USER_ACTIONS:
        raise InvalidTransition(f"未知动作: {action}")
    deal = await _get_owned(db, institution_id=institution_id, deal_id=deal_id)
    if deal is None:
        raise DealNotFound(str(deal_id))

    patched = apply_user_action(deal.data or {}, action, ctx)
    # 入库前强校验：补丁只动可选块，DealProfile 校验通过才落库（绝不落脏数据）
    deal.data = DealProfile.model_validate(patched).model_dump(mode="json")
    await db.flush()

    suffix, _ = USER_ACTIONS[action]
    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type=f"deal.{suffix}",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "action": action,
            "company_id": str(deal.company_id),
            **({"conversation_id": str(ctx["conversation_id"])} if ctx and ctx.get("conversation_id") else {}),
        },
    )
    # 约定 4 强化：用户反馈动作落结构化 UserAction（快照取动作后的 data，含 user_feedback）。
    action_type = DEAL_FEEDBACK_ACTIONS.get(action)
    if action_type is not None:
        conv_id = ctx.get("conversation_id") if ctx else None
        await record_user_action(
            db,
            action_type=action_type,
            institution_id=institution_id,
            user_id=user_id,
            target_type="deal",
            target_id=deal.id,
            snapshot=snapshot_from_deal(deal.data),
            context=ActionContext(
                source_page="project_workspace",
                source_conversation_id=str(conv_id) if conv_id else None,
            ),
        )
    return deal
