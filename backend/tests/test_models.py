"""模型自动检测与对话档位收敛测试（离线，纯函数）。

覆盖 llm.client.coerce_tier 与 available_models：用户切换模型即切换 fast/standard/premium
档位，具体模型名由 Provider 配置映射；模型可用性由 provider token/config 决定。
"""
from __future__ import annotations

from app.config import settings
from app.llm.client import ModelTier, available_models, coerce_tier


def test_coerce_tier_defaults_and_validates():
    assert coerce_tier(None) is ModelTier.STANDARD
    assert coerce_tier("") is ModelTier.STANDARD
    assert coerce_tier("fast") is ModelTier.FAST
    assert coerce_tier("PREMIUM") is ModelTier.PREMIUM
    assert coerce_tier(" standard ") is ModelTier.STANDARD
    assert coerce_tier("does-not-exist") is ModelTier.STANDARD
    # 嵌入档不能用于对话，回退默认
    assert coerce_tier("embed") is ModelTier.STANDARD


def test_available_models_deepseek(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "sk-test")
    monkeypatch.setattr(settings, "deepseek_fast_model", "deepseek-v4-flash")
    monkeypatch.setattr(settings, "deepseek_standard_model", "deepseek-v4-flash")
    monkeypatch.setattr(settings, "deepseek_premium_model", "deepseek-v4-pro")

    info = available_models(allow_overseas=False)
    assert info["provider"] == "deepseek"
    assert info["default_tier"] == "standard"
    by_tier = {o["tier"]: o for o in info["options"]}
    assert "fast" not in by_tier  # fast 与 standard 同模型时只展示一次
    assert by_tier["standard"]["model"] == "deepseek-v4-flash"
    assert by_tier["premium"]["model"] == "deepseek-v4-pro"
    assert by_tier["premium"]["requires_overseas"] is False
    assert by_tier["premium"]["available"] is True
    assert by_tier["standard"]["available"] is True


def test_available_models_marks_provider_without_key_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    info = available_models(allow_overseas=True)
    assert info["provider"] == "deepseek"
    assert all(option["available"] is False for option in info["options"])


def test_available_models_litellm_fallback(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "litellm")
    monkeypatch.setattr(settings, "litellm_fast_model", "fast")
    monkeypatch.setattr(settings, "litellm_standard_model", "standard")
    monkeypatch.setattr(settings, "litellm_premium_model", "premium")
    info = available_models(allow_overseas=True)
    assert info["provider"] == "litellm"
    tiers = {o["tier"] for o in info["options"]}
    assert {"fast", "standard", "premium"} <= tiers


def test_available_models_skips_unconfigured_tier(monkeypatch):
    """某档位模型名为空或与前序展示模型重复时不出现在可选项里。"""
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "openai_fast_model", "")
    monkeypatch.setattr(settings, "openai_standard_model", "gpt-4.1")
    monkeypatch.setattr(settings, "openai_premium_model", "gpt-4.1")
    info = available_models(allow_overseas=True)
    tiers = {o["tier"] for o in info["options"]}
    assert "fast" not in tiers
    assert "standard" in tiers
    assert "premium" not in tiers
