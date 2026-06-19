"""赛道前瞻执行编排（agents/runner.py）单元测试 —— 不连库、不连网关。

覆盖：
- 成功路径：progress 去重推送 → deliverable 强校验入库（created_by_run_id 回链）
  → thesis.created → assistant 消息带 object_ref 块 → run succeeded + 事件记账
- 失败路径：子图异常 → run failed + agent_run.failed，error 事件推送，不落脏数据
- 空产出路径：子图完成但无 thesis → 按失败处理
"""

from __future__ import annotations

import asyncio
import json
import uuid

import pytest
from sqlalchemy.dialects import postgresql

import app.agents.runner as runner
from app.agents.runner import AGENT_FAILED_MSG, EMPTY_THESIS_ERROR, run_thesis_scout
from app.models.models import (
    AgentRun,
    Deliverable,
    DomainEvent,
    EvidenceItemRow,
    EvidenceLinkRow,
    Message,
)

INST = uuid.uuid4()
USER = uuid.uuid4()
CONV = uuid.uuid4()


# ---------- 假 Session / 假子图 ----------

class _Store:
    def __init__(self):
        self.added: list = []
        self.update_params: list[dict] = []

    def of(self, cls):
        return [o for o in self.added if isinstance(o, cls)]

    def events(self):
        return [e.event_type for e in self.of(DomainEvent)]


class _NullTxn:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc):
        return False


class _FakeSession:
    def __init__(self, store: _Store):
        self._store = store

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def begin(self):
        return _NullTxn()

    def add(self, obj):
        self._store.added.append(obj)

    def add_all(self, objs):
        self._store.added.extend(objs)

    async def flush(self):
        for obj in self._store.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    async def execute(self, stmt):
        compiled = stmt.compile(dialect=postgresql.dialect())
        self._store.update_params.append(dict(compiled.params))
        return None


