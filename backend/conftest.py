"""Pytest defaults that keep unit tests offline.

Runtime must read the developer's root ``.env`` so the local app works, but
unit tests should not accidentally call real LLMs, paid data connectors, or
Redis just because those keys exist on the machine.
"""

from __future__ import annotations

import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "litellm")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "bocha_api_key", "")
    monkeypatch.setattr(settings, "qcc_app_key", "")
    monkeypatch.setattr(settings, "qcc_secret_key", "")
    monkeypatch.setattr(settings, "tavily_api_key", "")
    monkeypatch.setattr(settings, "redis_url", "")

    try:
        import app.connectors.cache as cache_mod

        monkeypatch.setattr(cache_mod, "_cache_resolved", False)
        monkeypatch.setattr(cache_mod, "_cache_singleton", None)
    except Exception:
        pass
