# AtomCAP

以「交付结果对象」为中心的一级市场投资多 Agent 系统。整体架构与路线见 [技术规划.md](./技术规划.md)。

## 目录结构

```
backend/
  app/
    objects/      # ★ 交付结果对象 Pydantic Schema —— 系统契约原点（Thesis 已完整定义）
    models/       # SQLAlchemy ORM（三类对象 + 证据链 + domain_events + RAG）
    llm/          # 档位路由（fast/standard/premium）+ 结构化输出（校验失败自动修复）
    agents/       # 主图意图路由 + 四个专用 Agent 子图（赛道前瞻 8 步已搭好）
    connectors/   # 数据源抽象 + 博查/企查查/Tavily 适配器
    evidence/     # 证据链服务（Source 落库、结论连边）
    services/     # 对象存取（入库强校验）、domain_events 记账
    api/          # 对话 SSE（token/progress/object/done 协议）、对象动作
  worker/         # ARQ：长任务 + cron（赛道监控、经验沉淀）
  tests/          # Schema 契约测试
  evals/          # 赛道前瞻 golden 评测集
frontend/
  src/
    components/objects/  # ★ 对象渲染注册表 + ThesisView 六区
    mocks/               # AI 硬件 mock Thesis（Phase 0 验收用）
    pages/               # 首页对话 / 项目工作台
litellm/config.yaml      # 模型档位配置 —— 换模型只改这里
```

## 快速启动

```bash
cp .env.example .env          # 填入模型与数据源 API key
docker compose up -d postgres redis litellm

# 后端
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload                        # http://localhost:8000/docs
pytest                                               # Schema 契约测试

# 前端
cd frontend
npm install
npm run dev                                          # http://localhost:5173
```

前端启动后首页即渲染 mock Thesis 的六区 UI（Phase 0 验收标准）。

## Phase 0 待办（按技术规划）

- [ ] Alembic 初始化（`alembic init -t async alembic`）+ 首个 migration（建表 + pgvector 扩展）
- [ ] JWT 认证与多租户上下文（`api/deps.py` 的 TODO）
- [ ] 通用对话接 `llm.complete()` 流式
- [ ] domain_events 在所有对象动作处记账
- [ ] Langfuse 接入（自部署或云版）

## 核心约定（不可破坏）

1. 专用 Agent 的输出必须是 `SCHEMA_REGISTRY` 注册的对象，入库前强制校验
2. 结论一律用 `Claim` 表达：有 `evidence_ids`，或显式 `inferred=True`
3. 业务代码只引用模型档位别名（fast/standard/premium），不写死模型名
4. 用户操作与状态流转必须写 `domain_events`（经验沉淀 Agent 的唯一数据来源）
5. 海外模型调用前检查机构级开关 `allow_overseas_models`（数据出境合规）