class _FakeGraph:
    """逐 chunk 产出 state（values 模式语义：全量 state），可注入异常。"""

    def __init__(
        self,
        chunks,
        exc: Exception | None = None,
        usage_events: list[dict[str, int]] | None = None,
    ):
        self.chunks = chunks
        self.exc = exc
        self.usage_events = usage_events
        self.initial_state: dict | None = None

    async def astream(self, state, *, stream_mode):
        assert stream_mode == "values"
        self.initial_state = state
        merged: dict = dict(state)
        for c in self.chunks:
            if self.usage_events is not None:
                self.usage_events.append(
                    {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
                )
            merged = {**merged, **c}
            yield merged
        if self.exc is not None:
            raise self.exc


def _fit():
    return {
        "track_preference": 80, "stage_match": 70, "moat_match": 60,
        "geo_match": 90, "risk_appetite_match": 75, "history_similarity": 50,
        "exclusion_penalty": 0, "total": 72, "rationale": "测试评分",
    }


def _sub(name: str):
    return {
        "name": name, "detail": "细分详情",
        "investment_reasons": [{"text": "推荐理由", "evidence_ids": [], "inferred": True}],
        "representative_companies": [], "key_risks": [],
        "suitable_stage": "A轮", "fit_score": _fit(),
    }


def thesis_payload():
    """能通过 SCHEMA_REGISTRY[THESIS] 强校验的最小 payload。"""
    return {
        "schema_version": 1,
        "thesis_name": "AI 硬件",
        "one_line_view": "上游存在结构性机会",
        "opportunity_level": "高",
        "risk_level": "中",
        "advice": "优先关注上游",
        "sub_directions": [_sub("子赛道A"), _sub("子赛道B"), _sub("子赛道C")],
        "investment_reason": [{"text": "与机构偏好匹配", "evidence_ids": [], "inferred": True}],
        "institution_fit_score": _fit(),
        "value_chain": {"upstream": [], "midstream": [], "downstream": [], "customers": []},
        "recent_signals": [],
        "representative_companies": [],
        "key_risks": [{"text": "供给过剩风险", "evidence_ids": [], "inferred": True}],
    }


FAKE_PREF = {"track_preferences": ["AI 硬件"], "stages": ["A"]}
FAKE_HISTORY = [
    {"event_type": "thesis.followed", "subject_type": "thesis", "subject_id": None,
     "occurred_at": "2026-06-01T00:00:00", "payload": {"track": "AI 硬件"}},
]


def _run(monkeypatch, graph: _FakeGraph):
    store = _Store()
    monkeypatch.setattr(runner, "SessionLocal", lambda: _FakeSession(store))
    monkeypatch.setattr(runner, "thesis_scout_graph", graph)

    async def _fake_pref(db, *, institution_id):
        assert institution_id == INST
        return dict(FAKE_PREF)

    async def _fake_hist(db, *, institution_id, **kw):
        assert institution_id == INST
        return list(FAKE_HISTORY)

    monkeypatch.setattr(runner.preferences_service, "get_active", _fake_pref)
    monkeypatch.setattr(runner, "recent_history", _fake_hist)

    async def collect():
        return [
            ev
            async for ev in run_thesis_scout(
                institution_id=INST,
                user_id=USER,
                allow_overseas=True,
                conversation_id=CONV,
                query="AI硬件还有什么机会",
            )
        ]

    return asyncio.run(collect()), store


# ---------- 成功路径 ----------

def test_success_full_pipeline(monkeypatch):
    graph = _FakeGraph(
        [
            {"progress": "正在拆解赛道定义…"},
            {"progress": "正在收集市场信号…"},
            {"progress": "正在收集市场信号…"},  # 重复 progress 应去重
            {"progress": "Thesis 已生成", "thesis": thesis_payload()},
        ]
    )
    events, store = _run(monkeypatch, graph)

    # 子图输入带租户/合规上下文（核心约定 5 的传递链路）
    assert graph.initial_state["institution_id"] == str(INST)
    assert graph.initial_state["allow_overseas"] is True
    # 偏好/历史由 runner 预加载注入（节点纯函数不碰库）
    assert graph.initial_state["preference_input"] == FAKE_PREF
    assert graph.initial_state["history_events"] == FAKE_HISTORY

    # SSE：progress 去重 + object 推真实 deliverable_id
    progresses = [e["data"] for e in events if e["event"] == "progress"]
    assert progresses == ["正在拆解赛道定义…", "正在收集市场信号…", "Thesis 已生成"]
    reasonings = [e["data"] for e in events if e["event"] == "reasoning"]
    assert reasonings
    assert "正在拆解赛道定义" in reasonings[0]
    [obj_ev] = [e for e in events if e["event"] == "object"]
    obj = json.loads(obj_ev["data"])

    # deliverable 入库：强校验 + run 回链 + 来源会话
    [d] = store.of(Deliverable)
    assert obj == {"type": "thesis", "deliverable_id": str(d.id)}
    assert d.payload["thesis_name"] == "AI 硬件"
    [run] = store.of(AgentRun)
    assert d.created_by_run_id == run.id
    assert d.source_conversation_id == CONV

    # assistant 消息：object_ref 块指向真实 deliverable
    [m] = store.of(Message)
    assert m.role == "assistant"
    assert {"type": "object_ref", "deliverable_id": str(d.id)} in m.content

    # thesis.created 事件带赛道上下文（load_history 按赛道回放的匹配依据）
    created = [e for e in store.of(DomainEvent) if e.event_type == "thesis.created"]
    assert created[0].payload["track"] == "AI 硬件"
    assert created[0].payload["one_line_view"] == "上游存在结构性机会"

    # domain_events：started → thesis.created → message.completed → succeeded
    assert store.events() == [
        "agent_run.started",
        "thesis.created",
        "message.completed",
        "agent_run.succeeded",
    ]

    # run 收尾 UPDATE：succeeded + 步骤轨迹
    [params] = store.update_params
    assert params["status"] == "succeeded"
    assert params["steps"]["trail"] == progresses
    assert params["error"] is None


def test_usage_events_are_streamed_and_persisted(monkeypatch):
    usage_events: list[dict[str, int]] = []
    graph = _FakeGraph(
        [
            {"progress": "正在拆解赛道定义…"},
            {"progress": "Thesis 已生成", "thesis": thesis_payload()},
        ],
        usage_events=usage_events,
    )
    monkeypatch.setattr(runner, "begin_usage_collection", lambda: (object(), usage_events))
    monkeypatch.setattr(runner, "end_usage_collection", lambda token: None)

    events, store = _run(monkeypatch, graph)

    usage_payloads = [json.loads(e["data"]) for e in events if e["event"] == "usage"]
    assert usage_payloads == [
        {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15, "estimated": False},
        {"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30, "estimated": False},
    ]
    [m] = store.of(Message)
    usage_blocks = [block for block in m.content if block.get("type") == "usage"]
    assert usage_blocks == [
        {
            "type": "usage",
            "usage": {
                "prompt_tokens": 20,
                "completion_tokens": 10,
                "total_tokens": 30,
                "estimated": False,
            },
        }
    ]


def test_schema_violation_marks_run_failed(monkeypatch):
    """入库前强校验（核心约定 1）：payload 不合法 → 不落 deliverable，run 标记 failed。"""
    bad = thesis_payload()
    bad["sub_directions"] = bad["sub_directions"][:1]  # 少于 3 个，违反 Schema
    graph = _FakeGraph([{"progress": "Thesis 已生成", "thesis": bad}])
    events, store = _run(monkeypatch, graph)

    assert [e["event"] for e in events][-1] == "error"
    assert store.of(Message) == []
    assert store.events() == ["agent_run.started", "agent_run.failed"]
    [params] = store.update_params
    assert params["status"] == "failed"


# ---------- 失败路径 ----------

def test_graph_exception_finishes_run_failed(monkeypatch):
    graph = _FakeGraph([{"progress": "正在拆解赛道定义…"}], exc=RuntimeError("网关超时"))
    events, store = _run(monkeypatch, graph)

    assert events == [
        {"event": "progress", "data": "正在拆解赛道定义…"},
        {"event": "reasoning", "data": "正在拆解赛道定义…\n"},
        {"event": "error", "data": AGENT_FAILED_MSG},
    ]
    assert store.of(Deliverable) == [] and store.of(Message) == []
    assert store.events() == ["agent_run.started", "agent_run.failed"]
    [params] = store.update_params
    assert params["status"] == "failed"
    assert "网关超时" in params["error"]
    assert params["steps"]["trail"] == ["正在拆解赛道定义…"]


def test_empty_thesis_treated_as_failure(monkeypatch):
    graph = _FakeGraph([{"progress": "正在组装 Thesis…", "thesis": None}])
    events, store = _run(monkeypatch, graph)

    assert [e["event"] for e in events][-1] == "error"
    assert store.events() == ["agent_run.started", "agent_run.failed"]
    [params] = store.update_params
    assert EMPTY_THESIS_ERROR in params["error"]


# ---------- 证据链路径 ----------

def test_success_persists_evidence_and_strips_hallucinated_ids(monkeypatch):
    """证据落库 + 连边 + 幻觉 id 剥除（核心约定 2 的代码级兜底）。"""
    eid_real = str(uuid.uuid4())
    eid_fake = str(uuid.uuid4())
    payload = thesis_payload()
    # 真实引用 + 幻觉引用混在同一 Claim；另一 Claim 全是幻觉引用
    payload["key_risks"] = [
        {"text": "有据风险", "evidence_ids": [eid_real, eid_fake], "inferred": False}
    ]
    payload["investment_reason"] = [
        {"text": "纯幻觉引用", "evidence_ids": [eid_fake], "inferred": False}
    ]
    graph = _FakeGraph(
        [
            {
                "progress": "正在收集市场信号…",
                "evidence_sources": [
                    {
                        "evidence_id": eid_real,
                        "source_type": "web_search",
                        "title": "信号A",
                        "url": "https://example.com/a",
                        "snippet": "摘要",
                        "published_at": "2026-06-01",
                        "connector": "bocha",
                        "raw": {"k": "v"},
                    }
                ],
            },
            {"progress": "Thesis 已生成", "thesis": payload},
        ]
    )
    events, store = _run(monkeypatch, graph)
    assert [e["event"] for e in events][-1] == "object"

    # 证据按预分配 id 落库（id 与 Claim 绑定全程一致）
    [item] = store.of(EvidenceItemRow)
    assert str(item.id) == eid_real
    assert item.institution_id == INST and item.connector == "bocha"
    assert item.raw == {"k": "v"}

    # 幻觉 id 被剥除；剥空的 Claim 自动 inferred=True，真实引用保留 inferred=False
    [d] = store.of(Deliverable)
    [risk] = d.payload["key_risks"]
    assert risk["evidence_ids"] == [eid_real] and risk["inferred"] is False
    [reason] = d.payload["investment_reason"]
    assert reason["evidence_ids"] == [] and reason["inferred"] is True

    # 实际被引用的证据与 deliverable 连边
    [lk] = store.of(EvidenceLinkRow)
    assert str(lk.from_id) == eid_real
    assert lk.to_id == d.id and lk.relation == "supports"


def test_success_without_evidence_strips_all_ids(monkeypatch):
    """无采集证据时（Connector 未配置 key 的常态路径）：一切 evidence_id 都是伪造，全部剥除。"""
    payload = thesis_payload()
    payload["key_risks"] = [
        {"text": "风险", "evidence_ids": [str(uuid.uuid4())], "inferred": False}
    ]
    graph = _FakeGraph([{"progress": "Thesis 已生成", "thesis": payload}])
    events, store = _run(monkeypatch, graph)

    assert [e["event"] for e in events][-1] == "object"
    assert store.of(EvidenceItemRow) == [] and store.of(EvidenceLinkRow) == []
    [d] = store.of(Deliverable)
    [risk] = d.payload["key_risks"]
    assert risk["evidence_ids"] == [] and risk["inferred"] is True
