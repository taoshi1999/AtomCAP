"""项目获取 Agent（Deal Sourcing 搜寻流）各节点实现。

设计文档流程一（项目搜寻工作流）的 LangGraph 落地：
  gen_search_strategy（Step 2 搜索策略）
  → mine_signals（Step 3 公开数据挖掘：多 Connector 并发，每条预分配 evidence_id）
  → generate_candidates（Step 4-7 Signal-to-Deal：从信号反推候选公司）
  → dedupe_candidates（Step 5 实体识别去重：名称规范化 + 别名合并，纯函数确定性）
  → score_candidates（Step 8-9 机构匹配度评分 + 推荐理由/轻量风险 + 推荐分层）
  → assemble_deal_list（Step 10 组装 DealList，PREMIUM 仅做池级命名与总览）

原则（与赛道前瞻一致）：
- 轻任务（策略拆解）FAST，候选生成/评分 STANDARD，池级组装 PREMIUM（约定 3）
- 节点纯函数（state in → state out），不碰数据库；落库由 agents/runner.py 编排
- 结论用 Claim 绑定信号 evidence_id，无证据自动 inferred=True（约定 2），严禁伪造
- 所有 LLM 调用经 _ask() 透传 allow_overseas（约定 5）
- 实体去重为纯 Python 确定性逻辑：可独立测试、零 LLM 成本
"""

from __future__ import annotations

import json
import re
import uuid
from typing import TypeVar

from pydantic import BaseModel

from app.agents.deal_sourcing.schemas import (
    CandidateDrafts,
    DealListSummary,
    ScoredCandidates,
    SearchStrategy,
)
from app.agents.deal_sourcing.state import DealSourcingState
from app.connectors.registry import active_connectors, cached_gather_signals
from app.llm.client import ModelTier, complete_structured
from app.objects.deal_list import DealSourceType, RecommendationTier

T = TypeVar("T", bound=BaseModel)


async def _ask(
    state: DealSourcingState, tier: ModelTier, system: str, payload: dict, schema: type[T]
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


# ---------- Step 2：搜索策略 ----------

STRATEGY_SYSTEM = """你是一级市场（VC/PE）的项目搜寻分析师。把用户的模糊找项目需求拆成可执行的搜索策略：
1. themes：拆出 2–8 个具体检索主题（如「AI 眼镜光学模组」「端侧 AI 芯片」「机器人力觉感知」），
   不要停留在用户给的大词上——要细化到产业链环节/技术方向
2. priority_signals：列出本次优先关注的信号类型（新融资/新注册公司/专利增长/大厂离职创业/
   招聘扩张/产品发布/产业客户合作等）
3. keywords：供检索的关键词，中英文各若干
4. regions：用户提到地域则填（如深圳、苏州），没提就留空
重要：若给了来源 Thesis（赛道判断/子赛道/产业链位置/机构匹配度），要据整个 Thesis 拆策略，
而不仅依据赛道名四个字。结合机构偏好聚焦，但不强行迎合。"""


async def gen_search_strategy(state: DealSourcingState) -> dict:
    """Step 2：把模糊需求拆成可执行搜索策略（据来源 Thesis 与机构偏好聚焦）。"""
    strat = await _ask(
        state,
        ModelTier.FAST,
        STRATEGY_SYSTEM,
        {
            "用户需求": state.get("query", ""),
            "来源Thesis": state.get("thesis_context", {}),
            "机构偏好": state.get("preference_input", {}),
        },
        SearchStrategy,
    )
    return {
        "search_strategy": strat.model_dump(mode="json"),
        "progress": "正在生成项目搜索策略…",
    }


# ---------- Step 3：公开数据挖掘 ----------


async def mine_signals(state: DealSourcingState) -> dict:
    """Step 3：多 Connector 并发挖掘公开数据信号，每条预分配 evidence_id。

    与赛道前瞻 collect_signals 同构：返回 LLM 瘦身视图 raw_signals 与待落库
    完整 Source evidence_sources（runner 成功事务批量落 evidence_items）。
    检索词用策略 keywords + themes（缺失回退用户原始需求）；global 源受 allow_overseas
    闸控（检索词出境合规，约定 5）；未配置任何数据源 key 时走空信号路径。
    """
    strat = state.get("search_strategy") or {}
    keywords = [k for k in (strat.get("keywords") or []) if k]
    keywords += [t for t in (strat.get("themes") or []) if t]
    if not keywords and state.get("query"):
        keywords = [state["query"]]
    # themes 第一项作为 track（驱动 funding_events 检索），缺失回退用户需求
    track = ""
    themes = strat.get("themes") or []
    if themes:
        track = themes[0]
    elif state.get("query"):
        track = state["query"]

    allow_overseas = state.get("allow_overseas", False)
    connectors = active_connectors(allow_overseas=allow_overseas)
    sources = await cached_gather_signals(
        connectors,
        keywords=keywords,
        track=track,
        allow_overseas=allow_overseas,
    )

    evidence_sources: list[dict] = []
    raw_signals: list[dict] = []
    for s in sources:
        eid = str(uuid.uuid4())  # 预分配证据 id，供 generate_candidates→Claim 绑定
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
        "progress": "正在挖掘公开数据信号…",
    }


