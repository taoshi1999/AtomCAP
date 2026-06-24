"""项目工作台近期市场信号收集服务。"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import Source
from app.connectors.registry import active_connectors, cached_gather_signals, lookup_company
from app.evidence.service import save_sources
from app.models.models import Deal
from app.objects.deal import DealMarketSignalCategory, DealProfile, DealStatus
from app.services.events import record_event
from app.services.market_signal_research import (
    MarketSignalResearchSubject,
    build_fallback_analysis,
    run_market_signal_research,
)


MAX_SIGNALS_PER_CATEGORY = 4

CATEGORY_LABELS: dict[DealMarketSignalCategory, str] = {
    DealMarketSignalCategory.FINANCE_NEWS: "财经新闻",
    DealMarketSignalCategory.BUSINESS_REGISTRY: "工商信息",
    DealMarketSignalCategory.PATENT: "专利信息",
    DealMarketSignalCategory.PAPER: "学术论文",
    DealMarketSignalCategory.PERSONNEL: "人事变动",
}


class DealSignalTargetNotFound(Exception):
    """目标 Deal 不存在或不属于当前租户。"""


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


def deal_market_signal_queries(profile: DealProfile) -> dict[DealMarketSignalCategory, list[str]]:
    """按五类信息生成项目级公开检索关键词。"""
    extraction = profile.extraction
    name = extraction.company_name
    aliases = extraction.aliases[:2]
    track = extraction.track or extraction.sub_direction
    product_or_tech = extraction.tech_route or extraction.product or extraction.one_line_intro
    founder_terms = extraction.founders[:3]

    return {
        DealMarketSignalCategory.FINANCE_NEWS: _clean_terms(
            [
                name,
                f"{name} 融资 财经 新闻",
                f"{name} {track} 融资" if track else None,
                *aliases,
            ]
        ),
        DealMarketSignalCategory.BUSINESS_REGISTRY: _clean_terms([name]),
        DealMarketSignalCategory.PATENT: _clean_terms(
            [
                f"{name} 专利",
                f"{name} 知识产权",
                f"{product_or_tech} 专利 {name}" if product_or_tech else None,
            ]
        ),
        DealMarketSignalCategory.PAPER: _clean_terms(
            [
                f"{name} 论文",
                f"{name} 学术论文",
                f"{product_or_tech} paper {name}" if product_or_tech else None,
            ]
        ),
        DealMarketSignalCategory.PERSONNEL: _clean_terms(
            [
                f"{name} 创始人",
                f"{name} 高管 人事",
                *(f"{name} {founder}" for founder in founder_terms),
            ]
        ),
    }


def _deal_research_subject(profile: DealProfile) -> MarketSignalResearchSubject:
    extraction = profile.extraction
    return MarketSignalResearchSubject(
        kind="deal",
        name=extraction.company_name,
        description=profile.analysis.portrait or extraction.one_line_intro or "",
        track=extraction.track or extraction.sub_direction or "",
        aliases=extraction.aliases,
        focus_terms=_clean_terms(
            [
                extraction.product,
                extraction.tech_route,
                extraction.one_line_intro,
                *extraction.founders,
                *extraction.competitors[:3],
            ]
        ),
    )


def _source_key(source: Source) -> str:
    return (source.url or source.title).strip().lower()


def _with_signal_raw(source: Source, *, category: DealMarketSignalCategory, deal_id: uuid.UUID) -> Source:
    raw = dict(source.raw or {})
    raw.update({"deal_id": str(deal_id), "market_signal_category": category.value})
    return source.model_copy(update={"raw": raw})


async def collect_deal_market_signal_sources(
    profile: DealProfile,
    *,
    deal_id: uuid.UUID,
    allow_overseas: bool,
    max_search_rounds: int = 1,
) -> dict[DealMarketSignalCategory, list[Source]]:
    """按 ReAct 方式收集、研判并筛选项目五类信号。"""
    connectors = active_connectors(allow_overseas=allow_overseas)
    if not connectors:
        return {category: [] for category in DealMarketSignalCategory}

    queries = deal_market_signal_queries(profile)
    track = profile.extraction.track or profile.extraction.sub_direction or ""
    subject = _deal_research_subject(profile)

    async def search_round(
        round_queries: dict[str, list[str]],
        round_number: int,
    ) -> dict[str, list[Source]]:
        async def search_category(category_value: str, category_queries: list[str]) -> tuple[str, list[Source]]:
            category = DealMarketSignalCategory(category_value)
            if category is DealMarketSignalCategory.BUSINESS_REGISTRY and round_number == 1:
                sources = await lookup_company(
                    connectors,
                    (profile.extraction.company_name or "").strip(),
                )
            else:
                sources = await cached_gather_signals(
                    connectors,
                    keywords=category_queries,
                    track=track if category is DealMarketSignalCategory.FINANCE_NEWS else "",
                    allow_overseas=allow_overseas,
                )
            return category_value, sources

        pairs = await asyncio.gather(
            *(
                search_category(category_value, category_queries)
                for category_value, category_queries in round_queries.items()
            )
        )
        return dict(pairs)

    researched = await run_market_signal_research(
        subject=subject,
        initial_queries={category.value: values for category, values in queries.items()},
        search_round=search_round,
        max_search_rounds=max_search_rounds,
        allow_overseas=allow_overseas,
    )

    filtered: dict[DealMarketSignalCategory, list[Source]] = {}
    for category in DealMarketSignalCategory:
        sources = researched.get(category.value, [])[:MAX_SIGNALS_PER_CATEGORY]
        seen: set[str] = set()
        items: list[Source] = []
        for source in sources:
            key = _source_key(source)
            if not key or key in seen:
                continue
            seen.add(key)
            items.append(_with_signal_raw(source, category=category, deal_id=deal_id))
        filtered[category] = items
    return filtered


def _project_signal(
    source: Source,
    *,
    evidence_id: uuid.UUID,
    category: DealMarketSignalCategory,
    collected_at: str,
    subject: MarketSignalResearchSubject,
) -> dict:
    raw = source.raw or {}
    return {
        "evidence_id": str(evidence_id),
        "category": category.value,
        "title": source.title,
        "summary": source.snippet,
        "analysis": raw.get("signal_analysis")
        or build_fallback_analysis(source, category=category.value, subject=subject),
        "url": source.url,
        "source_type": source.source_type,
        "connector": source.connector,
        "published_at": source.published_at,
        "collected_at": collected_at,
    }


async def collect_deal_market_signals(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    allow_overseas: bool,
    max_search_rounds: int = 1,
) -> dict:
    """收集并保存项目近期市场信号，返回前端可直接展示的列表。"""
    deal = await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,
        )
    )
    if deal is None or deal.status == DealStatus.DELETED.value:
        raise DealSignalTargetNotFound(str(deal_id))

    profile = DealProfile.model_validate(deal.data or {})
    collect_kwargs = {
        "deal_id": deal.id,
        "allow_overseas": allow_overseas,
    }
    if max_search_rounds != 1:
        collect_kwargs["max_search_rounds"] = max_search_rounds
    source_groups = await collect_deal_market_signal_sources(profile, **collect_kwargs)
    subject = _deal_research_subject(profile)
    collected_at = datetime.now(UTC).isoformat()
    projected: list[dict] = []

    for category in DealMarketSignalCategory:
        sources = source_groups.get(category, [])
        evidence_ids = await save_sources(db, institution_id=institution_id, sources=sources) if sources else []
        projected.extend(
            _project_signal(
                source,
                evidence_id=evidence_id,
                category=category,
                collected_at=collected_at,
                subject=subject,
            )
            for source, evidence_id in zip(sources, evidence_ids, strict=False)
        )

    data = dict(deal.data or {})
    data["market_signals"] = projected
    deal.data = DealProfile.model_validate(data).model_dump(mode="json")
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.market_signals_collected",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "count": len(projected),
            "max_search_rounds": max_search_rounds,
            "by_category": {
                category.value: sum(1 for item in projected if item["category"] == category.value)
                for category in DealMarketSignalCategory
            },
        },
    )
    return {
        "items": projected,
        "count": len(projected),
        "collected_at": collected_at,
        "max_search_rounds": max_search_rounds,
    }
