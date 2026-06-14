"""Deal 业务对象的结构化画像（DealProfile）—— 项目获取 Agent（Deal Intake 分析流）的产出。

与交付结果对象（deliverables）不同，Deal 是**业务对象**（companies/deals 表），
落库在 `deals.data` JSONB。本模块定义该 JSONB 的 Pydantic 契约：

设计依据《项目获取Agent》流程二（项目初步分析工作流）：
- Step 3 材料解析：从 BP/介绍/公司名抽取结构化事实（DealExtraction）
- Step 8 项目初步分析：项目画像、匹配度、机会点、初步风险、信息缺口、待验证问题、推荐下一步

约定 1 的 SCHEMA_REGISTRY 管的是交付结果对象；业务对象 Deal 的 data 用本 schema
在入库前强制校验（service 层 model_validate），同样「结构化 + 不落脏数据」。
约定 2：结论性字段一律用 Claim（有 evidence_ids 或 inferred=True）。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.objects.base import Claim
from app.objects.deal_list import DealSourceType
from app.objects.thesis import FitScoreBreakdown


class DealStatus(StrEnum):
    """Deal 状态机（与 deals.status 对齐）。

    搜寻流候选进库走 sourced；分析流用户主动带入的项目初始为 screening（待初筛），
    设计文档「待分析 / 待初筛」即此阶段——项目已进系统、待人工初筛推进。
    """

    SOURCED = "sourced"        # 搜寻流候选
    SCREENING = "screening"    # 待初筛（Deal Intake 带入的项目初始态）
    PRE_DD = "pre_dd"
    IC_READY = "ic_ready"
    APPROVED = "approved"
    REJECTED = "rejected"


class DealExtraction(BaseModel):
    """Step 3：从用户材料（BP/介绍/公司名）解析出的结构化事实。

    这是「材料里写了什么」的客观抽取，未经外部交叉验证——区别于 analysis 的研判结论。
    未提及的字段留空，绝不臆造。
    """

    company_name: str = Field(description="公司主体名（尽量规范化）")
    aliases: list[str] = Field(default_factory=list, description="品牌名/英文名/项目代号")
    uscc: str | None = Field(default=None, description="统一社会信用代码（材料中给出才填）")
    official_website: str | None = Field(default=None)
    one_line_intro: str | None = Field(default=None, description="一句话介绍")
    track: str | None = Field(default=None, description="所属赛道")
    sub_direction: str | None = Field(default=None, description="子赛道方向")
    product: str | None = Field(default=None, description="产品方案")
    tech_route: str | None = Field(default=None, description="技术路线")
    founders: list[str] = Field(default_factory=list, description="创始团队")
    funding_stage: str | None = Field(default=None, description="融资阶段")
    funding_amount: str | None = Field(default=None, description="本轮融资金额/诉求")
    valuation: str | None = Field(default=None, description="估值")
    revenue: str | None = Field(default=None, description="收入")
    customers: list[str] = Field(default_factory=list, description="主要客户")
    business_model: str | None = Field(default=None, description="商业模式")
    market_size: str | None = Field(default=None, description="市场空间")
    competitors: list[str] = Field(default_factory=list, description="竞争对手")
    contact: str | None = Field(default=None, description="联系人信息")


class DealAnalysis(BaseModel):
    """Step 8：项目初步分析（非完整 Pre-DD，仅项目获取阶段的初步研判）。"""

    portrait: str = Field(description="项目画像：一两句话说清这是家什么公司")
    track_judgement: str | None = Field(default=None, description="所属赛道判断")
    fit_score: FitScoreBreakdown | None = Field(default=None, description="与机构偏好匹配度分项")
    overall_fit: float = Field(ge=0, le=100, description="匹配度总分（fit_score 缺失时的中性回退）")
    highlights: list[Claim] = Field(default_factory=list, description="投资亮点/机会点（绑定证据）")
    initial_risks: list[Claim] = Field(default_factory=list, description="初步风险（绑定证据）")
    info_gaps: list[str] = Field(default_factory=list, description="信息缺口：材料未覆盖的关键信息")
    open_questions: list[str] = Field(default_factory=list, description="待验证问题")
    next_steps: list[Claim] = Field(default_factory=list, description="推荐下一步")


class DealProfile(BaseModel):
    """deals.data 的完整契约：材料抽取 + 初步分析 + 来源/状态元信息。"""

    schema_version: int = Field(default=1)
    source_type: DealSourceType = Field(
        default=DealSourceType.USER_INPUT, description="项目来源：BP上传/用户输入/FA推荐/内部表"
    )
    status: DealStatus = Field(default=DealStatus.SCREENING)
    extraction: DealExtraction
    analysis: DealAnalysis
    created_from_conversation: str | None = Field(default=None)
