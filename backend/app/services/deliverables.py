"""交付结果对象的存取服务 —— 入库前强制 Schema 校验。"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Deliverable
from app.objects import SCHEMA_REGISTRY, DeliverableType


async def save_deliverable(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    dtype: DeliverableType,
    payload: dict,
    source_conversation_id: uuid.UUID | None = None,
    created_by_run_id: uuid.UUID | None = None,
) -> Deliverable:
    schema = SCHEMA_REGISTRY[dtype]
    validated = schema.model_validate(payload)  # 校验不过直接抛错，绝不入库脏数据
    row = Deliverable(
        institution_id=institution_id,
        type=dtype.value,
        schema_version=validated.schema_version,
        payload=validated.model_dump(mode="json"),
        source_conversation_id=source_conversation_id,
        created_by_run_id=created_by_run_id,
    )
    db.add(row)
    await db.flush()
    return row
