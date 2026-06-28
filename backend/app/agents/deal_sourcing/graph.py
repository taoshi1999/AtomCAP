"""项目获取 Agent（Deal Sourcing 搜寻流）—— 设计文档流程一的 LangGraph 子图。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agents.deal_sourcing import nodes
from app.agents.deal_sourcing.state import DealSourcingState


def build_deal_sourcing_graph():
    g = StateGraph(DealSourcingState)

    g.add_node("gen_search_strategy", nodes.gen_search_strategy)
    g.add_node("mine_signals", nodes.mine_signals)
    g.add_node("generate_candidates", nodes.generate_candidates)
    g.add_node("dedupe_candidates", nodes.dedupe_candidates)
    g.add_node("verify_candidates", nodes.verify_candidates)
    g.add_node("score_candidates", nodes.score_candidates)
    g.add_node("collect_candidate_reference_materials", nodes.collect_candidate_reference_materials)
    g.add_node("assemble_deal_list", nodes.assemble_deal_list)

    g.add_edge(START, "gen_search_strategy")
    g.add_edge("gen_search_strategy", "mine_signals")
    g.add_edge("mine_signals", "generate_candidates")
    g.add_edge("generate_candidates", "dedupe_candidates")
    g.add_edge("dedupe_candidates", "verify_candidates")
    g.add_edge("verify_candidates", "collect_candidate_reference_materials")
    g.add_edge("collect_candidate_reference_materials", "score_candidates")
    g.add_edge("score_candidates", "assemble_deal_list")
    g.add_edge("assemble_deal_list", END)

    return g.compile()


deal_sourcing_graph = build_deal_sourcing_graph()
