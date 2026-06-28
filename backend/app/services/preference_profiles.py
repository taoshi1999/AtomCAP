"""用户自建命名投资偏好卡片（preference_profiles 表）读写服务。

多租户行级隔离：一律按 institution_id 过滤。与机构唯一生效偏好 Preference
（services/preferences.py）分离，互不影响 fit_score / 经验沉淀主链路。

写路径只入会话（add/flush），由 API 层 get_db（session.begin()）与 record_event
同事务原子落盘——创建 / 更新偏好卡片是用户操作，必须连带写 domain_events（约定 4）。
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DomainEvent, PreferenceProfileRow
from app.objects.preference_profile import PreferenceProfile


def _weighted_items(values: list[str], *, weight: float) -> list[dict]:
    return [{"name": value, "weight": weight, "confidence": 1.0} for value in values]


def _supplemental_notes_from_payload(payload: dict) -> list:
    notes = payload.get("supplemental_notes")
    if isinstance(notes, list):
        return notes
    legacy_note = payload.get("notes")
    return [legacy_note] if isinstance(legacy_note, str) and legacy_note.strip() else []


def profile_summary(row: PreferenceProfileRow) -> dict:
    """列表卡片投影（够渲染卡片即可，五维取值随卡片直接展示）。"""
    payload = row.payload or {}
    return {
        "id": str(row.id),
        "name": row.name,
        "sectors": payload.get("sectors", []),
        "anti_sectors": payload.get("anti_sectors", []),
        "stages": payload.get("stages", []),
        "anti_stages": payload.get("anti_stages", []),
        "regions": payload.get("regions", []),
        "anti_regions": payload.get("anti_regions", []),
        "risk_levels": payload.get("risk_levels", []),
        "anti_risk_levels": payload.get("anti_risk_levels", []),
        "check_sizes": payload.get("check_sizes", []),
        "anti_check_sizes": payload.get("anti_check_sizes", []),
        "custom_dimensions": payload.get("custom_dimensions", []),
        "supplemental_notes": _supplemental_notes_from_payload(payload),
        "notes": payload.get("notes"),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _norm_query(value: str | None) -> str:
    compact = "".join((value or "").split())
    return compact.replace("_", "").replace("-", "").replace("－", "").lower()


def profile_matches_query(row: PreferenceProfileRow, query: str | None) -> bool:
    needle = _norm_query(query)
    if not needle:
        return True
    payload = row.payload or {}
    custom_dimensions = payload.get("custom_dimensions")
    custom_text = ""
    if isinstance(custom_dimensions, list):
        custom_text = "\n".join(
            "\n".join(
                str(part or "")
                for part in (
                    item.get("label"),
                    *(item.get("values") or []),
                    *(item.get("anti_values") or []),
                )
            )
            for item in custom_dimensions
            if isinstance(item, dict)
        )
    hay = _norm_query(
        "\n".join(
            str(item or "")
            for item in (
                row.name,
                payload.get("name"),
                "\n".join(payload.get("sectors") or []),
                "\n".join(payload.get("anti_sectors") or []),
                "\n".join(payload.get("stages") or []),
                "\n".join(payload.get("anti_stages") or []),
                "\n".join(payload.get("regions") or []),
                "\n".join(payload.get("anti_regions") or []),
                "\n".join(payload.get("risk_levels") or []),
                "\n".join(payload.get("anti_risk_levels") or []),
                "\n".join(payload.get("check_sizes") or []),
                "\n".join(payload.get("anti_check_sizes") or []),
                "\n".join(_supplemental_notes_from_payload(payload)),
                payload.get("notes"),
                custom_text,
            )
        )
    )
    return needle in hay


def profile_detail(row: PreferenceProfileRow) -> dict:
    """详情投影（含完整 payload，经 PreferenceProfile 归一化）。"""
    return {
        "id": str(row.id),
        "name": row.name,
        "archived": bool(row.archived),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "profile": PreferenceProfile.model_validate(row.payload or {}).model_dump(mode="json"),
    }


def profile_event_payload(profile: PreferenceProfile) -> dict:
    """完整快照 + 常用摘要，供 domain_events 恢复历史版本。"""
    payload = profile.model_dump(mode="json")
    return {
        "profile": payload,
        "name": payload["name"],
        "sectors": payload.get("sectors", []),
        "anti_sectors": payload.get("anti_sectors", []),
        "stages": payload.get("stages", []),
        "anti_stages": payload.get("anti_stages", []),
        "regions": payload.get("regions", []),
        "anti_regions": payload.get("anti_regions", []),
        "risk_levels": payload.get("risk_levels", []),
        "anti_risk_levels": payload.get("anti_risk_levels", []),
        "check_sizes": payload.get("check_sizes", []),
        "anti_check_sizes": payload.get("anti_check_sizes", []),
        "custom_dimensions": payload.get("custom_dimensions", []),
        "supplemental_notes": payload.get("supplemental_notes", []),
        "notes": payload.get("notes"),
    }


def profile_from_event_payload(payload: dict) -> dict:
    """兼容旧事件：新事件优先用 profile 快照，旧事件用摘要字段恢复可展示版本。"""
    raw = payload.get("profile") if isinstance(payload.get("profile"), dict) else payload
    return PreferenceProfile.model_validate(raw or {}).model_dump(mode="json")


def profile_to_investment_preference(profile: PreferenceProfile) -> dict:
    """把命名偏好卡片应用为机构当前生效偏好（preferences.payload）。"""
    custom_dimensions = {
        item.label: item.values for item in profile.custom_dimensions if item.values
    }
    anti_custom_dimensions = {
        item.label: item.anti_values
        for item in profile.custom_dimensions
        if item.anti_values
    }
    disliked_deal_patterns = [
        *profile.anti_stages,
        *profile.anti_regions,
        *profile.anti_risk_levels,
        *profile.anti_check_sizes,
        *(
            f"{label}: {value}"
            for label, values in anti_custom_dimensions.items()
            for value in values
        ),
    ]
    return {
        "name": profile.name,
        "status": "active",
        "declared_strategy": {
            "focus_sectors": profile.sectors,
            "anti_focus_sectors": profile.anti_sectors,
            "focus_stages": profile.stages,
            "anti_focus_stages": profile.anti_stages,
            "focus_regions": profile.regions,
            "anti_focus_regions": profile.anti_regions,
            "anti_risk_levels": profile.anti_risk_levels,
            "anti_check_sizes": profile.anti_check_sizes,
            "custom_dimensions": custom_dimensions,
            "anti_custom_dimensions": anti_custom_dimensions,
            "supplemental_notes": profile.supplemental_notes,
            "description": "\n".join(profile.supplemental_notes) or profile.notes,
        },
        "learned_preference": {
            "sector_weights": _weighted_items(profile.sectors, weight=1.0),
            "stage_weights": _weighted_items(profile.stages, weight=1.0),
            "region_weights": _weighted_items(profile.regions, weight=1.0),
        },
        "anti_preference": {
            "disliked_sectors": profile.anti_sectors,
            "disliked_stages": profile.anti_stages,
            "disliked_regions": profile.anti_regions,
            "disliked_risk_levels": profile.anti_risk_levels,
            "disliked_check_sizes": profile.anti_check_sizes,
            "disliked_custom_dimensions": anti_custom_dimensions,
            "disliked_deal_patterns": disliked_deal_patterns,
        },
        "track_preferences": profile.sectors,
        "excluded_tracks": profile.anti_sectors,
        "stages": profile.stages,
        "geographies": profile.regions,
        "risk_appetite": " / ".join(profile.risk_levels) if profile.risk_levels else None,
        "check_size": " / ".join(profile.check_sizes) if profile.check_sizes else None,
        "supplemental_notes": profile.supplemental_notes,
        "notes": "\n".join(profile.supplemental_notes) or profile.notes,
    }


async def list_profile_versions(
    db: AsyncSession, *, institution_id: uuid.UUID, profile_id: uuid.UUID
) -> list[dict]:
    """从 domain_events 回放一张偏好卡片的历史版本（旧事件尽力恢复摘要）。"""
    rows = (
        await db.execute(
            select(DomainEvent)
            .where(
                DomainEvent.institution_id == institution_id,
                DomainEvent.subject_type == "preference_profile",
                DomainEvent.subject_id == profile_id,
                DomainEvent.event_type.in_(
                    (
                        "preference_profile.created",
                        "preference_profile.updated",
                        "preference_profile.applied",
                    )
                ),
            )
            .order_by(DomainEvent.occurred_at.asc(), DomainEvent.id.asc())
        )
    ).scalars().all()
    return [
        {
            "version": index + 1,
            "event_type": row.event_type,
            "occurred_at": row.occurred_at.isoformat() if row.occurred_at else None,
            "profile": profile_from_event_payload(row.payload or {}),
        }
        for index, row in enumerate(rows)
    ]


async def list_profiles(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    include_archived: bool = False,
    q: str | None = None,
) -> list[PreferenceProfileRow]:
    """机构下的偏好卡片列表，按最近更新倒序。默认不含已归档。"""
    stmt = select(PreferenceProfileRow).where(
        PreferenceProfileRow.institution_id == institution_id
    )
    if not include_archived:
        stmt = stmt.where(PreferenceProfileRow.archived.is_(False))
    stmt = stmt.order_by(PreferenceProfileRow.updated_at.desc())
    rows = list((await db.execute(stmt)).scalars().all())
    if q:
        rows = [row for row in rows if profile_matches_query(row, q)]
    return rows


async def get_profile(
    db: AsyncSession, *, institution_id: uuid.UUID, profile_id: uuid.UUID
) -> PreferenceProfileRow | None:
    """按 id + 租户取单张卡片（行级隔离：他机构 id 取不到）。"""
    return (
        await db.execute(
            select(PreferenceProfileRow).where(
                PreferenceProfileRow.id == profile_id,
                PreferenceProfileRow.institution_id == institution_id,
            )
        )
    ).scalars().first()


async def create_profile(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    created_by: uuid.UUID | None,
    profile: PreferenceProfile,
) -> PreferenceProfileRow:
    """新建一张偏好卡片（入会话 + flush，提交由调用方事务负责）。"""
    row = PreferenceProfileRow(
        institution_id=institution_id,
        created_by=created_by,
        name=profile.name,
        archived=False,
        payload=profile.model_dump(mode="json"),
    )
    db.add(row)
    await db.flush()
    return row


async def update_profile(
    db: AsyncSession, *, row: PreferenceProfileRow, profile: PreferenceProfile
) -> PreferenceProfileRow:
    """整体覆盖一张已有卡片的名称与五维内容（前端提交完整内容）。"""
    row.name = profile.name
    row.payload = profile.model_dump(mode="json")
    await db.flush()
    return row


async def archive_profile(db: AsyncSession, *, row: PreferenceProfileRow) -> PreferenceProfileRow:
    """软删除一张偏好卡片。"""
    row.archived = True
    await db.flush()
    return row
