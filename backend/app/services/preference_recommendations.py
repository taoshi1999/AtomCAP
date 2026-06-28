"""投资偏好维度的「AI 推荐取值」服务。

「投资偏好」界面里每个维度（赛道 / 阶段 / 地域 / 风险 / 规模）点「添加」后，下拉框给出
几个推荐候选，也支持用户自定义输入。推荐取值来源：
1. 优先调用 LLM（fast 档，约定 3 / 5：业务只用档位别名 + 海外模型前查 allow_overseas）
   据偏好名称与已选项生成上下文相关候选；
2. 任意失败（无 key / 网关不可达 / 校验失败）回退到本模块的「精选静态清单」——
   离线可用、确定性，既是兜底也是无 key 环境下的接口桩（已在 README 标注）。
"""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from app.llm import client as llm_client
from app.llm.client import ModelTier
from app.objects.preference_profile import DIMENSION_LABELS, dedupe_clean

logger = logging.getLogger(__name__)

# 各维度精选静态候选（一级市场常见取值；既是 LLM 不可用时的兜底，也是离线测试基线）
CURATED_RECOMMENDATIONS: dict[str, list[str]] = {
    "sectors": [
        "人工智能", "半导体", "新能源", "生物医药", "企业服务", "机器人",
        "电池", "储能", "光伏", "太阳能", "智能制造", "新材料", "自动驾驶",
        "金融科技", "消费", "航空航天",
    ],
    "stages": [
        "种子轮", "天使轮", "Pre-A 轮", "A 轮", "B 轮", "C 轮",
        "D 轮及以后", "战略投资", "Pre-IPO",
    ],
    "regions": [
        "北京", "上海", "深圳", "杭州", "苏州", "粤港澳大湾区",
        "长三角", "成渝地区", "全国", "海外",
    ],
    "risk_levels": [
        "保守（低风险）", "稳健（中低风险）", "平衡（中等风险）",
        "进取（中高风险）", "激进（高风险）",
    ],
    "check_sizes": [
        "500 万以下", "500 万 - 1000 万", "1000 万 - 3000 万",
        "3000 万 - 5000 万", "5000 万 - 1 亿", "1 亿以上",
    ],
}

DEFAULT_LIMIT = 6


def recommend_dimension_values(
    dimension: str, *, existing: list[str] | None = None, limit: int = DEFAULT_LIMIT
) -> list[str]:
    """纯函数：返回该维度的精选候选（已排除 existing、去重保序），离线确定性。"""
    pool = CURATED_RECOMMENDATIONS.get(dimension, [])
    existing_set = {e.strip() for e in (existing or []) if e and e.strip()}
    out = [v for v in pool if v not in existing_set]
    return out[: max(1, limit)]


class _DimensionSuggestion(BaseModel):
    """LLM 结构化输出中间模型（只取候选列表）。"""

    values: list[str] = Field(default_factory=list)


def _merge(
    ai_values: list[str], curated: list[str], existing: list[str], limit: int
) -> list[str]:
    """AI 候选优先、精选清单补足，统一去重去已选，截断到 limit。"""
    existing_set = {e.strip() for e in existing if e and e.strip()}
    merged = dedupe_clean([*ai_values, *curated])
    out = [v for v in merged if v not in existing_set]
    return out[: max(1, limit)]


async def ai_recommend_dimension_values(
    dimension: str,
    *,
    name: str | None = None,
    existing: list[str] | None = None,
    allow_overseas: bool = False,
    limit: int = DEFAULT_LIMIT,
) -> tuple[list[str], str]:
    """返回 (推荐候选, 来源)。来源为 "ai" 或 "curated"。

    LLM 任意异常都降级为精选清单——推荐是锦上添花，绝不让该端点因 LLM 不可用而失败。
    """
    existing = existing or []
    curated = recommend_dimension_values(dimension, existing=existing, limit=limit)
    label = DIMENSION_LABELS.get(dimension)
    if label is None:  # 未知维度无从推荐
        return [], "curated"

    system_prompt = (
        "你是一级市场（VC/PE）投资偏好配置助手。"
        "针对给定的偏好维度，给出简洁、规范、互不重复的候选取值（每个不超过 12 个字），"
        "用于下拉推荐。只输出 JSON。"
    )
    ctx = [f"维度：{label}"]
    if name:
        ctx.append(f"偏好名称：{name}")
    if existing:
        ctx.append(f"已选取值（不要重复）：{', '.join(existing)}")
    ctx.append(f"给出最多 {limit} 个候选。")
    try:
        suggestion = await llm_client.complete_structured(
            ModelTier.FAST,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(ctx)},
            ],
            _DimensionSuggestion,
            allow_overseas=allow_overseas,
        )
        merged = _merge(suggestion.values, curated, existing, limit)
        if merged:
            return merged, "ai"
    except Exception as exc:  # noqa: BLE001 —— 推荐失败必须降级，不外抛
        logger.info("AI 维度推荐降级为精选清单 dimension=%s err=%s", dimension, exc)
    return curated, "curated"
