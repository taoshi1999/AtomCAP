"""赛道前瞻 Agent 各节点实现。

全部九个节点均为真实实现。load_preference/load_history 不直接查库：
runner 在 run 创建事务中预加载 preferences active 版本与 domain_events
回放（preference_input / history_events 注入初始 state），节点只做
校验、按赛道过滤与 LLM 视图构造——节点保持纯函数，可独立测试。

原则：
- 轻任务（拆解/分类）用 FAST 档，综合判断用 STANDARD，最终组装用 PREMIUM（约定 3）
- 每条检索结果先落 evidence_items，结论经 Claim 绑定 evidence_ids；
  无证据结论由 Claim 自动 inferred=True（约定 2），严禁提示词外伪造证据 id
- 信号必须区分热度（heat）与结构性（structural），结构性加权
- 节点是纯函数（state in → state out），不碰数据库；落库由 agents/runner.py 编排
- 所有 LLM 调用经 _ask() 透传 allow_overseas（约定 5）
"""

from __future__ import annotations

import json
import uuid

from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.agents.thesis_scout.schemas import (
    ClassifiedSignals,
    FitAssessment,
    SubDirectionDrafts,
    TrackDefinition,
)
from app.agents.thesis_scout.state import ThesisScoutState
from app.connectors.registry import active_connectors, cached_gather_signals
from app.llm.client import ModelTier, complete_structured
from app.objects.preference import InvestmentPreference
from app.objects.thesis import Thesis, ValueChain
from app.agents.experience.influence import (
    assess_preference_fit,
    extract_preference_blocks,
)


T = TypeVar("T", bound=BaseModel)


async def _ask(
    state: ThesisScoutState, tier: ModelTier, system: str, payload: dict, schema: type[T]
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


PARSE_TRACK_SYSTEM = """你是一级市场（VC/PE）赛道研究员。把用户的投资方向问题拆解为明确的赛道定义：
1. name：规范化赛道名称（用户口语 →行业通用叫法）
2. includes：该赛道包括的细分领域/产业环节，5 个以内
3. excludes：容易与之混淆但不属于该赛道的领域（划清研究边界）
4. search_keywords：检索市场信号用的关键词，中英文各 2–4 个
只依据用户问题本身拆解，不要引申判断机会好坏。"""


async def parse_track(state: ThesisScoutState) -> dict:
    """Step 2：赛道定义拆解 —— 明确该赛道包括什么、不包括什么。"""
    td = await _ask(
        state,
        ModelTier.FAST,
        PARSE_TRACK_SYSTEM,
        {"用户问题": state["query"]},
        TrackDefinition,
    )
    return {
        "track_definition": td.model_dump(mode="json"),
        "progress": "正在拆解赛道定义…",
    }


async def collect_signals(state: ThesisScoutState) -> dict:
    """Step 3：多 Connector 并发收集市场信号，每条预分配 evidence_id。

    检索面：现有玩家、融资事件、政策变化、技术突破等（详见技术规划）。
    检索词用 track_definition.search_keywords（缺失回退用户原始问题）。
    节点保持纯函数不碰数据库——返回两个视图：
    - raw_signals：LLM 上下文瘦身视图（无 raw 报文，snippet 截断）
    - evidence_sources：完整 Source + 预分配 evidence_id，由 runner 在
      成功收尾事务中批量落 evidence_items（先绑定后持久化，id 全程一致）
    global 区源仅 allow_overseas=True 时启用（检索词出境合规，约定 5 精神）；
    未配置任何数据源 key 时走空信号路径（博查/企查查付费 key——README 已标注）。
    """
    td = state.get("track_definition") or {}
    keywords = [k for k in (td.get("search_keywords") or []) if k]
    if not keywords and state.get("query"):
        keywords = [state["query"]]
    allow_overseas = state.get("allow_overseas", False)
    connectors = active_connectors(allow_overseas=allow_overseas)
    sources = await cached_gather_signals(
        connectors,
        keywords=keywords,
        track=td.get("name") or "",
        allow_overseas=allow_overseas,
    )

    evidence_sources: list[dict] = []
    raw_signals: list[dict] = []
    for s in sources:
        eid = str(uuid.uuid4())  # 预分配证据 id，供 classify→Claim 绑定
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
        "progress": "正在收集市场信号…",
    }


