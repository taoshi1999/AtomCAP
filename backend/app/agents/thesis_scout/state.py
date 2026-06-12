"""赛道前瞻子图的状态定义。"""

from __future__ import annotations

from typing import Any, TypedDict


class ThesisScoutState(TypedDict, total=False):
    # 输入
    query: str                      # 用户原始问题
    institution_id: str
    conversation_id: str
    # 中间产物
    track_definition: dict[str, Any]   # 赛道包括什么/不包括什么
    raw_signals: list[dict]            # Connector 原始检索结果（已落 evidence_items）
    preference: dict[str, Any]         # 机构投资偏好
    history: list[dict]                # 机构历史操作
    classified_signals: list[dict]     # 热度/结构性分类后的信号
    value_chain: dict[str, Any]
    sub_directions: list[dict]
    fit: dict[str, Any]
    # 输出
    thesis: dict[str, Any] | None      # 校验通过的 Thesis payload
    progress: str                      # 当前进度文案（SSE 推送给前端）
