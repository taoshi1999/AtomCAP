"""交付结果对象 Schema —— 整个系统的契约原点。

约定：type → Schema 的映射在 SCHEMA_REGISTRY 中注册；
deliverables 表 payload 入库前必须通过对应 Schema 校验。

经验沉淀 Agent 的 UserAction / ExperienceEvent / PreferenceAdvice 是系统对象
（非交付结果对象），不进 SCHEMA_REGISTRY，但在此统一导出便于服务层引用。
"""

from app.objects.base import BaseDeliverable, Claim, DeliverableType
from app.objects.dd_report import DDReport
from app.objects.deal import DealAnalysis, DealExtraction, DealProfile, DealStatus
from app.objects.deal_list import DealList
from app.objects.evidence import EvidenceItem, EvidenceLink
from app.objects.experience import (
    AdvicePriority,
    AdviceType,
    ExperienceEvent,
    ExperienceEventType,
    ExperienceStatus,
    PreferenceAdvice,
    ReviewStatus,
    SignalStrength,
    SignalType,
    UserAction,
    UserActionType,
)
from app.objects.preference import (
    DeclaredStrategy,
    InvestmentPreference,
    LearnedPreference,
    WeightedItem,
)
from app.objects.thesis import Thesis

SCHEMA_REGISTRY: dict[DeliverableType, type[BaseDeliverable]] = {
    DeliverableType.THESIS: Thesis,
    DeliverableType.DEAL_LIST: DealList,
    DeliverableType.DD_REPORT: DDReport,
}

__all__ = [
    "BaseDeliverable",
    "Claim",
    "DeliverableType",
    "Thesis",
    "DealList",
    "DDReport",
    "DealProfile",
    "DealExtraction",
    "DealAnalysis",
    "DealStatus",
    "EvidenceItem",
    "EvidenceLink",
    "InvestmentPreference",
    "DeclaredStrategy",
    "LearnedPreference",
    "WeightedItem",
    "UserAction",
    "UserActionType",
    "ExperienceEvent",
    "ExperienceEventType",
    "ExperienceStatus",
    "PreferenceAdvice",
    "AdviceType",
    "AdvicePriority",
    "ReviewStatus",
    "SignalType",
    "SignalStrength",
    "SCHEMA_REGISTRY",
]
