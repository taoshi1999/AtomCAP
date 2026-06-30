"""Meeting minutes service tests."""

from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

from app.config import settings
from app.services import meeting_minutes
from app.services.meeting_minutes import (
    MeetingInfoDraft,
    MeetingMinutesDraft,
    MeetingQADraft,
    create_meeting_minutes,
    export_meeting_minutes_docx,
)


def _deal_data() -> dict:
    return {
        "source_type": "bp_upload",
        "status": "screening",
        "extraction": {
            "company_name": "光羽科技",
            "track": "AI 硬件",
            "product": "光学模组",
        },
        "analysis": {
            "portrait": "AI 眼镜光学模组方案商",
            "overall_fit": 82,
            "open_questions": ["核心客户收入占比是多少？"],
        },
    }


class FakeDb:
    def __init__(self, deal):
        self.deal = deal
        self.flushes = 0

    async def scalar(self, _stmt):
        return self.deal

    async def flush(self):
        self.flushes += 1


def test_create_meeting_minutes_and_export_docx(monkeypatch, tmp_path):
    institution_id = uuid.uuid4()
    deal_id = uuid.uuid4()
    deal = SimpleNamespace(id=deal_id, data=_deal_data())
    db = FakeDb(deal)

    monkeypatch.setattr(settings, "generated_files_dir", str(tmp_path))

    async def fake_analyze(**_kwargs):
        return MeetingMinutesDraft(
            title="Founder Call 纪要",
            summary="会议确认了客户进展和收入结构。",
            key_infos=[
                MeetingInfoDraft(title="客户进展", summary="客户 A 已完成试用。", segment_indexes=[0])
            ],
            qa_pairs=[
                MeetingQADraft(
                    question="核心客户收入占比是多少？",
                    answer="管理层表示客户 A 约占 40%。",
                    segment_indexes=[1],
                )
            ],
        )

    monkeypatch.setattr(meeting_minutes, "_analyze_minutes", fake_analyze)

    segments = [
        {"start_seconds": 3, "end_seconds": 8, "text": "客户 A 已完成试用。"},
        {"start_seconds": 12, "end_seconds": 19, "text": "核心客户收入占比约 40%。"},
    ]
    result = asyncio.run(
        create_meeting_minutes(
            db,
            institution_id=institution_id,
            deal_id=deal_id,
            audio_bytes=b"fake-audio",
            filename="founder-call.webm",
            content_type="audio/webm",
            mode="live",
            transcript_text="客户 A 已完成试用。核心客户收入占比约 40%。",
            transcript_segments_json=json.dumps(segments, ensure_ascii=False),
            duration_seconds=30,
            materials=[],
        )
    )

    assert result["title"] == "Founder Call 纪要"
    assert result["key_infos"][0]["start_seconds"] == 3
    assert result["qa_pairs"][0]["start_seconds"] == 12
    assert deal.data["meeting_minutes"][0]["id"] == result["id"]

    exported = asyncio.run(
        export_meeting_minutes_docx(
            db,
            institution_id=institution_id,
            deal_id=deal_id,
            minutes_id=result["id"],
        )
    )

    assert exported["file"]["format"] == "docx"
    assert exported["minutes"]["generated_file"]["file_id"] == exported["file"]["file_id"]
