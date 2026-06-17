"""PreferenceAdvice 审阅队列 API。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db import get_db
from app.objects.experience import ReviewDecision, ReviewStatus
from app.services.preference_advice import (
    InvalidAdviceReview,
    PreferenceAdviceNotFound,
    generate_preference_advice,
    list_preference_advice,
    review_preference_advice,
)

router = APIRouter()


class GenerateAdviceRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=500)


class ReviewAdviceRequest(BaseModel):
    decision: ReviewDecision
    comment: str | None = None


@router.post("/generate")
async def generate_advice(
    body: GenerateAdviceRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """从成熟 ExperienceEvent 生成 PreferenceAdvice。"""
    body = body or GenerateAdviceRequest()
    stats = await generate_preference_advice(
        db, institution_id=user.institution_id, limit=body.limit
    )
    return {"status": "ok", "stats": stats.as_dict()}


@router.get("")
async def get_advice_queue(
    review_status: str | None = Query(default=ReviewStatus.PENDING_REVIEW.value),
    limit: int = Query(default=100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """PreferenceAdvice 审阅队列。传 review_status=null 可看全部。"""
    if review_status is not None and review_status not in {s.value for s in ReviewStatus}:
        raise HTTPException(status_code=422, detail=f"未知审阅状态: {review_status}")
    items = await list_preference_advice(
        db,
        institution_id=user.institution_id,
        review_status=review_status,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@router.post("/{advice_id}/review")
async def review_advice(
    advice_id: uuid.UUID,
    body: ReviewAdviceRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """接受或拒绝一条偏好建议。部分接受留给后续偏好编辑流。"""
    if body.decision == ReviewDecision.PARTIAL_ACCEPT:
        raise HTTPException(status_code=422, detail="部分接受将在偏好编辑流中支持")
    try:
        result = await review_preference_advice(
            db,
            institution_id=user.institution_id,
            user_id=user.user_id,
            advice_id=advice_id,
            decision=body.decision,
            comment=body.comment,
        )
    except PreferenceAdviceNotFound:
        raise HTTPException(status_code=404, detail="偏好建议不存在") from None
    except InvalidAdviceReview as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"status": "ok", **result}
