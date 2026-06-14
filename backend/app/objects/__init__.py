"""交付结果对象 Schema —— 整个系统的契约原点。

约定：type → Schema 的映射在 SCHEMA_REGISTRY 中注册；
deliverables 表 payload 入库前必须通过对应 Schema 校验。
"""

from app.objects.base import BaseDeliverable, Claim, DeliverableType
from app.objects.dd_report import DDReport
from app.objects.deal import DealAnalysis, DealExtraction, DealProfile, DealStatus
from app.objects.deal_list import DealList
from app.objects.evidence import EvidenceItem, EvidenceLink
from app.objects.preference import InvestmentPreference
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
    "SCHEMA_REGISTRY",
]
