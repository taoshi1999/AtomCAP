"""项目工作台材料库：上传解析、Document/Chunk 入库与轻量投影。

本服务刻意保持薄层：文件字节解析继续复用 `document_extract.extract_text`，
这里只负责把解析结果绑定到 Deal，并把原文作为首个 Chunk 保存，给后续
Pre-DD/RAG 使用一个稳定落点。
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Chunk, Deal, Document, EvidenceItemRow
from app.objects.deal_list import DealSourceType
from app.services.document_extract import ExtractResult, extract_text
from app.services.events import record_event
from app.services.pre_dd import infer_material_task_hits, suggest_material_category

PREVIEW_CHARS = 240
SEARCH_SNIPPET_CHARS = 180


class DealMaterialTargetNotFound(Exception):
    """目标 Deal 不存在或不属于当前租户。"""


def _safe_filename(filename: str | None) -> str:
    name = (filename or "").strip() or "项目材料"
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


def _query_terms(query: str) -> list[str]:
    """把用户检索词收敛为少量确定性关键词；中文无空格时保留整句匹配。"""
    normalized = " ".join((query or "").split()).strip()
    if not normalized:
        return []
    terms = [term for term in re.split(r"[\s,，;；]+", normalized) if term]
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
        # 文件名命中通常更明确，权重略高；正文命中按出现次数累加。
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
    """把 Document + 首个正文 Chunk 投影为项目详情里的材料行。"""
    meta = chunk.meta if chunk is not None and isinstance(chunk.meta, dict) else {}
    content = chunk.content if chunk is not None else ""
    evidence_id = _meta_evidence_id(meta)
    task_hits = infer_material_task_hits(
        document_id=str(document.id),
        filename=document.filename,
        text=content,
        doc_type=document.doc_type,
        evidence_id=evidence_id,
    )
    category_suggestion = suggest_material_category(filename=document.filename, text=content)
    return {
        "id": str(document.id),
        "evidence_id": evidence_id,
        "filename": document.filename,
        "doc_type": document.doc_type,
        "parse_status": document.parse_status,
        "source_type": meta.get("source_type"),
        "fmt": meta.get("fmt"),
        "unit_count": meta.get("unit_count"),
        "text_chars": int(meta.get("text_chars") or len(content or "")),
        "text_preview": _preview(content),
        "material_category_suggestion": category_suggestion,
        "pre_dd_task_keys": [hit["task_key"] for hit in task_hits],
        "pre_dd_task_hits": task_hits,
        "warnings": list(meta.get("warnings") or []),
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
    }


def project_material_search_result(document: Document, chunk: Chunk, *, query: str) -> dict | None:
    """把 Document/Chunk 投影为材料检索命中；无命中返回 None。"""
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
    """离线可测的材料全文检索投影，后续可替换为 embedding / hybrid search。"""
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
    """读取某项目已上传材料，按最近更新时间倒序。"""
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


async def search_deal_materials(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """在某项目已上传材料中做 MVP 级全文检索。"""
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
) -> dict:
    """解析上传材料并绑定到 Deal。

    抛出 document_extract.DocumentError 子类给 API 层映射为 4xx/503。
    """
    deal = await db.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.institution_id == institution_id,
        )
    )
    if deal is None:
        raise DealMaterialTargetNotFound(str(deal_id))

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
        },
    )
    db.add(evidence)
    await db.flush()
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
            "warnings": result.warnings,
        },
    )
    return project_deal_material(document, chunk)
