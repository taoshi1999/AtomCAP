"""项目获取 Agent（Deal Intake 分析流）的子图状态定义。

与赛道前瞻 / Deal Sourcing 同构：节点保持纯函数（state in → state out），不碰数据库；
偏好 / 历史 / 已有公司由 runner 在 run 创建事务中预加载注入初始 state；
Company/Deal 业务对象的落库由 runner 编排（节点只产出经校验的 DealProfile payload）。
"""

from __future__ import annotations

from typing import Any, TypedDict


class DealIntakeState(TypedDict, total=False):
    # 输入
    material: str                      # 用户带入的项目材料（BP 抽取文本 / 项目介绍 / 公司名）
    source_type: str                   # 来源类型（bp_upload / user_input / fa_recommendation / internal_excel）
    institution_id: str
    conversation_id: str
    allow_overseas: bool               # 机构合规开关，检索词出境与 LLM 调用同等对待（约定 5）
    preference_input: dict[str, Any]   # runner 预加载的 active 偏好
    history_events: list[dict]         # runner 预加载的 domain_events 回放（新→旧）
    known_companies: list[dict]        # runner 预加载的同机构已有公司（实体对齐用：{id,name,uscc,aliases}）
    # 中间产物
    extraction: dict[str, Any]         # Step 3：材料解析出的结构化事实
    raw_signals: list[dict]            # Step 4：外部补全检索结果的 LLM 视图（带预分配 evidence_id）
    evidence_sources: list[dict]       # 待落库的完整 Source（runner 成功事务批量持久化）
    matched_company_id: str | None     # Step 5：命中的已有公司 id（实体对齐结果，None 表示新建）
    # 输出
    deal_profile: dict[str, Any] | None  # 校验通过的 DealProfile payload（落 deals.data）
    progress: str                      # 当前进度文案（SSE 推送给前端）
