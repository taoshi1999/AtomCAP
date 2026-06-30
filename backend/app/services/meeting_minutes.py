"""Project meeting minutes: audio storage, analysis, traceable QA, and Word export."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.llm.client import ModelTier, complete_structured
from app.models.models import Deal
from app.objects.deal import (
    DealMeetingMinutes,
    DealProfile,
    MeetingExtractedInfo,
    MeetingQAItem,
    MeetingTranscriptSegment,
)
from app.services.file_generation import (
    FilePlan,
    FileSection,
    FileTable,
    create_generated_file_from_plan,
)

MeetingMode = Literal["upload", "live"]


class MeetingMinutesError(RuntimeError):
    """Raised when meeting minutes cannot be created or exported."""


class MeetingMinutesNotFound(MeetingMinutesError):
    """Raised when a meeting minutes record cannot be found."""


class MeetingInfoDraft(BaseModel):
    title: str
    summary: str
    segment_indexes: list[int] = Field(default_factory=list)


class MeetingQADraft(BaseModel):
    question: str
    answer: str
    segment_indexes: list[int] = Field(default_factory=list)


class MeetingMinutesDraft(BaseModel):
    title: str = "项目会议纪要"
    summary: str = ""
    key_infos: list[MeetingInfoDraft] = Field(default_factory=list)
    qa_pairs: list[MeetingQADraft] = Field(default_factory=list)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _safe_filename(value: str | None, *, fallback: str = "meeting-audio") -> str:
    name = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", value or "").strip()
    name = re.sub(r"\s+", " ", name)
    return (name or fallback)[:120]


def _audio_extension(filename: str | None, content_type: str | None) -> str:
    suffix = Path(filename or "").suffix.lower().lstrip(".")
    if suffix in {"webm", "mp3", "m4a", "wav", "ogg", "mp4"}:
        return suffix
    mapping = {
        "audio/webm": "webm",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
    }
    return mapping.get((content_type or "").lower(), "webm")


async def _transcribe_audio_if_configured(
    *,
    audio_bytes: bytes,
    filename: str,
    content_type: str | None,
) -> tuple[str | None, str | None, str]:
    """Best-effort server-side ASR for uploaded recordings.

    The current product flow already supports live browser transcripts. Uploaded
    historical recordings need a server-side ASR provider; we keep it optional so
    local/dev environments without audio credentials still save the recording and
    produce a traceable fallback minutes object.
    """
    model = (settings.openai_asr_model or "").strip()
    api_key = (settings.openai_api_key or "").strip()
    if not model or not api_key:
        return None, None, "not_configured"

    try:
        client = AsyncOpenAI(
            base_url=settings.openai_base_url,
            api_key=api_key,
            timeout=settings.llm_request_timeout_seconds,
        )
        response = await asyncio.wait_for(
            client.audio.transcriptions.create(
                model=model,
                file=(filename, audio_bytes, content_type or "application/octet-stream"),
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            ),
            timeout=max(settings.llm_request_timeout_seconds, 45),
        )
    except Exception:  # noqa: BLE001 - ASR is optional; downstream fallback is safer for users.
        return None, None, "failed"

    payload = response.model_dump() if hasattr(response, "model_dump") else response
    if not isinstance(payload, dict):
        payload = {}
    text = _clean_text(str(payload.get("text") or ""))
    segments_payload = payload.get("segments") or []
    segments: list[dict[str, Any]] = []
    if isinstance(segments_payload, list):
        for index, item in enumerate(segments_payload[:120]):
            if not isinstance(item, dict):
                continue
            segment_text = _clean_text(str(item.get("text") or ""))
            if not segment_text:
                continue
            start = _to_float(item.get("start"), default=float(index * 30))
            end = _to_float(item.get("end"), default=max(start + 1, (index + 1) * 30))
            segments.append(
                {
                    "start_seconds": max(start, 0),
                    "end_seconds": max(end, start + 1),
                    "text": segment_text,
                }
            )
    return text or None, (json.dumps(segments, ensure_ascii=False) if segments else None), "completed"


def _tenant_meeting_dir(institution_id: uuid.UUID) -> Path:
    base = Path(settings.generated_files_dir).expanduser()
    if not base.is_absolute():
        base = Path(__file__).resolve().parents[2] / base
    return base / str(institution_id) / "meeting_audio"


def _normalize_segments(raw: str | None, transcript_text: str | None) -> list[MeetingTranscriptSegment]:
    parsed: list[Any] = []
    if raw:
        try:
            value = json.loads(raw)
            if isinstance(value, list):
                parsed = value
        except json.JSONDecodeError:
            parsed = []

    segments: list[MeetingTranscriptSegment] = []
    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue
        text = _clean_text(str(item.get("text") or ""))
        if not text:
            continue
        start = _to_float(item.get("start_seconds"), default=float(index * 30))
        end = _to_float(item.get("end_seconds"), default=max(start + 1, (index + 1) * 30))
        segments.append(
            MeetingTranscriptSegment(
                start_seconds=max(start, 0),
                end_seconds=max(end, start + 1),
                text=text,
            )
        )

    if segments:
        return segments

    transcript = _clean_text(transcript_text)
    if not transcript:
        return []
    parts = [part.strip() for part in re.split(r"(?<=[。！？!?；;])", transcript) if part.strip()]
    if not parts:
        parts = [transcript]
    return [
        MeetingTranscriptSegment(
            start_seconds=float(index * 30),
            end_seconds=float(index * 30 + 30),
            text=part,
        )
        for index, part in enumerate(parts[:80])
    ]


def _to_float(value: object, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _segment_window(indexes: list[int], segments: list[MeetingTranscriptSegment]) -> tuple[float, float]:
    valid = [segments[index] for index in indexes if 0 <= index < len(segments)]
    if not valid:
        return (0.0, 0.0)
    return (
        min(segment.start_seconds for segment in valid),
        max(segment.end_seconds for segment in valid),
    )


def _project_context(profile: DealProfile) -> str:
    extraction = profile.extraction
    return "\n".join(
        [
            f"项目：{extraction.company_name}",
            f"赛道：{extraction.track or '未设置'}",
            f"主营业务：{profile.workspace.summary.main_business or extraction.main_business or extraction.product or profile.analysis.portrait}",
            f"估值：{profile.workspace.summary.valuation or extraction.valuation or '未设置'}",
            f"已识别价值点：{'；'.join(claim.text for claim in profile.analysis.highlights[:5]) or '暂无'}",
            f"已识别风险点：{'；'.join(claim.text for claim in profile.analysis.initial_risks[:5]) or '暂无'}",
            f"待验证问题：{'；'.join(profile.analysis.open_questions[:8]) or '暂无'}",
        ]
    )


def _material_context(materials: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for item in materials[:12]:
        filename = str(item.get("filename") or "未命名材料")
        preview = _clean_text(str(item.get("text_preview") or item.get("source_intro") or ""))
        keys = "、".join(str(key) for key in item.get("pre_dd_task_keys", [])[:4])
        lines.append(f"- {filename}（分类：{keys or '未归类'}）：{preview[:180]}")
    return "\n".join(lines) or "暂无可用项目材料摘要。"


def _fallback_minutes(
    *,
    company_name: str,
    mode: MeetingMode,
    segments: list[MeetingTranscriptSegment],
    transcript: str,
) -> MeetingMinutesDraft:
    if not transcript:
        return MeetingMinutesDraft(
            title=f"{company_name}会议纪要",
            summary="录音已保存，但当前没有可用转写文本；系统暂无法判断会议内容。",
            key_infos=[
                MeetingInfoDraft(
                    title="资料不足，暂无法判断",
                    summary="请补充录音转写文本，或在接入 ASR 后重新生成会议纪要。",
                    segment_indexes=[],
                )
            ],
            qa_pairs=[
                MeetingQADraft(
                    question="本次会议讨论了哪些关键问题？",
                    answer="资料不足，暂无法判断。",
                    segment_indexes=[],
                )
            ],
        )
    questions = [part.strip() for part in re.split(r"[？?]\s*", transcript) if part.strip()]
    qa_pairs = [
        MeetingQADraft(
            question=f"{question[:80]}？",
            answer="该问题出现在会议转写中，需结合上下文进一步确认完整回答。",
            segment_indexes=[min(index, max(len(segments) - 1, 0))],
        )
        for index, question in enumerate(questions[:8])
    ]
    return MeetingMinutesDraft(
        title=f"{company_name}会议纪要",
        summary=f"本次会议通过{'实时录音' if mode == 'live' else '上传录音'}生成，已读取 {len(segments)} 段转写。",
        key_infos=[
            MeetingInfoDraft(
                title="会议转写摘要",
                summary=transcript[:260],
                segment_indexes=[0] if segments else [],
            )
        ],
        qa_pairs=qa_pairs
        or [
            MeetingQADraft(
                question="本次会议有哪些需要后续跟进的事项？",
                answer="转写中未识别到明确问答，建议人工复核录音。",
                segment_indexes=[0] if segments else [],
            )
        ],
    )


async def _analyze_minutes(
    *,
    profile: DealProfile,
    materials: list[dict[str, Any]],
    mode: MeetingMode,
    segments: list[MeetingTranscriptSegment],
    transcript: str,
    allow_overseas: bool = False,
) -> MeetingMinutesDraft:
    company_name = profile.extraction.company_name
    fallback = _fallback_minutes(company_name=company_name, mode=mode, segments=segments, transcript=transcript)
    if not transcript:
        return fallback

    segment_payload = [
        {
            "index": index,
            "start_seconds": round(segment.start_seconds, 2),
            "end_seconds": round(segment.end_seconds, 2),
            "text": segment.text,
        }
        for index, segment in enumerate(segments[:120])
    ]
    system = (
        "你是 AtomCAP 的会议纪要 Agent。请结合项目上下文、当前项目材料摘要和会议转写，"
        "生成可追溯的会议纪要。只抽取会议里明确出现或可由上下文直接支持的信息，不要编造。"
        "key_infos 是会议中的关键信息；qa_pairs 是会议中出现的关键问题和回答。"
        "每条都必须用 segment_indexes 标注来源片段，用于前端跳转录音。"
        "如果信息不足，请写“资料不足，暂无法判断”。"
    )
    user = json.dumps(
        {
            "project_context": _project_context(profile),
            "material_context": _material_context(materials),
            "recording_mode": mode,
            "transcript_segments": segment_payload,
        },
        ensure_ascii=False,
    )
    try:
        return await asyncio.wait_for(
            complete_structured(
                ModelTier.STANDARD,
                [{"role": "system", "content": system}, {"role": "user", "content": user}],
                MeetingMinutesDraft,
                allow_overseas=allow_overseas,
                max_repair_attempts=1,
            ),
            timeout=35,
        )
    except Exception:  # noqa: BLE001
        return fallback


def _minutes_from_draft(
    *,
    minutes_id: str,
    title: str,
    mode: MeetingMode,
    file_id: str,
    filename: str,
    content_type: str | None,
    duration_seconds: float | None,
    transcript: str,
    segments: list[MeetingTranscriptSegment],
    draft: MeetingMinutesDraft,
) -> DealMeetingMinutes:
    now = _now_iso()
    key_infos: list[MeetingExtractedInfo] = []
    for item in draft.key_infos[:12]:
        start, end = _segment_window(item.segment_indexes, segments)
        key_infos.append(
            MeetingExtractedInfo(
                title=item.title or "关键信息",
                summary=item.summary or "资料不足，暂无法判断",
                start_seconds=start,
                end_seconds=end,
            )
        )
    qa_pairs: list[MeetingQAItem] = []
    for item in draft.qa_pairs[:24]:
        start, end = _segment_window(item.segment_indexes, segments)
        qa_pairs.append(
            MeetingQAItem(
                question=item.question or "未命名问题",
                answer=item.answer or "资料不足，暂无法判断",
                start_seconds=start,
                end_seconds=end,
            )
        )
    return DealMeetingMinutes(
        id=minutes_id,
        title=draft.title or title,
        mode=mode,
        audio_file_id=file_id,
        audio_filename=filename,
        audio_mime_type=content_type,
        audio_url=f"/api/deals/meeting-minutes/audio/{file_id}",
        duration_seconds=duration_seconds,
        transcript=transcript,
        transcript_segments=segments,
        key_infos=key_infos or [
            MeetingExtractedInfo(title="资料不足，暂无法判断", summary="未能从录音中提取关键信息。")
        ],
        qa_pairs=qa_pairs or [
            MeetingQAItem(question="本次会议讨论了哪些关键问题？", answer="资料不足，暂无法判断。")
        ],
        summary=draft.summary or "资料不足，暂无法判断",
        created_at=now,
        updated_at=now,
    )


async def create_meeting_minutes(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    audio_bytes: bytes,
    filename: str,
    content_type: str | None,
    mode: MeetingMode,
    transcript_text: str | None = None,
    transcript_segments_json: str | None = None,
    duration_seconds: float | None = None,
    materials: list[dict[str, Any]] | None = None,
) -> dict:
    deal = await db.scalar(select(Deal).where(Deal.id == deal_id, Deal.institution_id == institution_id))
    if deal is None:
        raise MeetingMinutesError("项目不存在")

    profile = DealProfile.model_validate(deal.data or {})
    file_id = str(uuid.uuid4())
    ext = _audio_extension(filename, content_type)
    safe_name = _safe_filename(filename, fallback=f"{profile.extraction.company_name}-meeting.{ext}")
    if "." not in safe_name:
        safe_name = f"{safe_name}.{ext}"
    root = _tenant_meeting_dir(institution_id)
    root.mkdir(parents=True, exist_ok=True)
    audio_path = root / f"{file_id}.{ext}"
    audio_path.write_bytes(audio_bytes)
    metadata = {
        "institution_id": str(institution_id),
        "deal_id": str(deal_id),
        "filename": safe_name,
        "content_type": content_type,
        "mode": mode,
        "size_bytes": len(audio_bytes),
        "created_at": _now_iso(),
    }

    if not _clean_text(transcript_text) and not transcript_segments_json:
        asr_text, asr_segments, asr_status = await _transcribe_audio_if_configured(
            audio_bytes=audio_bytes,
            filename=safe_name,
            content_type=content_type,
        )
        transcript_text = asr_text or transcript_text
        transcript_segments_json = asr_segments or transcript_segments_json
        metadata["asr_status"] = asr_status
        if asr_status == "completed":
            metadata["asr_model"] = settings.openai_asr_model
    else:
        metadata["asr_status"] = "provided_by_client"
    audio_path.with_suffix(".json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    segments = _normalize_segments(transcript_segments_json, transcript_text)
    transcript = _clean_text(transcript_text) or " ".join(segment.text for segment in segments)
    draft = await _analyze_minutes(
        profile=profile,
        materials=materials or [],
        mode=mode,
        segments=segments,
        transcript=transcript,
    )
    minutes = _minutes_from_draft(
        minutes_id=str(uuid.uuid4()),
        title=f"{profile.extraction.company_name}会议纪要",
        mode=mode,
        file_id=file_id,
        filename=safe_name,
        content_type=content_type,
        duration_seconds=duration_seconds,
        transcript=transcript,
        segments=segments,
        draft=draft,
    )
    profile.meeting_minutes = [minutes, *profile.meeting_minutes][:20]
    deal.data = profile.model_dump(mode="json")
    await db.flush()
    return minutes.model_dump(mode="json")


def get_meeting_audio_file(
    *,
    institution_id: uuid.UUID,
    file_id: str | uuid.UUID,
) -> tuple[Path, dict[str, Any]]:
    file_uuid = str(uuid.UUID(str(file_id)))
    root = _tenant_meeting_dir(institution_id)
    metadata_candidates = list(root.glob(f"{file_uuid}.json"))
    if not metadata_candidates:
        raise MeetingMinutesNotFound("录音文件不存在。")
    metadata = json.loads(metadata_candidates[0].read_text(encoding="utf-8"))
    if str(metadata.get("institution_id")) != str(institution_id):
        raise MeetingMinutesNotFound("无权访问该录音。")
    file_candidates = [path for path in root.glob(f"{file_uuid}.*") if path.suffix != ".json"]
    if not file_candidates:
        raise MeetingMinutesNotFound("录音文件不存在。")
    return file_candidates[0], metadata


def _find_minutes(profile: DealProfile, minutes_id: str) -> DealMeetingMinutes:
    for item in profile.meeting_minutes:
        if item.id == minutes_id:
            return item
    raise MeetingMinutesNotFound("会议纪要不存在。")


async def export_meeting_minutes_docx(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    deal_id: uuid.UUID,
    minutes_id: str,
) -> dict:
    deal = await db.scalar(select(Deal).where(Deal.id == deal_id, Deal.institution_id == institution_id))
    if deal is None:
        raise MeetingMinutesError("项目不存在")
    profile = DealProfile.model_validate(deal.data or {})
    minutes = _find_minutes(profile, minutes_id)
    plan = FilePlan(
        title=f"{profile.extraction.company_name}-{minutes.title}",
        subtitle="AtomCAP 自动生成会议纪要",
        sections=[
            FileSection(
                heading="会议摘要",
                summary=minutes.summary,
                bullets=[
                    f"录音文件：{minutes.audio_filename}",
                    f"录制方式：{'实时录音' if minutes.mode == 'live' else '上传录音'}",
                    f"生成时间：{minutes.created_at}",
                ],
            ),
            FileSection(
                heading="关键信息",
                summary="系统从会议录音中提取出的关键信息。",
                bullets=[
                    f"{item.title}（{_format_time(item.start_seconds)}-{_format_time(item.end_seconds)}）：{item.summary}"
                    for item in minutes.key_infos
                ]
                or ["资料不足，暂无法判断"],
            ),
            FileSection(
                heading="关键问题 QA",
                summary="系统从会议中识别出的关键问题与回答。",
                bullets=[
                    f"Q：{item.question}\nA：{item.answer}（{_format_time(item.start_seconds)}-{_format_time(item.end_seconds)}）"
                    for item in minutes.qa_pairs
                ]
                or ["资料不足，暂无法判断"],
            ),
        ],
        tables=[
            FileTable(
                title="QA 清单",
                headers=["问题", "回答", "录音位置"],
                rows=[
                    [
                        item.question,
                        item.answer,
                        f"{_format_time(item.start_seconds)}-{_format_time(item.end_seconds)}",
                    ]
                    for item in minutes.qa_pairs
                ],
            )
        ],
    )
    generated = create_generated_file_from_plan(
        institution_id=institution_id,
        plan=plan,
        target_format="docx",
    )
    updated = minutes.model_copy(update={"generated_file": generated.to_ref(), "updated_at": _now_iso()})
    profile.meeting_minutes = [
        updated if item.id == minutes_id else item
        for item in profile.meeting_minutes
    ]
    deal.data = profile.model_dump(mode="json")
    await db.flush()
    return {"minutes": updated.model_dump(mode="json"), "file": generated.to_ref()}


def _format_time(seconds: float | int | None) -> str:
    total = max(int(seconds or 0), 0)
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
