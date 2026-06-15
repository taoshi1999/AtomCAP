"""项目库 / 项目工作台服务单测（不连库，与 test_auth 同风格）。

覆盖纯函数决策逻辑：
- 管线状态流转守卫（is_allowed_transition）
- 用户反馈动作补丁（apply_user_action）+ 入库前 DealProfile 强校验
- summary 投影（deal_summary）
- DealProfile 向后兼容（既有无 user_feedback/workspace 的 data 仍校验通过）

接库的列表/详情/记账集成测试待 compose 环境就绪后补（与 auth 接库测试同批，见 README）。
"""

from __future__ import annotations

import datetime as dt
import uuid
from types import SimpleNamespace

import pytest

from app.objects.deal import DealProfile, DealStatus
from app.services.deals import (
    USER_ACTIONS,
    apply_user_action,
    deal_summary,
    is_allowed_transition,
)


def _valid_data(**overrides) -> dict:
    """构造一份可经 DealProfile 强校验的最小 deals.data。"""
    data = {
        "source_type": "bp_upload",
        "status": "screening",
        "extraction": {"company_name": "光羽科技", "track": "AI硬件"},
        "analysis": {"portrait": "AI 眼镜光学模组方案商", "overall_fit": 89},
    }
    data.update(overrides)
    return data


# ---------- 管线状态流转守卫 ----------

def test_forward_transitions_allowed():
    assert is_allowed_transition("sourced", "screening")
    assert is_allowed_transition("screening", "pre_dd")
    assert is_allowed_transition("pre_dd", "ic_ready")
    assert is_allowed_transition("ic_ready", "approved")


def test_reject_allowed_from_nonterminal():
    assert is_allowed_transition("screening", "rejected")
    assert is_allowed_transition("pre_dd", "rejected")
    assert is_allowed_transition("ic_ready", "rejected")


def test_terminal_states_have_no_exit():
    assert not is_allowed_transition("approved", "rejected")
    assert not is_allowed_transition("rejected", "screening")


def test_skip_and_self_transition_rejected():
    assert not is_allowed_transition("sourced", "approved")  # 跳级
    assert not is_allowed_transition("screening", "screening")  # 自环


def test_ic_ready_can_fallback_to_pre_dd():
    assert is_allowed_transition("ic_ready", "pre_dd")


# ---------- 用户反馈动作补丁 ----------

def test_add_to_library_sets_flag_and_validates():
    out = apply_user_action(_valid_data(), "add_to_library")
    assert out["user_feedback"]["is_in_library"] is True
    DealProfile.model_validate(out)  # 入库前强校验通过


def test_follow_and_dismiss_are_mutually_exclusive():
    followed = apply_user_action(_valid_data(), "follow")
    assert followed["user_feedback"]["is_liked"] is True
    assert followed["user_feedback"]["is_disliked"] is False

    dismissed = apply_user_action(followed, "dismiss")
    assert dismissed["user_feedback"]["is_disliked"] is True
    assert dismissed["user_feedback"]["is_liked"] is False


def test_abandon_sets_flag():
    out = apply_user_action(_valid_data(), "abandon")
    assert out["user_feedback"]["is_abandoned"] is True


def test_create_workspace_records_conversation():
    conv = uuid.uuid4()
    out = apply_user_action(_valid_data(), "create_workspace", {"conversation_id": conv})
    assert out["workspace"]["created"] is True
    assert out["workspace"]["conversation_id"] == str(conv)
    DealProfile.model_validate(out)


def test_apply_user_action_does_not_mutate_input():
    data = _valid_data()
    apply_user_action(data, "add_to_library")
    assert "user_feedback" not in data or not data["user_feedback"].get("is_in_library")


def test_unknown_action_raises():
    with pytest.raises(ValueError, match="未知动作"):
        apply_user_action(_valid_data(), "nope")


def test_all_user_actions_keep_data_valid():
    for action in USER_ACTIONS:
        out = apply_user_action(_valid_data(), action, {"conversation_id": uuid.uuid4()})
        DealProfile.model_validate(out)  # 每个动作产物都可入库


# ---------- DealProfile 向后兼容 ----------

def test_legacy_data_without_feedback_blocks_validates():
    """既有 deals.data（无 user_feedback / workspace）仍能校验，且默认块就位。"""
    profile = DealProfile.model_validate(_valid_data())
    assert profile.user_feedback.is_in_library is False
    assert profile.workspace.created is False


def test_default_status_screening():
    profile = DealProfile.model_validate(_valid_data())
    assert profile.status == DealStatus.SCREENING


# ---------- summary 投影 ----------

def _fake_deal(data: dict, status: str = "screening"):
    now = dt.datetime(2026, 6, 15, 10, 0, 0)
    return SimpleNamespace(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        status=status,
        data=data,
        created_at=now,
        updated_at=now,
    )


def test_deal_summary_projects_key_fields():
    deal = _fake_deal(apply_user_action(_valid_data(), "follow"))
    company = SimpleNamespace(name="深圳光羽智能科技有限公司")
    s = deal_summary(deal, company)
    assert s["company_name"] == "深圳光羽智能科技有限公司"
    assert s["status"] == "screening"
    assert s["overall_fit"] == 89
    assert s["portrait"] == "AI 眼镜光学模组方案商"
    assert s["is_liked"] is True
    assert s["is_abandoned"] is False


def test_deal_summary_tolerates_missing_company():
    deal = _fake_deal(_valid_data())
    s = deal_summary(deal, None)
    assert s["company_name"] is None
    assert s["is_in_library"] is False