# ---------- Step 4-7：Signal-to-Deal 候选生成 ----------

CANDIDATE_SYSTEM = """你是一级市场项目搜寻分析师。采用 Signal-to-Deal 思路：从市场信号反推候选公司/项目。
对每条值得跟进的信号，识别其指向的公司或创业团队，产出候选：
1. company_name：公司主体名，尽量规范化（口语/品牌名 → 工商主体习惯叫法）
2. aliases：已知的品牌名/英文名/项目代号
3. sub_direction：对应的子赛道方向
4. selection_reasons：入选理由，必须在 evidence_ids 里填触发它的信号 evidence_id；
   严禁伪造不存在的 id，没有就留空（系统会标记为模型推断）
要求：宁缺毋滥，只产出信号确实支撑的候选；同一家公司不同信号合并成一条；
不要凭空编造公司名。信号为空时返回空候选列表。"""


async def generate_candidates(state: DealSourcingState) -> dict:
    """Step 4-7：从信号反推候选公司（Signal-to-Deal）。无信号不调 LLM（控成本）。"""
    raw = state.get("raw_signals") or []
    if not raw:
        return {"candidates": [], "progress": "正在生成候选项目…"}
    result = await _ask(
        state,
        ModelTier.STANDARD,
        CANDIDATE_SYSTEM,
        {
            "搜索策略": state.get("search_strategy", {}),
            "市场信号": raw,
        },
        CandidateDrafts,
    )
    return {
        "candidates": [c.model_dump(mode="json") for c in result.candidates],
        "progress": "正在生成候选项目…",
    }


# ---------- Step 5：实体识别、清洗与去重（纯函数，确定性） ----------

_COMPANY_NOISE = re.compile(
    r"(有限责任公司|股份有限公司|有限公司|集团|科技|technology|technologies|inc|ltd|co|corp|company|\(.*?\)|（.*?）)",
    re.IGNORECASE,
)
_NON_ALNUM = re.compile(r"[\s\.,，。、_\-/&]+")


def _norm_company(name: str) -> str:
    """公司名规范化：去常见后缀/括注/空白标点、转小写——作为去重键。"""
    if not name:
        return ""
    s = _COMPANY_NOISE.sub("", name)
    s = _NON_ALNUM.sub("", s)
    return s.strip().lower()


