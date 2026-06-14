# AtomCAP

以「交付结果对象」为中心的一级市场投资多 Agent 系统。整体架构与路线见 [技术规划.md](./技术规划.md)。

## 目录结构

```
backend/
  app/
    objects/      # ★ 交付结果对象 Pydantic Schema —— 系统契约原点（Thesis / DealList 已完整定义）
    models/       # SQLAlchemy ORM（三类对象 + 证据链 + domain_events + RAG）
    llm/          # 档位路由（fast/standard/premium）+ 结构化输出（校验失败自动修复）
    agents/       # 主图意图路由 + 专用 Agent 子图（赛道前瞻 thesis_scout / 项目获取 deal_sourcing）
                  #   + runner 执行编排（子图节点纯函数；run 生命周期/落库/SSE 事件由 runner 统一编排）
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
- [x] Tavily 实装（`connectors/tavily.py`：POST /search Bearer 鉴权、`results[]` 防御式解析、days→time_range 映射、search_news/company_lookup(general topic)/funding_events(组合检索词)；region=global 受 `allow_overseas` 闸控；transport 注入口离线 MockTransport 验证，`tests/test_tavily.py` 覆盖请求体/鉴权/解析/空响应/days 映射）
- [x] 企查查（工商/股东/对外投资）实装（`connectors/qcc.py`：开放平台 MD5 Token 鉴权（Token=MD5(AppKey+Timespan+SecretKey) 大写）；`company_lookup` 先取工商照面解析 KeyNo，再并发拉股东/对外投资，落 `company_registry`/`company_shareholder`/`company_investment` 三类 Source；字段多候选键防御取值、Status 非 200 降级、无 KeyNo 守卫不打子查询；region=cn 不受 allow_overseas 闸控；search_news/funding_events 返回空——本源服务项目获取 Agent 企业尽调，信号检索仍走博查/Tavily。端点路径以开放平台文档为准、待真实 key 校准；`tests/test_qcc.py` 6 用例覆盖鉴权头/三类解析/Status 降级/Result 列表形/无 KeyNo 守卫/news 空）
- [ ] 博查真实 key 冒烟测试；企查查真实 key 冒烟（端点路径与字段名按开放平台文档校准）；Tavily 真实 key 冒烟
- [x] 信号检索 24h 缓存（`connectors/cache.py`：`cached_gather_signals` 在 gather_signals 外套缓存，键含「合规开关 × 启用源集合 × 赛道 × 关键词集合 × 时间窗」——合规开关不同则源集合不同，严禁跨闸门复用结果（约定 5）；关键词大小写/顺序无关最大化命中；只缓存非空结果不钉死失败空集；redis 懒加载、不可用即透明降级为不缓存（缓存层故障绝不拖垮主检索）；TTL 走 `signal_cache_ttl_seconds` 默认 24h。`tests/test_signal_cache.py` 覆盖键稳定性/序列化/命中复用/降级/合规隔离）
- [x] load_preference / load_history 实装（`services/preferences.get_active`：active 取最大 version、payload 经 InvestmentPreference 校验、脏数据降级空偏好；`services/events.recent_history`：按机构回放白名单事件——runner 在 run 创建事务中预加载注入初始 state，节点保持纯函数：load_preference 校验+剔空字段，load_history 按 parse_track 关键词过滤同赛道历史、附机构行为统计头、上限 50 条；thesis.created 与 deliverable 动作事件 payload 已带 track 上下文供回放匹配——事件流水事后无法补）
- [x] 项目获取 Agent（Deal Sourcing 搜寻流）真实实现（`agents/deal_sourcing/`：设计文档流程一六节点 LangGraph 子图——gen_search_strategy（FAST，据整个来源 Thesis 与机构偏好拆搜索策略，不止赛道名）→ mine_signals（多 Connector 并发挖掘，每条预分配 evidence_id，复用 24h 缓存与 allow_overseas 闸控）→ generate_candidates（STANDARD，Signal-to-Deal 从信号反推公司，selection_reasons 绑定信号 evidence_id）→ dedupe_candidates（纯函数确定性实体对齐：名称规范化去后缀/括注 + 别名跨条命中合并 + 入选理由按 text 去重）→ score_candidates（STANDARD，逐候选 FitScoreBreakdown 分项 + 推荐分层 strong/watch/observe/reject + 推荐理由/轻量风险，评分缺失中性回退不丢候选，按分降序）→ assemble_deal_list（PREMIUM 仅做池级命名与总览，候选明细结构化保真不重写以保 evidence_ids）。DealList 交付对象扩展对齐 Step 8-10（fit_score/recommendation_tier/recommendation_reasons/initial_risks/source_type/search_themes）。runner.run_deal_sourcing 与赛道前瞻同构编排：run 生命周期 → 证据剥伪连边 → DealList 经 SCHEMA_REGISTRY 强校验入库 → `deal_list.created` 记账 → assistant 消息 object_ref；支持从 Thesis「生成项目池」传 source_thesis_id/thesis_context。conversations.py 接 DEAL_SOURCING 意图（≥0.7 置信度）。`tests/test_deal_sourcing_nodes.py` 11 用例覆盖档位/合规透传/空守卫/实体去重/评分合并回退排序/空池兜底/真实子图端到端，全套 100 测试通过）
- [x] 项目获取 Agent 分析流（Deal Intake）真实实现（`agents/deal_intake/`：设计文档流程二四节点 LangGraph 子图——parse_material（STANDARD，从 BP 文本/项目介绍/公司名客观抽取 DealExtraction，未提及字段不臆造，空材料守卫不调 LLM）→ enrich_external（企查查 company_lookup 工商实体补全 + 博查/Tavily 新闻融资信号交叉验证，每条预分配 evidence_id，复用 allow_overseas 闸控，未识别项目/无 key 走空证据）→ align_entity（纯函数确定性实体对齐：uscc 精确命中 + 规范化名/别名跨字段等值合并，与机构已有公司去重，命中即关联 company_id）→ assemble_deal（PREMIUM，项目画像/赛道判断/fit_score 分项/投资亮点/初步风险/信息缺口/待验证问题/推荐下一步，Claim 绑定证据，非完整 Pre-DD）。产出**业务对象**：DealProfile 强校验 `deals.data`，`services/business.py` upsert Company（客观信息，命中已有则补全不空覆盖）+ create Deal（status=screening 待初筛）。`agents/runner.run_deal_intake` 同构编排：run 生命周期 → 证据剥伪连边 → Company/Deal 落库 → `deal.created` 记账（约定 4）→ assistant 消息带 deal_ref 块（前端据此进入项目工作台）。`agents/router.Intent.DEAL_INTAKE` + conversations.py 分析型触发（≥0.7 置信度，与 deal_sourcing「找一批」区分「分析一个」）。新增 `connectors/registry.lookup_company`（多工商源并发去重）。`objects/deal.py` 定义 DealExtraction/DealAnalysis/DealProfile/DealStatus。`tests/test_deal_intake_nodes.py` 10 用例覆盖档位/合规透传/空材料与未识别守卫/uscc 与名称别名对齐/source_type 透传/DealProfile 强校验/真实子图端到端，全套 110 测试通过）
- [x] Deal Intake 文件型材料解析（`app/services/document_extract.py`：上传 PDF/Word(.docx)/Excel(.xlsx)/纯文本 BP → 抽取文本喂入同一 `run_deal_intake` 分析流。按扩展名分派、content-type 兜底，第三方解析库懒加载（未装也不拖垮编译/启动）；体积 20MB 守卫、空文本/扫描件守卫、UTF-8↔GB18030 解码回退；Word 段落+表格按行拼接、Excel 多工作表+单元格制表符拼接、PDF 多页拼接。source_type 推断：Excel→internal_excel、PDF/Word/文本→bp_upload。新增 `POST /api/conversations/{id}/upload`（UploadFile→抽取→把材料记成 user 消息→直进 Deal Intake，免再过意图分类；解析失败 4xx、依赖缺失 503）。`tests/test_document_extract.py` 15 用例覆盖分派/守卫/解码/docx/xlsx/csv/pdf 注入假库，全套 125 测试通过。**顺带修复**：上一版 `conversations.py` 提交时被挂载同步截断成 `return EventSourceRespons`（缺尾），已补全为 `return EventSourceResponse(event_stream())`）
- [ ] Deal Intake 系统主动推送触发流；deal_sourcing 搜寻流 mine_signals 也接入企查查 company_lookup（当前仅分析流 enrich_external 用工商源）；旧版 .doc/.xls 二进制与扫描件 OCR 解析；前端文件上传入口 + deal_ref 块渲染与项目工作台详情页
- [x] Thesis「生成项目池」专用端点（`POST /api/deliverables/{id}/generate-deal-pool`：加载存储的 Thesis 视图经 `services/thesis_context.thesis_context_from_payload` 压成精简上下文——赛道判断/子赛道/产业链位置/机构匹配度/风险/近期信号——喂给 deal_sourcing `gen_search_strategy` 据整个赛道判断拆策略，而非仅赛道名；产出 DealList 自动 `source_type=thesis_generated` 且 `source_thesis_id` 回链。流前完成租户过滤+类型校验（非 Thesis 422），生成器内 SessionLocal 短事务翻转 Thesis 状态→`deal_pool_generated`、记账 `thesis.deal_pool_requested`、新建会话承载 run 与 assistant 消息，再复用 `run_deal_sourcing` 同构编排，SSE 协议 progress/object/error/done 与对话端点一致。`thesis_context_from_payload` 纯函数对缺字段/脏数据宽容，`tests/test_thesis_context.py` 3 用例覆盖完整提取/空字段剔除/脏数据容错，全套 128 测试通过）
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
