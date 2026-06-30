"""Deal material ingestion, projection, search, and Pre-DD public collection helpers."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.react_planner import generate_visible_react_plan
from app.connectors.base import Source
from app.connectors.registry import active_connectors, cached_gather_signals
from app.llm.client import ModelTier, complete_structured
from app.models.models import Chunk, Deal, Document, EvidenceItemRow
from app.objects.deal import DealProfile, DealStatus
from app.objects.deal_list import DealSourceType
from app.services.document_extract import ExtractResult, extract_text
from app.services.events import record_event
from app.services.pre_dd import (
    MATERIAL_KEYWORD_SPECS,
    MATERIAL_SPEC_BY_KEY,
    infer_material_task_hits,
    suggest_material_category,
)

PREVIEW_CHARS = 240
SEARCH_SNIPPET_CHARS = 180
PUBLIC_PRE_DD_DOC_TYPE = "public_pre_dd"
AUTO_PRE_DD_SOURCE_TYPE = "auto_pre_dd"
AUTO_PRE_DD_MAX_RESULTS = 6
AUTO_PRE_DD_TARGET_RESULTS = 3
AUTO_PRE_DD_SAFETY_MAX_REACT_LOOPS = 8

StepCallback = Callable[[dict], Awaitable[None]]


class DealMaterialTargetNotFound(Exception):
    """Raised when a deal cannot be found for material operations."""


class InvalidDealMaterialCategory(Exception):
    """Raised when a Pre-DD material category key is invalid."""


class DealMaterialNotFound(Exception):
    """Raised when a requested material document cannot be found."""


class MaterialCollectionRoundDecision(BaseModel):
    """Model-visible decision on whether one Pre-DD material collection should continue."""

    continue_search: bool = Field(
        default=False,
        description="Whether another public search round is worth running for this material type.",
    )
    rationale: str = Field(
        default="",
        description="Short user-visible explanation for why collection should continue or stop.",
    )
    next_queries: list[str] = Field(
        default_factory=list,
        description="Focused next-round search queries, if another round should run.",
    )


def _safe_filename(filename: str | None) -> str:
    name = (filename or "").strip() or "project_material"
    return name[:255]


def _doc_type(result: ExtractResult) -> str:
    if result.source_type == DealSourceType.INTERNAL_EXCEL:
        return "internal_excel"
    return "bp"


def _preview(text: str | None, *, limit: int = PREVIEW_CHARS) -> str | None:
    normalized = " ".join((text or "").split())
    if not normalized:
        return None
    return normalized if len(normalized) <= limit else f"{normalized[:limit]}..."


def _meta_evidence_id(meta: object) -> str | None:
    if not isinstance(meta, dict):
        return None
    value = meta.get("evidence_id")
    return str(value) if value else None


def _is_auto_collected(meta: object) -> bool:
    return isinstance(meta, dict) and meta.get("material_origin") == "auto_collected"


def _assigned_task_key(meta: object) -> str | None:
    if not isinstance(meta, dict):
        return None
    value = str(meta.get("assigned_pre_dd_task_key") or "").strip()
    return value if value in MATERIAL_SPEC_BY_KEY else None


def _normalize_task_keys(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    keys: list[str] = []
    for value in values:
        key = str(value or "").strip()
        if key in MATERIAL_SPEC_BY_KEY and key not in keys:
            keys.append(key)
    return keys


def _confirmed_task_keys(meta: dict) -> list[str]:
    if "confirmed_pre_dd_task_keys" in meta:
        return _normalize_task_keys(meta.get("confirmed_pre_dd_task_keys"))
    confirmed = _normalize_task_keys(meta.get("confirmed_pre_dd_task_keys"))
    if confirmed:
        return confirmed
    if _is_auto_collected(meta):
        return []
    assigned_key = _assigned_task_key(meta)
    return [assigned_key] if assigned_key else []


def _has_confirmed_task_key_override(meta: dict) -> bool:
    return "confirmed_pre_dd_task_keys" in meta


def _rejected_task_keys(meta: dict) -> list[str]:
    return _normalize_task_keys(meta.get("rejected_pre_dd_task_keys"))


def _validate_task_keys(values: list[str], *, field_name: str) -> list[str]:
    keys: list[str] = []
    invalid: list[str] = []
    for value in values:
        key = str(value or "").strip()
        if not key:
            continue
        if key not in MATERIAL_SPEC_BY_KEY:
            invalid.append(key)
            continue
        if key not in keys:
            keys.append(key)
    if invalid:
        raise InvalidDealMaterialCategory(f"Invalid Pre-DD material category in {field_name}: {', '.join(invalid)}")
    return keys


def _source_hit_fields(meta: dict) -> dict:
    if not _is_auto_collected(meta):
        return {}
    return {
        "kind": "auto_collected",
        "source_title": meta.get("public_source_title"),
        "source_url": meta.get("public_url"),
        "source_intro": meta.get("public_intro"),
        "connector": meta.get("connector"),
        "published_at": meta.get("published_at"),
        "collection_steps": meta.get("collection_steps") or [],
    }


def _synthetic_task_hit(
    *,
    document: Document,
    content: str,
    task_key: str,
    evidence_id: str | None,
    keyword: str,
) -> dict:
    hit = {
        "document_id": str(document.id),
        "filename": document.filename,
        "task_key": task_key,
        "keyword": keyword,
        "snippet": _preview(content, limit=180) or document.filename,
    }
    if evidence_id:
        hit["evidence_id"] = evidence_id
    return hit


def _dedup_task_hits(hits: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for hit in hits:
        key = str(hit.get("task_key") or "")
        if key not in MATERIAL_SPEC_BY_KEY or key in seen:
            continue
        seen.add(key)
        result.append(hit)
    return result


def _suggested_task_hits(
    *,
    document: Document,
    content: str,
    meta: dict,
    evidence_id: str | None,
    inferred: list[dict],
) -> list[dict]:
    hits = list(inferred)
    assigned_key = _assigned_task_key(meta)
    if assigned_key is not None and not any(hit.get("task_key") == assigned_key for hit in hits):
        hits.insert(
            0,
            _synthetic_task_hit(
                document=document,
                content=content,
                task_key=assigned_key,
                evidence_id=evidence_id,
                keyword="system_suggested",
            ),
        )
    return [{**hit, **_source_hit_fields(meta)} for hit in _dedup_task_hits(hits)]


def _material_category_suggestions(
    *,
    document: Document,
    content: str,
    meta: dict,
    evidence_id: str | None,
    inferred: list[dict],
) -> list[dict]:
    suggestions: list[dict] = []
    for hit in _suggested_task_hits(
        document=document,
        content=content,
        meta=meta,
        evidence_id=evidence_id,
        inferred=inferred,
    ):
        key = str(hit.get("task_key") or "")
        spec = MATERIAL_SPEC_BY_KEY.get(key)
        if spec is None:
            continue
        keyword = str(hit.get("keyword") or "").strip()
        suggestions.append(
            {
                "key": spec.key,
                "title": spec.title,
                "confidence": "high" if keyword in {"user_confirmed", "system_suggested"} else "medium",
                "matched_keywords": [keyword] if keyword else [],
                "is_background": False,
                "reason": f"Matched or related Pre-DD material dimension: {spec.title}",
            }
        )
    return suggestions


def _project_task_hits(
    *,
    document: Document,
    content: str,
    meta: dict,
    evidence_id: str | None,
) -> list[dict]:
    """Return Pre-DD categories that have been explicitly confirmed for this material."""
    inferred = infer_material_task_hits(
        document_id=str(document.id),
        filename=document.filename,
        text=content,
        doc_type=document.doc_type,
        evidence_id=evidence_id,
    )
    confirmed_keys = _confirmed_task_keys(meta)
    if confirmed_keys or _has_confirmed_task_key_override(meta):
        confirmed_hits = [
            _synthetic_task_hit(
                document=document,
                content=content,
                task_key=task_key,
                evidence_id=evidence_id,
                keyword="user_confirmed",
            )
            for task_key in confirmed_keys
        ]
        return [{**hit, **_source_hit_fields(meta)} for hit in confirmed_hits]
    if _is_auto_collected(meta):
        return []
    return inferred

def _query_terms(query: str) -> list[str]:
    normalized = " ".join((query or "").split()).strip()
    if not normalized:
        return []
    terms = [term for term in re.split(r"[\s,;，；]+", normalized) if term]
    return terms[:8]

def _material_match_score(text: str, filename: str, terms: list[str]) -> tuple[int, list[str]]:
    hay = f"{filename}\n{text}".lower()
    score = 0
    matched: list[str] = []
    for term in terms:
        needle = term.lower()
        count = hay.count(needle)
        if count <= 0:
            continue
        matched.append(term)
        filename_bonus = 3 if needle in filename.lower() else 0
        score += count + filename_bonus
    return score, matched


def _search_snippet(text: str, terms: list[str], *, limit: int = SEARCH_SNIPPET_CHARS) -> str:
    normalized = " ".join((text or "").split())
    if not normalized:
        return ""
    lower = normalized.lower()
    positions = [
        lower.find(term.lower())
        for term in terms
        if term and lower.find(term.lower()) >= 0
    ]
    if not positions:
        return normalized[:limit]
    index = min(positions)
    radius = max(30, limit // 2)
    start = max(0, index - radius)
    end = min(len(normalized), index + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(normalized) else ""
    return f"{prefix}{normalized[start:end]}{suffix}"


def project_deal_material(document: Document, chunk: Chunk | None = None) -> dict:
    """Project a stored material into API response fields."""
    meta = chunk.meta if chunk is not None and isinstance(chunk.meta, dict) else {}
    content = chunk.content if chunk is not None else ""
    evidence_id = _meta_evidence_id(meta)
    inferred_hits = infer_material_task_hits(
        document_id=str(document.id),
        filename=document.filename,
        text=content,
        doc_type=document.doc_type,
        evidence_id=evidence_id,
    )
    task_hits = _project_task_hits(
        document=document,
        content=content,
        meta=meta,
        evidence_id=evidence_id,
    )
    suggested_hits = _suggested_task_hits(
        document=document,
        content=content,
        meta=meta,
        evidence_id=evidence_id,
        inferred=inferred_hits,
    )
    assigned_key = _assigned_task_key(meta)
    if assigned_key is not None:
        spec = MATERIAL_SPEC_BY_KEY[assigned_key]
        category_suggestion = {
            "key": spec.key,
            "title": spec.title,
            "confidence": "high",
            "matched_keywords": [],
            "is_background": False,
            "reason": "Uploaded from a specific Pre-DD material card and assigned to that category.",
        }
    else:
        category_suggestion = suggest_material_category(filename=document.filename, text=content)
    category_suggestions = _material_category_suggestions(
        document=document,
        content=content,
        meta=meta,
        evidence_id=evidence_id,
        inferred=inferred_hits,
    )
    return {
        "id": str(document.id),
        "evidence_id": evidence_id,
        "filename": document.filename,
        "doc_type": document.doc_type,
        "parse_status": document.parse_status,
        "source_type": meta.get("source_type"),
        "is_auto_collected": _is_auto_collected(meta),
        "source_title": meta.get("public_source_title"),
        "source_url": meta.get("public_url"),
        "source_intro": meta.get("public_intro"),
        "source_connector": meta.get("connector"),
        "source_published_at": meta.get("published_at"),
        "collection_steps": list(meta.get("collection_steps") or []),
        "fmt": meta.get("fmt"),
        "unit_count": meta.get("unit_count"),
        "text_chars": int(meta.get("text_chars") or len(content or "")),
        "text_preview": _preview(content),
        "material_category_suggestion": category_suggestion,
        "material_category_suggestions": category_suggestions,
        "pre_dd_task_keys": [hit["task_key"] for hit in task_hits],
        "pre_dd_task_hits": task_hits,
        "suggested_pre_dd_task_keys": [hit["task_key"] for hit in suggested_hits],
        "suggested_pre_dd_task_hits": suggested_hits,
        "confirmed_pre_dd_task_keys": [hit["task_key"] for hit in task_hits],
        "rejected_pre_dd_task_keys": _rejected_task_keys(meta),
        "warnings": list(meta.get("warnings") or []),
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
    }


def project_material_search_result(document: Document, chunk: Chunk, *, query: str) -> dict | None:
    """Project a material chunk into a ranked search result when it matches the query."""
    terms = _query_terms(query)
    if not terms:
        return None
    content = chunk.content or ""
    score, matched_terms = _material_match_score(content, document.filename, terms)
    if score <= 0:
        return None
    meta = getattr(chunk, "meta", None)
    return {
        "document_id": str(document.id),
        "chunk_id": str(chunk.id),
        "evidence_id": _meta_evidence_id(meta),
        "filename": document.filename,
        "doc_type": document.doc_type,
        "score": score,
        "matched_terms": matched_terms,
        "snippet": _search_snippet(content, matched_terms),
        "updated_at": document.updated_at.isoformat(),
    }


def search_material_records(
    records: list[tuple[Document, Chunk]],
    *,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """Return ranked material search results for document/chunk records."""
    items = [
        item
        for document, chunk in records
        if (item := project_material_search_result(document, chunk, query=query)) is not None
    ]
    items.sort(key=lambda item: (item["score"], item["updated_at"]), reverse=True)
    return items[: max(1, limit)]


async def list_deal_materials(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
) -> list[dict]:
    """List stored materials for a deal."""
    documents = (
        await db.execute(
            select(Document)
            .where(
                Document.institution_id == institution_id,
                Document.deal_id == deal_id,
            )
            .order_by(Document.updated_at.desc(), Document.created_at.desc())
        )
    ).scalars().all()
    if not documents:
        return []

    document_ids = [document.id for document in documents]
    chunks = (
        await db.execute(
            select(Chunk).where(
                Chunk.institution_id == institution_id,
                Chunk.document_id.in_(document_ids),
            )
        )
    ).scalars().all()
    first_chunk_by_doc: dict[uuid.UUID, Chunk] = {}
    for chunk in chunks:
        first_chunk_by_doc.setdefault(chunk.document_id, chunk)

    return [project_deal_material(document, first_chunk_by_doc.get(document.id)) for document in documents]


async def confirm_deal_material_categories(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    document_id: uuid.UUID,
    task_keys: list[str],
    rejected_task_keys: list[str] | None = None,
) -> dict:
    """Persist user-controlled Pre-DD category assignments for a material."""
    keys = _validate_task_keys(task_keys, field_name="task_keys")
    rejected_keys = _validate_task_keys(rejected_task_keys or [], field_name="rejected_task_keys")
    rejected_keys = [key for key in rejected_keys if key not in keys]

    document = await db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.institution_id == institution_id,
            Document.deal_id == deal_id,
        )
    )
    if document is None:
        raise DealMaterialNotFound(str(document_id))

    chunk = await db.scalar(
        select(Chunk).where(
            Chunk.institution_id == institution_id,
            Chunk.document_id == document.id,
        )
    )
    if chunk is None:
        raise DealMaterialNotFound(str(document_id))

    chunk.meta = {
        **(chunk.meta if isinstance(chunk.meta, dict) else {}),
        "confirmed_pre_dd_task_keys": keys,
        "rejected_pre_dd_task_keys": rejected_keys,
    }
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.material_categories_updated",
        subject_type="deal",
        subject_id=deal_id,
        payload={
            "document_id": str(document.id),
            "task_keys": keys,
            "rejected_task_keys": rejected_keys,
        },
    )
    return project_deal_material(document, chunk)


async def search_deal_materials(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """Search deal materials by keyword and return ranked snippets."""
    exists = await db.scalar(
        select(Deal.id).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,
        )
    )
    if exists is None:
        raise DealMaterialTargetNotFound(str(deal_id))

    documents = (
        await db.execute(
            select(Document)
            .where(
                Document.institution_id == institution_id,
                Document.deal_id == deal_id,
            )
        )
    ).scalars().all()
    if not documents:
        return []

    document_by_id = {document.id: document for document in documents}
    chunks = (
        await db.execute(
            select(Chunk).where(
                Chunk.institution_id == institution_id,
                Chunk.document_id.in_(list(document_by_id)),
            )
        )
    ).scalars().all()
    records = [
        (document_by_id[chunk.document_id], chunk)
        for chunk in chunks
        if chunk.document_id in document_by_id
    ]
    return search_material_records(records, query=query, limit=limit)


async def save_deal_material(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    filename: str | None,
    data: bytes,
    content_type: str | None = None,
    pre_dd_task_key: str | None = None,
) -> dict:
    """Save an uploaded material and attach an initial Pre-DD category when provided."""
    deal = await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,
        )
    )
    if deal is None:
        raise DealMaterialTargetNotFound(str(deal_id))
    if pre_dd_task_key is not None and pre_dd_task_key not in MATERIAL_SPEC_BY_KEY:
        raise InvalidDealMaterialCategory(f"Invalid Pre-DD material category: {pre_dd_task_key}")

    result = extract_text(filename=filename or "", data=data, content_type=content_type)
    document = Document(
        institution_id=institution_id,
        deal_id=deal.id,
        filename=_safe_filename(filename),
        doc_type=_doc_type(result),
        parse_status="completed",
    )
    db.add(document)
    await db.flush()

    chunk = Chunk(
        institution_id=institution_id,
        document_id=document.id,
        content=result.text,
        meta={
            "role": "source_text",
            "fmt": result.fmt,
            "source_type": result.source_type.value,
            "unit_count": result.unit_count,
            "text_chars": len(result.text),
            "warnings": result.warnings,
            "assigned_pre_dd_task_key": pre_dd_task_key,
        },
    )
    db.add(chunk)
    await db.flush()

    evidence = EvidenceItemRow(
        institution_id=institution_id,
        source_type="private_material",
        title=document.filename,
        url=None,
        snippet=_preview(result.text) or document.filename,
        published_at=None,
        connector="upload",
        raw={
            "deal_id": str(deal.id),
            "document_id": str(document.id),
            "chunk_id": str(chunk.id),
            "filename": document.filename,
            "doc_type": document.doc_type,
            "fmt": result.fmt,
            "source_type": result.source_type.value,
            "text_chars": len(result.text),
            "assigned_pre_dd_task_key": pre_dd_task_key,
        },
    )
    db.add(evidence)
    await db.flush()
    if pre_dd_task_key is not None:
        spec = MATERIAL_SPEC_BY_KEY[pre_dd_task_key]
        category_suggestion = {
            "key": spec.key,
            "title": spec.title,
            "confidence": "high",
            "matched_keywords": [],
            "is_background": False,
            "reason": "Uploaded from a specific Pre-DD material card and assigned to that category.",
        }
    else:
        category_suggestion = suggest_material_category(filename=document.filename, text=result.text)
    chunk.meta = {
        **(chunk.meta or {}),
        "evidence_id": str(evidence.id),
        "material_category_suggestion": category_suggestion,
    }
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.material_uploaded",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "document_id": str(document.id),
            "evidence_id": str(evidence.id),
            "filename": document.filename,
            "doc_type": document.doc_type,
            "fmt": result.fmt,
            "source_type": result.source_type.value,
            "text_chars": len(result.text),
            "material_category_suggestion": category_suggestion,
            "assigned_pre_dd_task_key": pre_dd_task_key,
            "warnings": result.warnings,
        },
    )
    return project_deal_material(document, chunk)


def _task_keywords(task_key: str) -> list[str]:
    for spec in MATERIAL_KEYWORD_SPECS:
        if spec.task_key == task_key:
            return list(spec.keywords[:4])
    return []


def _auto_collect_queries(profile: DealProfile, task_key: str) -> list[str]:
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    extraction = profile.extraction
    entity_terms = [
        extraction.company_name,
        *extraction.aliases[:2],
    ]
    topic_terms = [
        spec.title,
        extraction.track,
        extraction.sub_direction,
        extraction.product,
        extraction.tech_route,
        *_task_keywords(task_key)[:3],
    ]
    queries: list[str] = []
    for entity in entity_terms:
        entity = " ".join((entity or "").split())
        if not entity:
            continue
        queries.append(f"{entity} {spec.title}")
        for topic in topic_terms[:4]:
            topic = " ".join((topic or "").split())
            if topic:
                queries.append(f"{entity} {topic}")

    seen: set[str] = set()
    result: list[str] = []
    for query in queries:
        normalized = query.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(query)
        if len(result) >= 6:
            break
    return result


def _source_relevance_score(source: Source, *, profile: DealProfile, task_key: str) -> int:
    text = f"{source.title} {source.snippet}".lower()
    extraction = profile.extraction
    entity_terms = [
        extraction.company_name,
        *extraction.aliases,
    ]
    topic_terms = [
        MATERIAL_SPEC_BY_KEY[task_key].title,
        extraction.track,
        extraction.sub_direction,
        extraction.product,
        extraction.tech_route,
        *_task_keywords(task_key),
    ]
    score = 0
    if any(term and term.lower() in text for term in entity_terms):
        score += 65
    score += min(
        3,
        sum(1 for term in topic_terms if term and term.lower() in text),
    ) * 12
    if source.url:
        score += 5
    if source.snippet:
        score += 5
    noise_terms = ("exam", "answer", "download", "tutorial", "wiki", "question bank", "homework")
    if any(term in text for term in noise_terms):
        score -= 60
    return score


def _source_content(source: Source, *, profile: DealProfile, task_key: str) -> str:
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    intro = _preview(source.snippet, limit=360) or source.title
    parts = [
        f"Material dimension: {spec.title}",
        f"Project: {profile.extraction.company_name}",
        f"Source: {source.title}",
    ]
    if source.url:
        parts.append(f"URL: {source.url}")
    if source.published_at:
        parts.append(f"Published at: {source.published_at}")
    if source.connector:
        parts.append(f"Connector: {source.connector}")
    parts.append(f"Intro: {intro}")
    if source.snippet:
        parts.append(f"Snippet: {source.snippet}")
    return "\n".join(parts)


def _source_key(source: Source) -> str:
    return (source.url or source.title).strip().lower()


def _react_step_payload(
    *,
    task_key: str,
    loop: int,
    phase: str,
    summary: str,
    details: list[str] | None = None,
    tool_id: str | None = None,
    tool_name: str | None = None,
    status: str = "completed",
) -> dict:
    payload = {
        "id": f"pre-dd-{task_key}-{loop}-{phase}-{tool_id or 'none'}",
        "loop": loop,
        "phase": phase,
        "summary": summary,
        "details": details or [],
        "status": status,
        "created_at": datetime.now(UTC).isoformat(),
    }
    if tool_id:
        payload["tool_id"] = tool_id
        payload["tool_name"] = tool_name or tool_id
    return payload


def _collection_request(profile: DealProfile, task_key: str) -> str:
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    return f"Collect public Pre-DD materials for project {profile.extraction.company_name}, dimension {spec.title}."


def _next_round_queries(
    profile: DealProfile,
    task_key: str,
    *,
    previous_queries: list[str],
    selected_count: int,
) -> list[str]:
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    extraction = profile.extraction
    base_terms = [
        extraction.company_name,
        *extraction.aliases[:2],
    ]
    modifiers = [
        spec.title,
        "website",
        "news",
        "announcement",
        "report",
        *_task_keywords(task_key),
    ]
    previous = {query.lower() for query in previous_queries}
    queries: list[str] = []
    for entity in base_terms:
        entity = " ".join((entity or "").split())
        if not entity:
            continue
        for modifier in modifiers:
            modifier = " ".join((modifier or "").split())
            if not modifier:
                continue
            query = f"{entity} {modifier}"
            normalized = query.lower()
            if normalized in previous:
                continue
            previous.add(normalized)
            queries.append(query)
            if len(queries) >= 6:
                return queries
    if selected_count == 0:
        return [query for query in _auto_collect_queries(profile, task_key) if query.lower() not in previous][:6]
    return queries


def _normalize_next_queries(
    values: list[str] | None,
    *,
    previous_queries: list[str],
    limit: int = 6,
) -> list[str]:
    previous = {query.lower() for query in previous_queries}
    seen: set[str] = set()
    queries: list[str] = []
    for value in values or []:
        query = " ".join(str(value or "").split())
        if not query:
            continue
        normalized = query.lower()
        if normalized in previous or normalized in seen:
            continue
        seen.add(normalized)
        queries.append(query[:160])
        if len(queries) >= limit:
            break
    return queries


def _collection_source_summary(source: Source) -> dict:
    return {
        "title": source.title,
        "url": source.url,
        "published_at": source.published_at,
        "connector": source.connector,
        "snippet": _preview(source.snippet, limit=140),
    }


def _fallback_collection_decision(
    *,
    selected_count: int,
    round_selected_count: int,
    next_query_candidates: list[str],
) -> MaterialCollectionRoundDecision:
    if selected_count >= AUTO_PRE_DD_MAX_RESULTS:
        return MaterialCollectionRoundDecision(
            continue_search=False,
            rationale="本次资料收集已达到可保存资料上限，先保存当前高相关资料供用户确认归类。",
        )
    if not next_query_candidates:
        return MaterialCollectionRoundDecision(
            continue_search=False,
            rationale="当前没有新的有效检索目标，继续搜索可能只会重复已有结果。",
        )
    if selected_count < AUTO_PRE_DD_TARGET_RESULTS:
        return MaterialCollectionRoundDecision(
            continue_search=True,
            rationale="当前高相关资料仍偏少，继续用更聚焦的查询补充该 Pre-DD 维度。",
            next_queries=next_query_candidates,
        )
    if round_selected_count == 0:
        return MaterialCollectionRoundDecision(
            continue_search=False,
            rationale="上一轮没有新增可用资料，继续检索的边际价值较低。",
        )
    return MaterialCollectionRoundDecision(
        continue_search=False,
        rationale="当前已获得若干可引用资料，可以先保存并等待用户确认归类。",
    )


async def _assess_material_collection_round(
    *,
    profile: DealProfile,
    task_key: str,
    round_number: int,
    sources_count: int,
    round_selected: list[Source],
    selected: list[Source],
    next_query_candidates: list[str],
    previous_queries: list[str],
    allow_overseas: bool,
) -> MaterialCollectionRoundDecision:
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    fallback = _fallback_collection_decision(
        selected_count=len(selected),
        round_selected_count=len(round_selected),
        next_query_candidates=next_query_candidates,
    )
    if len(selected) >= AUTO_PRE_DD_MAX_RESULTS:
        return fallback
    try:
        decision = await asyncio.wait_for(
            complete_structured(
                ModelTier.FAST,
                [
                    {
                        "role": "system",
                        "content": (
                            "你是 AtomCAP 的 Pre-DD 资料自动收集控制器。"
                            "你只判断当前资料项是否还值得继续搜索，不要输出隐藏推理。"
                            "如果现有资料已足以让用户判断该 Pre-DD 维度，或下一轮可能只会重复低价值结果，"
                            "continue_search 应为 false。若继续搜索，next_queries 必须是新的、聚焦的公开信息检索词，最多 6 条。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "project": profile.extraction.company_name,
                                "aliases": profile.extraction.aliases,
                                "track": profile.extraction.track,
                                "product": profile.extraction.product,
                                "target_material_type": spec.title,
                                "round_number": round_number,
                                "round_candidate_count": sources_count,
                                "round_selected": [
                                    _collection_source_summary(source) for source in round_selected[:6]
                                ],
                                "selected_so_far_count": len(selected),
                                "selected_so_far": [
                                    _collection_source_summary(source) for source in selected[-6:]
                                ],
                                "next_query_candidates": next_query_candidates,
                                "collection_goal": (
                                    "为当前 Pre-DD 资料项收集公开出处、简介和可引用材料。"
                                    "由你根据资料质量和信息增量决定是否继续搜索。"
                                ),
                            },
                            ensure_ascii=False,
                        ),
                    },
                ],
                MaterialCollectionRoundDecision,
                allow_overseas=allow_overseas,
            ),
            timeout=12,
        )
    except Exception:  # noqa: BLE001
        return fallback

    if len(selected) >= AUTO_PRE_DD_MAX_RESULTS:
        return fallback
    next_queries = _normalize_next_queries(decision.next_queries, previous_queries=previous_queries)
    if decision.continue_search:
        if not next_queries:
            next_queries = next_query_candidates
        if not next_queries:
            return MaterialCollectionRoundDecision(
                continue_search=False,
                rationale=decision.rationale or "模型判断可继续，但没有新的有效检索目标，因此停止本次收集。",
            )
        return decision.model_copy(update={"continue_search": True, "next_queries": next_queries})
    return decision.model_copy(update={"continue_search": False, "next_queries": []})


async def _existing_auto_material_keys(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
) -> set[str]:
    documents = (
        await db.execute(
            select(Document).where(
                Document.institution_id == institution_id,
                Document.deal_id == deal_id,
            )
        )
    ).scalars().all()
    if not documents:
        return set()

    document_ids = [document.id for document in documents]
    chunks = (
        await db.execute(
            select(Chunk).where(
                Chunk.institution_id == institution_id,
                Chunk.document_id.in_(document_ids),
            )
        )
    ).scalars().all()
    keys: set[str] = set()
    for chunk in chunks:
        meta = chunk.meta if isinstance(chunk.meta, dict) else {}
        if not _is_auto_collected(meta):
            continue
        key = str(meta.get("public_url") or meta.get("public_source_title") or "").strip().lower()
        if key:
            keys.add(key)
    return keys


async def collect_pre_dd_public_materials(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    task_key: str,
    allow_overseas: bool,
    on_step: StepCallback | None = None,
) -> dict:
    """Collect public sources for one Pre-DD material category and persist selected materials."""
    if task_key not in MATERIAL_SPEC_BY_KEY:
        raise InvalidDealMaterialCategory(f"Unknown Pre-DD material task: {task_key}")
    deal = await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,
        )
    )
    if deal is None or deal.status == DealStatus.DELETED.value:
        raise DealMaterialTargetNotFound(str(deal_id))

    profile = DealProfile.model_validate(deal.data or {})
    spec = MATERIAL_SPEC_BY_KEY[task_key]
    request_text = _collection_request(profile, task_key)
    steps: list[dict] = []

    async def append_step(step: dict) -> None:
        steps.append(step)
        if on_step is not None:
            await on_step(step)

    connectors = active_connectors(allow_overseas=allow_overseas)
    if not connectors:
        await append_step(
            _react_step_payload(
                task_key=task_key,
                loop=1,
                phase="analysis",
                summary="No public search connector is available, so this Pre-DD material cannot be collected automatically now.",
                details=["No active connector detected."],
            )
        )
        return {"items": [], "count": 0, "steps": steps, "rounds": 0}

    existing_keys = await _existing_auto_material_keys(
        db,
        institution_id=institution_id,
        deal_id=deal.id,
    )
    seen = set(existing_keys)
    selected: list[Source] = []
    all_queries: list[str] = []
    queries = _auto_collect_queries(profile, task_key)
    rounds_run = 0
    round_number = 0
    while queries:
        round_number += 1
        if round_number > AUTO_PRE_DD_SAFETY_MAX_REACT_LOOPS:
            await append_step(
                _react_step_payload(
                    task_key=task_key,
                    loop=round_number,
                    phase="observation",
                    summary="The model-led collection reached the internal safety fuse, so this run will save the currently selected materials.",
                    details=[
                        "This is a fault guard against accidental infinite collection loops, not a user search-depth setting.",
                        f"Selected useful sources: {len(selected)}",
                    ],
                )
            )
            break
        rounds_run = round_number
        plan = await generate_visible_react_plan(
            user_request=request_text,
            intent="pre_dd_material_collect",
            progress=f"Collecting public materials for {spec.title}, round {round_number}",
            observations=[
                f"Selected useful sources so far: {len(selected)}",
                f"Target Pre-DD dimension: {spec.title}",
                f"Round queries: {', '.join(queries[:6])}",
            ],
            allow_overseas=allow_overseas,
        )
        await append_step(
            _react_step_payload(
                task_key=task_key,
                loop=round_number,
                phase="analysis",
                summary=plan,
                details=[
                    f"Target material type: {spec.title}",
                    f"Selected useful sources: {len(selected)}",
                    f"Candidate queries: {', '.join(queries[:6])}",
                ],
            )
        )
        await append_step(
            _react_step_payload(
                task_key=task_key,
                loop=round_number,
                phase="action",
                summary="I will search public information only for the current Pre-DD material type.",
                details=queries[:6],
                tool_id="public_web_search",
                tool_name="Public information search",
            )
        )
        all_queries.extend(queries)
        sources = await cached_gather_signals(
            connectors,
            keywords=queries,
            track="",
            days=365,
            allow_overseas=allow_overseas,
        )
        round_selected: list[Source] = []
        for source in sorted(
            sources,
            key=lambda item: _source_relevance_score(item, profile=profile, task_key=task_key),
            reverse=True,
        ):
            key = _source_key(source)
            if not key or key in seen:
                continue
            if _source_relevance_score(source, profile=profile, task_key=task_key) < 55:
                continue
            seen.add(key)
            round_selected.append(source)
            selected.append(source)
            if len(selected) >= AUTO_PRE_DD_MAX_RESULTS:
                break
        next_query_candidates = _next_round_queries(
            profile,
            task_key,
            previous_queries=all_queries,
            selected_count=len(selected),
        )
        decision = await _assess_material_collection_round(
            profile=profile,
            task_key=task_key,
            round_number=round_number,
            sources_count=len(sources),
            round_selected=round_selected,
            selected=selected,
            next_query_candidates=next_query_candidates,
            previous_queries=all_queries,
            allow_overseas=allow_overseas,
        )
        await append_step(
            _react_step_payload(
                task_key=task_key,
                loop=round_number,
                phase="observation",
                summary=(
                    f"Round returned {len(sources)} candidates and selected {len(round_selected)} sources "
                    f"related to {spec.title}. Total selected: {len(selected)}."
                ),
                details=[
                    *(f"{source.title}: {_preview(source.snippet, limit=100) or source.url or 'no summary'}" for source in round_selected[:5]),
                    (
                        decision.rationale
                        or (
                            "The collection controller decided to continue with a more focused search."
                            if decision.continue_search
                            else "The collection controller decided the current materials are enough to save."
                        )
                    ),
                ],
            )
        )
        if len(selected) >= AUTO_PRE_DD_MAX_RESULTS or not decision.continue_search:
            break
        queries = decision.next_queries

    created: list[dict] = []
    collection_steps = list(steps)
    for source in selected:
        content = _source_content(source, profile=profile, task_key=task_key)
        intro = _preview(source.snippet, limit=180) or source.title
        document = Document(
            institution_id=institution_id,
            deal_id=deal.id,
            filename=_safe_filename(f"{spec.title} - {source.title}"),
            doc_type=PUBLIC_PRE_DD_DOC_TYPE,
            parse_status="completed",
        )
        db.add(document)
        await db.flush()

        chunk = Chunk(
            institution_id=institution_id,
            document_id=document.id,
            content=content,
            meta={
                "role": "source_text",
                "fmt": "web",
                "source_type": AUTO_PRE_DD_SOURCE_TYPE,
                "material_origin": "auto_collected",
                "unit_count": 1,
                "text_chars": len(content),
                "warnings": [],
                "assigned_pre_dd_task_key": task_key,
                "public_url": source.url,
                "public_source_title": source.title,
                "public_intro": intro,
                "connector": source.connector,
                "published_at": source.published_at,
                "collection_steps": collection_steps,
            },
        )
        db.add(chunk)
        await db.flush()

        evidence = EvidenceItemRow(
            institution_id=institution_id,
            source_type=source.source_type or "web_search",
            title=source.title,
            url=source.url,
            snippet=source.snippet or intro,
            published_at=source.published_at,
            connector=source.connector,
            raw={
                **(source.raw or {}),
                "deal_id": str(deal.id),
                "document_id": str(document.id),
                "chunk_id": str(chunk.id),
                "pre_dd_task_key": task_key,
                "material_origin": "auto_collected",
                "collection_steps": collection_steps,
            },
        )
        db.add(evidence)
        await db.flush()
        chunk.meta = {**(chunk.meta or {}), "evidence_id": str(evidence.id)}
        await db.flush()
        created.append(project_deal_material(document, chunk))

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.pre_dd_materials_auto_collected",
        subject_type="deal",
        subject_id=deal.id,
        payload={
            "task_key": task_key,
            "count": len(created),
            "rounds": rounds_run,
            "react_step_count": len(collection_steps),
            "document_ids": [item["id"] for item in created],
        },
    )
    return {"items": created, "count": len(created), "steps": collection_steps, "rounds": rounds_run}

async def delete_deal_material(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    user_id: uuid.UUID | None,
    deal_id: uuid.UUID,
    document_id: uuid.UUID,
) -> None:
    """Delete a material document and related chunks/evidence for a deal."""
    document = await db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.institution_id == institution_id,
            Document.deal_id == deal_id,
        )
    )
    if document is None:
        raise DealMaterialNotFound(str(document_id))

    chunks = (
        await db.execute(
            select(Chunk).where(
                Chunk.institution_id == institution_id,
                Chunk.document_id == document.id,
            )
        )
    ).scalars().all()
    evidence_ids: list[uuid.UUID] = []
    for chunk in chunks:
        evidence_id = _meta_evidence_id(chunk.meta)
        if evidence_id:
            try:
                evidence_ids.append(uuid.UUID(evidence_id))
            except ValueError:
                continue

    await db.execute(
        delete(Chunk).where(
            Chunk.institution_id == institution_id,
            Chunk.document_id == document.id,
        )
    )
    if evidence_ids:
        await db.execute(
            delete(EvidenceItemRow).where(
                EvidenceItemRow.institution_id == institution_id,
                EvidenceItemRow.id.in_(evidence_ids),
            )
        )
    await db.execute(
        delete(Document).where(
            Document.institution_id == institution_id,
            Document.id == document.id,
        )
    )
    await db.flush()

    await record_event(
        db,
        institution_id=institution_id,
        user_id=user_id,
        event_type="deal.material_deleted",
        subject_type="deal",
        subject_id=deal_id,
        payload={
            "document_id": str(document.id),
            "filename": document.filename,
            "evidence_ids": [str(item) for item in evidence_ids],
        },
    )
