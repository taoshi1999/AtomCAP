"""交付结果对象的公共基础。

AtomCAP 三类对象之一的「交付结果对象」：所有专用 Agent 的输出都必须是
经 Schema 严格校验的结构化对象，而非纯文本。本模块定义公共约定：

- DeliverableType：对象类型枚举，前端渲染注册表以它为 key
- Claim：带证据链的结论单元 —— 任何结论性内容都用 Claim 表达，
  没有 evidence_ids 支撑的结论必须显式标记 inferred=True（模型推断）
- BaseDeliverable：公共元信息（schema_version 必填，对象会长期存储并演进）
"""

from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class DeliverableType(StrEnum):
    THESIS = "thesis"                # 赛道前瞻 Agent → Thesis 对象
    DEAL_LIST = "deal_list"          # 项目获取 Agent → 候选项目池
    DD_REPORT = "dd_report"          # Pre-DD Agent → 立项会前报告
    BRIEFING = "briefing"            # 赛道简报
    LP_REPORT = "lp_report"          # 投资经验沉淀 Agent → LP 汇报
    PREFERENCE_DIFF = "preference_diff"  # 经验沉淀 Agent 提出的偏好更新建议


class Claim(BaseModel):
    """带证据链的结论单元。

    产品承诺「严密的可视化证据链」，落实方式：结论与证据在数据结构上强绑定。
    evidence_ids 指向 evidence_items 表；无证据时必须 inferred=True，
    前端将渲染「模型推断」标识。
    """

    text: str = Field(description="结论内容")
    evidence_ids: list[uuid.UUID] = Field(default_factory=list, description="支撑该结论的证据 id")
    inferred: bool = Field(default=False, description="是否为无直接证据的模型推断")

    def model_post_init(self, __context: object) -> None:
        # 无证据又未标记推断的结论，自动标记为推断，绝不静默放行
        if not self.evidence_ids and not self.inferred:
            self.inferred = True


class BaseDeliverable(BaseModel):
    """所有交付结果对象的公共字段。payload 入库前必须通过对应子类校验。"""

    schema_version: int = Field(default=1, description="Schema 版本，对象长期存储必须可演进")
    created_from_conversation: uuid.UUID | None = Field(
        default=None, description="来源对话 id（系统对象 conversation）"
    )
