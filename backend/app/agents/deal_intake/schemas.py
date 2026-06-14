"""项目获取 Agent（Deal Intake 分析流）子图的中间结构化输出模型。

节点间的内部契约，不进 SCHEMA_REGISTRY（注册表只收交付结果对象）。
复用业务对象 DealProfile 的内嵌模型（DealExtraction / DealAnalysis），
保证中间产物到最终 Deal 对象零转换损耗。
"""

from __future__ import annotations

from app.objects.deal import DealAnalysis, DealExtraction

__all__ = ["DealExtraction", "DealAnalysis"]
