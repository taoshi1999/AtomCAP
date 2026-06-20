"""Pre-DD 工作台只读视图生成。

本模块把 Deal Intake 阶段已有的 DealProfile 转成 Pre-DD 工作台的最小任务树：
14 类材料项、完整度、待验证问题与初步风险队列。它不调用 LLM、不写库，只做确定性
归一化，供项目工作台先展示真实缺口，后续再接入完整 Pre-DD Agent / RAG 材料库。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.objects.base import Claim
from app.objects.deal import DealProfile


TaskStatus = str


@dataclass(frozen=True)
class MaterialSpec:
    key: str
    title: str
    fields: tuple[str, ...]
    required: tuple[str, ...]
    public_hint: bool = False


MATERIAL_SPECS: tuple[MaterialSpec, ...] = (
    MaterialSpec("bp_product", "BP / 产品宣传材料", ("one_line_intro", "product", "tech_route"), ("one_line_intro", "product")),
    MaterialSpec("equity", "股东与股权结构", ("uscc",), ("uscc",), public_hint=True),
    MaterialSpec("organization", "组织架构与核心人员", ("founders",), ("founders",)),
    MaterialSpec("business_model", "业务模式", ("business_model",), ("business_model",)),
    MaterialSpec("sales_model", "营销模式", ("customers",), ("customers",)),
    MaterialSpec("profit_model", "盈利模式", ("business_model", "revenue"), ("business_model", "revenue")),
    MaterialSpec("financials", "财务指标", ("revenue", "valuation", "funding_amount"), ("revenue",)),
    MaterialSpec("suppliers", "上游供应商", tuple(), tuple(), public_hint=True),
    MaterialSpec("customers", "下游客户", ("customers",), ("customers",)),
    MaterialSpec("competitors", "竞争对手", ("competitors",), ("competitors",), public_hint=True),
    MaterialSpec("market", "市场规模与增长", ("market_size",), ("market_size",), public_hint=True),
    MaterialSpec("team", "核心管理团队", ("founders",), ("founders",)),
    MaterialSpec("financing", "融资与估值", ("funding_stage", "funding_amount", "valuation"), ("funding_stage", "funding_amount")),
    MaterialSpec("development", "未来发展方向 / 合作诉求", ("contact",), ("contact",)),
)


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


def build_pre_dd_workspace(profile: DealProfile) -> dict[str, Any]:
    """从 DealProfile 生成 Pre-DD 最小工作台视图。

    状态规则：
    - complete：关键 required 字段均已提供；
    - partial：已提供部分相关信息，或存在系统已识别的 gap/question；
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

        if spec.required and len(required_provided) == len(spec.required):
            status: TaskStatus = "complete"
        elif provided_fields or related_gaps or related_questions:
            status = "partial"
        elif spec.public_hint:
            status = "public_data_possible"
        else:
            status = "missing"

        counts[status] += 1
        items.append(
            {
                "key": spec.key,
                "title": spec.title,
                "status": status,
                "provided": [
                    f"{FIELD_LABELS.get(field, field)}：{_stringify(_field_value(profile, field))}"
                    for field in provided_fields
                    if _stringify(_field_value(profile, field))
                ],
                "missing": missing_fields,
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
        },
        "items": items,
        "priority_questions": questions[:8],
        "risk_queue": _claim_texts(profile.analysis.initial_risks, limit=8),
        "next_steps": _claim_texts(profile.analysis.next_steps, limit=5),
    }
