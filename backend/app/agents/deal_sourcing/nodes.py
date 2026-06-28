"""项目获取 Agent（Deal Sourcing 搜寻流）各节点实现。

设计文档流程一（项目搜寻工作流）的 LangGraph 落地：
  gen_search_strategy（Step 2 搜索策略）
  → mine_signals（Step 3 公开数据挖掘：多 Connector 并发，每条预分配 evidence_id）
  → generate_candidates（Step 4-7 Signal-to-Deal：从信号反推候选公司）
  → dedupe_candidates（Step 5 实体识别去重：名称规范化 + 别名合并，纯函数确定性）
  → verify_candidates（Step 5 工商核验：企查查 company_lookup 补 uscc/规范名，落核验证据）
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

import asyncio
import json
import re
import uuid
from typing import Any, TypeVar
from urllib.parse import urlparse

from pydantic import BaseModel

from app.agents.deal_sourcing.schemas import (
    CandidateDrafts,
    DealListSummary,
    ScoredCandidates,
    SearchStrategy,
)
from app.agents.deal_sourcing.state import DealSourcingState
from app.connectors.base import Source
from app.connectors.registry import active_connectors, cached_gather_signals, lookup_company
from app.llm.client import ModelTier, complete_structured
from app.objects.deal_list import DealSourceType, RecommendationTier
from app.agents.experience.influence import (
    assess_preference_fit,
    extract_preference_blocks,
    screen_risk_boundary,
)

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

MIN_SIGNAL_COUNT = 5
MAX_SIGNAL_SEARCH_ROUNDS = 3


def _uniq_text(values: list[object], *, limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        text = str(value or "").strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        out.append(text)
        if limit is not None and len(out) >= limit:
            break
    return out


def _signal_search_rounds(strat: dict, query: str | None) -> list[list[str]]:
    """Build increasingly broad query rounds for public signal search.

    The first round follows the LLM strategy closely. Later rounds combine themes with
    priority signal words and common deal-sourcing hints, so a weak first search does
    not immediately collapse into an empty deal pool.
    """
    themes = _uniq_text(strat.get("themes") or [])
    keywords = _uniq_text(strat.get("keywords") or [])
    signals = _uniq_text(strat.get("priority_signals") or [])
    regions = _uniq_text(strat.get("regions") or [])
    query_text = str(query or "").strip()

    rounds: list[list[str]] = []
    rounds.append(_uniq_text([*keywords, *themes, query_text], limit=6))

    signal_terms = signals or ["融资", "产品发布", "专利", "工商", "官网", "招聘"]
    rounds.append(
        _uniq_text(
            [
                f"{theme} {signal}"
                for theme in (themes or [query_text])
                for signal in signal_terms[:4]
            ],
            limit=6,
        )
    )

    rounds.append(
        _uniq_text(
            [
                *(f"{region} {theme} 初创 公司" for region in regions[:3] for theme in themes[:3]),
                *(f"{theme} 融资 新闻 官网 专利" for theme in themes[:4]),
                query_text,
            ],
            limit=6,
        )
    )

    unique_rounds: list[list[str]] = []
    seen: set[tuple[str, ...]] = set()
    for round_keywords in rounds:
        key = tuple(round_keywords)
        if round_keywords and key not in seen:
            seen.add(key)
            unique_rounds.append(round_keywords)
    return unique_rounds[:MAX_SIGNAL_SEARCH_ROUNDS]


def _source_key(source: Source) -> str:
    return str(source.url or source.title or "").strip().lower()


async def mine_signals(state: DealSourcingState) -> dict:
    """Step 3：多 Connector 并发挖掘公开数据信号，每条预分配 evidence_id。

    与赛道前瞻 collect_signals 同构：返回 LLM 瘦身视图 raw_signals 与待落库
    完整 Source evidence_sources（runner 成功事务批量落 evidence_items）。
    检索词用策略 keywords + themes（缺失回退用户原始需求）；global 源受 allow_overseas
    闸控（检索词出境合规，约定 5）；未配置任何数据源 key 时走空信号路径。
    """
    strat = state.get("search_strategy") or {}
    # themes 第一项作为 track（驱动 funding_events 检索），缺失回退用户需求
    track = ""
    themes = strat.get("themes") or []
    if themes:
        track = themes[0]
    elif state.get("query"):
        track = state["query"]

    allow_overseas = state.get("allow_overseas", False)
    connectors = active_connectors(allow_overseas=allow_overseas)
    sources: list[Source] = []
    seen_sources: set[str] = set()
    for round_keywords in _signal_search_rounds(strat, state.get("query")):
        batch = await cached_gather_signals(
            connectors,
            keywords=round_keywords,
            track=track,
            allow_overseas=allow_overseas,
        )
        for source in batch:
            key = _source_key(source)
            if not key or key in seen_sources:
                continue
            seen_sources.add(key)
            sources.append(source)
        if len(sources) >= MIN_SIGNAL_COUNT:
            break

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
不要凭空编造公司名。
若市场信号为空，但搜索策略、来源 Thesis 或机构偏好已经明确到具体细分方向，
可以生成 3-8 个“待核验候选”：必须选择真实存在且名称尽量规范的公司/项目，
selection_reasons 的 evidence_ids 必须留空，并说明需要后续公开资料核验。
只有在方向完全无法判断时才返回空候选列表。"""


