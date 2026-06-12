"""应用配置（pydantic-settings，从 .env 读取）。"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://atomcap:atomcap_dev@localhost:5432/atomcap"
    redis_url: str = "redis://localhost:6379/0"

    litellm_base_url: str = "http://localhost:4000"
    litellm_master_key: str = "sk-atomcap-dev"

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

    # 可观测
    langfuse_host: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""


settings = Settings()
