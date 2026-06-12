"""赛道前瞻 Agent —— 设计文档 8 步工作流的 LangGraph 子图。

parse_track（赛道定义拆解）
  → 并行：collect_signals ｜ load_preference ｜ load_history
  → classify_signals（热度 vs 结构性，结构性加权）
  → value_chain（产业链拆解）
  → gen_sub_directions（3–7 个子赛道）
  → fit_score（机构匹配度分项评分）
  → assemble_thesis（组装 + Pydantic 校验 + evidence 绑定 + 落库）

每个节点完成即更新 progress（经 SSE 推送给前端），全程作为异步任务执行。
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agents.thesis_scout import nodes
from app.agents.thesis_scout.state import ThesisScoutState


def build_thesis_scout_graph():
    g = StateGraph(ThesisScoutState)

    g.add_node("parse_track", nodes.parse_track)
    g.add_node("collect_signals", nodes.collect_signals)
    g.add_node("load_preference", nodes.load_preference)
    g.add_node("load_history", nodes.load_history)
    g.add_node("classify_signals", nodes.classify_signals)
    g.add_node("value_chain", nodes.value_chain)
    g.add_node("gen_sub_directions", nodes.gen_sub_directions)
    g.add_node("fit_score", nodes.fit_score)
    g.add_node("assemble_thesis", nodes.assemble_thesis)

    g.add_edge(START, "parse_track")
    # 三路并行收集，全部完成后进入信号分类
    g.add_edge("parse_track", "collect_signals")
    g.add_edge("parse_track", "load_preference")
    g.add_edge("parse_track", "load_history")
    g.add_edge(["collect_signals", "load_preference", "load_history"], "classify_signals")
    g.add_edge("classify_signals", "value_chain")
    g.add_edge("value_chain", "gen_sub_directions")
    g.add_edge("gen_sub_directions", "fit_score")
    g.add_edge("fit_score", "assemble_thesis")
    g.add_edge("assemble_thesis", END)

    # 生产环境传入 Postgres checkpointer 以支持中断恢复：
    # graph.compile(checkpointer=PostgresSaver(...))
    return g.compile()


thesis_scout_graph = build_thesis_scout_graph()
