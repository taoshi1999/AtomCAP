"""用户自建命名投资偏好（PreferenceProfile）。

区别于 objects/preference.py 的 InvestmentPreference（机构唯一生效偏好，含
declared_strategy + 经验沉淀 Agent 反哺的 learned_preference，由 get_active_row 单条
读取喂给 fit_score）：PreferenceProfile 是用户在「投资偏好」界面手动创建的多张命名
偏好卡片，每张是一组可增量配置的策略维度，互不影响经验沉淀 / fit_score 主链路。

五个固定维度均为「可增量配置」的取值列表（用户逐条添加，下拉给 AI 推荐也支持自定义
输入）：偏好赛道 sectors / 融资阶段 stages / 所在地域 regions / 风险偏好 risk_levels /
融资规模 check_sizes。
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# 五个固定维度的字段名（前端、推荐端点与服务层共用，避免散落字符串漂移）
PROFILE_DIMENSIONS: tuple[str, ...] = (
    "sectors",
    "stages",
    "regions",
    "risk_levels",
    "check_sizes",
)

# 维度 → 中文展示名（推荐端点校验维度合法性 + 前端兜底文案）
DIMENSION_LABELS: dict[str, str] = {
    "sectors": "偏好赛道",
    "stages": "融资阶段",
    "regions": "所在地域",
    "risk_levels": "风险偏好",
    "check_sizes": "融资规模",
}


def dedupe_clean(values: list[str]) -> list[str]:
    """去空白、去重（保序）——维度取值是用户增量添加的标签，重复无意义。"""
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        s = (v or "").strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


class PreferenceProfile(BaseModel):
    """单张投资偏好卡片的内容契约（preference_profiles.payload）。

    同时用作创建 / 更新端点的请求体（FastAPI 自动 422 校验），前端只提交内容。
    """

    name: str = Field(min_length=1, max_length=100, description="偏好名称，用户手动输入")
    sectors: list[str] = Field(default_factory=list, description="偏好赛道")
    stages: list[str] = Field(default_factory=list, description="融资阶段")
    regions: list[str] = Field(default_factory=list, description="所在地域")
    risk_levels: list[str] = Field(default_factory=list, description="风险偏好")
    check_sizes: list[str] = Field(default_factory=list, description="融资规模")
    notes: str | None = Field(default=None, max_length=2000, description="补充说明（可选）")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("偏好名称不能为空")
        return s

    @field_validator("sectors", "stages", "regions", "risk_levels", "check_sizes")
    @classmethod
    def _clean_lists(cls, v: list[str]) -> list[str]:
        return dedupe_clean(v)
