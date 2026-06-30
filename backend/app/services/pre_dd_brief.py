"""Pre-DD Report 草稿生成。

MVP 版本不跑完整 Pre-DD Agent，也不调用 LLM；它把当前 DealProfile 与
`build_pre_dd_workspace` 的确定性任务树整理成 `DDReport` 交付对象草稿。
这样项目工作台可以先产出一份可复用、可审计的立项前报告，同时保留后续接入
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
from app.objects.dd_report import (
    ChecklistDimension,
    ChecklistItem,
    DDReport,
    DDSection,
    PreDDMeetingQuestion,
    PreDDProjectOverview,
    PreDDReport,
)
from app.objects.deal import DealProfile
from app.services.file_generation import (
    FilePlan,
    FileSection,
    FileTable,
    create_generated_file_from_plan,
)


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


def _claim(text: str | None, evidence_ids: list[uuid.UUID] | None = None) -> Claim:
    ids = evidence_ids or []
    return Claim(
        text=(text or "暂无可用信息，需补充材料后更新。").strip(),
        evidence_ids=ids,
        inferred=not ids,
    )


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


def _item_evidence_ids(item: dict[str, Any]) -> list[uuid.UUID]:
    return _material_evidence_ids(list(item.get("materials") or []))


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


def _overview_claim(label: str, value: str | None) -> Claim:
    return _claim(f"{label}：{value.strip()}" if value and value.strip() else f"{label}：待在会议中确认")


def _project_overview(profile: DealProfile) -> PreDDProjectOverview:
    extraction = profile.extraction
    summary = profile.workspace.summary
    return PreDDProjectOverview(
        founded_at=_overview_claim("成立时间", summary.founded_at or extraction.founded_at),
        region=_overview_claim("地域", summary.region or extraction.region),
        main_business=_overview_claim(
            "主营业务",
            summary.main_business
            or extraction.main_business
            or extraction.business_model
            or extraction.product
            or profile.analysis.portrait,
        ),
        valuation=_overview_claim("估值", summary.valuation or extraction.valuation),
    )


def _fit_summary(profile: DealProfile) -> Claim:
    fit = profile.analysis.fit_score
    if fit is not None and fit.rationale:
        return _claim(f"当前机构匹配度 {round(fit.total)} / 100。{fit.rationale}")
    return _claim(f"当前机构匹配度 {round(profile.analysis.overall_fit)} / 100，需结合后续材料继续校准。")


def _explicit_claims(claims: list[Claim], *, limit: int) -> list[Claim]:
    return [
        Claim(text=claim.text, evidence_ids=list(claim.evidence_ids), inferred=claim.inferred)
        for claim in _claim_list(claims, limit=limit)
        if not _is_material_insufficiency_claim(claim.text)
    ]


def _is_material_insufficiency_claim(text: str) -> bool:
    normalized = "".join((text or "").split())
    if not normalized:
        return True
    placeholders = (
        "资料不足",
        "材料不足",
        "资料仍不充分",
        "材料仍不充分",
        "资料不充分",
        "材料不充分",
        "补充材料",
        "补齐材料",
        "进一步补充",
        "手动创建项目",
        "暂无可用信息",
        "暂无法判断",
        "无法判断",
        "信息不足",
        "信息缺口",
    )
    return any(token in normalized for token in placeholders)


def _value_points(profile: DealProfile, pre_dd: dict[str, Any]) -> list[Claim]:
    del pre_dd
    values = _explicit_claims(profile.analysis.highlights, limit=5)
    if not values:
        values.append(_claim("资料不足，暂无法判断"))
    return values[:5]


def _risk_points(profile: DealProfile, pre_dd: dict[str, Any]) -> list[Claim]:
    del pre_dd
    risks = _explicit_claims(profile.analysis.initial_risks, limit=5)
    if not risks:
        risks.append(_claim("资料不足，暂无法判断"))
    return risks[:5]


def _make_meeting_question(question: str, purpose: str) -> PreDDMeetingQuestion:
    return PreDDMeetingQuestion(
        question=" ".join(question.split()),
        purpose=" ".join(purpose.split()),
    )


def _default_question_for_task(title: str, key: str) -> str:
    templates = {
        "bp_product": "您能否提供最新版 BP、产品介绍或业务宣传材料，并重点说明当前产品的核心卖点和落地进展？",
        "equity": "您能否提供详细的股权分配明细、股东名册以及历次股权变动记录？",
        "organization": "您能否介绍当前组织架构、核心部门职责分工以及关键负责人背景？",
        "business_model": "您觉得公司的业务模式有哪些差异化和亮点，近几年是否发生过重要调整？",
        "sales_model": "您能否说明公司的获客方式、销售团队配置、获客成本和主要客户转化路径？",
        "profit_model": "您能否拆解公司的收入来源、毛利结构、成本费用构成以及当前盈利改善路径？",
        "financials": "您能否提供最近三年一期的财务报表、审计报告、纳税报表及关键经营指标？",
        "suppliers": "您能否介绍主要上游供应商、采购占比、付款条件以及供应稳定性情况？",
        "customers": "您能否介绍前五大客户构成、收入占比、合作年限以及续约或复购情况？",
        "competitors": "您认为当前主要竞争对手是谁，公司相较它们的差异化优势和短板分别是什么？",
        "market": "您如何判断当前市场规模、增长速度和未来三到五年的核心驱动因素？",
        "team": "您能否提供核心管理团队简历、关键员工花名册，并说明团队在行业中的经验优势？",
        "financing": "您能否说明历史融资情况、本轮投前估值、融资金额、出让比例及资金用途？",
        "development": "您能否介绍公司未来 12 到 24 个月的发展方向、里程碑目标和对外合作诉求？",
    }
    return templates.get(key, f"您能否围绕「{title}」补充最新材料，并说明其中最影响投资判断的关键信息？")


def _purpose_for_task(title: str, key: str, context: list[str]) -> str:
    purposes = {
        "bp_product": "该问题预期收集公司产品、业务和商业化进展的基础材料，帮助判断项目定位、产品成熟度和后续尽调重点。",
        "equity": "该问题预期收集股东名单、持股比例和历史变动信息，有助于判断控制权结构、利益绑定和潜在法律风险。",
        "organization": "该问题预期收集组织架构和核心人员分工，有助于判断公司运营能力、管理半径和关键岗位完整性。",
        "business_model": "该问题预期收集业务结构、交易链路和差异化逻辑，有助于判断商业模式是否清晰、可复制和具备竞争优势。",
        "sales_model": "该问题预期收集获客、销售和客户转化信息，有助于判断增长质量、销售效率和客户可持续性。",
        "profit_model": "该问题预期收集收入、毛利、成本和费用结构，有助于判断盈利模式成熟度和未来利润释放空间。",
        "financials": "该问题预期收集财务报表和关键经营指标，有助于验证收入质量、现金流状况和经营真实性。",
        "suppliers": "该问题预期收集供应商和采购信息，有助于判断供应链稳定性、议价能力和上游集中风险。",
        "customers": "该问题预期收集客户构成和合作稳定性，有助于判断需求真实性、收入集中度和客户粘性。",
        "competitors": "该问题预期收集竞争格局和公司差异化，有助于判断护城河、替代风险和市场位置。",
        "market": "该问题预期收集市场规模和增长判断，有助于验证赛道空间、成长性和估值支撑。",
        "team": "该问题预期收集团队履历和员工结构，有助于判断创始团队能力、组织韧性和关键人才密度。",
        "financing": "该问题预期收集融资与估值信息，有助于判断定价合理性、资金使用效率和下一轮融资压力。",
        "development": "该问题预期收集未来规划和合作诉求，有助于判断公司战略清晰度、执行路径和投资后赋能空间。",
    }
    base = purposes.get(key, f"该问题预期补齐「{title}」相关资料，有助于完善 Pre-DD 判断并形成后续尽调清单。")
    if context:
        return f"{base} 当前已识别背景：{'；'.join(context[:3])}。"
    return base


def _meeting_questions(profile: DealProfile, pre_dd: dict[str, Any]) -> list[PreDDMeetingQuestion]:
    questions: list[PreDDMeetingQuestion] = []
    seen: set[str] = set()

    def add(question: str, purpose: str) -> None:
        text = " ".join(question.split())
        if text and text not in seen:
            seen.add(text)
            questions.append(_make_meeting_question(text, purpose))

    for question in _clean(list(profile.analysis.open_questions), limit=8):
        add(
            question,
            "该问题来自系统已识别的历史待验证事项，预期在会议中直接获得管理层解释或后续材料承诺，以便更新项目风险和投资判断。",
        )

    for item in pre_dd.get("items", []):
        key = str(item.get("key") or "")
        title = str(item.get("title") or "资料项")
        status = str(item.get("status") or "")
        collection_status = str(item.get("collection_status") or "")
        if status == "complete" and collection_status == "collected":
            continue
        intro = str(item.get("intro") or "")
        missing = _clean(list(item.get("missing") or []), limit=3)
        gaps = _clean(list(item.get("gaps") or []), limit=3)
        provided = _clean(list(item.get("provided") or []), limit=2)
        suggestions = [
            suggestion
            for suggestion in _clean(list(item.get("suggestions") or []), limit=3)
            if suggestion != "材料收集完成"
        ]
        item_questions = _clean(list(item.get("questions") or []), limit=3)
        material_names = _clean(
            [str(material.get("filename") or "") for material in item.get("materials", [])],
            limit=3,
        )
        context: list[str] = []
        if intro:
            context.append(f"目标材料：{intro}")
        if provided:
            context.append(f"已掌握：{'、'.join(provided)}")
        if material_names:
            context.append(f"已有材料：{'、'.join(material_names)}")
        if missing:
            context.append(f"缺失内容：{'、'.join(missing)}")
        if gaps:
            context.append(f"待核实缺口：{'、'.join(gaps)}")
        if suggestions:
            context.append(f"建议补充：{'、'.join(suggestions)}")
        add(
            _default_question_for_task(title, key),
            _purpose_for_task(title, key, context),
        )
        for question in item_questions:
            add(
                question,
                f"该问题用于进一步核实「{title}」维度中的具体缺口，预期帮助投资团队补齐材料并减少会后反复沟通。",
            )

    if not questions:
        add(
            "请管理层确认当前 14 项 Pre-DD 材料是否均有最新版本，并说明是否存在尚未披露的重大变化。",
            "该问题用于在会议中一次性校准资料完整性，预期帮助投资团队确认是否可以进入下一阶段尽调或仍需补充关键材料。",
        )
    return questions[:32]


def build_pre_dd_report(
    *,
    deal_id: uuid.UUID,
    company_name: str,
    profile: DealProfile,
    pre_dd: dict[str, Any],
) -> DDReport:
    """生成可直接经 SCHEMA_REGISTRY[DD_REPORT] 入库的 Pre-DD Report 草稿。"""
    completion = pre_dd.get("completion") or {}
    score = int(completion.get("score") or 0)
    value_points = _value_points(profile, pre_dd)
    risk_points = _risk_points(profile, pre_dd)
    meeting_questions = _meeting_questions(profile, pre_dd)

    report = PreDDReport(
        project_overview=_project_overview(profile),
        fit_summary=_fit_summary(profile),
        completion_score=score,
        completion_summary=_completion_summary(pre_dd),
        value_points=value_points,
        risk_points=risk_points,
        meeting_questions=meeting_questions,
    )
    sections = [
        DDSection(
            title="项目概览",
            dimension=ChecklistDimension.PRODUCT,
            findings=[
                report.project_overview.founded_at,
                report.project_overview.region,
                report.project_overview.main_business,
                report.project_overview.valuation,
            ],
        ),
        DDSection(title="机构匹配度", dimension=ChecklistDimension.MARKET, findings=[report.fit_summary]),
        DDSection(title="价值点", dimension=ChecklistDimension.MARKET, findings=value_points),
        DDSection(title="风险点", dimension=ChecklistDimension.LEGAL, findings=risk_points),
    ]

    return DDReport(
        deal_id=deal_id,
        company_name=company_name,
        report=report,
        checklist=[_checklist_item(item) for item in pre_dd.get("items", [])],
        sections=[section for section in sections if section.findings],
        open_questions=[item.question for item in meeting_questions],
    )


def build_pre_dd_brief_report(**kwargs: Any) -> DDReport:
    """Backward-compatible alias for callers not yet renamed."""
    return build_pre_dd_report(**kwargs)


class PreDDReportExportError(RuntimeError):
    """Raised when a Pre-DD Report cannot be exported."""


class PreDDReportNotFound(PreDDReportExportError):
    """Raised when the target Pre-DD Report version is missing or mismatched."""


def _claim_text(claim: Claim | None) -> str:
    text = (claim.text if claim else "").strip()
    return text or "资料不足，暂无法判断"


def _claim_export_bullets(claims: list[Claim], *, fallback: str) -> list[str]:
    bullets: list[str] = []
    for claim in claims:
        evidence_count = len(claim.evidence_ids)
        suffix = f"（{evidence_count} 条证据）" if evidence_count else "（模型判断，暂无证据）"
        bullets.append(f"{_claim_text(claim)}{suffix}")
    return bullets or [fallback]


def _overview_export_rows(report: PreDDReport) -> list[list[str]]:
    return [
        ["成立时间", _claim_text(report.project_overview.founded_at)],
        ["地域", _claim_text(report.project_overview.region)],
        ["主营业务", _claim_text(report.project_overview.main_business)],
        ["估值", _claim_text(report.project_overview.valuation)],
    ]


def _claim_export_rows(title: str, claims: list[Claim]) -> list[list[str]]:
    rows: list[list[str]] = []
    for index, claim in enumerate(claims, start=1):
        rows.append(
            [
                f"{title} {index}",
                _claim_text(claim),
                str(len(claim.evidence_ids)),
                "是" if claim.inferred else "否",
            ]
        )
    return rows


def _checklist_export_rows(checklist: list[ChecklistItem]) -> list[list[str]]:
    rows: list[list[str]] = []
    for item in checklist:
        rows.append(
            [
                item.dimension.value,
                item.question,
                "已收集" if item.filled else "待收集",
                _claim_text(item.answer),
            ]
        )
    return rows


def _report_to_file_plan(report: DDReport) -> FilePlan:
    if report.report is None:
        raise PreDDReportExportError("Pre-DD Report 内容为空，无法导出。")
    pre_dd = report.report
    question_rows = [[item.question, item.purpose] for item in pre_dd.meeting_questions]
    return FilePlan(
        title=f"{report.company_name} Pre-DD Report",
        subtitle="AtomCAP 自动生成 Pre-DD Report",
        sections=[
            FileSection(
                heading="项目概览",
                summary="项目基础信息来自工作台资料和公开信息抽取，用户可在工作台继续修正。",
                bullets=[f"{label}：{value}" for label, value in _overview_export_rows(pre_dd)],
            ),
            FileSection(
                heading="机构匹配度与资料状态",
                summary=_claim_text(pre_dd.fit_summary),
                bullets=[
                    f"资料完整度：{pre_dd.completion_score}%",
                    pre_dd.completion_summary,
                ],
            ),
            FileSection(
                heading="价值点",
                summary="支撑项目成立、值得继续投入研究的关键判断。",
                bullets=_claim_export_bullets(pre_dd.value_points, fallback="资料不足，暂无法判断"),
            ),
            FileSection(
                heading="风险点",
                summary="反对投资或需要重点验证的关键判断。",
                bullets=_claim_export_bullets(pre_dd.risk_points, fallback="资料不足，暂无法判断"),
            ),
            FileSection(
                heading="推荐会议问题列表",
                summary="以下问题用于在一场会议中尽可能补齐缺失的 Pre-DD 材料。",
                bullets=[
                    f"提问方式：{item.question}\n预期目的：{item.purpose}"
                    for item in pre_dd.meeting_questions
                ]
                or ["暂无推荐会议问题。"],
            ),
        ],
        tables=[
            FileTable(
                title="项目概览",
                headers=["维度", "内容"],
                rows=_overview_export_rows(pre_dd),
            ),
            FileTable(
                title="价值点与风险点",
                headers=["类型", "判断", "证据数量", "是否模型推断"],
                rows=_claim_export_rows("价值点", pre_dd.value_points)
                + _claim_export_rows("风险点", pre_dd.risk_points),
            ),
            FileTable(
                title="推荐会议问题列表",
                headers=["提问方式", "预期目的"],
                rows=question_rows,
            ),
            FileTable(
                title="Pre-DD 资料清单",
                headers=["维度", "资料项", "状态", "当前结论"],
                rows=_checklist_export_rows(report.checklist),
            ),
        ],
    )


async def export_pre_dd_report_docx(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
) -> dict:
    row = await db.scalar(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.institution_id == institution_id,
            Deliverable.type == DeliverableType.DD_REPORT.value,
        )
    )
    if row is None:
        raise PreDDReportNotFound("Pre-DD Report 不存在。")
    report = DDReport.model_validate(row.payload or {})
    if report.deal_id != deal_id or report.report is None:
        raise PreDDReportNotFound("Pre-DD Report 不属于当前项目。")
    generated = create_generated_file_from_plan(
        institution_id=institution_id,
        plan=_report_to_file_plan(report),
        target_format="docx",
    )
    return {"report": report.model_dump(mode="json"), "file": generated.to_ref()}


def project_pre_dd_report(row: Deliverable, *, deal_id: uuid.UUID) -> dict | None:
    """把 dd_report 行投影为工作台 Report 历史项；非目标项目或无 Report 则跳过。"""
    try:
        report = DDReport.model_validate(row.payload or {})
    except Exception:
        return None
    if report.deal_id != deal_id or report.report is None:
        return None
    return {
        "deliverable_id": str(row.id),
        "type": DeliverableType.DD_REPORT.value,
        "payload": report.model_dump(mode="json"),
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def project_pre_dd_brief(row: Deliverable, *, deal_id: uuid.UUID) -> dict | None:
    """Backward-compatible alias for callers not yet renamed."""
    return project_pre_dd_report(row, deal_id=deal_id)


async def list_pre_dd_reports(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    limit: int = 10,
) -> list[dict]:
    """读取某项目最近生成的 Pre-DD Report。

    当前 deliverables 表没有 `(type, payload.deal_id)` 的专用索引。MVP 阶段先按租户和
    类型取最近若干条再在 Python 中校验 payload，保持迁移零成本；后续 Report 历史变多后
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
        item = project_pre_dd_report(row, deal_id=deal_id)
        if item is not None:
            out.append(item)
        if len(out) >= limit:
            break
    return out


async def list_pre_dd_briefs(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    limit: int = 10,
) -> list[dict]:
    """Backward-compatible alias for callers not yet renamed."""
    return await list_pre_dd_reports(
        db,
        institution_id=institution_id,
        deal_id=deal_id,
        limit=limit,
    )
