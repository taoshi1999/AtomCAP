"""手动创建项目/赛道草稿的纯函数构造测试（离线，无 DB）。

覆盖 api.deals._manual_deal_profile 与 api.deliverables._manual_thesis_payload：
手动录入的最小表单要能组装成通过 schema 强校验的 DealProfile / Thesis 草稿——
来源标记、项目库/工作台标志、子方向数量边界、SCHEMA_REGISTRY 入库校验均须正确。
"""
from __future__ import annotations

from app.api.deals import CreateDealBody, _manual_deal_profile
from app.api.deliverables import CreateThesisBody, _manual_thesis_payload
from app.objects import SCHEMA_REGISTRY, DeliverableType
from app.objects.deal import DealProfile, DealStatus
from app.objects.deal_list import DealSourceType
from app.objects.thesis import Thesis, ThesisStatus


# ---- 手动 Deal 草稿 ----

def test_manual_deal_profile_basic():
    body = CreateDealBody(
        company_name="  示例科技  ",
        one_line_intro="做工业质检的 AI 公司",
        track="人工智能",
        sub_direction="工业质检",
        funding_stage="A轮",
    )
    profile = _manual_deal_profile(body)
    assert profile.source_type == DealSourceType.USER_INPUT
    assert profile.status == DealStatus.SCREENING
    assert profile.user_feedback.is_in_library is True
    assert profile.workspace.created is True
    assert profile.extraction.company_name == "示例科技"  # 去空白
    assert profile.extraction.track == "人工智能"
    assert profile.extraction.sub_direction == "工业质检"
    assert profile.extraction.funding_stage == "A轮"
    assert profile.analysis.overall_fit == 50
    assert profile.analysis.track_judgement == "人工智能"
    # 手动草稿无证据，所有 Claim 必须是推断
    assert profile.analysis.highlights and all(c.inferred for c in profile.analysis.highlights)
    assert profile.analysis.next_steps and all(c.inferred for c in profile.analysis.next_steps)


def test_manual_deal_profile_revalidates():
    """组装结果必须能通过 DealProfile 强校验（入库前 model_validate 路径）。"""
    body = CreateDealBody(company_name="再校验项目")
    profile = _manual_deal_profile(body)
    DealProfile.model_validate(profile.model_dump(mode="json"))


def test_manual_deal_profile_intro_fallback():
    """无一句话介绍/补充说明时，画像回退到含项目名的占位，且信息缺口非空。"""
    body = CreateDealBody(company_name="无简介项目")
    profile = _manual_deal_profile(body)
    assert "无简介项目" in profile.analysis.portrait
    assert profile.analysis.info_gaps
    assert profile.analysis.open_questions


def test_manual_deal_profile_source_note_used_for_portrait():
    body = CreateDealBody(company_name="甲", source_note="来自 FA 推荐的早期项目")
    profile = _manual_deal_profile(body)
    assert profile.analysis.portrait == "来自 FA 推荐的早期项目"


# ---- 手动 Thesis 草稿 ----

def test_manual_thesis_pads_to_three_subdirections():
    """子方向不足 3 个时自动补足（Thesis.sub_directions min_length=3）。"""
    body = CreateThesisBody(thesis_name="储能")
    thesis = _manual_thesis_payload(body)
    assert isinstance(thesis, Thesis)
    assert thesis.thesis_name == "储能"
    assert len(thesis.sub_directions) == 3
    assert thesis.status == ThesisStatus.DRAFT


def test_manual_thesis_caps_at_seven_subdirections():
    body = CreateThesisBody(
        thesis_name="半导体",
        sub_directions=[f"方向{i}" for i in range(10)],
    )
    thesis = _manual_thesis_payload(body)
    assert len(thesis.sub_directions) == 7  # Thesis.sub_directions max_length=7
    assert thesis.sub_directions[0].name == "方向0"


def test_manual_thesis_preserves_given_names_and_trims():
    body = CreateThesisBody(
        thesis_name="  合成生物  ",
        sub_directions=["医药", "  ", "材料"],  # 空白项剔除
    )
    thesis = _manual_thesis_payload(body)
    assert thesis.thesis_name == "合成生物"
    names = [s.name for s in thesis.sub_directions]
    assert "医药" in names and "材料" in names
    assert "" not in names and "  " not in names
    assert len(thesis.sub_directions) >= 3


def test_manual_thesis_passes_schema_registry():
    """必须通过 save_deliverable 的入库强校验路径（SCHEMA_REGISTRY[THESIS]）。"""
    body = CreateThesisBody(thesis_name="氢能", one_line_view="长坡厚雪")
    thesis = _manual_thesis_payload(body)
    schema = SCHEMA_REGISTRY[DeliverableType.THESIS]
    validated = schema.model_validate(thesis.model_dump(mode="json"))
    assert validated.key_risks  # min_length=1
    assert validated.investment_reason
    for sub in validated.sub_directions:
        assert sub.fit_score is not None
        assert sub.investment_reasons  # min_length=1


def test_manual_thesis_all_claims_inferred():
    body = CreateThesisBody(thesis_name="脑机接口")
    thesis = _manual_thesis_payload(body)
    assert thesis.key_risks and all(c.inferred for c in thesis.key_risks)
    assert thesis.investment_reason and all(c.inferred for c in thesis.investment_reason)