async def load_preference(state: ThesisScoutState) -> dict:
    """机构投资偏好：校验 runner 预加载的 active 版本，构造 LLM 视图。

    runner 经 services.preferences.get_active 已做过一次校验；这里再兜底一次，
    保证节点单独调用（测试/重放）时同样不会把脏数据递给下游提示词。
    """
    raw = state.get("preference_input") or {}
    if not raw:
        return {"preference": {}}
    try:
        pref = InvestmentPreference.model_validate(raw)
    except ValidationError:
        return {"preference": {}}
    # 空字段剔除，缩小提示词体积（fit_score 对缺失字段有 50 分回退语义）
    view = {k: v for k, v in pref.model_dump(mode="json").items() if v not in (None, [], "")}
    return {"preference": view}


# 单条历史在提示词里的预算（条数），防止老机构事件流水撑爆上下文
_HISTORY_VIEW_LIMIT = 50


def _track_keywords(track_definition: dict) -> set[str]:
    """从赛道定义提取小写关键词集合（名称 + includes + 检索词）。"""
    kws: set[str] = set()
    for field in ("name",):
        v = track_definition.get(field)
        if isinstance(v, str) and v.strip():
            kws.add(v.strip().lower())
    for field in ("includes", "search_keywords"):
        for v in track_definition.get(field) or []:
            if isinstance(v, str) and v.strip():
                kws.add(v.strip().lower())
    return kws


def _event_view(ev: dict) -> dict:
    """单条 domain_event 的 LLM 视图：只留判断所需字段。"""
    payload = ev.get("payload") or {}
    view = {
        "event": ev.get("event_type"),
        "when": (ev.get("occurred_at") or "")[:10],  # 日期粒度足够
    }
    for key in ("track", "one_line_view", "reason", "action"):
        if payload.get(key):
            view[key] = payload[key]
    return view


async def load_history(state: ThesisScoutState) -> dict:
    """机构历史：关注过的赛道、生成过的项目池、被证伪的判断（domain_events 回放）。

    runner 预加载机构最近的关键事件（history_events，新→旧）；本节点按
    parse_track 产出的赛道关键词过滤出同赛道历史，并附全机构行为统计——
    fit_score 的 history_similarity 因子既看同赛道经历，也看机构整体偏好惯性。
    """
    events = state.get("history_events") or []
    if not events:
        return {"history": []}

    kws = _track_keywords(state.get("track_definition") or {})

    def related(ev: dict) -> bool:
        if not kws:
            return True  # 无赛道定义时不过滤（极端兜底，正常流 parse_track 先行）
        payload = ev.get("payload") or {}
        text = " ".join(
            str(payload.get(k, "")) for k in ("track", "one_line_view", "reason")
        ).lower()
        return any(k in text for k in kws if k)

    matched = [_event_view(ev) for ev in events if related(ev)][:_HISTORY_VIEW_LIMIT]

    # 全机构统计：事件类型 → 次数（体现机构行为惯性，如频繁证伪某类判断）
    stats: dict[str, int] = {}
    for ev in events:
        et = ev.get("event_type") or "unknown"
        stats[et] = stats.get(et, 0) + 1

    history: list[dict] = matched
    if stats:
        history = [{"机构近期行为统计": stats, "同赛道历史条数": len(matched)}] + matched
    return {"history": history}


CLASSIFY_SYSTEM = """你是一级市场赛道研究员，对市场信号做分类与提炼。对每条输入信号：
1. kind 判定：heat（热度信号：融资变多、媒体报道、大厂进入——只说明“有人看”）
   或 structural（结构性信号：成本下降、技术成熟、政策窗口、供需反转——说明“可能值得投”）
2. summary 用一句话提炼判断；输入信号自带 evidence_id 时填进 evidence_ids，
   严禁伪造不存在的证据 id；没有就留空（系统会标记为模型推断）
3. signal_date 尽量保留原信号时间
丢弃与赛道定义无关的噪音信号。结构性信号是后续判断的主要依据。"""


async def classify_signals(state: ThesisScoutState) -> dict:
    """区分热度信号与结构性信号。热度说明“有人看”，结构性才说明“可能值得投”。"""
    raw = state.get("raw_signals") or []
    if not raw:
        # 无信号不调 LLM（控成本）；Connector 实装前这是常态路径
        return {"classified_signals": [], "progress": "正在区分热度信号与结构性信号…"}
    result = await _ask(
        state,
        ModelTier.FAST,
        CLASSIFY_SYSTEM,
        {"赛道定义": state.get("track_definition", {}), "原始信号": raw},
        ClassifiedSignals,
    )
    return {
        "classified_signals": [s.model_dump(mode="json") for s in result.signals],
        "progress": "正在区分热度信号与结构性信号…",
    }


