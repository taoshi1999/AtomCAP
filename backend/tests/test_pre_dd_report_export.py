"""Pre-DD Report export tests."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

from app.config import settings
from app.objects.base import Claim
from app.objects.dd_report import (
    ChecklistDimension,
    ChecklistItem,
    DDReport,
    PreDDMeetingQuestion,
    PreDDProjectOverview,
    PreDDReport,
)
from app.services.pre_dd_brief import export_pre_dd_report_docx


class FakeDb:
    def __init__(self, row):
        self.row = row

    async def scalar(self, _stmt):
        return self.row


def _sample_report(deal_id: uuid.UUID) -> DDReport:
    report = PreDDReport(
        project_overview=PreDDProjectOverview(
            founded_at=Claim(text="成立时间：2021 年"),
            region=Claim(text="地域：北京"),
            main_business=Claim(text="主营业务：光伏组件与系统集成"),
            valuation=Claim(text="估值：待确认"),
        ),
        fit_summary=Claim(text="当前机构匹配度较高。"),
        completion_score=68,
        completion_summary="14 项 Pre-DD 材料中已有部分公开资料支撑。",
        value_points=[
            Claim(text="团队具备产业背景。", evidence_ids=[uuid.uuid4()], inferred=False),
        ],
        risk_points=[
            Claim(text="客户集中度仍需核实。", evidence_ids=[uuid.uuid4()], inferred=False),
        ],
        meeting_questions=[
            PreDDMeetingQuestion(
                question="您能否提供前五大客户收入占比？",
                purpose="该问题预期收集客户集中度信息，用于判断收入稳定性。",
            )
        ],
    )
    return DDReport(
        deal_id=deal_id,
        company_name="光羽科技",
        report=report,
        checklist=[
            ChecklistItem(
                dimension=ChecklistDimension.PRODUCT,
                question="BP / 产品宣传材料",
                filled=True,
                answer=Claim(text="已收集最新版 BP。"),
            )
        ],
        sections=[],
        open_questions=["您能否提供前五大客户收入占比？"],
    )


def test_export_pre_dd_report_docx(monkeypatch, tmp_path):
    institution_id = uuid.uuid4()
    deal_id = uuid.uuid4()
    deliverable_id = uuid.uuid4()
    row = SimpleNamespace(
        id=deliverable_id,
        payload=_sample_report(deal_id).model_dump(mode="json"),
    )
    monkeypatch.setattr(settings, "generated_files_dir", str(tmp_path))

    result = asyncio.run(
        export_pre_dd_report_docx(
            FakeDb(row),
            institution_id=institution_id,
            deal_id=deal_id,
            deliverable_id=deliverable_id,
        )
    )

    assert result["report"]["company_name"] == "光羽科技"
    assert result["file"]["format"] == "docx"
    assert (tmp_path / str(institution_id) / f"{result['file']['file_id']}.docx").exists()
