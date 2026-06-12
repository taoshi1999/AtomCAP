"""通用 Agent 主图 —— 意图路由。

设计文档：专用 Agent 在特定提示词下被触发。实现为 LLM 结构化分类
（不用关键词规则——触发语句形态太多样），低置信度时向用户确认。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.llm.client import ModelTier, complete_structured


class Intent(StrEnum):
    CHAT = "chat"                  # 通用对话
    THESIS_SCOUT = "thesis_scout"  # 赛道前瞻：投资方向询问
    DEAL_SOURCING = "deal_sourcing"  # 项目获取


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    track_hint: str | None = Field(default=None, description="若为赛道前瞻，提取的赛道名")


ROUTER_SYSTEM = """你是 AtomCAP 的意图路由器。判断用户消息属于哪类意图：
- thesis_scout：询问投资方向/赛道机会，如“AI硬件最近有什么机会”“人形机器人上游还能不能投”
- deal_sourcing：要求寻找/筛选具体项目或公司
- chat：其他日常交流、私有库问答、对象查询
"""


async def classify_intent(message: str) -> IntentResult:
    return await complete_structured(
        ModelTier.FAST,
        [
            {"role": "system", "content": ROUTER_SYSTEM},
            {"role": "user", "content": message},
        ],
        IntentResult,
    )