VALUE_CHAIN_SYSTEM = """你是一级市场赛道研究员，拆解赛道的产业链结构。输出上游/中游/下游各环节：
1. 每个环节给出 name、examples（代表性细分或公司，没把握就少写，不要编造）
2. margin_potential（毛利率潜力）、entry_difficulty（创业公司进入难度）、
   suitable_stage（适合的投资阶段）给出简短判断
3. customers 列出终端客户类型
4. 有市场信号佐证的判断优先参考结构性信号；信号为空时基于行业常识给初版拆解"""


async def value_chain(state: ThesisScoutState) -> dict:
    """Step 4：产业链上中下游拆解 + 各环节毛利潜力/进入难度/适合阶段判断。"""
    vc = await _ask(
        state,
        ModelTier.STANDARD,
        VALUE_CHAIN_SYSTEM,
        {
            "赛道定义": state.get("track_definition", {}),
            "市场信号": state.get("classified_signals", []),
        },
        ValueChain,
    )
    return {"value_chain": vc.model_dump(mode="json"), "progress": "正在拆解产业链…"}


SUB_DIRECTIONS_SYSTEM = """你是一级市场赛道研究员，从产业链拆解中提炼 3–7 个值得关注的子赛道。要求：
1. 每个子赛道：name、detail（做什么、为什么现在）、investment_reasons（推荐理由，
   引用市场信号的 evidence_ids，无证据留空由系统标记推断）、key_risks（真实风险）、
   suitable_stage（适合的投资阶段）、representative_companies（确有把握才写，不要编造）
2. 子赛道之间要有区分度：覆盖产业链不同环节或不同切入逻辑，不要同义反复
3. 结构性信号支撑的子赛道优先；纯热度驱动的要在风险里说明
4. 机构偏好非空时，优先生成与偏好相关的方向，但不强行迎合"""


async def gen_sub_directions(state: ThesisScoutState) -> dict:
    """Step 5：生成 3–7 个子赛道草稿（机构匹配度由下一节点补全）。"""
    drafts = await _ask(
        state,
        ModelTier.STANDARD,
        SUB_DIRECTIONS_SYSTEM,
        {
            "赛道定义": state.get("track_definition", {}),
            "市场信号": state.get("classified_signals", []),
            "产业链": state.get("value_chain", {}),
            "机构偏好": state.get("preference", {}),
        },
        SubDirectionDrafts,
    )
    return {
        "sub_directions": [d.model_dump(mode="json") for d in drafts.sub_directions],
        "progress": "正在生成子赛道…",
    }


def apply_learned_preference_to_sub_directions(
    sub_directions: list[dict], preference: dict, track_definition: dict
) -> list[dict]:
    """路线第 9 步反哺：按 learned_preference 权重表对子赛道 fit_score.total 做有界微调并稳定重排。

    纯函数、确定性：空 learned_preference 且空 anti_preference → 原样返回（零调整、顺序不变），
    严格非回归。每个子赛道按 sub_sector=name、sector=赛道名、stage=suitable_stage 匹配；命中即
    调整 total 并把命中明细写入 ``preference_influence``（前端可解释「为何排序变化」）。
    """
    learned, anti, _ = extract_preference_blocks(preference)
    if not learned and not anti:
        return sub_directions
    sector = track_definition.get("name")
    adjusted: list[dict] = []
    for d in sub_directions:
        infl = assess_preference_fit(
            learned,
            sector=sector,
            sub_sector=d.get("name"),
            stage=d.get("suitable_stage"),
            anti_preference=anti,
        )
        if not infl.changed:
            adjusted.append(d)
            continue
        fs = dict(d.get("fit_score") or {})
        fs["total"] = infl.adjust(fs.get("total", 50))
        adjusted.append({**d, "fit_score": fs, "preference_influence": infl.as_dict()})
    adjusted.sort(key=lambda x: (x.get("fit_score") or {}).get("total", 0), reverse=True)
    return adjusted


