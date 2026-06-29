"""项目获取 Agent（Deal Intake 分析流）各节点实现。

设计文档流程二（项目初步分析工作流）的 LangGraph 落地：
  parse_material（Step 3 材料解析：从 BP/介绍/公司名抽取结构化事实）
  → enrich_external（Step 4 外部信息补全：工商 + 公开信号交叉验证，每条预分配 evidence_id）
  → align_entity（Step 5 实体对齐：与机构已有公司确定性匹配，命中即关联 company_id）
  → assemble_deal（Step 8 项目初步分析：画像/匹配度/亮点/风险/信息缺口/待验证问题/下一步）

原则（与赛道前瞻 / Deal Sourcing 一致）：
- 轻任务 FAST、抽取/分析 STANDARD、综合研判 PREMIUM（约定 3）
- 节点纯函数（state in → state out），不碰数据库；Company/Deal 落库由 runner 编排
- 结论用 Claim 绑定 evidence_id，无证据自动 inferred=True（约定 2），严禁伪造
- 所有 LLM 调用经 _ask() 透传 allow_overseas（约定 5）
- 实体对齐为纯 Python 确定性逻辑：可独立测试、零 LLM 成本
"""

from __future__ import annotations

import json
import re
import uuid
from typing import TypeVar

from pydantic import BaseModel

from app.agents.deal_intake.schemas import DealAnalysis, DealExtraction
from app.agents.deal_intake.state import DealIntakeState
from app.connectors.registry import (
    active_connectors,
    cached_gather_signals,
    lookup_company,
)
from app.llm.client import ModelTier, complete_structured
from app.objects.deal import DealProfile, DealStatus, DealWorkspace, infer_workspace_summary
from app.objects.deal_list import DealSourceType
from app.objects.base import Claim
from app.agents.experience.influence import (
    assess_preference_fit,
    extract_preference_blocks,
    screen_risk_boundary,
)

T = TypeVar("T", bound=BaseModel)


