"""投资偏好「指令助手」——把自然语言指令解析为对偏好的结构化操作。

用于「投资偏好」界面中部的会话栏：用户说「帮我创建一个关注 AI、A 轮的投资偏好」「筛选出
半导体相关的投资偏好」，系统据此在右侧偏好栏自动完成创建/筛选；识别出与投资偏好无关的
请求时返回 unrelated 并提示用户。

解析两条路径：
1. LLM（standard 档，约定 3/5）结构化判定意图 + 抽取（create 给 profile / filter 给关键词）；
2. 任意失败（无 key / 网关不可达 / 校验失败）回退到本模块的**启发式解析**——纯函数、离线
   确定性，按动词关键词分类 + 按维度精选清单匹配取值，既是兜底也是无 key 环境下的接口桩。
"""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from app.llm import client as llm_client
from app.llm.client import ModelTier
from app.objects.preference_profile import (
    ANTI_PROFILE_DIMENSION_FIELD,
    PROFILE_DIMENSIONS,
    PreferenceProfile,
)
from app.services.preference_recommendations import CURATED_RECOMMENDATIONS

logger = logging.getLogger(__name__)

ACTION_CREATE = "create"
ACTION_FILTER = "filter"
ACTION_UNRELATED = "unrelated"

UNRELATED_MESSAGE = (
    "我只能帮你管理投资偏好哦～可以试试「帮我创建一个关注 AI、A 轮的投资偏好」"
    "或「筛选出半导体相关的投资偏好」。"
)

# 启发式动词关键词
_CREATE_KW = ("创建", "新建", "新增", "添加", "建一个", "建个", "帮我建", "生成一个", "做一个", "加一个")
_FILTER_KW = ("筛选", "过滤", "找出", "只看", "查看", "显示", "列出", "搜索", "找一下", "找找", "看看")
_ANTI_KW = ("不要", "不想", "不投", "不看", "排除", "避开", "厌恶", "讨厌", "反偏好", "不喜欢")
# 偏好领域词（用于判断是否与投资偏好相关）
_DOMAIN_KW = ("偏好", "反偏好", "赛道", "阶段", "地域", "风险", "规模", "投资", "轮", "项目")


class PreferenceInstructionResult(BaseModel):
    """指令解析结果（也作 LLM 结构化输出 schema）。"""

    action: str = Field(default=ACTION_UNRELATED, description="create / filter / unrelated")
    message: str = Field(default="", description="给用户的自然语言回复")
    profile: PreferenceProfile | None = Field(default=None, description="action=create 时的新偏好")
    filter_keywords: list[str] = Field(default_factory=list, description="action=filter 时的筛选关键词")


def _norm(s: str) -> str:
    return (s or "").replace(" ", "").replace("　", "").lower()


def _all_curated_values() -> list[str]:
    out: list[str] = []
    for values in CURATED_RECOMMENDATIONS.values():
        out.extend(values)
    return out


def _matched_terms(instruction: str) -> list[str]:
    """指令里命中的精选清单取值（空格无关、去重保序）。"""
    norm_instr = _norm(instruction)
    seen: set[str] = set()
    out: list[str] = []
    for v in _all_curated_values():
        if _norm(v) in norm_instr and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _extract_dimension_values(instruction: str) -> dict[str, list[str]]:
    """按维度从指令里匹配精选取值（空格无关）。"""
    norm_instr = _norm(instruction)
    out: dict[str, list[str]] = {
        **{d: [] for d in PROFILE_DIMENSIONS},
        **{field: [] for field in ANTI_PROFILE_DIMENSION_FIELD.values()},
    }
    for dim, values in CURATED_RECOMMENDATIONS.items():
        for v in values:
            term = _norm(v)
            if term not in norm_instr:
                continue
            field_name = ANTI_PROFILE_DIMENSION_FIELD[dim] if _is_anti_term(norm_instr, term) else dim
            out[field_name].append(v)
    return out


