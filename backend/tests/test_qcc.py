"""企查查 Connector 离线契约测试 —— httpx.MockTransport 验证鉴权头、请求与防御式解析。"""

from __future__ import annotations

import asyncio
import hashlib

import httpx

from app.config import settings
from app.connectors.qcc import QccConnector


def _route(handler):
    """构造 QccConnector + 注入 MockTransport。"""
    return QccConnector(transport=httpx.MockTransport(handler))


def test_auth_headers_md5_token(monkeypatch):
    monkeypatch.setattr(settings, "qcc_app_key", "APPKEY123")
    monkeypatch.setattr(settings, "qcc_secret_key", "SECRET456")
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["keyword"] = request.url.params.get("keyword")
        seen["token"] = request.headers.get("Token")
        seen["timespan"] = request.headers.get("Timespan")
        return httpx.Response(200, json={"Status": "200", "Result": {"Name": "测试公司"}})

    asyncio.run(_route(handler).company_lookup("测试公司"))

    assert seen["path"] == "/ECIV4/GetBasicDetailsByName"
    assert seen["keyword"] == "测试公司"
    assert seen["timespan"] and seen["timespan"].isdigit()
    expected = hashlib.md5(("APPKEY123" + seen["timespan"] + "SECRET456").encode()).hexdigest().upper()
    assert seen["token"] == expected
    assert len(seen["token"]) == 32 and seen["token"].isupper()


def test_full_lookup_parses_three_facets(monkeypatch):
    monkeypatch.setattr(settings, "qcc_app_key", "k")
    monkeypatch.setattr(settings, "qcc_secret_key", "s")
    calls = []

    def handler(request):
        path = request.url.path
        calls.append((path, dict(request.url.params)))
        if path.endswith("GetBasicDetailsByName"):
            return httpx.Response(200, json={"Status": "200", "Result": {
                "KeyNo": "abc123", "Name": "镭石智能科技有限公司", "OperName": "张三",
                "RegistCapi": "1000万人民币", "StartDate": "2021-03-15", "Status": "存续",
                "CreditCode": "91110108MA01XXXX"}})
        if path.endswith("GetPartnerList"):
            return httpx.Response(200, json={"Status": "200", "Result": [
                {"StockName": "张三", "StockPercent": "60%", "ShouldCapi": "600万", "StockType": "自然人股东"},
                {"StockName": "某创投基金", "StockPercent": "40%"},
                "garbage",  # 非 dict 被过滤
            ]})
        if path.endswith("GetInvestmentList"):
            return httpx.Response(200, json={"Status": "200", "Result": {"Items": [
                {"Name": "子公司A", "FundedRatio": "100%", "OperName": "李四", "StartDate": "2023-01-01"},
            ]}})
        return httpx.Response(404)

    out = asyncio.run(_route(handler).company_lookup("镭石"))

    types = [s.source_type for s in out]
    assert types == ["company_registry", "company_shareholder", "company_shareholder", "company_investment"]

    registry = out[0]
    assert registry.title == "镭石智能科技有限公司 工商照面"
    assert "法定代表人：张三" in registry.snippet
    assert "注册资本：1000万人民币" in registry.snippet
    assert "统一社会信用代码：91110108MA01XXXX" in registry.snippet
    assert registry.published_at == "2021-03-15"
    assert registry.connector == "qcc"

    assert out[1].title == "镭石智能科技有限公司 股东：张三"
    assert "持股比例：60%" in out[1].snippet and "股东类型：自然人股东" in out[1].snippet
    # 第二个股东缺类型/出资，降级仍生成
    assert out[2].title.endswith("某创投基金") and "持股比例：40%" in out[2].snippet

    invest = out[3]
    assert invest.source_type == "company_investment"
    assert invest.title == "镭石智能科技有限公司 对外投资：子公司A"
    assert "出资比例：100%" in invest.snippet
    assert invest.published_at == "2023-01-01"

    # KeyNo 解析后确实分别请求了股东/投资端点（带 keyNo 参数）
    paths = [p for p, _ in calls]
    assert "/ECIV4/GetPartnerList" in paths and "/ECIV4/GetInvestmentList" in paths
    for p, params in calls:
        if p.endswith(("GetPartnerList", "GetInvestmentList")):
            assert params.get("keyNo") == "abc123"


def test_non_200_status_degrades_empty(monkeypatch):
    monkeypatch.setattr(settings, "qcc_app_key", "k")
    monkeypatch.setattr(settings, "qcc_secret_key", "s")
    transport_resp = {"Status": "104", "Message": "账户额度不足", "Result": None}
    out = asyncio.run(_route(lambda r: httpx.Response(200, json=transport_resp)).company_lookup("任意"))
    assert out == []


def test_result_as_list_takes_first(monkeypatch):
    monkeypatch.setattr(settings, "qcc_app_key", "k")
    monkeypatch.setattr(settings, "qcc_secret_key", "s")

    def handler(request):
        if request.url.path.endswith("GetBasicDetailsByName"):
            # Result 以列表返回多条命中
            return httpx.Response(200, json={"Status": "200", "Result": [
                {"Name": "命中一", "KeyNo": ""}, {"Name": "命中二"}]})
        return httpx.Response(200, json={"Status": "200", "Result": []})

    out = asyncio.run(_route(handler).company_lookup("命中"))
    # 第一条无 KeyNo → 只有工商照面、不再请股东/投资
    assert len(out) == 1 and out[0].title == "命中一 工商照面"


def test_no_keyno_skips_subqueries(monkeypatch):
    monkeypatch.setattr(settings, "qcc_app_key", "k")
    monkeypatch.setattr(settings, "qcc_secret_key", "s")
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json={"Status": "200", "Result": {"Name": "无 KeyNo 公司"}})

    out = asyncio.run(_route(handler).company_lookup("x"))
    assert len(out) == 1 and out[0].source_type == "company_registry"
    assert paths == ["/ECIV4/GetBasicDetailsByName"]  # 未触发股东/投资端点


def test_news_and_funding_return_empty():
    c = QccConnector()
    assert asyncio.run(c.search_news("AI 芯片")) == []
    assert asyncio.run(c.funding_events("人形机器人")) == []