async def _ask(
    state: DealIntakeState, tier: ModelTier, system: str, payload: dict, schema: type[T]
) -> T:
    """统一封装：上下文 JSON 化 + 合规开关透传（约定 5）。"""
    return await complete_structured(
        tier,
        [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        schema,
        allow_overseas=state.get("allow_overseas", False),
    )


# ---------- Step 3：材料解析 ----------

PARSE_SYSTEM = """你是一级市场（VC/PE）的项目分析师。用户带来一个具体项目（上传了 BP / 粘贴了介绍 /
给了公司名），请从材料中客观抽取结构化事实：
company_name（主体名，尽量规范化）、aliases、uscc（统一社会信用代码，材料给出才填）、
official_website、one_line_intro、founded_at（成立时间/注册时间）、region（所在地/主要经营地域）、
main_business（主营业务）、track、sub_direction、product、tech_route、founders、
funding_stage、funding_amount、valuation、revenue、customers、business_model、market_size、
competitors、contact。
要求：只抽取材料中确有的信息，未提及的字段一律留空，绝不臆造或脑补。若材料只有公司名，
则只填 company_name，其余留空。全部用简体中文（专有名词/英文名保留原文）。"""


async def parse_material(state: DealIntakeState) -> dict:
    """Step 3：从用户材料解析结构化事实。空材料守卫不调 LLM。"""
    material = (state.get("material") or "").strip()
    if not material:
        # 无材料兜底：产出占位抽取，下游 assemble 会标记信息缺口
        return {
            "extraction": DealExtraction(company_name="未识别项目").model_dump(mode="json"),
            "progress": "正在解析项目材料…",
        }
    extraction = await _ask(
        state,
        ModelTier.STANDARD,
        PARSE_SYSTEM,
        {"项目材料": material},
        DealExtraction,
    )
    return {
        "extraction": extraction.model_dump(mode="json"),
        "progress": "正在解析项目材料…",
    }


# ---------- Step 4：外部信息补全 ----------


async def enrich_external(state: DealIntakeState) -> dict:
    """Step 4：用公开数据交叉验证补全（不只信 BP）。

    工商实体走 company_lookup（企查查照面/股东/对外投资），公开信号走 news/funding。
    每条预分配 evidence_id 供 assemble_deal 的 Claim 绑定；runner 成功事务统一落 evidence_items。
    未配置数据源 key 时走空信号路径（assemble 仍出分析，结论自动 inferred）。
    """
    extraction = state.get("extraction") or {}
    name = (extraction.get("company_name") or "").strip()
    track = extraction.get("track") or extraction.get("sub_direction") or ""
    allow_overseas = state.get("allow_overseas", False)
    connectors = active_connectors(allow_overseas=allow_overseas)

    keywords = [k for k in [name, extraction.get("one_line_intro")] if k]
    if not name or name == "未识别项目":
        return {"raw_signals": [], "evidence_sources": [], "progress": "正在补全外部信息…"}

    # 工商实体补全 + 公开信号检索并发
    company_sources = await lookup_company(connectors, name)
    signal_sources = await cached_gather_signals(
        connectors,
        keywords=keywords,
        track=track,
        allow_overseas=allow_overseas,
    )
    # 工商在前（实体锚点），信号在后；按 (url|title) 去重
    seen: set[str] = set()
    evidence_sources: list[dict] = []
    raw_signals: list[dict] = []
    for s in [*company_sources, *signal_sources]:
        key = (s.url or s.title).strip().lower()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        eid = str(uuid.uuid4())  # 预分配证据 id，供 assemble_deal→Claim 绑定
        evidence_sources.append({"evidence_id": eid, **s.model_dump(mode="json")})
        raw_signals.append(
            {
                "evidence_id": eid,
                "source_type": s.source_type,
                "title": s.title,
                "url": s.url,
                "snippet": s.snippet[:500],
                "published_at": s.published_at,
            }
        )
    return {
        "raw_signals": raw_signals,
        "evidence_sources": evidence_sources,
        "progress": "正在补全外部信息…",
    }


# ---------- Step 5：实体对齐（纯函数，确定性） ----------

_COMPANY_NOISE = re.compile(
    r"(有限责任公司|股份有限公司|有限公司|集团|科技|technology|technologies|inc|ltd|co|corp|company|\(.*?\)|（.*?）)",
    re.IGNORECASE,
)
_NON_ALNUM = re.compile(r"[\s\.,，。、_\-/&]+")


def _norm_company(name: str) -> str:
    """公司名规范化：去常见后缀/括注/空白标点、转小写——作为对齐键。"""
    if not name:
        return ""
    s = _COMPANY_NOISE.sub("", name)
    s = _NON_ALNUM.sub("", s)
    return s.strip().lower()


def align_entity(state: DealIntakeState) -> dict:
    """Step 5：与机构已有公司确定性对齐。

    判断带入项目是否已在公司库（避免重复建 Company / 召回已放弃项目）。
    优先 uscc 精确匹配，其次规范化名 + 别名跨字段命中。纯 Python，可独立测试、零 LLM 成本。
    （创始人/官网/邮箱的深度交叉匹配待 persons 业务对象与企查查实体库接入后增强。）
    """
    extraction = state.get("extraction") or {}
    known = state.get("known_companies") or []
    if not known:
        return {"matched_company_id": None, "progress": "正在做实体对齐…"}

    uscc = (extraction.get("uscc") or "").strip()
    name = extraction.get("company_name") or ""
    norm = _norm_company(name)
    alias_norms = {_norm_company(a) for a in (extraction.get("aliases") or []) if a}
    alias_norms.discard("")

    for c in known:
        c_uscc = (c.get("uscc") or "").strip()
        if uscc and c_uscc and uscc == c_uscc:
            return {"matched_company_id": str(c.get("id")), "progress": "正在做实体对齐…"}
    for c in known:
        c_norms = {_norm_company(c.get("name") or "")}
        c_norms |= {_norm_company(a) for a in (c.get("aliases") or []) if a}
        c_norms.discard("")
        if (norm and norm in c_norms) or (alias_norms & c_norms):
            return {"matched_company_id": str(c.get("id")), "progress": "正在做实体对齐…"}

    return {"matched_company_id": None, "progress": "正在做实体对齐…"}


def _apply_learned_preference_to_analysis(
    analysis: DealAnalysis, extraction: dict, preference: dict
) -> None:
    """路线第 9 步反哺：原地把 learned_preference 微调进 overall_fit/fit_score.total，
    并按 risk_boundary 对已识别风险做初筛，命中补 inferred Claim 进 initial_risks。

    纯函数语义（仅改传入 analysis）；空 learned_preference 且空 risk_boundary → 不动（非回归）。
    维度取自材料抽取：sector=track、sub_sector=sub_direction、stage=funding_stage。
    """
    learned, anti, risk_boundary = extract_preference_blocks(preference)
    if not learned and not anti and not risk_boundary:
        return
    # 先留存 LLM 原始风险文本（含估值线索）供边界初筛，避免反哺自述被二次命中
    base_risk_texts = [c.text for c in analysis.initial_risks]
    valuation = extraction.get("valuation")
    if valuation:
        base_risk_texts.append(f"估值：{valuation}")

    infl = assess_preference_fit(
        learned,
        sector=extraction.get("track"),
        sub_sector=extraction.get("sub_direction"),
        stage=extraction.get("funding_stage"),
        anti_preference=anti,
    )
    if infl.changed:
        analysis.overall_fit = infl.adjust(analysis.overall_fit)
        if analysis.fit_score is not None:
            analysis.fit_score.total = infl.adjust(analysis.fit_score.total)
        reason = infl.reason_text()
        if reason:
            analysis.highlights.append(Claim(text=reason, inferred=True))
        risk = infl.risk_text()
        if risk:
            analysis.initial_risks.append(Claim(text=risk, inferred=True))

    for flag in screen_risk_boundary(risk_boundary, base_risk_texts):
        analysis.initial_risks.append(Claim(text=flag.note, inferred=True))


# ---------- Step 8：项目初步分析 ----------

ANALYSIS_SYSTEM = """你是一级市场机构的投资分析师。基于材料抽取与外部补全信息，对这个项目做初步分析
（注意：这不是完整 Pre-DD，只是项目获取阶段的初步研判）：
1. portrait：项目画像，一两句话说清这是家什么公司、做什么
2. track_judgement：所属赛道判断
3. fit_score 分项（0–100）：track_preference、stage_match、moat_match、geo_match（无信息给 50）、
   risk_appetite_match、history_similarity（无历史给 50）、exclusion_penalty（命中不感兴趣清单才 >0）、
   total（加权合成）、rationale（一句话）。结合机构偏好客观打分，信息不足给中性分并说明，不要抬分
4. overall_fit：与 fit_score.total 一致的匹配度总分
5. highlights：投资亮点/机会点。能绑定外部证据的在 evidence_ids 填对应 evidence_id；
   严禁伪造不存在的 id，没有就留空（系统标记为模型推断）
6. initial_risks：初步风险（轻量，非完整尽调），同样可绑定证据
7. info_gaps：材料未覆盖但关键的信息缺口（字符串列表）
8. open_questions：需要向项目方/通过尽调验证的问题（字符串列表）
9. next_steps：推荐下一步动作
要求：BP 与公开信息不一致时，在风险或信息缺口里点出。全部用简体中文。"""


async def assemble_deal(state: DealIntakeState) -> dict:
    """Step 8：项目初步分析 + 组装 DealProfile（落 deals.data）。"""
    extraction = state.get("extraction") or {}
    analysis = await _ask(
        state,
        ModelTier.PREMIUM,
        ANALYSIS_SYSTEM,
        {
            "材料抽取": extraction,
            "外部补全信息": state.get("raw_signals", []),
            "机构偏好": state.get("preference_input", {}),
            "已命中公司": state.get("matched_company_id"),
        },
        DealAnalysis,
    )

    # 路线第 9 步：learned_preference 反哺 + risk_boundary 初筛（原地修改 analysis）
    _apply_learned_preference_to_analysis(
        analysis, extraction, state.get("preference_input") or {}
    )

    source_type = state.get("source_type") or DealSourceType.USER_INPUT.value
    profile = DealProfile(
        source_type=source_type,
        status=DealStatus.SCREENING,
        extraction=DealExtraction.model_validate(extraction),
        analysis=analysis,
        created_from_conversation=state.get("conversation_id"),
        workspace=DealWorkspace(
            created=True,
            conversation_id=state.get("conversation_id"),
            summary=infer_workspace_summary(DealExtraction.model_validate(extraction), analysis),
        ),
    )
    return {
        "deal_profile": profile.model_dump(mode="json"),
        "progress": "项目初步分析完成",
    }
