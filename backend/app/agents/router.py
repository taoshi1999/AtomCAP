"""通用 Agent 主图 —— 意图路由。

设计文档：专用 Agent 在特定提示词下被触发。主路径使用 LLM 结构化分类；
同时保留少量高精度本地保护规则，兜住“项目/公司推荐”这类不能误触赛道
前瞻的强语义请求，避免 LLM 把 Deal Sourcing 误判成 Thesis Scout。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.llm.client import ModelTier, complete_structured


class Intent(StrEnum):
    CHAT = "chat"                  # 通用对话
    THESIS_SCOUT = "thesis_scout"  # 赛道前瞻：投资方向询问
    DEAL_SOURCING = "deal_sourcing"  # 项目获取：搜寻一批项目
    DEAL_INTAKE = "deal_intake"    # 项目获取：分析用户带入的某个具体项目
    PREFERENCE_ADVICE = "preference_advice"  # 投资偏好 Agent：偏好/反偏好修改建议


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    track_hint: str | None = Field(default=None, description="若为赛道前瞻，提取的赛道名")


ROUTER_SYSTEM = """你是 AtomCAP 的意图路由器。判断用户消息属于哪类意图：
- thesis_scout：询问投资方向/赛道机会，如“AI硬件最近有什么机会”“人形机器人上游还能不能投”“最近有什么赛道值得看”
- deal_sourcing：要求寻找/筛选/推荐**一批**项目或公司，如“最近有什么项目值得看”“帮我找一批 AI 硬件上游项目”“给我推荐几家有融资信号的感知模组公司”
- deal_intake：要求分析用户**带入的某一个具体项目**，如“帮我分析一下这个项目”“我上传了 BP 帮我看看值不值得投”“看看这家公司符不符合我们偏好”“粘贴一段项目介绍/公司名后让你研判”
- preference_advice：要求修改、纠正或沉淀长期投资偏好/反偏好，如“以后不要推荐太阳能电池相关的项目”“别再看社区团购”“我们以后更想看机器人上游”“把消费互联网加入不感兴趣”
- chat：其他日常交流、私有库问答、对象查询
区分要点：deal_sourcing 是「从外部找一批新项目」，deal_intake 是「对一个已给定项目做初步分析」。
用户上传材料/给公司名/给项目介绍并要求分析时，判为 deal_intake。
凡是带有“以后 / 长期 / 不要再 / 别再 / 我们以后 / 以后只看”等长期策略措辞的偏好修正，都优先判为 preference_advice，不要因为出现“项目/推荐”而判为 deal_sourcing。
"""


def _compact(message: str) -> str:
    return "".join(message.lower().split())


def _has_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term.lower() in text for term in terms)


def high_precision_intent_hint(message: str) -> IntentResult | None:
    """只处理非常明确的项目获取/项目分析表达，其余仍交给 LLM 路由。

    设计上不把所有触发都做成关键词规则；这里是错误防护层：
    - “最近有什么项目值得看”这类请求含明确项目/标的对象和推荐/寻找动作，
      按《项目获取Agent》应进入 Deal Sourcing 并输出候选项目池；
    - “帮我分析这个项目 / 这家公司 / BP”这类已给定单项目上下文，进入 Deal Intake。
    """
    text = _compact(message)
    if not text:
        return None

    durable_terms = (
        "以后",
        "今后",
        "长期",
        "一直",
        "后续",
        "不要再",
        "别再",
        "不再",
        "我们以后",
    )
    preference_update_terms = (
        "不要推荐",
        "别推荐",
        "不要看",
        "不看",
        "不想看",
        "不想投",
        "不投",
        "排除",
        "避开",
        "加入不感兴趣",
        "加入黑名单",
        "降低权重",
        "提高权重",
        "更想看",
        "只看",
        "偏好",
        "反偏好",
    )
    preference_objects = ("项目", "公司", "赛道", "领域", "方向", "标的", "投资")
    explicit_preference_edit = _has_any(text, ("修改投资偏好", "更新投资偏好", "调整投资偏好", "优化投资偏好"))
    if explicit_preference_edit or (
        _has_any(text, durable_terms)
        and _has_any(text, preference_update_terms)
        and _has_any(text, preference_objects)
    ):
        return IntentResult(intent=Intent.PREFERENCE_ADVICE, confidence=0.96)

    existing_library_query = "项目库" in text and _has_any(
        text, ("已有", "现有", "当前", "查看", "显示", "列出", "多少", "数量")
    )
    if existing_library_query:
        return None

    project_terms = ("项目", "公司", "标的", "deal")
    if not _has_any(text, project_terms):
        return None

    intake_context_terms = (
        "这个项目",
        "该项目",
        "这家公司",
        "该公司",
        "这个公司",
        "这份bp",
        "这份材料",
        "上传",
        "粘贴",
        "商业计划书",
        "bp",
    )
    intake_action_terms = (
        "分析",
        "看看",
        "评估",
        "研判",
        "值不值得投",
        "值得投吗",
        "尽调",
        "符合我们偏好",
        "匹配我们偏好",
    )
    if _has_any(text, intake_context_terms) and _has_any(text, intake_action_terms):
        return IntentResult(intent=Intent.DEAL_INTAKE, confidence=0.95)

    sourcing_terms = (
        "找",
        "寻找",
        "搜",
        "推荐",
        "有哪些",
        "有什么",
        "哪些",
        "一批",
        "项目池",
        "候选",
        "名单",
        "值得看",
        "可看",
        "关注",
        "挖掘",
        "发现",
    )
    if _has_any(text, sourcing_terms):
        return IntentResult(intent=Intent.DEAL_SOURCING, confidence=0.95)

    return None


async def classify_intent(message: str) -> IntentResult:
    hint = high_precision_intent_hint(message)
    if hint is not None:
        return hint
    return await complete_structured(
        ModelTier.FAST,
        [
            {"role": "system", "content": ROUTER_SYSTEM},
            {"role": "user", "content": message},
        ],
        IntentResult,
    )
