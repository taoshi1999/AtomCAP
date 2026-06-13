"""赛道前瞻子图的状态定义。"""

from __future__ import annotations

from typing import Any, TypedDict


class ThesisScoutState(TypedDict, total=False):
    # 输入
    query: str                      # 用户原始问题
    institution_id: str
    conversation_id: str
    allow_overseas: bool            # 机构合规开关，LLM 调用前必须传入档位路由（核心约定 5）
    preference_input: dict[str, Any]   # runner 预加载的 active 偏好（节点不碰库，约定见 runner）
    history_events: list[dict]         # runner 预加载的 domain_events 回放（新→旧）
    # 中间产物
    track_definition: dict[str, Any]   # 赛道包括什么/不包括什么
    raw_signals: list[dict]            # Connector 检索结果的 LLM 视图（带预分配 evidence_id，不含 raw 报文）
    evidence_sources: list[dict]       # 待落库的完整 Source（含 raw 报文；runner 成功事务中批量持久化）
    preference: dict[str, Any]         # 机构投资偏好
    history: list[dict]                # 机构历史操作
    classified_signals: list[dict]     # 热度/结构性分类后的信号
    value_chain: dict[str, Any]
    sub_directions: list[dict]
    fit: dict[str, Any]
    # 输出
    thesis: dict[str, Any] | None      # 校验通过的 Thesis payload
    progress: str                      # 当前进度文案（SSE 推送给前端）
