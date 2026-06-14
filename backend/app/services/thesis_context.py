"""从 Thesis 交付对象 payload 抽取「搜索策略上下文」的纯函数。

Thesis「生成项目池」专用端点用：把整份 Thesis 视图压成一个精简 dict，喂给
deal_sourcing 的 gen_search_strategy 节点，使其据**整个赛道判断**（子赛道 / 产业链
位置 / 机构匹配度 / 风险）拆搜索策略，而不只依据赛道名四个字（设计文档流程一 Step 2）。

纯函数、不碰数据库、对缺字段/脏数据宽容（payload 来自 JSON 列），便于离线单测。
"""

from __future__ import annotations

from typing import Any


def _claim_texts(claims: Any) -> list[str]:
    """把 Claim 列表压成纯文本列表（丢弃证据链细节，仅保留结论文案供 LLM 拆词）。"""
    out: list[str] = []
    if not isinstance(claims, list):
        return out
    for c in claims:
        if isinstance(c, dict):
            text = c.get("text")
            if isinstance(text, str) and text.strip():
                out.append(text.strip())
        elif isinstance(c, str) and c.strip():
            out.append(c.strip())
    return out


def _company_names(companies: Any) -> list[str]:
    out: list[str] = []
    if not isinstance(companies, list):
        return out
    for c in companies:
        if isinstance(c, dict):
            name = c.get("name")
            if isinstance(name, str) and name.strip():
                out.append(name.strip())
        elif isinstance(c, str) and c.strip():
            out.append(c.strip())
    return out


def _segment_names(segments: Any) -> list[str]:
    """产业链某一层（上/中/下游）的环节名列表。"""
    out: list[str] = []
    if not isinstance(segments, list):
        return out
    for s in segments:
        if isinstance(s, dict):
            name = s.get("name")
            if isinstance(name, str) and name.strip():
                out.append(name.strip())
    return out


def _str_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [v.strip() for v in values if isinstance(v, str) and v.strip()]


def thesis_context_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """把 Thesis payload 压成 deal_sourcing 搜索策略所需的精简上下文。

    只取驱动「拆检索主题/关键词」有用的字段，丢弃证据链 id、评分分项等噪声，
    控 token 成本。所有取值防御式：缺字段返回空，不抛错。
    """
    if not isinstance(payload, dict):
        return {}

    fit = payload.get("institution_fit_score")
    institution_fit: dict[str, Any] = {}
    if isinstance(fit, dict):
        institution_fit = {
            "total": fit.get("total"),
            "rationale": fit.get("rationale"),
        }

    sub_directions: list[dict[str, Any]] = []
    for sd in payload.get("sub_directions") or []:
        if not isinstance(sd, dict):
            continue
        sub_directions.append(
            {
                "name": sd.get("name"),
                "detail": sd.get("detail"),
                "suitable_stage": sd.get("suitable_stage"),
                "investment_reasons": _claim_texts(sd.get("investment_reasons")),
                "key_risks": _claim_texts(sd.get("key_risks")),
                "representative_companies": _company_names(
                    sd.get("representative_companies")
                ),
            }
        )

    value_chain_raw = payload.get("value_chain")
    value_chain: dict[str, Any] = {}
    if isinstance(value_chain_raw, dict):
        value_chain = {
            "upstream": _segment_names(value_chain_raw.get("upstream")),
            "midstream": _segment_names(value_chain_raw.get("midstream")),
            "downstream": _segment_names(value_chain_raw.get("downstream")),
            "customers": _str_list(value_chain_raw.get("customers")),
        }

    recent_signals: list[str] = []
    for sig in payload.get("recent_signals") or []:
        if isinstance(sig, dict):
            title = sig.get("title")
            if isinstance(title, str) and title.strip():
                recent_signals.append(title.strip())

    context: dict[str, Any] = {
        "thesis_name": payload.get("thesis_name"),
        "one_line_view": payload.get("one_line_view"),
        "opportunity_level": payload.get("opportunity_level"),
        "risk_level": payload.get("risk_level"),
        "advice": payload.get("advice"),
        "institution_fit": institution_fit,
        "investment_reason": _claim_texts(payload.get("investment_reason")),
        "key_risks": _claim_texts(payload.get("key_risks")),
        "sub_directions": sub_directions,
        "value_chain": value_chain,
        "representative_companies": _company_names(
            payload.get("representative_companies")
        ),
        "recent_signals": recent_signals,
    }
    # 去掉 None / 空值，给 LLM 干净上下文
    return {k: v for k, v in context.items() if v not in (None, "", [], {})}
