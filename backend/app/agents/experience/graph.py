"""投资经验沉淀 Agent（Phase 4）—— cron 驱动，不在对话中触发。

消费 domain_events + 历史交付对象 → 提炼偏好更新建议（PreferenceDiff，
人工确认后生效）、操作复盘、LP 汇报对象。被证伪的 thesis 回流为
fit_score 的历史因子（“越用越准”）。
"""

# TODO Phase 4: run_experience_distillation()
