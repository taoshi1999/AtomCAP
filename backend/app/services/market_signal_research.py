"""近期市场信号的 ReAct 检索、筛选与分析编排。

每一轮执行三步：按当前目标检索、让模型研判候选、生成下一轮检索目标。
测试阶段默认只执行一轮；调用方可在 1-5 轮内调整搜索深度。
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from app.connectors.base import Source
from app.llm.client import ModelTier, complete_structured

logger = logging.getLogger(__name__)

MARKET_SIGNAL_CATEGORIES = {
    "finance_news",
    "business_registry",
    "patent",
    "paper",
    "personnel",
}
MIN_RELEVANCE_SCORE = 65
MAX_CANDIDATES_PER_CATEGORY = 10
MAX_NEXT_QUERIES_PER_CATEGORY = 4

_CATEGORY_LABELS = {
    "finance_news": "财经新闻",
    "business_registry": "工商信息",
    "patent": "专利信息",
    "paper": "学术论文",
    "personnel": "人事变动",
}
_CATEGORY_SIGNAL_TERMS = {
    "finance_news": ("融资", "投资", "并购", "订单", "营收", "收入", "上市", "合作", "发布"),
    "business_registry": ("工商", "注册", "股东", "法人", "成立", "增资", "变更", "经营范围"),
    "patent": ("专利", "发明", "授权", "申请号", "知识产权"),
    "paper": ("论文", "研究", "期刊", "学术", "paper", "journal"),
    "personnel": ("任命", "离职", "加入", "高管", "创始人", "董事", "首席", "招聘"),
}
_NOISE_TERMS = (
    "试题",
    "答案",
    "题库",
    "作业",
    "教案",
    "教程",
    "软件下载",
    "软件资讯",
    "使用技巧",
    "文库",
    "百科",
    "原理揭秘",
)


class MarketSignalResearchSubject(BaseModel):
    """模型研判所需的最小项目/赛道上下文。"""

    kind: Literal["deal", "thesis"]
    name: str
    description: str = ""
    track: str = ""
    aliases: list[str] = Field(default_factory=list)
    focus_terms: list[str] = Field(default_factory=list)


class MarketSignalCollectOptions(BaseModel):
    max_search_rounds: int = Field(default=1, ge=1, le=5)


class CandidateAssessment(BaseModel):
    candidate_id: str
    relevant: bool
    relevance_score: int = Field(ge=0, le=100)
    signal_analysis: str = Field(
        default="",
        description="四到五句话，说明与当前项目或赛道的关系、启发和后续核验重点",
    )


class NextSearchTarget(BaseModel):
    category: str
    queries: list[str] = Field(default_factory=list)


class MarketSignalRoundDecision(BaseModel):
    assessments: list[CandidateAssessment] = Field(default_factory=list)
    next_search_targets: list[NextSearchTarget] = Field(default_factory=list)
    stop: bool = False


@dataclass(frozen=True)
class ResearchCandidate:
    candidate_id: str
    category: str
    source: Source
    round_number: int


SearchRound = Callable[
    [dict[str, list[str]], int],
    Awaitable[dict[str, list[Source]]],
]


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _clean_terms(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        term = " ".join((value or "").split())
        normalized = term.lower()
        if not term or normalized in seen:
            continue
        seen.add(normalized)
        result.append(term)
    return result


def _source_key(source: Source) -> str:
    return _clean_text(source.url or source.title)


def _subject_terms(subject: MarketSignalResearchSubject) -> tuple[list[str], list[str]]:
    entity_terms = _clean_terms([subject.name, *subject.aliases])
    topic_terms = _clean_terms([subject.track, *subject.focus_terms])
    return entity_terms, topic_terms


def source_relevance_prior(
    source: Source,
    *,
    category: str,
    subject: MarketSignalResearchSubject,
) -> int:
    """轻量预排序，先把明显试题、教程和无主体关系的泛资料压到候选尾部。"""
    title = _clean_text(source.title)
    text = _clean_text(f"{source.title} {source.snippet}")
    entity_terms, topic_terms = _subject_terms(subject)
    score = 0
    entity_hit = any(_clean_text(term) in text for term in entity_terms if term)
    topic_hits = sum(1 for term in topic_terms if _clean_text(term) in text)
    if entity_hit:
        score += 60
    score += min(topic_hits, 3) * 12
    if any(term in text for term in _CATEGORY_SIGNAL_TERMS.get(category, ())):
        score += 18
    if source.published_at:
        score += 5
    if source.url:
        score += 3
    if any(term in title for term in _NOISE_TERMS):
        score -= 80

    # 项目级信号必须能回到具体主体；仅命中一个宽泛赛道词不足以进入展示。
    if subject.kind == "deal" and not entity_hit:
        score -= 35
    return score


def _fallback_relevant(
    source: Source,
    *,
    category: str,
    subject: MarketSignalResearchSubject,
) -> tuple[bool, int]:
    score = max(0, min(100, source_relevance_prior(source, category=category, subject=subject)))
    threshold = 55 if subject.kind == "deal" else 35
    return score >= threshold, max(score, MIN_RELEVANCE_SCORE if score >= threshold else score)


def _sentence_count(text: str) -> int:
    return len([part for part in re.split(r"[。！？!?]+", text) if part.strip()])


def build_fallback_analysis(
    source: Source,
    *,
    category: str,
    subject: MarketSignalResearchSubject,
) -> str:
    """生成事实约束的四句降级分析，不引入来源之外的具体数字或结论。"""
    category_label = _CATEGORY_LABELS.get(category, "市场信息")
    snippet = " ".join((source.snippet or source.title).split())
    snippet = re.sub(r"[。！？!?]+", "；", snippet).strip("；")
    if len(snippet) > 180:
        snippet = f"{snippet[:180]}..."
    return (
        f"该信号在{category_label}维度与{subject.name}存在直接关键词或主体关联。"
        f"原始信息显示，{snippet or source.title}。"
        f"对当前研究的启发是，应结合项目实际业务与赛道假设判断它是否代表需求、竞争或技术条件的实质变化。"
        "后续应核验来源时间、主体一致性和商业影响，避免把一般性技术资料误判为有效市场信号。"
    )


def normalize_signal_analysis(
    analysis: str,
    *,
    source: Source,
    category: str,
    subject: MarketSignalResearchSubject,
) -> str:
    cleaned = " ".join(analysis.split())
    if _sentence_count(cleaned) in {4, 5}:
        return cleaned
    return build_fallback_analysis(source, category=category, subject=subject)


def _candidate_payload(candidate: ResearchCandidate) -> dict:
    return {
        "candidate_id": candidate.candidate_id,
        "category": candidate.category,
        "category_label": _CATEGORY_LABELS.get(candidate.category, candidate.category),
        "title": candidate.source.title,
        "summary": candidate.source.snippet[:1000],
        "published_at": candidate.source.published_at,
        "url": candidate.source.url,
        "connector": candidate.source.connector,
    }


async def assess_market_signal_round(
    *,
    subject: MarketSignalResearchSubject,
    candidates: list[ResearchCandidate],
    round_number: int,
    max_search_rounds: int,
    allow_overseas: bool,
    selected_context: list[dict] | None = None,
) -> MarketSignalRoundDecision:
    """调用模型研判当前轮结果；失败时使用严格的确定性相关性规则。"""
    if not candidates:
        return MarketSignalRoundDecision(stop=True)

    system_prompt = """你是一级市场投资研究员，负责市场信号检索的 ReAct 研判步骤。