def dedupe_candidates(state: DealSourcingState) -> dict:
    """Step 5：实体对齐去重。

    同一项目常有多名称（工商主体/品牌名/中英文/项目代号）。这里做确定性合并：
    - 按规范化名 + 已知别名建立去重键，命中即合并
    - 合并 aliases、selection_reasons（按 text 去重），保留信息最全的主名
    纯 Python 确定性逻辑：可独立测试、零 LLM 成本。
    （创始人/官网/工商主体的深度交叉匹配待 Company 业务对象与企查查实体库接入后增强。）
    """
    cands = state.get("candidates") or []
    if not cands:
        return {"candidates": [], "progress": "正在做实体识别与去重…"}

    merged: dict[str, dict] = {}
    key_alias: dict[str, str] = {}  # 别名规范化 → 主键，跨条命中

    for c in cands:
        name = (c.get("company_name") or "").strip()
        if not name:
            continue
        norm = _norm_company(name)
        alias_norms = [_norm_company(a) for a in (c.get("aliases") or []) if a]
        # 命中已有主键：主名 norm 或任一别名 norm 之前出现过
        hit = None
        for k in [norm, *alias_norms]:
            if k and k in key_alias:
                hit = key_alias[k]
                break
        if hit is None:
            hit = norm or name.lower()
            merged[hit] = {
                "company_name": name,
                "aliases": list(dict.fromkeys(c.get("aliases") or [])),
                "sub_direction": c.get("sub_direction"),
                "selection_reasons": list(c.get("selection_reasons") or []),
            }
        else:
            tgt = merged[hit]
            # 合并别名：把这条的主名（若不同）与别名都纳入
            new_aliases = list(tgt["aliases"])
            for a in [name, *(c.get("aliases") or [])]:
                if a and a != tgt["company_name"] and a not in new_aliases:
                    new_aliases.append(a)
            tgt["aliases"] = new_aliases
            # 合并入选理由（按 text 去重）
            seen_text = {r.get("text") for r in tgt["selection_reasons"]}
            for r in c.get("selection_reasons") or []:
                if r.get("text") not in seen_text:
                    tgt["selection_reasons"].append(r)
                    seen_text.add(r.get("text"))
            tgt["sub_direction"] = tgt.get("sub_direction") or c.get("sub_direction")
        # 登记本条所有规范化键 → 主键
        for k in [norm, *alias_norms]:
            if k:
                key_alias[k] = hit

    return {
        "candidates": list(merged.values()),
        "progress": "正在做实体识别与去重…",
    }


# ---------- Step 8-9：匹配度评分 + 推荐理由/轻量风险 + 分层 ----------

SCORE_SYSTEM = """你是一级市场机构的投资策略分析师。对每个候选项目按机构视角打分并给推荐结论：
1. fit_score 分项（0–100）：track_preference（赛道匹配）、stage_match（阶段匹配）、
   moat_match（技术壁垒匹配）、geo_match（地域匹配，无信息给 50）、
   risk_appetite_match（风险偏好匹配）、history_similarity（与历史项目相似度，无历史给 50）、
   exclusion_penalty（命中机构不感兴趣清单才 >0 并说明）、total（加权合成）、rationale（一句话）
2. recommendation_tier：据 total 与信号强度给分层——strong（强推荐）/watch（可关注）/
   observe（待观察）/reject（不推荐或不匹配）
3. recommendation_reasons：为何值得机构关注（绑定信号 evidence_id，无证据留空由系统标记推断）
4. initial_risks：项目获取阶段的轻量风险（非完整 Pre-DD），同样可绑定证据
诚实打分：信息不足给中性分并说明，不要抬分。company_name 必须与输入候选一致（按名合并）。"""


def _tier_from_score(total: float) -> RecommendationTier:
    """评分缺失候选的回退分层（确定性兜底，绝不让候选丢失分层）。"""
    if total >= 80:
        return RecommendationTier.STRONG
    if total >= 65:
        return RecommendationTier.WATCH
    if total >= 45:
        return RecommendationTier.OBSERVE
    return RecommendationTier.REJECT


async def score_candidates(state: DealSourcingState) -> dict:
    """Step 8-9：逐候选机构匹配度评分 + 推荐分层。无候选不调 LLM。"""
    cands = state.get("candidates") or []
    if not cands:
        return {"candidates": [], "progress": "正在计算机构匹配度并排序…"}

    assessment = await _ask(
        state,
        ModelTier.STANDARD,
        SCORE_SYSTEM,
        {
            "搜索策略": state.get("search_strategy", {}),
            "候选项目": cands,
            "机构偏好": state.get("preference_input", {}),
            "来源Thesis": state.get("thesis_context", {}),
        },
        ScoredCandidates,
    )
    score_by_name = {s.company_name: s for s in assessment.candidates}

    enriched: list[dict] = []
    for c in cands:
        name = c.get("company_name")
        sc = score_by_name.get(name)
        if sc is not None:
            total = sc.fit_score.total
            enriched.append(
                {
                    **c,
                    "fit_score": sc.fit_score.model_dump(mode="json"),
                    "initial_score": total,
                    "recommendation_tier": sc.recommendation_tier.value,
                    "recommendation_reasons": [r.model_dump(mode="json") for r in sc.recommendation_reasons],
                    "initial_risks": [r.model_dump(mode="json") for r in sc.initial_risks],
                }
            )
        else:
            # 评分缺失：中性分回退，绝不丢候选（约定：候选不静默消失）
            enriched.append(
                {
                    **c,
                    "fit_score": None,
                    "initial_score": 50.0,
                    "recommendation_tier": _tier_from_score(50.0).value,
                    "recommendation_reasons": [],
                    "initial_risks": [],
                }
            )
    # 按初筛总分降序（排序键），强推荐在前
    enriched.sort(key=lambda c: c.get("initial_score", 0), reverse=True)
    return {"candidates": enriched, "progress": "正在计算机构匹配度并排序…"}


