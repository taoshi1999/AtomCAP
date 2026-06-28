from __future__ import annotations

import importlib.util

import pytest

from app.services.conversations import file_ref_block
from app.services.file_generation import (
    FilePlan,
    FileSection,
    detect_file_generation_request,
    _render_docx,
    _render_pptx,
    _render_xlsx,
)


def test_detect_file_generation_request_formats() -> None:
    assert detect_file_generation_request("帮我生成一份赛道报告的word文档") == "docx"
    assert detect_file_generation_request("帮我针对该项目生成路演PPT") == "pptx"
    assert detect_file_generation_request("请导出一个项目清单 Excel 表格") == "xlsx"
    assert detect_file_generation_request("帮我推荐几个项目") is None


def test_file_ref_block_persists_as_file_ref() -> None:
    block = file_ref_block(
        {
            "type": "generated_file",
            "file_id": "file-1",
            "filename": "report.docx",
        }
    )
    assert block["type"] == "file_ref"
    assert block["file_id"] == "file-1"


def test_render_word_and_excel_files(tmp_path) -> None:
    plan = FilePlan(
        title="测试投研报告",
        subtitle="AtomCAP",
        sections=[
            FileSection(
                heading="项目摘要",
                summary="一句话概括。",
                bullets=["要点一", "要点二"],
            )
        ],
    )
    docx_path = tmp_path / "report.docx"
    xlsx_path = tmp_path / "report.xlsx"

    _render_docx(plan, docx_path)
    _render_xlsx(plan, xlsx_path)

    assert docx_path.exists()
    assert docx_path.stat().st_size > 0
    assert xlsx_path.exists()
    assert xlsx_path.stat().st_size > 0


@pytest.mark.skipif(importlib.util.find_spec("pptx") is None, reason="python-pptx 未安装")
def test_render_pptx_file(tmp_path) -> None:
    plan = FilePlan(
        title="测试路演 PPT",
        sections=[
            FileSection(
                heading="融资亮点",
                bullets=["团队具备产业经验", "产品已完成初步验证"],
            )
        ],
    )
    pptx_path = tmp_path / "deck.pptx"

    _render_pptx(plan, pptx_path)

    assert pptx_path.exists()
    assert pptx_path.stat().st_size > 0