async def generate_candidates(state: DealSourcingState) -> dict:
    """Step 4-7：从信号反推候选公司；信号不足时生成待核验候选兜底。"""
    raw = state.get("raw_signals") or []
    fallback_mode = not raw
    payload = {
        "搜索策略": state.get("search_strategy", {}),
        "市场信号": raw,
    }
    if fallback_mode:
        payload.update(
            {
                "补充要求": (
                    "当前公开信号为空。请基于搜索策略、来源 Thesis、机构偏好和用户需求，"
                    "生成少量待核验候选；不要伪造 evidence_id，入选理由必须说明待公开资料核验。"
                ),
                "来源Thesis": state.get("thesis_context", {}),
                "机构偏好": state.get("preference_input", {}),
                "用户需求": state.get("query", ""),
            }
        )
    result = await _ask(
        state,
        ModelTier.STANDARD,
        CANDIDATE_SYSTEM,
        payload,
        CandidateDrafts,
    )
    candidates = [c.model_dump(mode="json") for c in result.candidates]
    if raw and not candidates:
        fallback_mode = True
        result = await _ask(
            state,
            ModelTier.STANDARD,
            CANDIDATE_SYSTEM,
            {
                "搜索策略": state.get("search_strategy", {}),
                "市场信号": [],
                "已检索但未形成候选的信号摘要": raw[:8],
                "补充要求": (
                    "已有公开搜索结果不足以支撑直接反推候选。请改用搜索策略、来源 Thesis、"
                    "机构偏好和用户需求生成少量待核验候选；不要伪造 evidence_id。"
                ),
                "来源Thesis": state.get("thesis_context", {}),
                "机构偏好": state.get("preference_input", {}),
                "用户需求": state.get("query", ""),
            },
            CandidateDrafts,
        )
        candidates = [c.model_dump(mode="json") for c in result.candidates]
    if fallback_mode:
        for candidate in candidates:
            reasons = []
            for reason in candidate.get("selection_reasons") or []:
                text = str(reason.get("text") or "").strip()
                if text and "待" not in text and "核验" not in text:
                    text = f"{text}（待公开资料进一步核验）"
                reasons.append({**reason, "text": text, "evidence_ids": [], "inferred": True})
            candidate["selection_reasons"] = reasons or [
                {
                    "text": "基于搜索策略和机构偏好的待核验候选，需补充公开资料确认匹配度。",
                    "evidence_ids": [],
                    "inferred": True,
                }
            ]
    return {
        "candidates": candidates,
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
    （工商主体核验在下一节点 verify_candidates 用企查查 company_lookup 完成；
    创始人/官网级深度交叉匹配待 Company 业务对象沉淀后进一步增强。）
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


# ---------- Step 5：工商核验（企查查 company_lookup，确定性富化 + 落证据） ----------

MAX_VERIFY = 20          # 单次最多核验候选数（控开放平台配额/调用成本）
VERIFY_CONCURRENCY = 5   # 工商查询并发上限
MAX_REFERENCE_CANDIDATES = 12
REFERENCE_CONCURRENCY = 3
MAX_REFERENCE_SOURCES_PER_CANDIDATE = 8


def _registry_basic(sources: list) -> dict | None:
    """从 company_lookup 返回里取工商照面 Source 的原始报文（None 表示未命中）。"""
    for s in sources:
        if getattr(s, "source_type", "") == "company_registry":
            return s.raw or {}
    return None


def _reg_field(raw: dict, *keys: str) -> str:
    for k in keys:
        v = raw.get(k)
        if v not in (None, ""):
            return str(v)
    return ""


async def verify_candidates(state: DealSourcingState) -> dict:
    """Step 5：对去重后的候选做工商核验（企查查 company_lookup）。

    设计文档把「新注册公司的工商信息」列为最宝贵的项目信息来源之一。这里对每个候选
    并发拉工商照面/股东/对外投资，把命中结果：
    - 落进 evidence_sources（每条 Source 预分配 evidence_id，runner 成功事务统一持久化）；
    - 用工商主体规范名补全 aliases、用统一社会信用代码补 uscc（确定性，不过 LLM）；
    - 追加一条绑定工商照面 evidence_id 的核验 Claim 到 selection_reasons（约定 2：有据可查）。
    未命中的候选保持原样、绝不伪造证据。company_lookup 走工商源（region=cn），
    active_connectors 已按 allow_overseas 过滤（约定 5）；无工商源 key 时全部未命中、链路无副作用。
    """
    cands = state.get("candidates") or []
    if not cands:
        return {"candidates": cands, "progress": "正在做工商核验…"}

    connectors = active_connectors(allow_overseas=state.get("allow_overseas", False))
    if not connectors:
        return {"candidates": cands, "progress": "正在做工商核验…"}

    targets = cands[:MAX_VERIFY]
    sem = asyncio.Semaphore(VERIFY_CONCURRENCY)

    async def _lookup(name: str) -> list:
        async with sem:
            return await lookup_company(connectors, name)

    results = await asyncio.gather(
        *(_lookup((c.get("company_name") or "").strip()) for c in targets)
    )

    # 在已有 evidence_sources 基础上累加（TypedDict 无 reducer，须读旧值合并返回）
    evidence_sources: list[dict] = list(state.get("evidence_sources") or [])

    for cand, sources in zip(targets, results):
        if not sources:
            continue
        basic = _registry_basic(sources)
        # 工商照面 evidence_id：核验 Claim 绑定它；其余股东/对外投资亦各自落证据
        registry_eid: str | None = None
        for s in sources:
            eid = str(uuid.uuid4())
            evidence_sources.append({"evidence_id": eid, **s.model_dump(mode="json")})
            if registry_eid is None and getattr(s, "source_type", "") == "company_registry":
                registry_eid = eid

        if basic is None or registry_eid is None:
            continue  # 仅命中股东/对外投资但无照面——不补核验结论，避免误导

        reg_name = _reg_field(basic, "Name")
        uscc = _reg_field(basic, "CreditCode", "USCC")
        status = _reg_field(basic, "Status", "ShortStatus")

        if uscc and not cand.get("uscc"):
            cand["uscc"] = uscc
        if reg_name and reg_name != cand.get("company_name"):
            aliases = list(cand.get("aliases") or [])
            if reg_name not in aliases:
                aliases.append(reg_name)
            cand["aliases"] = aliases

        verify_text = f"企查查工商核验：主体「{reg_name or cand.get('company_name')}」已登记"
        if status:
            verify_text += f"（经营状态：{status}）"
        if uscc:
            verify_text += f"，统一社会信用代码 {uscc}"
        reasons = list(cand.get("selection_reasons") or [])
        reasons.append({"text": verify_text, "evidence_ids": [registry_eid], "inferred": False})
        cand["selection_reasons"] = reasons

    return {
        "candidates": cands,
        "evidence_sources": evidence_sources,
        "progress": "正在做工商核验…",
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
    # 路线第 9 步：learned_preference 反哺——候选 fit_score 有界微调 + risk_boundary 初筛旗标
    enriched = apply_learned_preference_to_candidates(
        enriched, state.get("preference_input") or {}, state.get("thesis_context") or {}
    )
    # 按初筛总分降序（排序键），强推荐在前
    enriched.sort(key=lambda c: c.get("initial_score", 0), reverse=True)
    return {"candidates": enriched, "progress": "正在计算机构匹配度并排序…"}


# ---------- 候选项目资料链接归集 ----------

_WEBSITE_RAW_KEYS = (
    "Website",
    "WebSite",
    "WebSiteUrl",
    "WebUrl",
    "Url",
    "CompanyUrl",
    "OfficialWebsite",
    "HomePage",
    "Homepage",
)


def _claim_evidence_ids(candidate: dict) -> set[str]:
    ids: set[str] = set()
    for key in ("selection_reasons", "recommendation_reasons", "initial_risks"):
        for claim in candidate.get(key) or []:
            if not isinstance(claim, dict):
                continue
            for evidence_id in claim.get("evidence_ids") or []:
                if evidence_id:
                    ids.add(str(evidence_id))
    return ids


def _url(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.startswith("www."):
        text = f"https://{text}"
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return text
    return None


def _raw_website(raw: object) -> str | None:
    if not isinstance(raw, dict):
        return None
    for key in _WEBSITE_RAW_KEYS:
        value = _url(raw.get(key))
        if value:
            return value
    for value in raw.values():
        if isinstance(value, dict):
            nested = _raw_website(value)
            if nested:
                return nested
    return None


def _valid_uuid(value: object) -> str | None:
    try:
        return str(uuid.UUID(str(value)))
    except (TypeError, ValueError):
        return None


def _norm_text(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "")).lower()


def _source_matches_candidate(source: dict, candidate: dict) -> bool:
    raw = source.get("raw") if isinstance(source.get("raw"), dict) else {}
    tagged_name = str(source.get("candidate_name") or raw.get("_candidate_reference_for") or "")
    if tagged_name and tagged_name == str(candidate.get("company_name") or ""):
        return True
    haystack = _norm_text(" ".join(str(source.get(key) or "") for key in ("title", "snippet", "url")))
    names = [candidate.get("company_name"), *(candidate.get("aliases") or [])]
    return any(_norm_text(name) and _norm_text(name) in haystack for name in names)


def _looks_like_official_source(source: dict) -> bool:
    text = _norm_text(" ".join(str(source.get(key) or "") for key in ("title", "snippet", "url")))
    if any(token in text for token in ("官网", "官方网站", "公司官网", "首页", "homepage", "officialwebsite")):
        return True
    parsed = urlparse(str(source.get("url") or ""))
    path = parsed.path.strip("/")
    return bool(parsed.netloc and path in {"", "index.html", "index.htm"})


def _candidate_references(candidate: dict, evidence_sources: list[dict]) -> tuple[str | None, list[dict[str, Any]]]:
    """Attach homepage/reference URLs from real evidence sources.

    Priority:
    1. URLs whose evidence_ids are explicitly cited by the candidate.
    2. URLs whose title/snippet mentions the company or aliases.
    3. Official website-like fields from company registry raw payloads.
    """
    cited_ids = _claim_evidence_ids(candidate)
    links: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    official_website = _url(candidate.get("official_website"))

    def add_link(source: dict) -> None:
        url = _url(source.get("url"))
        if not url or url in seen_urls:
            return
        seen_urls.add(url)
        links.append(
            {
                "title": str(source.get("title") or source.get("source_type") or "相关资料"),
                "url": url,
                "source_type": source.get("source_type"),
                "evidence_id": _valid_uuid(source.get("evidence_id")),
            }
        )

    for source in evidence_sources:
        if str(source.get("evidence_id") or "") in cited_ids:
            add_link(source)
        website = _raw_website(source.get("raw"))
        if website and not official_website and (
            str(source.get("evidence_id") or "") in cited_ids or _source_matches_candidate(source, candidate)
        ):
            official_website = website
        if (
            not official_website
            and _source_matches_candidate(source, candidate)
            and _looks_like_official_source(source)
        ):
            official_website = _url(source.get("url"))

    for source in evidence_sources:
        if len(links) >= 5:
            break
        if _source_matches_candidate(source, candidate):
            add_link(source)

    if official_website and official_website not in seen_urls:
        links.insert(
            0,
            {
                "title": f"{candidate.get('company_name') or '候选项目'} 官网/主页",
                "url": official_website,
                "source_type": "official_website",
                "evidence_id": None,
            },
        )

    return official_website, links[:5]


def attach_candidate_reference_links(candidates: list[dict], evidence_sources: list[dict]) -> list[dict]:
    """Enrich final candidates with homepage/reference links without changing ranking."""
    if not candidates:
        return []
    out: list[dict] = []
    for candidate in candidates:
        official_website, links = _candidate_references(candidate, evidence_sources)
        enriched = dict(candidate)
        if official_website:
            enriched["official_website"] = official_website
        enriched["reference_links"] = links
        out.append(enriched)
    return out


def _reference_queries(candidate: dict) -> list[str]:
    names = [
        str(name).strip()
        for name in [candidate.get("company_name"), *(candidate.get("aliases") or [])]
        if str(name or "").strip()
    ]
    queries: list[str] = []
    for name in names[:2]:
        queries.extend(
            [
                f"{name} 官网 官方网站",
                f"{name} 融资 新闻 专利 工商",
                f"{name} 最新 重要 进展",
            ]
        )
    return list(dict.fromkeys(queries))[:6]


def _reference_source_dump(source: Source, *, candidate_name: str, kind: str) -> dict[str, Any]:
    payload = source.model_dump(mode="json")
    raw = dict(payload.get("raw") or {})
    raw["_candidate_reference_for"] = candidate_name
    raw["_candidate_reference_kind"] = kind
    payload["raw"] = raw
    payload["candidate_name"] = candidate_name
    payload["reference_kind"] = kind
    return payload


async def _candidate_reference_sources(
    connectors,
    *,
    candidate: dict,
    allow_overseas: bool,
) -> list[dict[str, Any]]:
    company_name = str(candidate.get("company_name") or "").strip()
    if not company_name:
        return []

    registry_sources, search_sources = await asyncio.gather(
        lookup_company(connectors, company_name),
        cached_gather_signals(
            connectors,
            keywords=_reference_queries(candidate),
            track=company_name,
            days=3650,
            allow_overseas=allow_overseas,
        ),
    )

    payloads: list[dict[str, Any]] = []
    for source in registry_sources:
        payloads.append(_reference_source_dump(source, candidate_name=company_name, kind="registry"))
    for source in search_sources:
        payloads.append(_reference_source_dump(source, candidate_name=company_name, kind="company_reference"))
    return payloads[:MAX_REFERENCE_SOURCES_PER_CANDIDATE]


def _evidence_key(source: dict) -> str:
    return str(source.get("url") or source.get("title") or "").strip().lower()


async def collect_candidate_reference_materials(state: DealSourcingState) -> dict:
    """Supplement each shortlisted candidate with recent, important reference materials.

    This node intentionally runs after scoring: it focuses limited search quota on the candidates
    that will actually be shown in the generated project pool.
    """
    candidates = state.get("candidates") or []
    if not candidates:
        return {"candidates": candidates, "progress": "正在补充候选项目相关资料…"}

    allow_overseas = state.get("allow_overseas", False)
    connectors = active_connectors(allow_overseas=allow_overseas)
    if not connectors:
        return {"candidates": candidates, "progress": "正在补充候选项目相关资料…"}

    sem = asyncio.Semaphore(REFERENCE_CONCURRENCY)

    async def collect(candidate: dict) -> list[dict[str, Any]]:
        async with sem:
            return await _candidate_reference_sources(
                connectors,
                candidate=candidate,
                allow_overseas=allow_overseas,
            )

    batches = await asyncio.gather(*(collect(candidate) for candidate in candidates[:MAX_REFERENCE_CANDIDATES]))
    evidence_sources: list[dict] = list(state.get("evidence_sources") or [])
    seen = {_evidence_key(source) for source in evidence_sources if _evidence_key(source)}

    for batch in batches:
        for source in batch:
            key = _evidence_key(source)
            if not key or key in seen:
                continue
            seen.add(key)
            evidence_sources.append({"evidence_id": str(uuid.uuid4()), **source})

    return {
        "candidates": candidates,
        "evidence_sources": evidence_sources,
        "progress": "正在补充候选项目相关资料…",
    }


def _system_claim(text: str) -> dict:
    """系统推断 Claim（无证据→inferred=True，约定 2）；候选 initial_risks/reasons 用 dict 形态。"""
    return {"text": text, "evidence_ids": [], "inferred": True}


def _thesis_sector(thesis_context: dict) -> str | None:
    for key in ("track", "thesis_name", "name"):
        v = thesis_context.get(key)
        if isinstance(v, str) and v.strip():
            return v
    return None


def apply_learned_preference_to_candidates(
    candidates: list[dict], preference: dict, thesis_context: dict
) -> list[dict]:
    """路线第 9 步反哺：learned_preference 微调候选 initial_score + 重排分层；risk_boundary 初筛。

    纯函数、确定性：空 learned_preference 且空 anti_preference 且空 risk_boundary → 原样返回
    （零调整），严格非回归。调整与命中以 inferred Claim 落进 recommendation_reasons / initial_risks
    （约定 2 可解释）；分层据调整后分数用 _tier_from_score 重算。
    """
    learned, anti, risk_boundary = extract_preference_blocks(preference)
    if not learned and not anti and not risk_boundary:
        return candidates
    sector = _thesis_sector(thesis_context or {})
    out: list[dict] = []
    for raw in candidates:
        c = dict(raw)
        base_risk_texts = [
            r.get("text") for r in (c.get("initial_risks") or []) if isinstance(r, dict)
        ]
        infl = assess_preference_fit(
            learned, sector=sector, sub_sector=c.get("sub_direction"), anti_preference=anti
        )
        if infl.changed:
            new_score = infl.adjust(c.get("initial_score", 50.0))
            c["initial_score"] = new_score
            c["recommendation_tier"] = _tier_from_score(new_score).value
            c["preference_influence"] = infl.as_dict()
            reason = infl.reason_text()
            if reason:
                c["recommendation_reasons"] = list(c.get("recommendation_reasons") or []) + [
                    _system_claim(reason)
                ]
            risk = infl.risk_text()
            if risk:
                c["initial_risks"] = list(c.get("initial_risks") or []) + [_system_claim(risk)]
        flags = screen_risk_boundary(risk_boundary, base_risk_texts)
        if flags:
            c["initial_risks"] = list(c.get("initial_risks") or []) + [
                _system_claim(f.note) for f in flags
            ]
            c["risk_boundary_flags"] = [f.as_dict() for f in flags]
        out.append(c)
    return out


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
    cands = attach_candidate_reference_links(
        state.get("candidates") or [],
        state.get("evidence_sources") or [],
    )
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
