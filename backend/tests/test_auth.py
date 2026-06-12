"""auth 单元测试（不连库）：密码哈希、JWT 签发/校验、get_current_user 401 路径。

接库的注册/登录集成测试待 Phase 0 末 compose 环境就绪后补（见 README 待办）。
"""

from __future__ import annotations

import asyncio
import uuid

import jwt as pyjwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import _DEV_TENANT, CurrentUser, get_current_user
from app.config import settings
from app.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

USER_ID = uuid.uuid4()
INST_ID = uuid.uuid4()


# ---------- 密码哈希 ----------

def test_password_hash_roundtrip():
    hashed = hash_password("s3cret-password")
    assert hashed != "s3cret-password"
    assert verify_password("s3cret-password", hashed)
    assert not verify_password("wrong-password", hashed)


def test_same_password_different_salt():
    assert hash_password("abc12345") != hash_password("abc12345")


# ---------- JWT ----------

def test_token_roundtrip():
    token = create_access_token(user_id=USER_ID, institution_id=INST_ID)
    claims = decode_access_token(token)
    assert claims.user_id == USER_ID
    assert claims.institution_id == INST_ID


def test_expired_token_rejected():
    token = create_access_token(user_id=USER_ID, institution_id=INST_ID, expires_minutes=-1)
    with pytest.raises(TokenError, match="过期"):
        decode_access_token(token)


def test_garbage_token_rejected():
    with pytest.raises(TokenError):
        decode_access_token("not-a-jwt")


def test_wrong_secret_rejected():
    forged = pyjwt.encode(
        {"sub": str(USER_ID), "institution_id": str(INST_ID), "exp": 9999999999},
        "attacker-secret",
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenError):
        decode_access_token(forged)


def test_missing_claims_rejected():
    incomplete = pyjwt.encode(
        {"sub": str(USER_ID), "exp": 9999999999},  # 缺 institution_id
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenError):
        decode_access_token(incomplete)


def test_non_uuid_sub_rejected():
    bad = pyjwt.encode(
        {"sub": "admin", "institution_id": str(INST_ID), "exp": 9999999999},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenError):
        decode_access_token(bad)


# ---------- get_current_user（不触库的路径） ----------

def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_missing_credentials_401_when_fallback_off(monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_fallback", False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(credentials=None, db=None))
    assert exc.value.status_code == 401
    assert exc.value.headers["WWW-Authenticate"] == "Bearer"


def test_dev_fallback_returns_fixed_tenant(monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_fallback", True)
    user = asyncio.run(get_current_user(credentials=None, db=None))
    assert user == CurrentUser(user_id=_DEV_TENANT, institution_id=_DEV_TENANT)
    assert user.allow_overseas_models is False  # 回退租户默认不允许海外模型


def test_invalid_token_401_even_with_fallback_on(monkeypatch):
    # 带了凭证就必须严格校验，fallback 不为坏 token 兜底
    monkeypatch.setattr(settings, "auth_dev_fallback", True)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(credentials=_creds("garbage"), db=None))
    assert exc.value.status_code == 401


def test_expired_token_401(monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_fallback", False)
    token = create_access_token(user_id=USER_ID, institution_id=INST_ID, expires_minutes=-1)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(credentials=_creds(token), db=None))
    assert exc.value.status_code == 401
    assert "过期" in exc.value.detail
