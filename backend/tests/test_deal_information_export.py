"""Project-library information export tests."""

from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from types import SimpleNamespace

from openpyxl import load_workbook

from app.config import settings
from app.services.deals import DEAL_EXPORT_HEADERS, export_deal_information_xlsx


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)


class _FakeDb:
    def __init__(self, deals, companies):
        self._responses = [_ExecuteResult(deals), _ExecuteResult(companies)]

    async def execute(self, _stmt):
        return self._responses.pop(0)


def _deal_data() -> dict:
    return {
        "source_type": "user_input",
        "status": "screening",
        "extraction": {
            "company_name": "光羽科技",
            "track": "AI 硬件",
        },
        "analysis": {
            "portrait": "AI 眼镜光学模组方案商",
            "overall_fit": 86,
            "highlights": [
                {"text": "核心团队具备光学产业经验。"},
                {"text": "产品已进入头部客户验证阶段。"},
            ],
            "initial_risks": [
                {"text": "客户集中度仍需核实。"},
            ],
        },
        "workspace": {
            "created": True,
            "summary": {
                "founded_at": "2021-05",
                "region": "深圳",
                "main_business": "AI 眼镜光学模组",
                "valuation": "约 3 亿元",
            },
        },
        "user_feedback": {"is_in_library": True},
    }


def test_export_deal_information_xlsx(monkeypatch, tmp_path):
    institution_id = uuid.uuid4()
    company_id = uuid.uuid4()
    deal_id = uuid.uuid4()
    deal = SimpleNamespace(
        id=deal_id,
        institution_id=institution_id,
        company_id=company_id,
        status="screening",
        data=_deal_data(),
        created_at=dt.datetime(2026, 6, 30, 9, 15),
    )
    company = SimpleNamespace(
        id=company_id,
        institution_id=institution_id,
        name="深圳光羽智能科技有限公司",
        uscc="91440300TEST001",
        profile={},
    )
    monkeypatch.setattr(settings, "generated_files_dir", str(tmp_path))

    result = asyncio.run(
        export_deal_information_xlsx(
            _FakeDb([deal], [company]),
            institution_id=institution_id,
            deal_ids=[deal_id],
        )
    )

    file_ref = result["file"]
    assert file_ref["format"] == "xlsx"
    workbook = load_workbook(tmp_path / str(institution_id) / f"{file_ref['file_id']}.xlsx")
    sheet = workbook["项目信息"]
    headers = [cell.value for cell in sheet[1]]
    values = [cell.value for cell in sheet[2]]

    assert headers == DEAL_EXPORT_HEADERS
    assert values[0] == "深圳光羽智能科技有限公司"
    assert values[1] == "2021-05"
    assert values[2] == "2026-06-30 09:15"
    assert values[3] == "用户录入"
    assert values[4] == "初筛中"
    assert values[5] == "深圳"
    assert values[6] == "AI 眼镜光学模组"
    assert values[7] == "约 3 亿元"
    assert "核心团队具备光学产业经验" in values[8]
    assert "客户集中度仍需核实" in values[9]
    assert values[10] == "深圳光羽智能科技有限公司 / 91440300TEST001"
