"""UserAction 落库服务单测（纯函数，不连库，与 test_deals 同风格）。

覆盖：
- action_strength：polarity/weight 取自设计文档行为权重表，confidence=1.0
- 动作映射表只含有明确偏好语义的动作（系统初筛推进/立项通过不落 UserAction）
- snapshot_from_deal / snapshot_from_thesis：从对象 data 抽取快照、缺字段不臆造
- build_user_action：组装 UserAction、强度派生、标签与目标回填
- record_user_action：user_id 为空（开发回退）时返回 None 不触库

接库的真实插入集成测试待 compose 环境就绪后补（与 deals/auth 接库测试同批）。
"""

from __future__ import annotations

import asyncio
import uuid

from app.objects.experience import (
    ACTION_WEIGHTS,
    Polarity,
    UserAction,
    UserActionType,
)
from app.services.user_actions import (
    DEAL_FEEDBACK_ACTIONS,
    DEAL_TRANSITION_ACTIONS,
    THESIS_ACTIONS,
    action_strength,
    build_user_action,
    record_user_action,
    snapshot_from_deal,
    snapshot_from_thesis,
)


def test_action_strength_matches_weight_table():
    # 正向（加入项目库 +3）、负向（放弃 -5）、最强负向（风险不可接受 -6）
    pos = action_strength(UserActionType.JOIN_PROJECT_LIBRARY)
    assert pos.polarity == Polarity.POSITIVE
    assert pos.weight == ACTION_WEIGHTS[UserActionType.JOIN_PROJECT_LIBRARY] == 3
    assert pos.confidence == 1.0

    neg = action_strength(UserActionType.ABANDON_DEAL)
    assert neg.polarity == Polarity.NEGATIVE
    assert neg.weight == -5

    strongest_neg = action_strength(UserActionType.MARK_RISK_UNACCEPTABLE)
    assert strongest_neg.weight == -6


def test_action_strength_unweighted_is_neutral():
    # 不在权重表的类型（如 ACCEPT_PREFERENCE_ADVICE）记 neutral / 0
    s = action_strength(UserActionType.ACCEPT_PREFERENCE_ADVICE)
    assert s.weight == 0
    assert s.polarity == Polarity.NEUTRAL


def test_mappings_only_cover_defined_action_types():
    # 所有映射目标都是合法 UserActionType，且权重表对负向动作给负权重
    for m in (DEAL_FEEDBACK_ACTIONS, DEAL_TRANSITION_ACTIONS, THESIS_ACTIONS):
        for v in m.values():
            assert isinstance(v, UserActionType)
    # 设计取舍：系统初筛推进/立项通过不落 UserAction（domain_events 仍记），故不在流转映射里
    assert "screening" not in DEAL_TRANSITION_ACTIONS
    assert "approved" not in DEAL_TRANSITION_ACTIONS
    # 否决推进是负向信号
    assert action_strength(DEAL_TRANSITION_ACTIONS["rejected"]).polarity == Polarity.NEGATIVE
    # 上会是最强正向
    assert action_strength(DEAL_TRANSITION_ACTIONS["ic_ready"]).weight == 6
    assert THESIS_ACTIONS["dismiss_track"] == UserActionType.DISLIKE_THESIS
    assert action_strength(THESIS_ACTIONS["dismiss_track"]).polarity == Polarity.NEGATIVE
    assert THESIS_ACTIONS["join_project_library"] == UserActionType.JOIN_PROJECT_LIBRARY


def test_snapshot_from_deal_extracts_portrait():
    data = {
        "extraction": {"track": "具身智能", "sub_direction": "灵巧手", "funding_stage": "天使轮"},
        "analysis": {"overall_fit": 78.5, "track_judgement": "机器人本体"},
    }
    snap = snapshot_from_deal(data)
    assert snap.sector == "具身智能"          # 优先 extraction.track
    assert snap.sub_sector == "灵巧手"
    assert snap.stage == "天使轮"
    assert snap.fit_score == 78.5
    # 缺字段不臆造
    assert snap.region is None
    assert snap.industry_chain_position is None


def test_snapshot_from_deal_falls_back_to_track_judgement():
    snap = snapshot_from_deal({"analysis": {"track_judgement": "AI 制药", "overall_fit": 50}})
    assert snap.sector == "AI 制药"           # extraction.track 缺失回退
    assert snap.fit_score == 50.0


def test_snapshot_from_deal_tolerates_empty():
    snap = snapshot_from_deal(None)
    assert snap.sector is None and snap.fit_score is None


def test_snapshot_from_thesis():
    snap = snapshot_from_thesis({"thesis_name": "固态电池"})
    assert snap.sector == "固态电池"


def test_build_user_action_fills_target_and_strength():
    inst, user, target = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    ua = build_user_action(
        action_type=UserActionType.DISLIKE_DEAL,
        institution_id=inst,
        user_id=user,
        target_type="deal",
        target_id=target,
        target_name="某机器人公司",
        snapshot=snapshot_from_deal({"extraction": {"track": "机器人"}}),
    )
    assert isinstance(ua, UserAction)
    assert ua.action_type == UserActionType.DISLIKE_DEAL
    assert ua.action_label == "不感兴趣"
    assert ua.target.target_id == str(target)
    assert ua.target.target_name == "某机器人公司"
    assert ua.action_strength.weight == -3
    assert ua.action_strength.polarity == Polarity.NEGATIVE
    assert ua.target_snapshot.sector == "机器人"
    # 默认未扫描，供 5min 增量扫描去重
    assert ua.processing_status.experience_agent_scanned is False
    # payload 可 JSON 序列化（落 JSONB）
    assert ua.model_dump(mode="json")["action_type"] == "dislike_deal"


def test_record_user_action_skips_when_no_user():
    # 开发回退无登录用户：返回 None 不触库（db 传 None 也不应被访问）
    result = asyncio.run(
        record_user_action(
            None,
            action_type=UserActionType.FOLLOW_THESIS,
            institution_id=uuid.uuid4(),
            user_id=None,
            target_type="thesis",
            target_id=uuid.uuid4(),
        )
    )
    assert result is None
