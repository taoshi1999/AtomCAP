"""认证 API：机构引导注册 + 登录。

注册即机构引导（bootstrap）：创建机构 + 首个用户。
后续成员加入同一机构走邀请流程（Phase 0 之后，见 README 待办）。
注册/登录均写 domain_events（核心约定 4）。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.models import Institution, User
from app.security import create_access_token, hash_password, verify_password
from app.services.events import record_event

router = APIRouter()


class RegisterRequest(BaseModel):
    institution_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    # bcrypt 明文上限 72 字节，schema 层显式约束避免静默截断
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 秒


def _token_response(user: User) -> TokenResponse:
    token = create_access_token(user_id=user.id, institution_id=user.institution_id)
    return TokenResponse(
        access_token=token, expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.scalar(select(User.id).where(User.email == body.email))
    if existing is not None:
        # 并发竞态由 users.email 唯一约束兜底（IntegrityError → 500，可接受）
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    institution = Institution(name=body.institution_name)
    db.add(institution)
    await db.flush()

    user = User(
        institution_id=institution.id,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    await record_event(
        db,
        institution_id=institution.id,
        event_type="institution.created",
        subject_type="institution",
        subject_id=institution.id,
        user_id=user.id,
        payload={"name": institution.name},
    )
    await record_event(
        db,
        institution_id=institution.id,
        event_type="user.registered",
        subject_type="user",
        subject_id=user.id,
        user_id=user.id,
        payload={"email": user.email},
    )
    return _token_response(user)


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == body.email))
    # 用户不存在与密码错误返回同一文案，避免邮箱枚举
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    await record_event(
        db,
        institution_id=user.institution_id,
        event_type="user.logged_in",
        subject_type="user",
        subject_id=user.id,
        user_id=user.id,
    )
    return _token_response(user)
