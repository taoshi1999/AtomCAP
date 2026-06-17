"""UserAction 落库：约定 4「用户操作必须写 domain_events」的结构化强化形态。

设计依据 `agent_design/经验沉淀Agent.docx`：用户与系统对象的每次显式交互（关注/
不感兴趣/加入项目库/进入工作台/管线推进等）除写 domain_events 外，还落一条结构化
`UserAction`，**必须保存 target_snapshot**——记录操作发生当时对象的关键画像（赛道/
子赛道/阶段/地域/产业链位置/匹配度/风险），对象后续被更新也不丢复盘上下文。经验沉淀
Agent 每 5 分钟按 created_at 游标 + `scanned` 标志增量扫描这些行抽取 PreferenceSignal。

本模块只负责「把一次动作写成 UserActionRow」，由 deals / deliverables 动作端点在写
domain_event 的同一事务里调用，确保两者成对落盘。`action_strength` 的 polarity/weight
取自设计文档行为权重表（`objects.experience.ACTION_WEIGHTS`），是经验沉淀 Agent 的
原始打分依据；权重为 0（未在表中）时记 neutral。

注意：`user_actions.user_id` 是非空外键，开发回退（无登录用户）下 user_id 为 None，
此时跳过 UserAction（domain_event 仍照常写），避免落违反约束的脏行——见 record_user_action。
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import UserActionRow
from app.objects.experience import (
    ACTION_WEIGHTS,
    ActionContext,
    ActionStrength,
    ActionTarget,
    Polarity,
    TargetSnapshot,
    UserAction,
    UserActionType,
)

# ---------- 动作 → UserActionType 映射（仅映射有明确偏好语义的动作） ----------

# 项目工作台用户反馈动作（services.deals.apply_deal_action 的 action 键）。
DEAL_FEEDBACK_ACTIONS: dict[str, UserActionType] = {
    "add_to_library": UserActionType.JOIN_PROJECT_LIBRARY,
    "follow": UserActionType.MARK_DEAL_AS_INTERESTED,
    "dismiss": UserActionType.DISLIKE_DEAL,
    "abandon": UserActionType.ABANDON_DEAL,
    "create_workspace": UserActionType.CREATE_PROJECT_WORKSPACE,
}

# 管线状态流转 → UserActionType（仅取有明确偏好信号的目标态）。
# 说明：sourced→screening 是系统初筛推进、approved 是立项通过——前者无偏好信号、
# 后者在 UserActionType 枚举中暂无对应类型（domain_events 的 deal.approved 仍进经验沉淀
# 历史回放），故此二者不落 UserAction，待设计补充专用类型后再纳入。
DEAL_TRANSITION_ACTIONS: dict[str, UserActionType] = {
    "pre_dd": UserActionType.GENERATE_PRE_DD_BRIEF,   # 进入 Pre-DD：强正向意向 (+5)
    "ic_ready": UserActionType.PREPARE_IC,            # 准备上会：最强正向 (+6)
    "rejected": UserActionType.ABANDON_DEAL,          # 否决推进：负向 (-5)
}

# 赛道前瞻交付物（deliverable）动作（api.deliverables.trigger_action 的 action 键）。
THESIS_ACTIONS: dict[str, UserActionType] = {
    "follow_track": UserActionType.FOLLOW_THESIS,        # 关注赛道 (+2)
    "generate_deal_pool": UserActionType.GENERATE_PROJECT_POOL,  # 生成项目池 (+2)
}

# 中文标签（前端/复盘可读，写入 UserAction.action_label）。
ACTION_LABELS: dict[UserActionType, str] = {
    UserActionType.JOIN_PROJECT_LIBRARY: "加入项目库",
    UserActionType.MARK_DEAL_AS_INTERESTED: "关注项目",
    UserActionType.DISLIKE_DEAL: "不感兴趣",
    UserActionType.ABANDON_DEAL: "放弃项目",
    UserActionType.CREATE_PROJECT_WORKSPACE: "创建项目工作台",
    UserActionType.GENERATE_PRE_DD_BRIEF: "进入 Pre-DD",
    UserActionType.PREPARE_IC: "准备上会",
    UserActionType.FOLLOW_THESIS: "关注赛道",
    UserActionType.GENERATE_PROJECT_POOL: "生成项目池",
    UserActionType.ACCEPT_PREFERENCE_ADVICE: "采纳偏好建议",
    UserActionType.REJECT_PREFERENCE_ADVICE: "拒绝偏好建议",
}


# ---------- 纯函数：行为强度与快照（无 DB，便于单测） ----------

def action_strength(action_type: UserActionType) -> ActionStrength:
    """据设计文档行为权重表出 polarity/weight；显式 UI 点击 confidence 记 1.0。"""
    weight = ACTION_WEIGHTS.get(action_type, 0)
    if weight > 0:
        polarity = Polarity.POSITIVE
    elif weight < 0:
        polarity = Polarity.NEGATIVE
    else:
        polarity = Polarity.NEUTRAL
    return ActionStrength(polarity=polarity, weight=weight, confidence=1.0)


def snapshot_from_deal(data: dict | None) -> TargetSnapshot:
    """从 deals.data（DealProfile）抽取操作当时的对象画像快照。

    赛道优先取材料抽取的 track，缺失回退分析的 track_judgement；匹配度取 analysis
    的 overall_fit（fit_score 缺失时的中性总分）。region/产业链位置当前 Deal schema
    未单列，留空——快照是尽力而为，缺字段不臆造。
    """
    data = data or {}
    extraction = data.get("extraction") or {}
    analysis = data.get("analysis") or {}
    fit = analysis.get("overall_fit")
    return TargetSnapshot(
        sector=extraction.get("track") or analysis.get("track_judgement"),
        sub_sector=extraction.get("sub_direction"),
        stage=extraction.get("funding_stage"),
        region=extraction.get("region"),
        industry_chain_position=extraction.get("industry_chain_position"),
        fit_score=float(fit) if isinstance(fit, (int, float)) else None,
        risk_level=None,
    )


def snapshot_from_thesis(payload: dict | None) -> TargetSnapshot:
    """从 thesis deliverable payload 抽取快照（赛道名为主，余字段尽力而为）。"""
    payload = payload or {}
    return TargetSnapshot(
        sector=payload.get("thesis_name") or payload.get("track"),
        sub_sector=payload.get("sub_sector"),
        industry_chain_position=payload.get("industry_chain_position"),
    )


def build_user_action(
    *,
    action_type: UserActionType,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    target_name: str | None = None,
    snapshot: TargetSnapshot | None = None,
    context: ActionContext | None = None,
    extra_payload: dict | None = None,
) -> UserAction:
    """组装 UserAction（pydantic 对象，未触库），强度按权重表派生。"""
    return UserAction(
        institution_id=str(institution_id),
        user_id=str(user_id),
        action_type=action_type,
        action_label=ACTION_LABELS.get(action_type),
        target=ActionTarget(
            target_type=target_type,
            target_id=str(target_id),
            target_name=target_name,
        ),
        context=context or ActionContext(),
        target_snapshot=snapshot or TargetSnapshot(),
        action_strength=action_strength(action_type),
        extra_payload=extra_payload or {},
    )


# ---------- 落库 ----------

async def record_user_action(
    db: AsyncSession,
    *,
    action_type: UserActionType,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    target_type: str,
    target_id: uuid.UUID,
    target_name: str | None = None,
    snapshot: TargetSnapshot | None = None,
    context: ActionContext | None = None,
    extra_payload: dict | None = None,
) -> UserActionRow | None:
    """落一条 UserActionRow（payload 存完整 UserAction，去规范化列供增量扫描/聚合）。

    user_id 为空（开发回退，无登录用户）时返回 None 不落库——user_actions.user_id 非空
    外键，写入会违反约束；此时 domain_event 仍由调用方照常记录，不影响约定 4 主链路。
    """
    if user_id is None:
        return None

    ua = build_user_action(
        action_type=action_type,
        institution_id=institution_id,
        user_id=user_id,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        snapshot=snapshot,
        context=context,
        extra_payload=extra_payload,
    )
    row = UserActionRow(
        institution_id=institution_id,
        user_id=user_id,
        action_type=ua.action_type.value,
        target_type=target_type,
        target_id=target_id,
        polarity=ua.action_strength.polarity.value,
        weight=ua.action_strength.weight,
        confidence=ua.action_strength.confidence,
        scanned=False,
        payload=ua.model_dump(mode="json"),
    )
    db.add(row)
    await db.flush()
    return row
