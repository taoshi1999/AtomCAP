"""证据链服务：Source → evidence_items 落库；结论与证据连边；幻觉 id 防线。"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import Source
from app.models.models import EvidenceItemRow, EvidenceLinkRow


async def save_sources(
    db: AsyncSession, *, institution_id: uuid.UUID, sources: list[Source]
) -> list[uuid.UUID]:
    rows = [
        EvidenceItemRow(
            institution_id=institution_id,
            source_type=s.source_type,
            title=s.title,
            url=s.url,
            snippet=s.snippet,
            published_at=s.published_at,
            connector=s.connector,
            raw=s.raw,
        )
        for s in sources
    ]
    db.add_all(rows)
    await db.flush()
    return [r.id for r in rows]


async def save_collected(
    db: AsyncSession, *, institution_id: uuid.UUID, evidence_sources: list[dict]
) -> list[uuid.UUID]:
    """落库 collect_signals 产出的证据（evidence_id 已被下游 Claim 绑定，必须原样保留）。"""
    rows = [
        EvidenceItemRow(
            id=uuid.UUID(str(es["evidence_id"])),
            institution_id=institution_id,
            source_type=es.get("source_type") or "web_search",
            title=es.get("title") or "(无标题)",
            url=es.get("url"),
            snippet=es.get("snippet") or "",
            published_at=es.get("published_at"),
            connector=es.get("connector"),
            raw=es.get("raw"),
        )
        for es in evidence_sources
    ]
    db.add_all(rows)
    await db.flush()
    return [r.id for r in rows]


async def link(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    from_id: uuid.UUID,
    to_id: uuid.UUID,
    relation: str = "supports",
) -> None:
    db.add(
        EvidenceLinkRow(
            institution_id=institution_id, from_id=from_id, to_id=to_id, relation=relation
        )
    )
    await db.flush()


def sanitize_evidence_ids(payload: object, valid_ids: set[str]) -> object:
    """剥除 payload 中不属于本次采集的 evidence_id（LLM 幻觉防线，核心约定 2 的代码级兜底）。

    剥除后证据为空的 Claim 会在入库强校验（save_deliverable → SCHEMA_REGISTRY）时
    经 Claim.model_post_init 自动标记 inferred=True，绝不静默放行伪造引用。
    注：当前 Thesis 流程的合法证据只来自本次 run 的采集；后续支持跨 run 引用
    （历史 evidence、RAG 文档）时在调用方扩大 valid_ids 即可。
    """
    if isinstance(payload, dict):
        out: dict = {}
        for k, v in payload.items():
            if k == "evidence_ids" and isinstance(v, list):
                out[k] = [i for i in v if str(i) in valid_ids]
            else:
                out[k] = sanitize_evidence_ids(v, valid_ids)
        return out
    if isinstance(payload, list):
        return [sanitize_evidence_ids(i, valid_ids) for i in payload]
    return payload


def referenced_evidence_ids(payload: object) -> set[uuid.UUID]:
    """递归提取 payload 中所有 Claim 实际引用的 evidence_ids（证据连边用）。"""
    found: set[uuid.UUID] = set()
    if isinstance(payload, dict):
        for k, v in payload.items():
            if k == "evidence_ids" and isinstance(v, list):
                for item in v:
                    try:
                        found.add(uuid.UUID(str(item)))
                    except ValueError:
                        continue
            else:
                found |= referenced_evidence_ids(v)
    elif isinstance(payload, list):
        for item in payload:
            found |= referenced_evidence_ids(item)
    return found
