"""赛道库「指令助手」——把自然语言指令解析为对赛道（Thesis）的结构化操作。

与 services/preference_assistant.py 同构，用于「赛道库」界面中部会话栏：用户说「帮我创建一个
关注固态电池的赛道」「筛选出半导体相关的赛道」，系统据此在右侧赛道栏自动创建/筛选；识别出
与赛道无关的请求时返回 unrelated 并提示。

解析两条路径：LLM（standard 档，约定 3/5）结构化判定；任意失败回退**启发式**（纯函数离线：
按动词关键词分类 + 抽取主题词），既是兜底也是无 key 环境下的接口桩。
"""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from app.llm import client as llm_client
from app.llm.client import ModelTier

logger = logging.getLogger(__name__)

ACTION_CREATE = "create"
ACTION_FILTER = "filter"
ACTION_UNRELATED = "unrelated"

UNRELATED_MESSAGE = (
    "我只能帮你管理赛道库哦～可以试试「帮我创建一个关注固态电池的赛道」"
    "或「筛选出半导体相关的赛道」。"
)

_CREATE_KW = ("创建", "新建", "新增", "添加", "建一个", "建个", "帮我建", "生成一个", "做一个", "加一个")
_FILTER_KW = ("筛选", "过滤", "找出", "只看", "查看", "显示", "列出", "搜索", "找一下", "找找", "看看")
# 赛道领域词（判断指令是否与赛道相关）
_DOMAIN_KW = ("赛道", "投资逻辑", "thesis", "方向", "领域", "行业", "前瞻")
# 抽主题词时剔除的填充词（动词/领域词/常见虚词，按长度降序剔除）
_FILLERS = (
    "帮我", "帮忙", "请", "一个", "个", "关注", "相关", "这类", "那类", "类",
    "的", "出", "下", "一下", "这个", "那个", "些", "关于",
)


class ThesisDraft(BaseModel):
    """create 时的赛道草稿（喂给手动建赛道逻辑）。"""

    thesis_name: str = Field(min_length=1, max_length=120)
    one_line_view: str | None = Field(default=None, max_length=500)
    sub_directions: list[str] = Field(default_factory=list)
    opportunity_level: str = Field(default="中", max_length=20)
    risk_level: str = Field(default="中", max_length=20)


class TrackInstructionResult(BaseModel):
    """指令解析结果（也作 LLM 结构化输出 schema）。"""

    action: str = Field(default=ACTION_UNRELATED, description="create / filter / unrelated")
    message: str = Field(default="", description="给用户的自然语言回复")
    thesis: ThesisDraft | None = Field(default=None, description="action=create 时的赛道草稿")
    filter_keywords: list[str] = Field(default_factory=list, description="action=filter 时的筛选关键词")


def _extract_topic(instruction: str) -> str:
    """从指令里粗略抽取主题词（剔除动词/领域词/虚词），用作赛道名或筛选词。"""
    t = instruction.strip()
    for w in sorted(set(_CREATE_KW + _FILTER_KW + _DOMAIN_KW + _FILLERS), key=len, reverse=True):
        t = t.replace(w, "")
    return t.strip(" 　,，。.、:：;；!！?？\t\n")


def heuristic_interpret(instruction: str) -> TrackInstructionResult:
    """纯函数启发式解析（离线确定性，LLM 不可用时兜底）。"""
    text = (instruction or "").strip()
    if not text:
        return TrackInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)

    has_create = any(k in text for k in _CREATE_KW)
    has_filter = any(k in text for k in _FILTER_KW)
    domain_hit = any(k in text for k in _DOMAIN_KW)
    if not domain_hit:  # 与赛道无关
        return TrackInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)

    topic = _extract_topic(text)
    if has_create:
        name = topic or "新赛道"
        return TrackInstructionResult(
            action=ACTION_CREATE,
            thesis=ThesisDraft(thesis_name=name),
            message=f"已为你创建赛道「{name}」。",
        )
    if has_filter or topic:
        kws = [topic] if topic else []
        return TrackInstructionResult(
            action=ACTION_FILTER,
            filter_keywords=kws,
            message=(f"已为你筛选包含「{topic}」的赛道。" if topic else "已显示全部赛道。"),
        )
    return TrackInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)


def _default_message(action: str) -> str:
    if action == ACTION_CREATE:
        return "已为你创建赛道。"
    if action == ACTION_FILTER:
        return "已为你筛选赛道。"
    return UNRELATED_MESSAGE


async def interpret_instruction(
    instruction: str, *, allow_overseas: bool = False
) -> TrackInstructionResult:
    """解析一条赛道指令：LLM 优先，任意异常/不可用回退启发式。"""
    text = (instruction or "").strip()
    if not text:
        return TrackInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)

    system_prompt = (
        "你是 AtomCAP 的赛道库管理助手，只处理与投资赛道（赛道前瞻 Thesis）相关的指令。"
        "把用户指令判定为三类之一：create=创建一个新的赛道；filter=在已有赛道中筛选；"
        "unrelated=与赛道管理无关。create 时填 thesis（thesis_name 必填，可选 one_line_view、"
        "sub_directions 子方向、opportunity_level、risk_level）；filter 时填 filter_keywords；"
        "message 为给用户的简洁中文回复，unrelated 时提示用户输入与赛道相关的请求。只输出 JSON。"
    )
    try:
        result = await llm_client.complete_structured(
            ModelTier.STANDARD,
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": text}],
            TrackInstructionResult,
            allow_overseas=allow_overseas,
        )
        if result.action not in (ACTION_CREATE, ACTION_FILTER, ACTION_UNRELATED):
            result.action = ACTION_UNRELATED
        if result.action == ACTION_CREATE and result.thesis is None:
            return heuristic_interpret(text)
        if not result.message.strip():
            result.message = _default_message(result.action)
        return result
    except Exception as exc:  # noqa: BLE001 —— LLM 不可用回退启发式
        logger.info("赛道指令 LLM 解析失败，回退启发式：%s", exc)
        return heuristic_interpret(text)
