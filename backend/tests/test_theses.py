"""赛道库服务单测。"""

from __future__ import annotations

import uuid

from app.services.theses import ThesisLibraryMatchEntry, mark_thesis_library_matches


def test_mark_thesis_library_matches_by_track_and_subdirection_names():
    existing_id = uuid.uuid4()
    payload = {
        "sub_directions": [
            {"name": "AI 硬件", "detail": "已存在的主赛道"},
            {"name": "端侧推理芯片", "detail": "已存在的子方向"},
            {"name": "机器人传感器", "detail": "新方向"},
        ]
    }

    out = mark_thesis_library_matches(
        payload,
        [
            ThesisLibraryMatchEntry(
                deliverable_id=existing_id,
                names=("AI硬件赛道", "端侧推理芯片"),
            )
        ],
    )

    assert out is not payload
    assert out["sub_directions"][0]["is_in_library"] is True
    assert out["sub_directions"][0]["deliverable_id"] == str(existing_id)
    assert out["sub_directions"][1]["is_in_library"] is True
    assert out["sub_directions"][2]["is_in_library"] is False
    assert "deliverable_id" not in out["sub_directions"][2]


def test_mark_thesis_library_matches_tolerates_legacy_payload():
    payload = {"thesis_name": "储能"}
    assert mark_thesis_library_matches(payload, []) is payload
