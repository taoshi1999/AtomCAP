"""文件型 BP 材料解析（app/services/document_extract.py）单元测试 —— 纯离线，不连网络/库/网关。

覆盖：
- 格式分派：扩展名优先、content-type 兜底、不支持格式 / 旧二进制 .doc/.xls 报错
- 体积守卫（超限）、空文件守卫、抽取后空文本守卫
- 纯文本解码：UTF-8 与 GB18030 中文回退
- CSV 行抽取
- Word(.docx)：段落 + 表格按行拼接（真实 python-docx 构造再回读）
- Excel(.xlsx)：多工作表 + 单元格制表符拼接（真实 openpyxl 构造再回读）
- PDF：分派与多页拼接（注入假 pdfplumber，免重型依赖）
- source_type 推断：Excel→internal_excel，PDF/Word/文本→bp_upload
"""

from __future__ import annotations

import io
import sys
import types

import pytest

import app.services.document_extract as de
from app.objects.deal_list import DealSourceType


# ---------- 格式分派 ----------

def test_detect_by_extension_wins_over_mime():
    assert de._detect_format("bp.pdf", "text/plain") == "pdf"
    assert de._detect_format("项目.DOCX", None) == "docx"
    assert de._detect_format("表.xlsx", None) == "xlsx"


def test_detect_by_mime_fallback_when_no_ext():
    assert de._detect_format("noext", "application/pdf") == "pdf"
    assert (
        de._detect_format(
            "noext",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        == "xlsx"
    )


def test_unsupported_format_raises():
    with pytest.raises(de.UnsupportedDocumentError):
        de._detect_format("a.png", "image/png")


def test_legacy_binary_doc_xls_rejected_with_guidance():
    with pytest.raises(de.UnsupportedDocumentError):
        de.extract_text(filename="old.doc", data=b"x" * 100)
    with pytest.raises(de.UnsupportedDocumentError):
        de.extract_text(filename="old.xls", data=b"x" * 100)


# ---------- 守卫 ----------

def test_empty_file_guard():
    with pytest.raises(de.EmptyDocumentError):
        de.extract_text(filename="a.txt", data=b"")


def test_too_large_guard():
    big = b"a" * (de.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(de.DocumentTooLargeError):
        de.extract_text(filename="a.txt", data=big)


def test_text_too_short_guard():
    # 抽取后有效文本低于下限 → 视为没抽到东西
    with pytest.raises(de.EmptyDocumentError):
        de.extract_text(filename="a.txt", data="短".encode("utf-8"))


# ---------- 纯文本 / CSV ----------

def test_text_utf8():
    r = de.extract_text(
        filename="intro.txt", data="光羽科技做 AI 眼镜光学模组，Pre-A 轮。".encode("utf-8")
    )
    assert "光羽科技" in r.text
    assert r.fmt == "text"
    assert r.source_type is DealSourceType.BP_UPLOAD


def test_text_gb18030_fallback():
    raw = "北京硬科技有限公司，主营激光雷达。".encode("gb18030")
    r = de.extract_text(filename="intro.md", data=raw)
    assert "激光雷达" in r.text


def test_csv_rows_and_source_type():
    csv = "公司,赛道,轮次\n光羽科技,AI硬件,Pre-A\n深瞳,机器人,A".encode("utf-8")
    r = de.extract_text(filename="pool.csv", data=csv)
    assert "光羽科技" in r.text and "深瞳" in r.text
    assert r.source_type is DealSourceType.INTERNAL_EXCEL


# ---------- Word ----------

def test_docx_paragraphs_and_tables():
    docx = pytest.importorskip("docx")
    doc = docx.Document()
    doc.add_paragraph("光羽科技 项目商业计划书")
    doc.add_paragraph("一句话介绍：AI 眼镜光学模组供应商。")
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "融资轮次"
    table.cell(0, 1).text = "Pre-A"
    table.cell(1, 0).text = "估值"
    table.cell(1, 1).text = "1.2 亿元"
    buf = io.BytesIO()
    doc.save(buf)
    r = de.extract_text(filename="bp.docx", data=buf.getvalue())
    assert "光羽科技" in r.text
    assert "融资轮次" in r.text and "Pre-A" in r.text  # 表格被拼进文本
    assert r.fmt == "docx"
    assert r.source_type is DealSourceType.BP_UPLOAD
    assert r.unit_count > 0


# ---------- Excel ----------

def test_xlsx_multi_sheet():
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "项目池"
    ws1.append(["公司", "赛道", "轮次"])
    ws1.append(["光羽科技", "AI 硬件", "Pre-A"])
    ws2 = wb.create_sheet("备注")
    ws2.append(["来源", "FA 推荐"])
    buf = io.BytesIO()
    wb.save(buf)
    r = de.extract_text(filename="deals.xlsx", data=buf.getvalue())
    assert "光羽科技" in r.text
    assert "项目池" in r.text and "备注" in r.text  # 工作表名都在
    assert r.fmt == "xlsx"
    assert r.source_type is DealSourceType.INTERNAL_EXCEL
    assert r.unit_count == 2


# ---------- PDF（注入假 pdfplumber，免重型依赖） ----------

class _FakePage:
    def __init__(self, text):
        self._text = text

    def extract_text(self):
        return self._text


class _FakePdf:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _install_fake_pdfplumber(monkeypatch, pages):
    mod = types.ModuleType("pdfplumber")
    mod.open = lambda _stream: _FakePdf([_FakePage(p) for p in pages])  # type: ignore
    monkeypatch.setitem(sys.modules, "pdfplumber", mod)


def test_pdf_multi_page_join(monkeypatch):
    _install_fake_pdfplumber(monkeypatch, ["第一页：光羽科技 BP", "第二页：团队与财务"])
    r = de.extract_text(filename="bp.pdf", data=b"%PDF-1.4 fake")
    assert "光羽科技" in r.text and "团队与财务" in r.text
    assert r.fmt == "pdf"
    assert r.unit_count == 2
    assert r.source_type is DealSourceType.BP_UPLOAD


def test_pdf_scanned_no_text_warns(monkeypatch):
    # 扫描件：每页 extract_text 返回空 → 抽取后空文本，触发 EmptyDocumentError
    _install_fake_pdfplumber(monkeypatch, ["", ""])
    with pytest.raises(de.EmptyDocumentError):
        de.extract_text(filename="scan.pdf", data=b"%PDF-1.4 fake")


def test_pdf_dependency_missing(monkeypatch):
    # 模拟未安装 pdfplumber：import 失败 → DependencyMissingError
    monkeypatch.setitem(sys.modules, "pdfplumber", None)
    with pytest.raises(de.DependencyMissingError):
        de.extract_text(filename="bp.pdf", data=b"%PDF-1.4 fake")
