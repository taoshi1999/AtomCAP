"""thesis_context_from_payload 纯函数测试 —— Thesis 视图 → 搜索策略上下文。

驱动 Thesis「生成项目池」专用端点：把整份赛道判断压成精简上下文喂给
deal_sourcing 的 gen_search_strategy。纯函数、离线、对脏数据宽容。
"""

import uuid

from app.services.thesis_context import thesis_context_from_payload


def _full_payload() -> dict:
    eid = str(uuid.uuid4())
    return {
        "thesis_name": "AI 硬件",
        "one_line_view": "端侧 AI 硬件迎来窗口期",
        "opportunity_level": "高",
        "risk_level": "中高",
        "advice": "重点布局上游模组",
        "schema_version": 1,
        "institution_fit_score": {
            "track_preference": 90, "stage_match": 80, "moat_match": 75,
            "geo_match": 70, "risk_appetite_match": 85, "history_similarity": 60,
            "exclusion_penalty": 0, "total": 82.0, "rationale": "偏好高度重合",
        },
        "investment_reason": [
            {"text": "供应链成本快速下降", "evidence_ids": [eid], "inferred": False},
            {"text": "政策窗口开启", "evidence_ids": [], "inferred": True},
        ],
        "key_risks": [{"text": "技术路线未收敛", "evidence_ids": [], "inferred": True}],
        "sub_directions": [
            {
                "name": "AI 眼镜光学模组",
                "detail": "光波导方案降本",
                "suitable_stage": "A轮",
                "investment_reasons": [{"text": "良率提升", "evidence_ids": [eid]}],
                "key_risks": [{"text": "客户集中", "evidence_ids": []}],
                "representative_companies": [{"name": "光舟半导体"}, {"name": "理湃光晶"}],
            }
        ],
        "value_chain": {
            "upstream": [{"name": "光学元件"}, {"name": "AI 芯片"}],
            "midstream": [{"name": "模组集成"}],
            "downstream": [{"name": "整机品牌"}],
            "customers": ["消费电子厂商", "工业客户"],
        },
        "representative_companies": [{"name": "Rokid"}, {"name": "雷鸟创新"}],
        "recent_signals": [
            {"kind": "structural", "title": "光波导量产成本下降 40%"},
            {"kind": "heat", "title": "多家大厂入局 AI 眼镜"},
        ],
    }


def test_full_payload_extracts_search_relevant_view():
    ctx = thesis_context_from_payload(_full_payload())

    assert ctx["thesis_name"] == "AI 硬件"
    assert ctx["one_line_view"].startswith("端侧")
    assert ctx["institution_fit"] == {"total": 82.0, "rationale": "偏好高度重合"}
    # Claim 压成纯文本，丢弃证据 id
    assert ctx["investment_reason"] == ["供应链成本快速下降", "政策窗口开启"]
    assert ctx["key_risks"] == ["技术路线未收敛"]
    # 子赛道保留拆词有用的字段
    sd = ctx["sub_directions"][0]
    assert sd["name"] == "AI 眼镜光学模组"
    assert sd["suitable_stage"] == "A轮"
    assert sd["investment_reasons"] == ["良率提升"]
    assert sd["representative_companies"] == ["光舟半导体", "理湃光晶"]
    # 产业链各层压成环节名 + 客户类型
    assert ctx["value_chain"]["upstream"] == ["光学元件", "AI 芯片"]
    assert ctx["value_chain"]["customers"] == ["消费电子厂商", "工业客户"]
    assert ctx["representative_companies"] == ["Rokid", "雷鸟创新"]
    assert ctx["recent_signals"] == ["光波导量产成本下降 40%", "多家大厂入局 AI 眼镜"]


def test_empty_and_missing_fields_are_dropped():
    ctx = thesis_context_from_payload({"thesis_name": "机器人"})
    assert ctx == {"thesis_name": "机器人"}
    # 不抛错、无空键残留
    assert "value_chain" not in ctx
    assert "sub_directions" not in ctx


def test_dirty_payload_is_tolerated():
    # 非 dict / None / 列表里混入脏类型都不应抛错
    assert thesis_context_from_payload(None) == {}  # type: ignore[arg-type]
    assert thesis_context_from_payload([]) == {}  # type: ignore[arg-type]
    dirty = {
        "thesis_name": "X",
        "investment_reason": ["纯字符串结论", {"text": ""}, 123, {"no_text": 1}],
        "sub_directions": ["不是dict会被跳过", {"name": "子赛道A"}],
        "value_chain": {"upstream": "不是列表", "customers": [1, "有效客户", ""]},
        "representative_companies": [{"name": ""}, {"name": "有效公司"}, 99],
    }
    ctx = thesis_context_from_payload(dirty)
    assert ctx["investment_reason"] == ["纯字符串结论"]
    assert [sd["name"] for sd in ctx["sub_directions"]] == ["子赛道A"]
    assert ctx["value_chain"]["upstream"] == []
    assert ctx["value_chain"]["customers"] == ["有效客户"]
    assert ctx["representative_companies"] == ["有效公司"]
