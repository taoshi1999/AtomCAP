"""LLM 调用层 —— 档位路由 + 结构化输出。

核心约定：业务代码只引用 ModelTier（fast/standard/premium），
具体模型在 litellm/config.yaml 配置，切换模型零代码改动。

premium 档可能路由到海外模型：调用前必须检查机构级开关
（Institution.allow_overseas_models），不满足时降级 standard。
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from enum import StrEnum
from typing import TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class ModelTier(StrEnum):
    FAST = "fast"          # 拆解、分类、抽取
    STANDARD = "standard"  # 综合推理、子赛道生成
    PREMIUM = "premium"    # 最终组装 / 用户要求高质量交付
    EMBED = "embed"


_client = AsyncOpenAI(base_url=settings.litellm_base_url, api_key=settings.litellm_master_key)


def resolve_tier(tier: ModelTier, *, allow_overseas: bool) -> ModelTier:
    """合规降级：机构未开启海外模型时，premium 自动降为 standard。"""
    if tier is ModelTier.PREMIUM and not allow_overseas:
        return ModelTier.STANDARD
    return tier


async def complete(
    tier: ModelTier,
    messages: list[dict],
    *,
    allow_overseas: bool = False,
    temperature: float = 0.3,
) -> str:
    resp = await _client.chat.completions.create(
        model=resolve_tier(tier, allow_overseas=allow_overseas).value,
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


async def complete_stream(
    tier: ModelTier,
    messages: list[dict],
    *,
    allow_overseas: bool = False,
    temperature: float = 0.3,
) -> AsyncIterator[str]:
    """流式补全：逐段产出增量文本（SSE token 事件的数据源）。

    与 complete() 同一套档位路由与合规降级；调用方负责拼接全文落库。
    """
    stream = await _client.chat.completions.create(
        model=resolve_tier(tier, allow_overseas=allow_overseas).value,
        messages=messages,
        temperature=temperature,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def complete_structured(
    tier: ModelTier,
    messages: list[dict],
    schema: type[T],
    *,
    allow_overseas: bool = False,
    max_repair_attempts: int = 1,
) -> T:
    """结构化输出：JSON mode + Pydantic 校验，校验失败时带错误信息自动重试修复。

    这是「对象化交付」的关键路径——所有交付结果对象的生成都走这里。
    """
    sys_suffix = (
        "\n你必须只输出一个合法 JSON 对象（不要 markdown 代码块），"
        f"严格符合以下 JSON Schema：\n{json.dumps(schema.model_json_schema(), ensure_ascii=False)}"
    )
    msgs = [*messages]
    if msgs and msgs[0]["role"] == "system":
        msgs[0] = {**msgs[0], "content": msgs[0]["content"] + sys_suffix}
    else:
        msgs.insert(0, {"role": "system", "content": sys_suffix})

    last_err: Exception | None = None
    for _ in range(1 + max_repair_attempts):
        resp = await _client.chat.completions.create(
            model=resolve_tier(tier, allow_overseas=allow_overseas).value,
            messages=msgs,
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        try:
            return schema.model_validate_json(raw)
        except Exception as err:  # 校验失败 → 把错误回灌给模型修复
            last_err = err
            msgs.append({"role": "assistant", "content": raw})
            msgs.append(
                {"role": "user", "content": f"输出未通过 Schema 校验：{err}。请修正后重新输出完整 JSON。"}
            )
    raise ValueError(f"结构化输出在 {1 + max_repair_attempts} 次尝试后仍未通过校验: {last_err}")


async def embed(texts: list[str]) -> list[list[float]]:
    resp = await _client.embeddings.create(model=ModelTier.EMBED.value, input=texts)
    return [d.embedding for d in resp.data]
