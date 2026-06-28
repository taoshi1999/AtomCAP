"""机构投资偏好读写服务（preferences 表，版本化）。

读：fit_score 与前端展示的输入。同机构可能多行（历史版本），取 is_active=True
中 version 最大的一行；payload 经 InvestmentPreference 校验——读路径脏数据降级为
空偏好并告警，不让 Agent 执行崩掉。

写：用户直接维护机构偏好（经验沉淀 Agent 的 diff 建议 Phase 4 复用本写路径）。
每次写入分配新版本号、旧 active 行置否（保留历史可审计），写路径校验失败直接抛错
——脏输入要反馈给用户，不能像读路径那样静默降级。
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Preference
from app.objects.preference import InvestmentPreference

logger = logging.getLogger(__name__)


def _string_list(value: Any) -> list[str]:
    """宽松提取字符串列表，供 Agent 上下文摘要使用。"""
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _join(items: list[str], *, limit: int = 8) -> str:
    normalized = _unique(items)
    if not normalized:
        return ""
    suffix = " 等" if len(normalized) > limit else ""
    return "、".join(normalized[:limit]) + suffix


def _join_notes(items: list[str], *, limit: int = 6) -> str:
    normalized = _unique(items)
    if not normalized:
        return ""
    suffix = " 等" if len(normalized) > limit else ""
    return "；".join(normalized[:limit]) + suffix


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else ""


def describe_for_agent(preference: dict[str, Any] | None) -> str:
    """把当前 active 投资偏好压缩成可注入 LLM/Agent 的文本上下文。

    该函数只做展示层归一化，不改变 preferences.payload。所有需要偏好语境的
    Agent 都应以 get_active()/get_active_row() 的结果为准，再用本函数生成
    prompt 上下文，避免读到未应用的命名偏好卡片或前端临时状态。
    """
    preference = preference or {}
    if not preference:
        return "当前应用的投资偏好：未配置。"

    declared = preference.get("declared_strategy")
    declared = declared if isinstance(declared, dict) else {}
    lines = ["当前应用的投资偏好："]

    name = _text(preference.get("name"))
    if name:
        lines.append(f"- 名称：{name}")

    version = preference.get("version")
    if isinstance(version, int):
        lines.append(f"- 版本：v{version}")

    sectors = _join(
        _string_list(declared.get("focus_sectors"))
        + _string_list(preference.get("track_preferences"))
    )
    if sectors:
        lines.append(f"- 关注赛道：{sectors}")

    anti = preference.get("anti_preference")
    anti = anti if isinstance(anti, dict) else {}
    anti_sectors = _join(
        _string_list(declared.get("anti_focus_sectors"))
        + _string_list(anti.get("disliked_sectors"))
        + _string_list(preference.get("excluded_tracks"))
    )
    if anti_sectors:
        lines.append(f"- 反偏好赛道：{anti_sectors}")

    stages = _join(
        _string_list(declared.get("focus_stages"))
        + _string_list(preference.get("stages"))
    )
    if stages:
        lines.append(f"- 投资阶段：{stages}")

    anti_stages = _join(
        _string_list(declared.get("anti_focus_stages"))
        + _string_list(anti.get("disliked_stages"))
    )
    if anti_stages:
        lines.append(f"- 反偏好阶段：{anti_stages}")

    regions = _join(
        _string_list(declared.get("focus_regions"))
        + _string_list(preference.get("geographies"))
    )
    if regions:
        lines.append(f"- 地域偏好：{regions}")

    anti_regions = _join(
        _string_list(declared.get("anti_focus_regions"))
        + _string_list(anti.get("disliked_regions"))
    )
    if anti_regions:
        lines.append(f"- 反偏好地域：{anti_regions}")

    risk_appetite = _text(preference.get("risk_appetite"))
    if risk_appetite:
        lines.append(f"- 风险偏好：{risk_appetite}")

    check_size = _text(preference.get("check_size"))
    if check_size:
        lines.append(f"- 单笔规模：{check_size}")

    anti_risk_levels = _join(
        _string_list(declared.get("anti_risk_levels"))
        + _string_list(anti.get("disliked_risk_levels"))
    )
    if anti_risk_levels:
        lines.append(f"- 反偏好风险特征：{anti_risk_levels}")

    anti_check_sizes = _join(
        _string_list(declared.get("anti_check_sizes"))
        + _string_list(anti.get("disliked_check_sizes"))
    )
    if anti_check_sizes:
        lines.append(f"- 反偏好单笔规模：{anti_check_sizes}")

    custom_dimensions = declared.get("custom_dimensions")
    if isinstance(custom_dimensions, dict):
        for label, values in custom_dimensions.items():
            label_text = _text(label)
            value_text = _join(_string_list(values))
            if label_text and value_text:
                lines.append(f"- {label_text}：{value_text}")

    anti_custom_dimensions = declared.get("anti_custom_dimensions")
    if isinstance(anti_custom_dimensions, dict):
        for label, values in anti_custom_dimensions.items():
            label_text = _text(label)
            value_text = _join(_string_list(values))
            if label_text and value_text:
                lines.append(f"- 反偏好{label_text}：{value_text}")

    supplemental_notes = _join_notes(
        _string_list(declared.get("supplemental_notes"))
        + _string_list(preference.get("supplemental_notes"))
    )
    if supplemental_notes:
        lines.append(f"- 补充说明：{supplemental_notes}")

    notes = ""
    if not supplemental_notes:
        notes = _text(preference.get("notes")) or _text(declared.get("description"))
    if notes:
        lines.append(f"- 补充说明：{notes}")

    if len(lines) == 1:
        lines.append("- 已配置，但未填写具体维度。")
    return "\n".join(lines)


async def get_active_row(
    db: AsyncSession, *, institution_id: uuid.UUID
) -> Preference | None:
    """机构当前生效的偏好行（is_active 且 version 最大），无则 None。"""
    return (
        await db.execute(
            select(Preference)
            .where(
                Preference.institution_id == institution_id,
                Preference.is_active.is_(True),
            )
            .order_by(Preference.version.desc())
            .limit(1)
        )
    ).scalars().first()


def validate_payload(row: Preference) -> dict:
    """校验并归一化一行偏好的 payload（InvestmentPreference 形状的 dict）。

    脏数据（历史 schema 漂移）降级为空偏好并告警——与 get_active 同语义，
    供 GET 端点拿到行后复用，避免重复查询。
    """
    try:
        return InvestmentPreference.model_validate(row.payload or {}).model_dump(mode="json")
    except ValidationError:
        logger.warning("preferences 行校验失败，按空偏好处理 id=%s", row.id)
        return {}


async def get_active(db: AsyncSession, *, institution_id: uuid.UUID) -> dict:
    """返回机构当前生效的投资偏好（InvestmentPreference 形状的 dict）。

    无记录返回 {}（fit_score 对空偏好有明确的 50 分回退语义）。
    """
    row = await get_active_row(db, institution_id=institution_id)
    return validate_payload(row) if row is not None else {}


async def set_active_preference(
    db: AsyncSession, *, institution_id: uuid.UUID, payload: dict
) -> Preference:
    """覆盖机构投资偏好：分配新版本号 → 旧 active 行置否 → 写入新 active 行。

    入参经 InvestmentPreference 校验，**校验失败直接抛错**（写路径不静默降级，
    脏输入要反馈给用户）。版本号由服务层分配（机构现有最大 version + 1，含已停用
    历史版本），忽略入参里的 version——避免前端回传旧版本号造成回退。旧版本行保留
    （is_active=False），偏好演进可审计、可回溯。

    仅入会话（add/flush），不在此提交：由调用方（get_db 依赖的 session.begin()）
    与记账 record_event 同事务原子落盘。
    """
    validated = InvestmentPreference.model_validate(payload)  # 不吞校验异常

    max_version = (
        await db.execute(
            select(func.max(Preference.version)).where(
                Preference.institution_id == institution_id
            )
        )
    ).scalar()
    validated.version = (max_version or 0) + 1

    # 旧 active 行批量置否（保留历史，仅切换"当前生效"指针）
    await db.execute(
        update(Preference)
        .where(
            Preference.institution_id == institution_id,
            Preference.is_active.is_(True),
        )
        .values(is_active=False)
    )

    row = Preference(
        institution_id=institution_id,
        version=validated.version,
        payload=validated.model_dump(mode="json"),
        is_active=True,
    )
    db.add(row)
    await db.flush()
    return row
