# AtomCAP

以「交付结果对象」为中心的一级市场投资多 Agent 系统。整体架构与路线见 [技术规划.md](./技术规划.md)。

## 目录结构

```
backend/
  app/
    objects/      # ★ 交付结果对象 Pydantic Schema —— 系统契约原点（Thesis 已完整定义）
    models/       # SQLAlchemy ORM（三类对象 + 证据链 + domain_events + RAG）
    llm/          # 档位路由（fast/standard/premium）+ 结构化输出（校验失败自动修复）
    agents/       # 主图意图路由 + 四个专用 Agent 子图 + runner 执行编排
                  #   （子图节点纯函数；run 生命周期/落库/SSE 事件由 runner 统一编排）
    connectors/   # 数据源抽象 + registry 聚合检索（key 启用/合规闸门/去重截断）+ 博查（已实装）/企查查/Tavily
    evidence/     # 证据链服务（Source 落库、结论连边）
    services/     # 对象存取（入库强校验）、domain_events 记账与历史回放、偏好读写（版本化）、agent_runs 生命周期
    api/          # JWT 认证（注册/登录）、对话 SSE（token/progress/object/error/done 协议 + 历史回放）、对象动作（记账）、偏好读写
  worker/         # ARQ：长任务 + cron（赛道监控、经验沉淀）
  tests/          # Schema 契约测试 + 运行编排测试
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
alembic upgrade head                                 # 建表（含 pgvector 扩展与 HNSW 向量索引）
uvicorn app.main:app --reload                        # http://localhost:8000/docs
pytest                                               # Schema 契约测试 + 迁移契约测试

# 前端
cd frontend
npm install
npm run dev                                          # http://localhost:5173
```

前端启动后首页即渲染 mock Thesis 的六区 UI（Phase 0 验收标准）。

## Phase 0 待办（按技术规划）

- [x] Alembic 初始化 + 首个 migration（0001：pgvector 扩展 + 全部 15 表 + HNSW 向量索引；`tests/test_migration_contract.py` 保证迁移与 ORM 不漂移；离线审阅用 `alembic upgrade head --sql`）
- [x] JWT 认证与多租户上下文（`/api/auth/register` 机构引导注册 + `/login` 签发 JWT；`get_current_user` 注入租户上下文并实时读 `allow_overseas_models`；开发回退开关 `AUTH_DEV_FALLBACK`；deliverable 动作端点已带租户过滤并写 domain_events）
- [x] 通用对话接 `llm.complete()` 流式（`complete_stream()` 复用档位路由与海外合规降级；SSE 新增 error 事件；会话/消息落库带租户过滤，历史回放 `GET /messages`；流内用 `SessionLocal` 短事务——FastAPI ≥0.106 在流式响应前关闭依赖会话）
- [x] domain_events 在所有对象动作处记账（注册/登录、deliverable 四个动作、会话/消息、agent run 状态流转 `agent_run.started/succeeded/failed` —— `services/agent_runs.py`）
- [x] 赛道前瞻子图完成后 assistant 消息落库（object_ref 块）+ 真实 deliverable_id 推送（`agents/runner.py` 编排：run 创建 → 子图执行 progress 去重推送 → Thesis 经 SCHEMA_REGISTRY 强校验入库（回链 run 与来源会话）→ `thesis.created` → assistant 消息 → run 收尾；失败路径统一 `agent_run.failed` + error 事件，不落脏数据。`assemble_thesis` 节点已真实实现：PREMIUM 档结构化输出 + 合规开关透传，上游节点为空时基于赛道常识出初版判断，无证据结论自动 `inferred=True`）
- [x] 赛道前瞻 LLM 节点真实实现（parse_track/classify_signals/value_chain/gen_sub_directions/fit_score：提示词 + 档位按任务轻重 FAST/STANDARD + 合规开关全节点透传；中间结构化模型 `agents/thesis_scout/schemas.py` 复用 Thesis 内嵌模型零转换损耗；classify 空信号守卫不调 LLM；fit 评分按名合并进子赛道草稿、缺失回退机构整体分；`tests/test_thesis_nodes.py` 含真实 LangGraph 子图端到端集成测试）
- [x] collect_signals 接 Connector 并落 evidence_items（`connectors/registry.py`：按已配置 key 启用数据源、global 源被 `allow_overseas` 闸住——检索词出境与模型调用同等对待；多源×多关键词并发聚合、单源失败降级、URL 去重、按时间截断控成本；信号预分配 evidence_id 供 Claim 绑定，runner 成功事务统一落 evidence_items 并把被引用证据与 deliverable 连边；payload 中不属于本次采集的 evidence_id 一律剥除、剥空的 Claim 自动 `inferred=True`——约定 2 的代码级兜底。博查 web-search 已实装 HTTP 调用并以 MockTransport 离线验证解析契约；企查查/Tavily 仍为桩）
- [ ] 博查真实 key 冒烟测试；企查查（工商/股东/对外投资）与 Tavily 实装
- [ ] 信号检索 24h Redis 缓存（按 赛道×关键词，控按量计费成本，技术规划 Step 3）
- [x] load_preference / load_history 实装（`services/preferences.get_active`：active 取最大 version、payload 经 InvestmentPreference 校验、脏数据降级空偏好；`services/events.recent_history`：按机构回放白名单事件——runner 在 run 创建事务中预加载注入初始 state，节点保持纯函数：load_preference 校验+剔空字段，load_history 按 parse_track 关键词过滤同赛道历史、附机构行为统计头、上限 50 条；thesis.created 与 deliverable 动作事件 payload 已带 track 上下文供回放匹配——事件流水事后无法补）
- [ ] Agent 执行迁 ARQ 队列 + Postgres checkpointer（当前内联在请求流中执行，编排已收敛在 runner，整体搬迁即可）
- [ ] Langfuse 接入（自部署或云版）
- [ ] auth 接库集成测试（compose 起 postgres 后跑注册/登录全流程）
- [ ] 用户邀请加入既有机构（多用户；注册仅做机构引导）
- [x] preferences 写路径（`GET`/`PUT /api/preferences`；PUT 经 `InvestmentPreference` 校验后创建新 active 版本、旧版置否、写 `preference.updated` 事件；版本号由服务层分配并忽略入参；脏输入 422 不入库；经验沉淀 diff 确认流 Phase 4 复用本写路径）
- [ ] 前端登录页 + token 注入（接通后关闭 AUTH_DEV_FALLBACK）

## 核心约定（不可破坏）

1. 专用 Agent 的输出必须是 `SCHEMA_REGISTRY` 注册的对象，入库前强制校验
2. 结论一律用 `Claim` 表达：有 `evidence_ids`，或显式 `inferred=True`
3. 业务代码只引用模型档位别名（fast/standard/premium），不写死模型名
4. 用户操作与状态流转必须写 `domain_events`（经验沉淀 Agent 的唯一数据来源）
5. 海外模型调用前检查机构级开关 `allow_overseas_models`（数据出境合规）
