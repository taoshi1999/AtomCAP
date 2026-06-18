"""模型自动检测与对话档位收敛测试（离线，纯函数）。

覆盖 llm.client.coerce_tier 与 available_models：用户切换模型即切换 fast/standard/premium
档位，具体模型名由 Provider 配置映射；premium 受机构海外开关约束。
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
    monkeypatch.setattr(settings, "deepseek_fast_model", "deepseek-v4-flash")
    monkeypatch.setattr(settings, "deepseek_standard_model", "deepseek-v4-flash")
    monkeypatch.setattr(settings, "deepseek_premium_model", "deepseek-v4-pro")

    info = available_models(allow_overseas=False)
    assert info["provider"] == "deepseek"
    assert info["default_tier"] == "standard"
    by_tier = {o["tier"]: o for o in info["options"]}
    assert by_tier["fast"]["model"] == "deepseek-v4-flash"
    assert by_tier["standard"]["model"] == "deepseek-v4-flash"
    assert by_tier["premium"]["model"] == "deepseek-v4-pro"
    assert by_tier["premium"]["requires_overseas"] is True
    assert by_tier["premium"]["available"] is False  # 未开海外
    assert by_tier["standard"]["available"] is True


def test_available_models_premium_unlocked_with_overseas(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "deepseek")
    info = available_models(allow_overseas=True)
    by_tier = {o["tier"]: o for o in info["options"]}
    assert by_tier["premium"]["available"] is True


def test_available_models_litellm_fallback(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "litellm")
    info = available_models(allow_overseas=True)
    assert info["provider"] == "litellm"
    tiers = {o["tier"] for o in info["options"]}
    assert {"fast", "standard", "premium"} <= tiers


def test_available_models_skips_unconfigured_tier(monkeypatch):
    """某档位模型名为空时不出现在可选项里。"""
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_fast_model", "")
    monkeypatch.setattr(settings, "openai_standard_model", "gpt-4.1")
    monkeypatch.setattr(settings, "openai_premium_model", "gpt-4.1")
    info = available_models(allow_overseas=True)
    tiers = {o["tier"] for o in info["options"]}
    assert "fast" not in tiers
    assert "standard" in tiers and "premium" in tiers
