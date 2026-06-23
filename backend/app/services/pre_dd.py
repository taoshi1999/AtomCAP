"""Pre-DD 工作台只读视图生成。

本模块把 Deal Intake 阶段已有的 DealProfile 转成 Pre-DD 工作台的最小任务树：
14 类材料项、完整度、待验证问题与初步风险队列。它不调用 LLM、不写库，只做确定性
归一化，供项目工作台先展示真实缺口，后续再接入完整 Pre-DD Agent / RAG 材料库。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.objects.base import Claim
from app.objects.deal import DealProfile, PreDDMaterialCollectionStatus


TaskStatus = str


@dataclass(frozen=True)
class MaterialSpec:
    key: str
    title: str
    intro: str
    fields: tuple[str, ...]
    required: tuple[str, ...]
    public_hint: bool = False


@dataclass(frozen=True)
class MaterialKeywordSpec:
    task_key: str
    keywords: tuple[str, ...]


MATERIAL_SPECS: tuple[MaterialSpec, ...] = (
    MaterialSpec(
        "bp_product",
        "BP / 产品宣传材料",
        "公司对外融资 BP、产品或业务宣传册，优先提供最新版 BP。",
        ("one_line_intro", "product", "tech_route"),
        ("one_line_intro", "product"),
    ),
    MaterialSpec("equity", "股东与股权结构", "股东名单、持股比例、股权结构和历史变动说明。", ("uscc",), ("uscc",), public_hint=True),
    MaterialSpec("organization", "组织架构与核心人员", "组织架构图、部门职能划分和主要部门负责人背景或简历。", ("founders",), ("founders",)),
    MaterialSpec("business_model", "业务模式", "业务结构、商业逻辑、近年变化及变化原因说明。", ("business_model",), ("business_model",)),
    MaterialSpec("sales_model", "营销模式", "客户获取方式、获客成本、营销团队构成和激励机制说明。", ("customers",), ("customers",)),
    MaterialSpec("profit_model", "盈利模式", "收入来源与构成、毛利拆分、成本费用控制情况。", ("business_model", "revenue"), ("business_model", "revenue")),
    MaterialSpec("financials", "财务指标", "三年一期财务报表、审计报告、纳税报表及关键业务指标。", ("revenue", "valuation", "funding_amount"), ("revenue",)),
    MaterialSpec("suppliers", "上游供应商", "重要供应商、采购信息、采购模式及成本变动情况。", tuple(), tuple(), public_hint=True),
    MaterialSpec("customers", "下游客户", "前五大客户构成、销售模式和近年合作稳定性说明。", ("customers",), ("customers",)),
    MaterialSpec("competitors", "竞争对手", "主要竞争对手、替代方案及竞争格局说明。", ("competitors",), ("competitors",), public_hint=True),
    MaterialSpec("market", "市场规模与增长", "目标市场规模、增长率、驱动因素和可服务市场空间说明。", ("market_size",), ("market_size",), public_hint=True),
    MaterialSpec("team", "核心管理团队", "核心管理团队简历、职责分工和员工花名册。", ("founders",), ("founders",)),
    MaterialSpec(
        "financing",
        "融资与估值",
        "历史融资、本轮投前估值、本轮融资金额比例及资金用途说明。",
        ("funding_stage", "funding_amount", "valuation"),
        ("funding_stage", "funding_amount"),
    ),
    MaterialSpec("development", "未来发展方向 / 合作诉求", "公司未来发展方向、里程碑计划或合作诉求说明。", ("contact",), ("contact",)),
)


MATERIAL_KEYWORD_SPECS: tuple[MaterialKeywordSpec, ...] = (
    MaterialKeywordSpec("bp_product", ("bp", "产品", "宣传册", "产品方案", "技术路线", "solution")),
    MaterialKeywordSpec("equity", ("股东", "股权", "持股", "股本", "cap table", "shareholder")),
    MaterialKeywordSpec("organization", ("组织架构", "核心人员", "员工", "部门", "组织")),
    MaterialKeywordSpec("business_model", ("业务模式", "商业模式", "收入模式", "business model")),
    MaterialKeywordSpec("sales_model", ("营销", "销售", "渠道", "获客", "销售模式")),
    MaterialKeywordSpec("profit_model", ("盈利", "毛利", "净利", "利润", "gross margin")),
    MaterialKeywordSpec("financials", ("财务", "收入", "营收", "现金流", "利润表", "资产负债表", "revenue")),
    MaterialKeywordSpec("suppliers", ("供应商", "上游", "采购", "原材料", "supplier")),
    MaterialKeywordSpec("customers", ("客户", "下游", "订单", "合同", "customer")),
    MaterialKeywordSpec("competitors", ("竞争", "竞品", "对手", "替代方案", "competitor")),
    MaterialKeywordSpec("market", ("市场规模", "增长率", "tam", "sam", "市场空间", "市场增长")),
    MaterialKeywordSpec("team", ("团队", "创始人", "管理层", "ceo", "cto", "founder")),
    MaterialKeywordSpec("financing", ("融资", "估值", "本轮", "pre-a", "a轮", "valuation")),
    MaterialKeywordSpec("development", ("规划", "未来发展", "合作诉求", "里程碑", "roadmap")),
)


MATERIAL_SPEC_BY_KEY: dict[str, MaterialSpec] = {spec.key: spec for spec in MATERIAL_SPECS}
BACKGROUND_MATERIAL_CATEGORY = "background"


FIELD_LABELS: dict[str, str] = {
    "one_line_intro": "一句话介绍",
    "product": "产品方案",
    "tech_route": "技术路线",
    "uscc": "统一社会信用代码",
    "founders": "创始团队",
    "business_model": "商业模式",
    "customers": "客户信息",
    "revenue": "收入",
    "valuation": "估值",
    "funding_amount": "融资金额",
    "competitors": "竞争对手",
    "market_size": "市场空间",
    "funding_stage": "融资阶段",
    "contact": "联系人/合作诉求",
}


def _normalize_text(text: str) -> str:
    return " ".join((text or "").split())


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(_has_value(item) for item in value)
    return bool(value)


def _field_value(profile: DealProfile, field: str) -> Any:
    return getattr(profile.extraction, field, None)


def _stringify(value: Any) -> str:
    if isinstance(value, list):
        return "、".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def _contains_any(text: str, words: tuple[str, ...]) -> bool:
    return any(word in text for word in words)


def _find_keyword(text: str, keywords: tuple[str, ...]) -> str | None:
    lower = text.lower()
    for keyword in keywords:
        if keyword.lower() in lower:
            return keyword
    return None


def _keyword_match_score(
    *,
    filename: str,
    text: str,
    keywords: tuple[str, ...],
) -> tuple[int, list[str]]:
    filename_lower = _normalize_text(filename).lower()
    text_lower = _normalize_text(text).lower()
    score = 0
    matched: list[str] = []
    for keyword in keywords:
        needle = keyword.lower()
        filename_hits = filename_lower.count(needle)
        text_hits = text_lower.count(needle)
        if filename_hits <= 0 and text_hits <= 0:
            continue
        matched.append(keyword)
        # 文件名往往承载材料类型（如 BP、利润表、客户访谈），权重略高于正文单次出现。
        score += filename_hits * 3 + text_hits
    return score, matched


def _classification_confidence(score: int, matched_keywords: list[str]) -> str:
    if score >= 4 or len(matched_keywords) >= 3:
        return "high"
    if score >= 2 or len(matched_keywords) >= 2:
        return "medium"
    return "low"


def suggest_material_category(*, filename: str, text: str) -> dict[str, Any]:
    """给上传材料生成一个面向用户的单一归类建议。

    该建议与 `infer_material_task_hits` 的多任务覆盖信号分开：前者用于“这份材料建议放哪类”，
    后者用于“它可能覆盖哪些 Pre-DD 缺口”。若 14 类均无关键词命中，则归为背景材料。
    """
    candidates: list[tuple[int, int, MaterialKeywordSpec, list[str]]] = []
    for index, spec in enumerate(MATERIAL_KEYWORD_SPECS):
        score, matched = _keyword_match_score(
            filename=filename,
            text=text,
            keywords=spec.keywords,
        )
        if score > 0:
            candidates.append((score, -index, spec, matched))

    if not candidates:
        return {
            "key": BACKGROUND_MATERIAL_CATEGORY,
            "title": "背景材料",
            "confidence": "low",
            "matched_keywords": [],
            "is_background": True,
            "reason": "未命中十四类 Pre-DD 材料关键词，建议先作为背景材料留存。",
        }

    score, _, keyword_spec, matched_keywords = max(candidates, key=lambda item: (item[0], len(item[3]), item[1]))
    material_spec = MATERIAL_SPEC_BY_KEY[keyword_spec.task_key]
    shown_keywords = matched_keywords[:5]
    return {
        "key": material_spec.key,
        "title": material_spec.title,
        "confidence": _classification_confidence(score, matched_keywords),
        "matched_keywords": shown_keywords,
        "is_background": False,
        "reason": f"命中关键词：{'、'.join(shown_keywords)}",
    }


def _snippet_around(text: str, keyword: str, *, radius: int = 44) -> str:
    normalized = _normalize_text(text)
    lower = normalized.lower()
    index = lower.find(keyword.lower())
    if index == -1:
        return normalized[: radius * 2]
    start = max(0, index - radius)
    end = min(len(normalized), index + len(keyword) + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(normalized) else ""
    return f"{prefix}{normalized[start:end]}{suffix}"


def infer_material_task_hits(
    *,
    document_id: str,
    filename: str,
    text: str,
    doc_type: str | None = None,
    evidence_id: str | None = None,
) -> list[dict[str, Any]]:
    """把一份上传材料的正文确定性归位到 Pre-DD 14 类任务。

    这是 MVP 级轻量规则：只做关键词命中与短摘录，不宣称完成尽调判断。后续可替换为
    LLM/embedding 分类，但输出结构保持稳定。
    """
    normalized = _normalize_text(text)
    filename_text = _normalize_text(filename)
    search_text = f"{filename_text} {normalized}".strip()
    if not search_text:
        return []

    hits: list[dict[str, Any]] = []
    for spec in MATERIAL_KEYWORD_SPECS:
        keyword = _find_keyword(search_text, spec.keywords)
        if keyword is None:
            continue
        hit = {
            "document_id": document_id,
            "filename": filename,
            "task_key": spec.task_key,
            "keyword": keyword,
            "snippet": _snippet_around(normalized, keyword),
        }
        if evidence_id:
            hit["evidence_id"] = evidence_id
        hits.append(hit)

    return hits


def _related_gaps(title: str, gaps: list[str]) -> list[str]:
    tokens = tuple(part for part in title.replace("/", " ").replace("与", " ").split() if part)
    if not tokens:
        return []
    return [gap for gap in gaps if _contains_any(gap, tokens)]


def _related_questions(title: str, questions: list[str]) -> list[str]:
    tokens = tuple(part for part in title.replace("/", " ").replace("与", " ").split() if part)
    if not tokens:
        return []
    return [question for question in questions if _contains_any(question, tokens)]


def _claim_texts(claims: list[Claim], *, limit: int | None = None) -> list[str]:
    items = [claim.text for claim in claims if claim.text.strip()]
    return items if limit is None else items[:limit]


def _collection_status(
    profile: DealProfile,
    *,
    task_key: str,
    system_status: TaskStatus,
    has_collected_evidence: bool,
) -> str:
    manual = profile.pre_dd_material_statuses.get(task_key)
    if manual is not None:
        return manual.value
    if system_status == "complete" or has_collected_evidence:
        return PreDDMaterialCollectionStatus.COLLECTED.value
    return PreDDMaterialCollectionStatus.PENDING.value


def _collected_materials(
    *,
    provided: list[str],
    materials: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = [
        {
            "kind": "系统捕获",
            "title": text,
            "detail": None,
            "document_id": None,
            "evidence_id": None,
        }
        for text in provided
    ]
    for material in materials:
        collected.append(
            {
                "kind": "机构材料",
                "title": str(material.get("filename") or "未命名材料"),
                "detail": str(material.get("snippet") or material.get("keyword") or "").strip() or None,
                "document_id": material.get("document_id"),
                "evidence_id": material.get("evidence_id"),
            }
        )
    return collected


def _dedup_texts(items: list[str], *, limit: int = 6) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        text = _normalize_text(item)
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _collection_suggestions(
    *,
    spec: MaterialSpec,
    status: TaskStatus,
    missing_fields: list[str],
    gaps: list[str],
    questions: list[str],
) -> list[str]:
    if status == "complete" and not gaps and not questions:
        return ["材料收集完成"]

    suggestions: list[str] = []
    suggestions.extend(f"补充{field}相关材料。" for field in missing_fields)
    suggestions.extend(f"补充信息缺口：{gap}" for gap in gaps)
    suggestions.extend(f"回应待验证问题：{question}" for question in questions)
    if not suggestions and status == "public_data_possible":
        suggestions.append(f"优先通过公开渠道补充{spec.title}。")
    if not suggestions:
        suggestions.append(f"继续补充{spec.intro}")
    return _dedup_texts(suggestions)


def build_pre_dd_workspace(
    profile: DealProfile,
    material_hits: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """从 DealProfile 生成 Pre-DD 最小工作台视图。

    状态规则：
    - complete：关键 required 字段均已提供；
    - partial：已提供部分相关信息、上传材料命中，或存在系统已识别的 gap/question；
    - missing：该材料项没有任何可用信息；
    - public_data_possible：当前缺失但适合后续由公开数据补全。
    """
    gaps = [item.strip() for item in profile.analysis.info_gaps if item.strip()]
    questions = [item.strip() for item in profile.analysis.open_questions if item.strip()]
    items: list[dict[str, Any]] = []
    counts: dict[str, int] = {
        "complete": 0,
        "partial": 0,
        "missing": 0,
        "public_data_possible": 0,
    }
    collection_counts: dict[str, int] = {
        PreDDMaterialCollectionStatus.COLLECTED.value: 0,
        PreDDMaterialCollectionStatus.PENDING.value: 0,
    }
    hits_by_key: dict[str, list[dict[str, Any]]] = {}
    for hit in material_hits or []:
        key = str(hit.get("task_key") or "")
        if key:
            hits_by_key.setdefault(key, []).append(hit)

    for spec in MATERIAL_SPECS:
        provided_fields = [
            field for field in spec.fields if _has_value(_field_value(profile, field))
        ]
        required_provided = [
            field for field in spec.required if _has_value(_field_value(profile, field))
        ]
        missing_fields = [
            FIELD_LABELS.get(field, field)
            for field in spec.required
            if not _has_value(_field_value(profile, field))
        ]
        related_gaps = _related_gaps(spec.title, gaps)
        related_questions = _related_questions(spec.title, questions)
        related_materials = hits_by_key.get(spec.key, [])

        if spec.required and len(required_provided) == len(spec.required):
            status: TaskStatus = "complete"
        elif provided_fields or related_materials or related_gaps or related_questions:
            status = "partial"
        elif spec.public_hint:
            status = "public_data_possible"
        else:
            status = "missing"

        counts[status] += 1
        provided = [
            f"{FIELD_LABELS.get(field, field)}：{_stringify(_field_value(profile, field))}"
            for field in provided_fields
            if _stringify(_field_value(profile, field))
        ]
        collection_status = _collection_status(
            profile,
            task_key=spec.key,
            system_status=status,
            has_collected_evidence=bool(provided or related_materials),
        )
        collection_counts[collection_status] += 1
        items.append(
            {
                "key": spec.key,
                "title": spec.title,
                "intro": spec.intro,
                "status": status,
                "collection_status": collection_status,
                "provided": provided,
                "missing": missing_fields,
                "materials": related_materials,
                "collected_materials": _collected_materials(
                    provided=provided,
                    materials=related_materials,
                ),
                "suggestions": _collection_suggestions(
                    spec=spec,
                    status=status,
                    missing_fields=missing_fields,
                    gaps=related_gaps,
                    questions=related_questions,
                ),
                "gaps": related_gaps,
                "questions": related_questions,
            }
        )

    score = round(
        (
            counts["complete"]
            + counts["partial"] * 0.5
            + counts["public_data_possible"] * 0.25
        )
        / len(MATERIAL_SPECS)
        * 100
    )

    return {
        "completion": {
            "score": score,
            "total": len(MATERIAL_SPECS),
            **counts,
            **collection_counts,
        },
        "items": items,
        "priority_questions": questions[:8],
        "risk_queue": _claim_texts(profile.analysis.initial_risks, limit=8),
        "next_steps": _claim_texts(profile.analysis.next_steps, limit=5),
    }
