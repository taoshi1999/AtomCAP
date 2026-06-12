"""密码哈希与 JWT 签发/校验。

- bcrypt 哈希（passlib），密码明文上限 72 字节（bcrypt 算法限制，schema 层同步约束）
- JWT 携带 sub（user_id）与 institution_id 两个租户定位声明；
  allow_overseas_models 等合规开关**不进 token**——必须每次请求时从库里读最新值
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    """JWT 校验失败（过期 / 篡改 / 缺声明 / 格式错误）。"""


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    institution_id: uuid.UUID


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    *,
    user_id: uuid.UUID,
    institution_id: uuid.UUID,
    expires_minutes: int | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    minutes = settings.access_token_expire_minutes if expires_minutes is None else expires_minutes
    payload = {
        "sub": str(user_id),
        "institution_id": str(institution_id),
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
        "token_type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenClaims:
    try:
        data = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "institution_id"]},
        )
        return TokenClaims(
            user_id=uuid.UUID(data["sub"]),
            institution_id=uuid.UUID(data["institution_id"]),
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenError("凭证已过期") from e
    except (jwt.PyJWTError, ValueError) as e:  # ValueError: UUID 解析失败
        raise TokenError("凭证无效") from e