请逐条判断候选资料是否与当前项目或赛道有直接研究价值，并严格去噪。

必须遵守：
1. 试题答案、教程、软件下载/使用技巧、泛百科、与主体无关的技术文档一律不保留。
2. 项目研究优先要求公司名、品牌、创始人、产品或明确事件与目标项目可核验地相关。
3. 赛道研究可保留直接影响技术成熟度、成本、政策、竞争、融资和人才流动的资料，但不能只因出现宽泛关键词就保留。
4. relevant=true 时 relevance_score 必须至少 65；只保留最相关、可指导投资判断的候选。
5. signal_analysis 必须用中文写四到五句话：概括信号、说明与目标的关系、给出投资研究启发、指出后续核验重点。不得编造原文没有的数字或事实。
6. 如仍有搜索轮次，根据本轮缺口给出更精确的下一轮 queries；检索词应包含主体/赛道锚点与具体事件，不要重复宽泛关键词。
"""
    user_payload = {
        "subject": subject.model_dump(mode="json"),
        "round": round_number,
        "max_search_rounds": max_search_rounds,
        "already_selected": selected_context or [],
        "candidates": [_candidate_payload(candidate) for candidate in candidates],
    }
    try:
        return await complete_structured(
            ModelTier.STANDARD,
            [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(user_payload, ensure_ascii=False),
                },
            ],
            MarketSignalRoundDecision,
            allow_overseas=allow_overseas,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("市场信号第 %d 轮模型研判失败，使用确定性降级：%s", round_number, exc)
        assessments: list[CandidateAssessment] = []
        for candidate in candidates:
            relevant, score = _fallback_relevant(
                candidate.source,
                category=candidate.category,
                subject=subject,
            )
            assessments.append(
                CandidateAssessment(
                    candidate_id=candidate.candidate_id,
                    relevant=relevant,
                    relevance_score=score,
                    signal_analysis=(
                        build_fallback_analysis(
                            candidate.source,
                            category=candidate.category,
                            subject=subject,
                        )
                        if relevant
                        else ""
                    ),
                )
            )
        return MarketSignalRoundDecision(assessments=assessments, stop=True)


def _preselect_sources(
    sources: list[Source],
    *,
    category: str,
    subject: MarketSignalResearchSubject,
) -> list[Source]:
    return sorted(
        sources,
        key=lambda source: source_relevance_prior(
            source,
            category=category,
            subject=subject,
        ),
        reverse=True,
    )[:MAX_CANDIDATES_PER_CATEGORY]


def _next_queries(
    decision: MarketSignalRoundDecision,
    *,
    previous: dict[str, list[str]],
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    previous_terms = {
        _clean_text(query)
        for queries in previous.values()
        for query in queries
    }
    for target in decision.next_search_targets:
        if target.category not in MARKET_SIGNAL_CATEGORIES:
            continue
        queries = [
            query
            for query in _clean_terms(target.queries)
            if _clean_text(query) not in previous_terms
        ][:MAX_NEXT_QUERIES_PER_CATEGORY]
        if queries:
            result[target.category] = queries
    return result


async def run_market_signal_research(
    *,
    subject: MarketSignalResearchSubject,
    initial_queries: dict[str, list[str]],
    search_round: SearchRound,
    max_search_rounds: int = 1,
    allow_overseas: bool = False,
) -> dict[str, list[Source]]:
    """运行最多 ``max_search_rounds`` 轮检索，并只返回通过相关性门槛的来源。"""
    depth = max(1, min(5, int(max_search_rounds)))
    current_queries = {
        category: _clean_terms(queries)
        for category, queries in initial_queries.items()
        if category in MARKET_SIGNAL_CATEGORIES and queries
    }
    seen: set[str] = set()
    selected: dict[str, list[Source]] = {category: [] for category in MARKET_SIGNAL_CATEGORIES}
    selected_context: list[dict] = []

    for round_number in range(1, depth + 1):
        if not current_queries:
            break
        source_groups = await search_round(current_queries, round_number)
        candidates: list[ResearchCandidate] = []
        for category, raw_sources in source_groups.items():
            if category not in MARKET_SIGNAL_CATEGORIES:
                continue
            fresh_sources: list[Source] = []
            for source in raw_sources:
                key = _source_key(source)
                if not key or key in seen:
                    continue
                seen.add(key)
                fresh_sources.append(source)
            for index, source in enumerate(
                _preselect_sources(fresh_sources, category=category, subject=subject)
            ):
                candidates.append(
                    ResearchCandidate(
                        candidate_id=f"r{round_number}-{category}-{index}",
                        category=category,
                        source=source,
                        round_number=round_number,
                    )
                )
        if not candidates:
            break

        decision = await assess_market_signal_round(
            subject=subject,
            candidates=candidates,
            round_number=round_number,
            max_search_rounds=depth,
            allow_overseas=allow_overseas,
            selected_context=selected_context,
        )
        assessment_by_id = {
            assessment.candidate_id: assessment
            for assessment in decision.assessments
        }
        for candidate in candidates:
            assessment = assessment_by_id.get(candidate.candidate_id)
            if assessment is None:
                relevant, score = _fallback_relevant(
                    candidate.source,
                    category=candidate.category,
                    subject=subject,
                )
                assessment = CandidateAssessment(
                    candidate_id=candidate.candidate_id,
                    relevant=relevant,
                    relevance_score=score,
                )
            if not assessment.relevant or assessment.relevance_score < MIN_RELEVANCE_SCORE:
                continue
            analysis = normalize_signal_analysis(
                assessment.signal_analysis,
                source=candidate.source,
                category=candidate.category,
                subject=subject,
            )
            raw = dict(candidate.source.raw or {})
            raw.update(
                {
                    "signal_analysis": analysis,
                    "relevance_score": assessment.relevance_score,
                    "search_round": round_number,
                }
            )
            researched = candidate.source.model_copy(update={"raw": raw})
            selected[candidate.category].append(researched)
            selected_context.append(
                {
                    "category": candidate.category,
                    "title": researched.title,
                    "relevance_score": assessment.relevance_score,
                }
            )

        if round_number >= depth or decision.stop:
            break
        current_queries = _next_queries(decision, previous=current_queries)

    for category, sources in selected.items():
        selected[category] = sorted(
            sources,
            key=lambda source: (
                int((source.raw or {}).get("relevance_score") or 0),
                source.published_at or "",
            ),
            reverse=True,
        )
    return selected
