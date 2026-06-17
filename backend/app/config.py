"""应用配置（pydantic-settings，从 .env 读取）。"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_PROJECT_ROOT / ".env", _BACKEND_DIR / ".env"),
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://atomcap:atomcap_dev@localhost:5432/atomcap"
    redis_url: str = "redis://localhost:6379/0"

    # LLM provider routing. "auto" prefers direct DeepSeek/OpenAI keys when
    # present, and falls back to the local LiteLLM gateway for existing setups.
    llm_provider: str = "auto"
    llm_request_timeout_seconds: float = 60.0
    llm_connect_timeout_seconds: float = 10.0
    llm_http_proxy: str = ""

    litellm_base_url: str = "http://localhost:4000"
    litellm_master_key: str = "sk-atomcap-dev"
    litellm_fast_model: str = "fast"
    litellm_standard_model: str = "standard"
    litellm_premium_model: str = "premium"
    litellm_embed_model: str = "embed"

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_fast_model: str = "deepseek-v4-flash"
    deepseek_standard_model: str = "deepseek-v4-flash"
    deepseek_premium_model: str = "deepseek-v4-pro"
    deepseek_embed_model: str = ""

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_fast_model: str = "gpt-4.1-mini"
    openai_standard_model: str = "gpt-4.1"
    openai_premium_model: str = "gpt-4.1"
    openai_embed_model: str = "text-embedding-3-large"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24h，开发期免频繁换 token
    # 开发回退：未携带凭证时返回固定开发租户（前端登录 UI 接通前的过渡），生产必须 false
    auth_dev_fallback: bool = False

    # 数据源
    bocha_api_key: str = ""
    qcc_app_key: str = ""
    qcc_secret_key: str = ""
    tavily_api_key: str = ""
    # 信号检索缓存 TTL（秒）；按量计费数据源粒度为天级，默认 24h。0 关闭缓存
    signal_cache_ttl_seconds: int = 86400

    # 可观测
    langfuse_host: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""


settings = Settings()
