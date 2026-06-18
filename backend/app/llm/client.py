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
from typing import Any, TypeVar

import httpx
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class ModelTier(StrEnum):
    FAST = "fast"          # 拆解、分类、抽取
    STANDARD = "standard"  # 综合推理、子赛道生成
    PREMIUM = "premium"    # 最终组装 / 用户要求高质量交付
    EMBED = "embed"


_client: Any | None = None
_client_signature: tuple[str, str, str, float, float, str] | None = None


def resolve_tier(tier: ModelTier, *, allow_overseas: bool) -> ModelTier:
    """合规降级：机构未开启海外模型时，premium 自动降为 standard。"""
    if tier is ModelTier.PREMIUM and not allow_overseas:
        return ModelTier.STANDARD
    return tier


def resolve_provider() -> str:
    """Return the concrete LLM provider selected from settings.

    auto:
    - DEEPSEEK_API_KEY present -> direct DeepSeek OpenAI-compatible API
    - OPENAI_API_KEY present -> direct OpenAI-compatible API
    - otherwise -> existing LiteLLM gateway
    """
    provider = (settings.llm_provider or "auto").strip().lower()
    if provider != "auto":
        return provider
    if settings.deepseek_api_key:
        return "deepseek"
    if settings.openai_api_key:
        return "openai"
    return "litellm"


def _provider_connection(provider: str) -> tuple[str, str]:
    if provider == "deepseek":
        return settings.deepseek_base_url, settings.deepseek_api_key
    if provider == "openai":
        return settings.openai_base_url, settings.openai_api_key
    if provider == "litellm":
        return settings.litellm_base_url, settings.litellm_master_key
    raise ValueError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")


def _provider_model_map(provider: str) -> dict[ModelTier, str]:
    """档位 -> 具体模型名的 provider 级映射（不做合规降级，供路由与模型自检共用）。"""
    if provider == "deepseek":
        return {
            ModelTier.FAST: settings.deepseek_fast_model,
            ModelTier.STANDARD: settings.deepseek_standard_model,
            ModelTier.PREMIUM: settings.deepseek_premium_model,
            ModelTier.EMBED: settings.deepseek_embed_model,
        }
    if provider == "openai":
        return {
            ModelTier.FAST: settings.openai_fast_model,
            ModelTier.STANDARD: settings.openai_standard_model,
            ModelTier.PREMIUM: settings.openai_premium_model,
            ModelTier.EMBED: settings.openai_embed_model,
        }
    return {
        ModelTier.FAST: settings.litellm_fast_model,
        ModelTier.STANDARD: settings.litellm_standard_model,
        ModelTier.PREMIUM: settings.litellm_premium_model,
        ModelTier.EMBED: settings.litellm_embed_model,
    }


def resolve_model(tier: ModelTier, *, allow_overseas: bool = False) -> str:
    """Map a logical tier to the provider-specific model name."""
    resolved = resolve_tier(tier, allow_overseas=allow_overseas)
    provider = resolve_provider()
    model = _provider_model_map(provider)[resolved]
    if not model:
        raise ValueError(f"{provider} provider has no model configured for tier {resolved.value!r}")
    return model


_TIER_LABELS: dict[ModelTier, str] = {
    ModelTier.FAST: "快速",
    ModelTier.STANDARD: "标准",
    ModelTier.PREMIUM: "高质量",
}


def coerce_tier(value: str | None, *, default: ModelTier = ModelTier.STANDARD) -> ModelTier:
    """把前端传入的档位字符串收敛为合法的对话档位，空/非法/embed 一律回退默认。

    业务代码只认 fast/standard/premium 档位别名（核心约定）：用户切换模型即切换档位，
    具体模型名由 provider 配置映射，绝不让任意模型名穿透到业务层。
    """
    if not value:
        return default
    try:
        tier = ModelTier(value.strip().lower())
    except ValueError:
        return default
    if tier is ModelTier.EMBED:  # 对话不能用嵌入档
        return default
    return tier


def available_models(*, allow_overseas: bool = False) -> dict[str, Any]:
    """自动检测当前配置的 Provider 及各对话档位对应的具体模型，供前端展示与切换。

    premium 档可能路由到海外模型——机构未开启海外模型时标记 available=False，
    前端禁用该选项（与 resolve_tier 的合规降级一致，核心约定 5）。
    """
    provider = resolve_provider()
    model_map = _provider_model_map(provider)
    options: list[dict[str, Any]] = []
    for tier in (ModelTier.FAST, ModelTier.STANDARD, ModelTier.PREMIUM):
        model = model_map.get(tier)
        if not model:
            continue
        requires_overseas = tier is ModelTier.PREMIUM
        options.append(
            {
                "tier": tier.value,
                "model": model,
                "label": _TIER_LABELS[tier],
                "requires_overseas": requires_overseas,
                "available": (not requires_overseas) or allow_overseas,
            }
        )
    return {
        "provider": provider,
        "default_tier": ModelTier.STANDARD.value,
        "options": options,
    }


def _get_client() -> Any:
    """Build the OpenAI-compatible client lazily.

    Tests monkeypatch ``_client`` with a fake object; when no signature is set we
    respect that fake instead of rebuilding it.
    """
    global _client, _client_signature

    provider = resolve_provider()
    base_url, api_key = _provider_connection(provider)
    signature = (
        provider,
        base_url,
        api_key,
        settings.llm_request_timeout_seconds,
        settings.llm_connect_timeout_seconds,
        settings.llm_http_proxy,
    )
    if _client is not None and (_client_signature == signature or _client_signature is None):
        return _client

    if provider in {"deepseek", "openai"} and not api_key:
        raise ValueError(f"{provider} API key is not configured")

    timeout = httpx.Timeout(
        timeout=settings.llm_request_timeout_seconds,
        connect=settings.llm_connect_timeout_seconds,
    )
    client_kwargs: dict[str, Any] = {
        "base_url": base_url,
        "api_key": api_key,
        "timeout": timeout,
    }
    if settings.llm_http_proxy:
        client_kwargs["http_client"] = httpx.AsyncClient(
            proxy=settings.llm_http_proxy,
            timeout=timeout,
        )

    _client = AsyncOpenAI(**client_kwargs)
    _client_signature = signature
    return _client


async def complete(
    tier: ModelTier,
    messages: list[dict],
    *,
    allow_overseas: bool = False,
    temperature: float = 0.3,
) -> str:
    client = _get_client()
    resp = await client.chat.completions.create(
        model=resolve_model(tier, allow_overseas=allow_overseas),
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
    client = _get_client()
    stream = await client.chat.completions.create(
        model=resolve_model(tier, allow_overseas=allow_overseas),
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
        client = _get_client()
        resp = await client.chat.completions.create(
            model=resolve_model(tier, allow_overseas=allow_overseas),
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
    client = _get_client()
    resp = await client.embeddings.create(
        model=resolve_model(ModelTier.EMBED, allow_overseas=False),
        input=texts,
    )
    return [d.embedding for d in resp.data]
