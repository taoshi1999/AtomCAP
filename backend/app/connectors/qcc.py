"""企查查开放平台 —— 国内工商/股东/对外投资（MVP 首选源之一，region=cn）。

开放平台鉴权：header ``Token`` = MD5(AppKey + Timespan + SecretKey) 大写，
``Timespan`` = unix 秒（与 Token 同源，服务端按窗口校验）。
响应统一形如 ``{"Status": "200", "Message": "...", "Result": ...}``，
``Status`` 非 200（额度耗尽/查无此企）一律降级为无数据而不抛错。
解析全程防御式取值——商业 API 字段时有增减，缺字段降级；端点路径以开放平台
文档为准，真实 key 冒烟时校准（离线用 httpx.MockTransport 验证请求与解析契约）。

注：企查查只提供工商类结构化数据，不提供新闻/融资检索，故 search_news /
funding_events 返回空，信号检索由博查/Tavily 承担；本源服务于项目获取 Agent
的企业尽调（Deal Intake）。
"""

from __future__ import annotations

import asyncio
import hashlib
import time

import httpx

from app.config import settings
from app.connectors.base import Source

API_BASE = "https://api.qichacha.com"
BASIC_PATH = "/ECIV4/GetBasicDetailsByName"   # 工商照面（按企业名）
PARTNER_PATH = "/ECIV4/GetPartnerList"        # 股东信息（按 KeyNo）
INVEST_PATH = "/ECIV4/GetInvestmentList"      # 对外投资（按 KeyNo）


def _auth_headers() -> dict[str, str]:
    timespan = str(int(time.time()))
    raw = settings.qcc_app_key + timespan + settings.qcc_secret_key
    token = hashlib.md5(raw.encode("utf-8")).hexdigest().upper()
    return {"Token": token, "Timespan": timespan}


def _join(*parts: object) -> str:
    """把若干「标签：值」拼成 snippet，跳过空值。"""
    return "；".join(str(p) for p in parts if p)


def _field(d: dict, *keys: str) -> str:
    """按候选键名顺序取第一个非空值（字段命名各版本有差异）。"""
    for k in keys:
        v = d.get(k)
        if v not in (None, "", []):
            return str(v)
    return ""


class QccConnector:
    name = "qcc"
    region = "cn"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        # transport 注入口：测试时传 httpx.MockTransport 离线验证
        self._transport = transport

    async def _get(self, path: str, params: dict) -> object | None:
        async with httpx.AsyncClient(transport=self._transport, base_url=API_BASE, timeout=15) as client:
            resp = await client.get(path, params=params, headers=_auth_headers())
            resp.raise_for_status()
            data = resp.json()
        if not isinstance(data, dict) or str(data.get("Status")) != "200":
            return None
        return data.get("Result")

    async def _get_list(self, path: str, params: dict) -> list[dict]:
        result = await self._get(path, params)
        if isinstance(result, list):
            return [r for r in result if isinstance(r, dict)]
        # 有的端点把列表裹在 {"Items": [...]} / {"Result": [...]} 里
        if isinstance(result, dict):
            for key in ("Items", "Result", "List", "Data"):
                inner = result.get(key)
                if isinstance(inner, list):
                    return [r for r in inner if isinstance(r, dict)]
        return []

    def _basic_source(self, name: str, b: dict) -> Source:
        start = _field(b, "StartDate", "EstablishTime", "TermStart")[:10] or None
        snippet = _join(
            f"法定代表人：{_field(b, 'OperName', 'LegalPerson')}" if _field(b, "OperName", "LegalPerson") else "",
            f"注册资本：{_field(b, 'RegistCapi', 'RegisteredCapital')}" if _field(b, "RegistCapi", "RegisteredCapital") else "",
            f"成立日期：{start}" if start else "",
            f"统一社会信用代码：{_field(b, 'CreditCode')}" if _field(b, "CreditCode") else "",
            f"经营状态：{_field(b, 'Status', 'ShortStatus')}" if _field(b, "Status", "ShortStatus") else "",
        )
        return Source(
            source_type="company_registry",
            title=f"{_field(b, 'Name') or name} 工商照面",
            url=None,
            snippet=snippet,
            published_at=start,
            connector=self.name,
            raw=b,
        )

    def _partner_source(self, company: str, p: dict) -> Source:
        holder = _field(p, "StockName", "PartnerName", "Name") or "(未知股东)"
        return Source(
            source_type="company_shareholder",
            title=f"{company} 股东：{holder}",
            url=None,
            snippet=_join(
                f"持股比例：{_field(p, 'StockPercent', 'FundedRatio', 'Percent')}" if _field(p, "StockPercent", "FundedRatio", "Percent") else "",
                f"认缴出资：{_field(p, 'ShouldCapi', 'SubscribedCapital')}" if _field(p, "ShouldCapi", "SubscribedCapital") else "",
                f"股东类型：{_field(p, 'StockType', 'PartnerType')}" if _field(p, "StockType", "PartnerType") else "",
            ),
            connector=self.name,
            raw=p,
        )

    def _invest_source(self, company: str, v: dict) -> Source:
        invested = _field(v, "Name", "InvestName") or "(未知企业)"
        start = _field(v, "StartDate", "EstablishTime")[:10] or None
        return Source(
            source_type="company_investment",
            title=f"{company} 对外投资：{invested}",
            url=None,
            snippet=_join(
                f"出资比例：{_field(v, 'FundedRatio', 'Percent', 'StockPercent')}" if _field(v, "FundedRatio", "Percent", "StockPercent") else "",
                f"法定代表人：{_field(v, 'OperName', 'LegalPerson')}" if _field(v, "OperName", "LegalPerson") else "",
                f"注册资本：{_field(v, 'RegistCapi', 'RegisteredCapital')}" if _field(v, "RegistCapi", "RegisteredCapital") else "",
                f"经营状态：{_field(v, 'Status', 'ShortStatus')}" if _field(v, "Status", "ShortStatus") else "",
            ),
            published_at=start,
            connector=self.name,
            raw=v,
        )

    async def company_lookup(self, name: str) -> list[Source]:
        basic = await self._get(BASIC_PATH, {"keyword": name})
        # Result 可能是 dict（单条照面）或 list（命中多条取第一条）
        if isinstance(basic, list):
            basic = next((r for r in basic if isinstance(r, dict)), None)
        if not isinstance(basic, dict):
            return []
        sources: list[Source] = [self._basic_source(name, basic)]
        key_no = _field(basic, "KeyNo", "Id")
        if not key_no:
            return sources
        partners, investments = await asyncio.gather(
            self._get_list(PARTNER_PATH, {"keyNo": key_no}),
            self._get_list(INVEST_PATH, {"keyNo": key_no}),
        )
        company = _field(basic, "Name") or name
        sources.extend(self._partner_source(company, p) for p in partners)
        sources.extend(self._invest_source(company, v) for v in investments)
        return sources

    async def search_news(self, query: str, *, days: int = 90) -> list[Source]:
        return []  # 企查查不提供新闻检索，信号检索走博查/Tavily

    async def funding_events(self, track: str, *, days: int = 180) -> list[Source]:
        return []  # 同上：无独立融资事件接口