def _is_anti_term(norm_instruction: str, norm_term: str) -> bool:
    """用局部窗口判断某个取值是否处于“不看/排除/反偏好”等负向语境。"""
    start = norm_instruction.find(norm_term)
    if start < 0:
        return False
    end = start + len(norm_term)
    before = norm_instruction[max(0, start - 12): start]
    after = norm_instruction[end: min(len(norm_instruction), end + 8)]
    return any(keyword in before for keyword in _ANTI_KW) or "反偏好" in after


def heuristic_interpret(instruction: str) -> PreferenceInstructionResult:
    """纯函数启发式解析（离线确定性，LLM 不可用时兜底）。"""
    text = (instruction or "").strip()
    if not text:
        return PreferenceInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)

    has_create = any(k in text for k in _CREATE_KW)
    has_filter = any(k in text for k in _FILTER_KW)
    terms = _matched_terms(text)
    domain_hit = bool(terms) or any(k in text for k in _DOMAIN_KW)

    # 创建意图且与偏好相关 → 创建
    if has_create and domain_hit:
        dims = _extract_dimension_values(text)
        if dims["sectors"]:
            name = f"{dims['sectors'][0]}相关偏好"
        elif dims["anti_sectors"]:
            name = f"排除{dims['anti_sectors'][0]}偏好"
        elif terms:
            name = f"{terms[0]}相关偏好"
        else:
            name = "新投资偏好"
        profile = PreferenceProfile(name=name, **dims)
        return PreferenceInstructionResult(
            action=ACTION_CREATE, profile=profile, message=f"已为你创建投资偏好「{name}」。"
        )

    # 筛选意图（或仅提到领域词）→ 筛选
    if has_filter or (domain_hit and terms):
        if terms:
            return PreferenceInstructionResult(
                action=ACTION_FILTER,
                filter_keywords=terms,
                message=f"已为你筛选包含「{'、'.join(terms)}」的投资偏好。",
            )
        if has_filter:
            return PreferenceInstructionResult(
                action=ACTION_FILTER, filter_keywords=[], message="已显示全部投资偏好。"
            )

    return PreferenceInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)


def _default_message(action: str) -> str:
    if action == ACTION_CREATE:
        return "已为你创建投资偏好。"
    if action == ACTION_FILTER:
        return "已为你筛选投资偏好。"
    return UNRELATED_MESSAGE


async def interpret_instruction(
    instruction: str, *, allow_overseas: bool = False
) -> PreferenceInstructionResult:
    """解析一条偏好指令：LLM 优先，任意异常/不可用回退启发式。"""
    text = (instruction or "").strip()
    if not text:
        return PreferenceInstructionResult(action=ACTION_UNRELATED, message=UNRELATED_MESSAGE)

    system_prompt = (
        "你是 AtomCAP 的投资偏好管理助手，只处理与投资偏好相关的指令。"
        "把用户指令判定为三类之一：create=创建一个新的投资偏好；filter=在已有偏好中筛选；"
        "unrelated=与投资偏好管理无关。create 时填 profile（name 必填，五维 sectors/stages/"
        "regions/risk_levels/check_sizes 按指令填、取值简洁规范；反偏好写入 anti_sectors/"
        "anti_stages/anti_regions/anti_risk_levels/anti_check_sizes；自定义维度的反偏好写入"
        "custom_dimensions[].anti_values；用户额外策略说明写入 supplemental_notes）；filter 时填 filter_keywords；"
        "message 为给用户的简洁中文回复，unrelated 时提示用户输入与投资偏好相关的请求。只输出 JSON。"
    )
    try:
        result = await llm_client.complete_structured(
            ModelTier.STANDARD,
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": text}],
            PreferenceInstructionResult,
            allow_overseas=allow_overseas,
        )
        if result.action not in (ACTION_CREATE, ACTION_FILTER, ACTION_UNRELATED):
            result.action = ACTION_UNRELATED
        # 模型说 create 却没给有效 profile → 退回启发式补救
        if result.action == ACTION_CREATE and result.profile is None:
            return heuristic_interpret(text)
        if not result.message.strip():
            result.message = _default_message(result.action)
        return result
    except Exception as exc:  # noqa: BLE001 —— LLM 不可用回退启发式
        logger.info("偏好指令 LLM 解析失败，回退启发式：%s", exc)
        return heuristic_interpret(text)
