"""赛道前瞻 Agent 各节点实现。

骨架阶段：节点结构、状态流转、档位选择已就位，检索与提示词为 TODO。
原则：
- 轻任务（拆解/分类）用 FAST 档，综合判断用 STANDARD，最终组装可用 PREMIUM
- 每条检索结果先落 evidence_items，结论经 Claim 绑定 evidence_ids
- 信号必须区分热度（heat）与结构性（structural），结构性加权
"""

from __future__ import annotations

from app.agents.thesis_scout.state import ThesisScoutState
from app.llm.client import ModelTier, complete_structured  # noqa: F401  骨架阶段未全部用到


async def parse_track(state: ThesisScoutState) -> dict:
    """Step 2：赛道定义拆解 —— 明确该赛道包括什么、不包括什么。"""
    # TODO: complete_structured(ModelTier.FAST, ..., TrackDefinition)
    return {
        "track_definition": {"name": state["query"], "includes": [], "excludes": []},
        "progress": "正在拆解赛道定义…",
    }


async def collect_signals(state: ThesisScoutState) -> dict:
    """Step 3：多 Connector 并发收集市场信号（按赛道做 24h 缓存控成本）。

    检索面：现有玩家、融资事件、政策变化、技术突破、专利、人事变化、
    供应链变化、需求变化。每条结果落 evidence_items。
    """
    # TODO: asyncio.gather(*[c.search_news(...) for c in active_connectors])
    return {"raw_signals": [], "progress": "正在收集市场信号…"}


async def load_preference(state: ThesisScoutState) -> dict:
    """加载机构投资偏好（preferences 表 active 版本）。"""
    # TODO: services.preferences.get_active(institution_id)
    return {"preference": {}}


async def load_history(state: ThesisScoutState) -> dict:
    """加载机构历史：关注过的赛道、生成过的项目池、被证伪的判断（来自 domain_events）。"""
    # TODO: services.events.history_for_track(...)
    return {"history": []}


async def classify_signals(state: ThesisScoutState) -> dict:
    """区分热度信号与结构性信号。热度说明“有人看”，结构性才说明“可能值得投”。"""
    # TODO: complete_structured(ModelTier.FAST, ..., list[MarketSignal])
    return {"classified_signals": [], "progress": "正在区分热度信号与结构性信号…"}


async def value_chain(state: ThesisScoutState) -> dict:
    """Step 4：产业链上中下游拆解 + 各环节毛利潜力/进入难度/适合阶段判断。"""
    # TODO: complete_structured(ModelTier.STANDARD, ..., ValueChain)
    return {"value_chain": {}, "progress": "正在拆解产业链…"}


async def gen_sub_directions(state: ThesisScoutState) -> dict:
    """Step 5：生成 3–7 个子赛道，每个含详情/推荐理由(Claim)/代表公司/风险/适合阶段。"""
    # TODO: complete_structured(ModelTier.STANDARD, ..., list[SubDirection])
    return {"sub_directions": [], "progress": "正在生成子赛道…"}


async def fit_score(state: ThesisScoutState) -> dict:
    """Step 6：机构匹配度分项评分。

    公式：赛道偏好 + 阶段 + 壁垒 + 地域 + 风险偏好 + 历史相似度(embedding) - 不感兴趣惩罚。
    每个因子 LLM 按 rubric 打分并给理由，分项明细全部保留（前端可解释）。
    """
    # TODO: rubric 评分 + embed() 历史相似度
    return {"fit": {}, "progress": "正在计算机构匹配度…"}


async def assemble_thesis(state: ThesisScoutState) -> dict:
    """Step 7/8：组装 Thesis 对象（Pydantic 强校验）→ 落库 → 返回推荐动作。

    校验不过会在 complete_structured 内自动带错误重试修复。
    """
    # TODO: complete_structured(ModelTier.PREMIUM, ..., Thesis) → services.deliverables.save()
    return {"thesis": None, "progress": "正在组装 Thesis…"}