# ---------- Step 10：组装 DealList ----------

ASSEMBLE_SYSTEM = """你是一级市场项目搜寻分析师，为候选项目池命名并写一句话总览。
- name：项目池名称，体现核心方向，如「AI 硬件上游候选项目池」
- summary：一句话总览，说明覆盖的方向、候选规模与推荐分布（强推荐/可关注/待观察各几个）
只做池级提炼，不要改动或编造候选明细。全部用简体中文。"""


def _empty_deal_list(state: DealSourcingState) -> dict:
    """无候选时的兜底交付：仍产出合法 DealList（空池也是有效结论，记录已检索方向）。"""
    strat = state.get("search_strategy") or {}
    themes = strat.get("themes") or []
    src = state.get("thesis_context") or {}
    payload = {
        "name": (f"{themes[0]}候选项目池" if themes else "候选项目池"),
        "source_type": (
            DealSourceType.THESIS_GENERATED.value
            if state.get("source_thesis_id")
            else DealSourceType.PUBLIC_SIGNAL_MINING.value
        ),
        "source_thesis_id": state.get("source_thesis_id"),
        "search_themes": themes,
        "summary": "本次未从已配置数据源挖掘到符合条件的候选项目（数据源未实装真实 key 或无匹配信号）。",
        "candidates": [],
    }
    if state.get("conversation_id"):
        payload["created_from_conversation"] = state["conversation_id"]
    _ = src  # 预留：来源 Thesis 名将并入命名（Company 业务对象接入后增强）
    return payload


async def assemble_deal_list(state: DealSourcingState) -> dict:
    """Step 10：组装 DealList（PREMIUM 仅做池级命名与总览，候选明细已结构化保真）。

    候选评分与证据绑定已在前序节点完成，组装阶段不再过 LLM 重写候选——避免丢失
    evidence_ids 与结构化评分。落库不在节点内做，由 agents/runner.py 编排。
    """
    cands = state.get("candidates") or []
    strat = state.get("search_strategy") or {}
    themes = strat.get("themes") or []

    if not cands:
        return {"deal_list": _empty_deal_list(state), "progress": "项目池已生成"}

    tier_counts: dict[str, int] = {}
    for c in cands:
        t = c.get("recommendation_tier") or RecommendationTier.OBSERVE.value
        tier_counts[t] = tier_counts.get(t, 0) + 1

    meta = await _ask(
        state,
        ModelTier.PREMIUM,
        ASSEMBLE_SYSTEM,
        {
            "搜索策略": strat,
            "候选数量": len(cands),
            "推荐分布": tier_counts,
            "候选概览": [
                {"company_name": c.get("company_name"), "tier": c.get("recommendation_tier"),
                 "score": c.get("initial_score"), "sub_direction": c.get("sub_direction")}
                for c in cands
            ],
        },
        DealListSummary,
    )

    payload = {
        "name": meta.name,
        "source_type": (
            DealSourceType.THESIS_GENERATED.value
            if state.get("source_thesis_id")
            else DealSourceType.PUBLIC_SIGNAL_MINING.value
        ),
        "source_thesis_id": state.get("source_thesis_id"),
        "search_themes": themes,
        "summary": meta.summary,
        "candidates": cands,
    }
    if state.get("conversation_id"):
        payload["created_from_conversation"] = state["conversation_id"]
    return {"deal_list": payload, "progress": "项目池已生成"}
