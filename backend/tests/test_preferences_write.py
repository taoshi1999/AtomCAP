"""preferences 写路径测试 —— 不连库（假 Session）。

覆盖 services.preferences.set_active_preference / get_active_row / validate_payload：
- 校验入参：脏数据抛 ValidationError，不静默降级（与读路径相反）
- 版本号 = 机构现有 max(version) + 1，忽略入参 version
- 旧 active 行批量置否（发出 UPDATE preferences SET is_active=...）
- 新行 is_active=True、payload 内版本与行版本一致、入会话并 flush
- validate_payload 脏数据降级空偏好（与 get_active 同语义）
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.models.models import Preference
from app.services import preferences as preferences_service

INST = uuid.uuid4()


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value

    def scalar(self):
        return self._value


class _WriteSession:
    """捕获 execute(select max / update) 与 add/flush 的假 Session。

    max_version 模拟 select(func.max(version)) 的返回（机构现有最大版本）。
    """

    def __init__(self, max_version=None):
        self._max_version = max_version
        self.statements: list[str] = []
        self.added: list[Preference] = []
        self.flushed = False

    async def execute(self, stmt):
        self.statements.append(
            str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": False}))
        )
        return _ScalarResult(self._max_version)

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()  # 模拟库端 default 生成主键

    async def flush(self):
        self.flushed = True


def test_set_active_preference_first_version():
    db = _WriteSession(max_version=None)  # 机构尚无任何偏好
    row = asyncio.run(
        preferences_service.set_active_preference(
            db, institution_id=INST,
            payload={"track_preferences": ["AI 硬件"], "stages": ["A"]},
        )
    )
    assert row.version == 1
    assert row.is_active is True
    assert row.institution_id == INST
    assert row.payload["track_preferences"] == ["AI 硬件"]
    assert row.payload["version"] == 1  # payload 内版本与行版本一致
    assert db.added == [row] and db.flushed
    joined = " ".join(db.statements).lower()
    assert "update preferences set" in joined          # 旧 active 置否
    assert "max(preferences.version)" in joined          # 取下一个版本号
    # 先取版本号，再置否旧行
    assert db.statements[0].lower().startswith("select")
    assert db.statements[1].lower().startswith("update")


def test_set_active_preference_increments_and_ignores_input_version():
    db = _WriteSession(max_version=3)
    row = asyncio.run(
        preferences_service.set_active_preference(
            db, institution_id=INST,
            payload={"version": 99, "track_preferences": ["机器人"]},
        )
    )
    assert row.version == 4               # 3 + 1
    assert row.payload["version"] == 4    # 忽略入参 version=99


def test_set_active_preference_rejects_dirty_input():
    db = _WriteSession()
    with pytest.raises(ValidationError):
        asyncio.run(
            preferences_service.set_active_preference(
                db, institution_id=INST, payload={"track_preferences": "不是列表"},
            )
        )
    assert db.added == [] and not db.flushed  # 未入会话、未 flush


def test_validate_payload_degrades_dirty_and_passes_clean():
    dirty = Preference(id=uuid.uuid4(), institution_id=INST, version=1,
                       payload={"stages": 42}, is_active=True)
    assert preferences_service.validate_payload(dirty) == {}
    clean = Preference(id=uuid.uuid4(), institution_id=INST, version=2,
                       payload={"track_preferences": ["半导体"]}, is_active=True)
    assert preferences_service.validate_payload(clean)["track_preferences"] == ["半导体"]


def test_describe_for_agent_includes_current_applied_preference():
    text = preferences_service.describe_for_agent(
        {
            "version": 7,
            "name": "AI 基础设施偏好",
            "declared_strategy": {
                "focus_sectors": ["AI 基础设施", "算力"],
                "focus_stages": ["Pre-A", "A"],
                "focus_regions": ["中国", "全球"],
                "custom_dimensions": {"商业化信号": ["已签大客户", "高留存"]},
                "description": "优先看能被项目获取 Agent 直接使用的偏好说明",
            },
            "track_preferences": ["AI 基础设施"],
            "stages": ["A"],
            "geographies": ["中国"],
            "risk_appetite": "中等风险",
            "check_size": "500万-2000万",
        }
    )

    assert "名称：AI 基础设施偏好" in text
    assert "版本：v7" in text
    assert "关注赛道：AI 基础设施、算力" in text
    assert "商业化信号：已签大客户、高留存" in text