FIT_SCORE_SYSTEM = """你是一级市场机构的投资策略分析师，按 rubric 给赛道与机构的匹配度打分（0–100）：
- track_preference：赛道与机构偏好赛道的重合度（偏好为空给 50 并在 rationale 说明）
- stage_match：子赛道适合阶段与机构投资阶段的匹配
- moat_match：技术壁垒类型与机构偏好的匹配
- geo_match：地域匹配（无地域信息给 50）
- risk_appetite_match：风险特征与机构风险偏好的匹配
- history_similarity：与机构历史项目的相似度（历史为空给 50 并说明；embedding 相似度后续接入）
- exclusion_penalty：仅当命中机构不感兴趣清单时 >0，并说明命中哪条
- total：加权合成（结构性机会权重高于热度）；rationale 用一句话解释总分
输出 institution_fit（赛道整体）+ sub_direction_fits（逐个子赛道，name 必须与输入草稿一致）。
诚实打分：信息不足就给中性分并说明，不要为了好看抬分。"""


async def fit_score(state: ThesisScoutState) -> dict:
    """Step 6：机构匹配度分项评分，并把分数合并进子赛道草稿。

    公式：赛道偏好 + 阶段 + 壁垒 + 地域 + 风险偏好 + 历史相似度 - 不感兴趣惩罚。
    分项明细全部保留（前端可解释「为什么是 82 分」）。
    TODO: history_similarity 接 embedding 相似度（pgvector）。
    """
    drafts = state.get("sub_directions", [])
    assessment = await _ask(
        state,
        ModelTier.STANDARD,
        FIT_SCORE_SYSTEM,
        {
            "赛道定义": state.get("track_definition", {}),
            "子赛道草稿": drafts,
            "机构偏好": state.get("preference", {}),
            "机构历史": state.get("history", []),
        },
        FitAssessment,
    )
    institution_fit = assessment.institution_fit.model_dump(mode="json")
    fit_by_name = {
        f.name: f.fit.model_dump(mode="json") for f in assessment.sub_direction_fits
    }
    # 评分缺失的子赛道回退用机构整体分（绝不让草稿丢失）
    merged = [
        {**d, "fit_score": fit_by_name.get(d.get("name"), institution_fit)} for d in drafts
    ]
    # 路线第 9 步：learned_preference 反哺——按机构学习偏好对子赛道做有界匹配度微调与稳定重排
    merged = apply_learned_preference_to_sub_directions(
        merged, state.get("preference") or {}, state.get("track_definition") or {}
    )
    return {
        "fit": institution_fit,
        "sub_directions": merged,
        "progress": "正在计算机构匹配度…",
    }


ASSEMBLE_SYSTEM = """你是一级市场（VC/PE）的资深赛道研究员，负责把前序分析组装成最终的赛道前瞻判断（Thesis 对象）。

要求：
1. 子赛道（sub_directions）3–7 个，优先沿用「候选子赛道」的内容与 fit_score，
   只做提炼润色，不推翻前序分析
2. key_risks 必须至少给出 1 条真实风险——没有风险点的判断像销售材料，不可信
3. 严禁伪造 evidence_ids：上下文中没有给出证据 id 时一律留空数组，由系统标记为模型推断
4. opportunity_level 取值 高/中/低，risk_level 取值 高/中高/中/低
5. 上下文中的「市场信号」「产业链」「机构匹配度」为空时，基于赛道常识给出初版判断，
   不要编造具体融资事件或政策名称
6. 全部用简体中文输出
"""


async def assemble_thesis(state: ThesisScoutState) -> dict:
    """Step 7/8：组装 Thesis 对象（PREMIUM 档结构化输出 + Pydantic 强校验）。

    校验不过会在 complete_structured 内带错误信息自动重试修复（核心约定 1）。
    落库不在节点内做——节点保持纯函数，由 agents/runner.py 编排短事务入库。
    """
    thesis = await _ask(
        state,
        ModelTier.PREMIUM,
        ASSEMBLE_SYSTEM,
        {
            "用户问题": state.get("query", ""),
            "赛道定义": state.get("track_definition", {}),
            "市场信号": state.get("classified_signals", []),
            "产业链": state.get("value_chain", {}),
            "候选子赛道": state.get("sub_directions", []),
            "机构偏好": state.get("preference", {}),
            "机构匹配度评分": state.get("fit", {}),
        },
        Thesis,
    )
    if state.get("conversation_id"):
        thesis.created_from_conversation = uuid.UUID(state["conversation_id"])
    return {"thesis": thesis.model_dump(mode="json"), "progress": "Thesis 已生成"}
