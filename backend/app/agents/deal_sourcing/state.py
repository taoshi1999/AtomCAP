"""项目获取 Agent（Deal Sourcing 搜寻流）的子图状态定义。

与赛道前瞻同构：节点保持纯函数（state in → state out），不碰数据库；
偏好 / 历史 / 来源 Thesis 由 runner 在 run 创建事务中预加载注入初始 state。
"""

from __future__ import annotations

from typing import Any, TypedDict


class DealSourcingState(TypedDict, total=False):
    # 输入
    query: str                         # 用户原始需求（"帮我找一批 AI 硬件上游项目"）
    institution_id: str
    conversation_id: str
    allow_overseas: bool               # 机构合规开关，检索词出境与 LLM 调用同等对待（约定 5）
    preference_input: dict[str, Any]   # runner 预加载的 active 偏好
    history_events: list[dict]         # runner 预加载的 domain_events 回放（新→旧）
    thesis_context: dict[str, Any]     # runner 预加载的来源 Thesis 视图（从赛道生成项目池时）
    source_thesis_id: str | None       # 来源 Thesis 对象 id（DealList 回链）
    # 中间产物
    search_strategy: dict[str, Any]    # Step 2：检索主题 + 优先信号 + 关键词
    raw_signals: list[dict]            # Connector 检索结果的 LLM 视图（带预分配 evidence_id）
    evidence_sources: list[dict]       # 待落库的完整 Source（含 raw 报文；runner 成功事务批量持久化）
    candidates: list[dict]             # Step 4-7：候选公司草稿（实体去重后）
    # 输出
    deal_list: dict[str, Any] | None   # 校验通过的 DealList payload
    progress: str                      # 当前进度文案（SSE 推送给前端）
