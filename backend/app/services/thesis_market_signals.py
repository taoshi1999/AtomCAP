"""赛道详情近期市场信号收集服务。"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import Source
from app.connectors.registry import active_connectors, cached_gather_signals
from app.evidence.service import save_sources
from app.models.models import Deliverable
from app.objects import DeliverableType
from app.objects.base import Claim
from app.objects.thesis import MarketSignal, MarketSignalCategory, SignalKind, Thesis, ThesisStatus
from app.services.events import record_event
from app.services.market_signal_research import (
    MarketSignalResearchSubject,
    build_fallback_analysis,
    run_market_signal_research,
)


MAX_SIGNALS_PER_CATEGORY = 4


class ThesisSignalTargetNotFound(Exception):
    """目标 Thesis 不存在、不属于当前租户，或已被删除。"""


def _clean_terms(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for value in values:
        term = " ".join((value or "").split())
        if not term or term in seen:
            continue
        seen.add(term)
        terms.append(term)
    return terms


def thesis_market_signal_queries(thesis: Thesis) -> dict[MarketSignalCategory, list[str]]:
    """按五类信息生成赛道级公开信号检索关键词。"""
    track = thesis.thesis_name
    sub_direction_names = [item.name for item in thesis.sub_directions[:4]]
    segment_examples = [
        example
        for segment in (
            thesis.value_chain.upstream
            + thesis.value_chain.midstream
            + thesis.value_chain.downstream
        )
        for example in (segment.examples or [])[:2]
    ][:4]
    focus_terms = _clean_terms([track, *sub_direction_names, *segment_examples])[:6]

    return {
        MarketSignalCategory.FINANCE_NEWS: _clean_terms(
            [
                track,
                f"{track} 融资 财经 新闻",
                f"{track} 产业 投资 新闻",
                *sub_direction_names[:2],
            ]
        ),
        MarketSignalCategory.BUSINESS_REGISTRY: _clean_terms(
            [
                f"{track} 企业 工商 注册",
                f"{track} 代表公司 工商",
                *(f"{term} 企业 工商" for term in focus_terms[1:4]),
            ]
        ),
        MarketSignalCategory.PATENT: _clean_terms(
            [
                f"{track} 专利",
                f"{track} 知识产权",
                *(f"{term} 专利" for term in focus_terms[1:4]),
            ]
        ),
        MarketSignalCategory.PAPER: _clean_terms(
            [
                f"{track} 学术论文",
                f"{track} 论文 paper",
                *(f"{term} 论文" for term in focus_terms[1:4]),
            ]
        ),
        MarketSignalCategory.PERSONNEL: _clean_terms(
            [
                f"{track} 创始人 高管 人事变动",
                f"{track} 招聘 任命 离职",
                *(f"{term} 创始人 高管" for term in focus_terms[1:3]),
            ]
        ),
    }


def _thesis_research_subject(thesis: Thesis) -> MarketSignalResearchSubject:
    sub_direction_names = [item.name for item in thesis.sub_directions]
    segment_terms = [
        term
        for segment in thesis.value_chain.upstream + thesis.value_chain.midstream + thesis.value_chain.downstream
        for term in [segment.name, *(segment.examples or [])]
    ]
    return MarketSignalResearchSubject(
        kind="thesis",
        name=thesis.thesis_name,
        description=thesis.one_line_view,
        track=thesis.thesis_name,
        focus_terms=_clean_terms(
            [
                *sub_direction_names,
                *segment_terms,
                *(company.name for company in thesis.representative_companies),
            ]
        )[:16],
    )


def _source_key(source: Source) -> str:
    return (source.url or source.title).strip().lower()


def _with_signal_raw(source: Source, *, category: MarketSignalCategory, deliverable_id: uuid.UUID) -> Source:
    raw = dict(source.raw or {})
    raw.update({"deliverable_id": str(deliverable_id), "market_signal_category": category.value})
    return source.model_copy(update={"raw": raw})


async def collect_thesis_market_signal_sources(
    thesis: Thesis,
    *,
    deliverable_id: uuid.UUID,
    allow_overseas: bool,
    max_search_rounds: int = 1,
) -> dict[MarketSignalCategory, list[Source]]:
    """按 ReAct 方式收集、研判并筛选赛道五类公开信号。"""
    connectors = active_connectors(allow_overseas=allow_overseas)
    if not connectors:
        return {category: [] for category in MarketSignalCategory}

    queries = thesis_market_signal_queries(thesis)
    subject = _thesis_research_subject(thesis)

    async def search_round(
        round_queries: dict[str, list[str]],
        _round_number: int,
    ) -> dict[str, list[Source]]:
        async def search_category(category_value: str, category_queries: list[str]) -> tuple[str, list[Source]]:
            category = MarketSignalCategory(category_value)
            sources = await cached_gather_signals(
                connectors,
                keywords=category_queries,
                track=thesis.thesis_name if category is MarketSignalCategory.FINANCE_NEWS else "",
                allow_overseas=allow_overseas,
            )
            return category_value, sources

        return dict(
            await asyncio.gather(
                *(
                    search_category(category_value, category_queries)
                    for category_value, category_queries in round_queries.items()
                )
            )
        )

    researched = await run_market_signal_research(
        subject=subject,
        initial_queries={category.value: values for category, values in queries.items()},
        search_round=search_round,
        max_search_rounds=max_search_rounds,
        allow_overseas=allow_overseas,
    )
    results: dict[MarketSignalCategory, list[Source]] = {}
    for category in MarketSignalCategory:
        seen: set[str] = set()
        filtered: list[Source] = []
        for source in researched.get(category.value, []):
            key = _source_key(source)
            if not key or key in seen:
                continue
            seen.add(key)
            filtered.append(_with_signal_raw(source, category=category, deliverable_id=deliverable_id))
            if len(filtered) >= MAX_SIGNALS_PER_CATEGORY:
                break
        results[category] = filtered
    return results


def _signal_kind(category: MarketSignalCategory) -> SignalKind:
    if category in {MarketSignalCategory.PATENT, MarketSignalCategory.PAPER}:
        return SignalKind.STRUCTURAL
    return SignalKind.HEAT


def _project_signal(
    source: Source,
    *,
    evidence_id: uuid.UUID,
    category: MarketSignalCategory,
    subject: MarketSignalResearchSubject,
) -> dict:
    raw = source.raw or {}
    signal = MarketSignal(
        kind=_signal_kind(category),
        title=source.title,
        summary=Claim(
            text=source.snippet or source.title,
            evidence_ids=[evidence_id],
            inferred=False,
        ),
        analysis=raw.get("signal_analysis")
        or build_fallback_analysis(source, category=category.value, subject=subject),
        signal_date=source.published_at,
        category=category,
    )
    return signal.model_dump(mode="json")


async def collect_thesis_market_signals(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deliverable_id: uuid.UUID,
    allow_overseas: bool,
    max_search_rounds: int = 1,
) -> dict:
    """收集并回写 Thesis 近期市场信号，返回前端可直接展示的数据。"""
    row = await db.scalar(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.institution_id == institution_id,
        )
    )
    if row is None or row.status == ThesisStatus.DELETED.value:
        raise ThesisSignalTargetNotFound(str(deliverable_id))
    if row.type != DeliverableType.THESIS.value:
        raise ValueError("Only thesis deliverables support market signal collection")

    thesis = Thesis.model_validate(row.payload or {})
    collect_kwargs = {
        "deliverable_id": row.id,
        "allow_overseas": allow_overseas,
    }
    if max_search_rounds != 1:
        collect_kwargs["max_search_rounds"] = max_search_rounds
    source_groups = await collect_thesis_market_signal_sources(thesis, **collect_kwargs)
    subject = _thesis_research_subject(thesis)
    collected_at = datetime.now(UTC).isoformat()
    projected: list[dict] = []

    for category in MarketSignalCategory:
        sources = source_groups.get(category, [])
        evidence_ids = await save_sources(db, institution_id=institution_id, sources=sources) if sources else []
        projected.extend(
            _project_signal(source, evidence_id=evidence_id, category=category, subject=subject)
            for source, evidence_id in zip(sources, evidence_ids, strict=False)
        )

    payload = dict(row.payload or {})
    payload["recent_signals"] = projected
    row.payload = Thesis.model_validate(payload).model_dump(mode="json")
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="thesis.market_signals_collected",
        subject_type=DeliverableType.THESIS.value,
        subject_id=row.id,
        payload={
            "count": len(projected),
            "max_search_rounds": max_search_rounds,
            "by_category": {
                category.value: sum(1 for item in projected if item.get("category") == category.value)
                for category in MarketSignalCategory
            },
        },
    )
    return {
        "deliverable_id": str(row.id),
        "payload": row.payload,
        "items": projected,
        "count": len(projected),
        "collected_at": collected_at,
        "max_search_rounds": max_search_rounds,
    }
