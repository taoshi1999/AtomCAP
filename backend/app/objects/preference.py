"""机构投资偏好（系统对象）。

fit_score 的输入；版本化，变更需人工确认（经验沉淀 Agent 只能提 diff 建议）。
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class InvestmentPreference(BaseModel):
    version: int = 1
    track_preferences: list[str] = Field(default_factory=list, description="偏好赛道")
    excluded_tracks: list[str] = Field(default_factory=list, description="不感兴趣清单（评分惩罚项）")
    stages: list[str] = Field(default_factory=list, description="偏好阶段：天使/Pre-A/A/B+...")
    geographies: list[str] = Field(default_factory=list, description="地域偏好")
    risk_appetite: str | None = Field(default=None, description="风险偏好描述")
    check_size: str | None = Field(default=None, description="单笔投资规模")
    notes: str | None = Field(default=None, description="其他策略说明（策略沉淀 Agent 维护）")
