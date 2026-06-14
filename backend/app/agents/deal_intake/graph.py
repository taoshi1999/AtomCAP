"""项目获取 Agent（Deal Intake 分析流）—— 设计文档流程二的 LangGraph 子图。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agents.deal_intake import nodes
from app.agents.deal_intake.state import DealIntakeState


def build_deal_intake_graph():
    g = StateGraph(DealIntakeState)

    g.add_node("parse_material", nodes.parse_material)
    g.add_node("enrich_external", nodes.enrich_external)
    g.add_node("align_entity", nodes.align_entity)
    g.add_node("assemble_deal", nodes.assemble_deal)

    g.add_edge(START, "parse_material")
    g.add_edge("parse_material", "enrich_external")
    g.add_edge("enrich_external", "align_entity")
    g.add_edge("align_entity", "assemble_deal")
    g.add_edge("assemble_deal", END)

    return g.compile()


deal_intake_graph = build_deal_intake_graph()
