"""Pre-DD Brief 草稿生成。

MVP 版本不跑完整 Pre-DD Agent，也不调用 LLM；它把当前 DealProfile 与
`build_pre_dd_workspace` 的确定性任务树整理成 `DDReport` 交付对象草稿。
这样项目工作台可以先产出一份可复用、可审计的立项前简报，同时保留后续接入
材料库/RAG/公开数据交叉验证的空间。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Deliverable
from app.objects.base import Claim
from app.objects.base import DeliverableType
from app.objects.dd_report import ChecklistDimension, ChecklistItem, DDReport, DDSection, PreDDBrief
from app.objects.deal import DealProfile


DIMENSION_BY_TASK_KEY: dict[str, ChecklistDimension] = {
    "bp_product": ChecklistDimension.PRODUCT,
    "equity": ChecklistDimension.LEGAL,
    "organization": ChecklistDimension.TEAM,
    "business_model": ChecklistDimension.MARKET,
    "sales_model": ChecklistDimension.MARKET,
    "profit_model": ChecklistDimension.FINANCE,
    "financials": ChecklistDimension.FINANCE,
    "suppliers": ChecklistDimension.MARKET,
    "customers": ChecklistDimension.MARKET,
    "competitors": ChecklistDimension.COMPETITION,
    "market": ChecklistDimension.MARKET,
    "team": ChecklistDimension.TEAM,
    "financing": ChecklistDimension.FINANCE,
    "development": ChecklistDimension.MARKET,
}


def _clean(items: list[str], *, limit: int | None = None) -> list[str]:
    out = [item.strip() for item in items if item and item.strip()]
    return out if limit is None else out[:limit]


def _claim(text: str | None) -> Claim:
    return Claim(text=(text or "暂无可用信息，需补充材料后更新。").strip(), inferred=True)


def _material_evidence_ids(materials: list[dict[str, Any]]) -> list[uuid.UUID]:
    out: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for material in materials:
        raw = material.get("evidence_id")
        if not raw:
            continue
        try:
            evidence_id = uuid.UUID(str(raw))
        except (TypeError, ValueError):
            continue
        if evidence_id in seen:
            continue
        seen.add(evidence_id)
        out.append(evidence_id)
    return out


def _claim_list(claims: list[Claim], *, limit: int) -> list[Claim]:
    return [claim for claim in claims if claim.text.strip()][:limit]


def _item_dimension(item: dict[str, Any]) -> ChecklistDimension:
    key = str(item.get("key") or "")
    return DIMENSION_BY_TASK_KEY.get(key, ChecklistDimension.MARKET)


def _checklist_item(item: dict[str, Any]) -> ChecklistItem:
    status = str(item.get("status") or "")
    title = str(item.get("title") or "未命名资料项")
    provided = _clean(list(item.get("provided") or []), limit=3)
    missing = _clean(list(item.get("missing") or []), limit=3)
    material_rows = list(item.get("materials") or [])
    materials = [
        f"《{m.get('filename')}》{m.get('snippet')}"
        for m in material_rows
        if m.get("filename") and m.get("snippet")
    ][:3]
    evidence_ids = _material_evidence_ids(material_rows)
    gaps = _clean(list(item.get("gaps") or []), limit=3)
    questions = _clean(list(item.get("questions") or []), limit=3)

    answer_parts: list[str] = []
    if provided:
        answer_parts.append("已掌握：" + "；".join(provided))
    if missing:
        answer_parts.append("待补充：" + "、".join(missing))
    if materials:
        answer_parts.append("相关材料：" + "；".join(materials))
    if gaps:
        answer_parts.append("已识别缺口：" + "；".join(gaps))
    if questions:
        answer_parts.append("待验证：" + "；".join(questions))

    return ChecklistItem(
        dimension=_item_dimension(item),
        question=title,
        filled=status == "complete",
        answer=(
            Claim(text="；".join(answer_parts), evidence_ids=evidence_ids, inferred=not evidence_ids)
            if answer_parts
            else None
        ),
    )


def _completion_summary(pre_dd: dict[str, Any]) -> str:
    completion = pre_dd.get("completion") or {}
    score = int(completion.get("score") or 0)
    complete = int(completion.get("complete") or 0)
    partial = int(completion.get("partial") or 0)
    public_data_possible = int(completion.get("public_data_possible") or 0)
    missing = int(completion.get("missing") or 0)
    total = int(completion.get("total") or complete + partial + public_data_possible + missing)
    return (
        f"当前资料完整度 {score}%，共 {total} 项；"
        f"已提供 {complete} 项，部分提供 {partial} 项，"
        f"可公开补全 {public_data_possible} 项，未提供 {missing} 项。"
    )


def _overview(profile: DealProfile, company_name: str) -> Claim:
    extraction = profile.extraction
    parts = [profile.analysis.portrait]
    facts = [
        ("赛道", extraction.track),
        ("子方向", extraction.sub_direction),
        ("融资阶段", extraction.funding_stage),
        ("产品", extraction.product),
    ]
    fact_text = "；".join(f"{label}：{value}" for label, value in facts if value)
    if fact_text:
        parts.append(fact_text)
    return _claim(f"{company_name}：{'。'.join(part for part in parts if part)}")


def _fit_summary(profile: DealProfile) -> Claim:
    fit = profile.analysis.fit_score
    if fit is not None and fit.rationale:
        return _claim(f"当前机构匹配度 {round(fit.total)} / 100。{fit.rationale}")
    return _claim(f"当前机构匹配度 {round(profile.analysis.overall_fit)} / 100，需结合后续材料继续校准。")


def _fallback_next_step(score: int) -> Claim:
    if score >= 70:
        return _claim("资料基础较完整，可安排 Founder Call 并准备立项会前复核。")
    if score >= 40:
        return _claim("先补充关键缺口材料，再更新风险扫描和立项判断。")
    return _claim("优先补充 BP、团队、客户、财务和融资信息，再启动完整 Pre-DD。")


def build_pre_dd_brief_report(
    *,
    deal_id: uuid.UUID,
    company_name: str,
    profile: DealProfile,
    pre_dd: dict[str, Any],
) -> DDReport:
    """生成可直接经 SCHEMA_REGISTRY[DD_REPORT] 入库的 DDReport 草稿。"""
    completion = pre_dd.get("completion") or {}
    score = int(completion.get("score") or 0)
    highlights = _claim_list(profile.analysis.highlights, limit=5)
    risks = _claim_list(profile.analysis.initial_risks, limit=5)
    next_steps = _claim_list(profile.analysis.next_steps, limit=5) or [_fallback_next_step(score)]
    questions = _clean(list(pre_dd.get("priority_questions") or []), limit=8)

    brief = PreDDBrief(
        project_overview=_overview(profile, company_name),
        fit_summary=_fit_summary(profile),
        completion_score=score,
        completion_summary=_completion_summary(pre_dd),
        key_highlights=highlights,
        top_risks=risks,
        priority_questions=questions,
        recommended_next_steps=next_steps,
    )
    sections = [
        DDSection(title="项目概览", dimension=ChecklistDimension.PRODUCT, findings=[brief.project_overview]),
        DDSection(title="机构匹配度", dimension=ChecklistDimension.MARKET, findings=[brief.fit_summary]),
        DDSection(title="核心亮点", dimension=ChecklistDimension.MARKET, findings=highlights),
        DDSection(title="Top 风险", dimension=ChecklistDimension.LEGAL, findings=risks),
        DDSection(title="建议下一步", dimension=ChecklistDimension.TEAM, findings=next_steps),
    ]

    return DDReport(
        deal_id=deal_id,
        company_name=company_name,
        brief=brief,
        checklist=[_checklist_item(item) for item in pre_dd.get("items", [])],
        sections=[section for section in sections if section.findings],
        open_questions=questions,
    )


def project_pre_dd_brief(row: Deliverable, *, deal_id: uuid.UUID) -> dict | None:
    """把 dd_report 行投影为工作台 Brief 历史项；非目标项目或无 Brief 则跳过。"""
    try:
        report = DDReport.model_validate(row.payload or {})
    except Exception:
        return None
    if report.deal_id != deal_id or report.brief is None:
        return None
    return {
        "deliverable_id": str(row.id),
        "type": DeliverableType.DD_REPORT.value,
        "payload": report.model_dump(mode="json"),
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


async def list_pre_dd_briefs(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    limit: int = 10,
) -> list[dict]:
    """读取某项目最近生成的 Pre-DD Brief。

    当前 deliverables 表没有 `(type, payload.deal_id)` 的专用索引。MVP 阶段先按租户和
    类型取最近若干条再在 Python 中校验 payload，保持迁移零成本；后续 Brief 历史变多后
    再补 JSONB 表达式索引或单独的 deal_deliverables 关联表。
    """
    rows = (
        await db.execute(
            select(Deliverable)
            .where(
                Deliverable.institution_id == institution_id,
                Deliverable.type == DeliverableType.DD_REPORT.value,
            )
            .order_by(Deliverable.updated_at.desc(), Deliverable.created_at.desc())
            .limit(max(limit * 5, 25))
        )
    ).scalars().all()
    out: list[dict] = []
    for row in rows:
        item = project_pre_dd_brief(row, deal_id=deal_id)
        if item is not None:
            out.append(item)
        if len(out) >= limit:
            break
    return out
