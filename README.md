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
- [x] deal_sourcing 搜寻流工商核验节点（`agents/deal_sourcing/nodes.verify_candidates`：dedupe 后、score 前新增确定性核验节点——对每个候选并发跑企查查 `registry.lookup_company`（工商照面/股东/对外投资，region=cn 不受 allow_overseas 闸控但连接器集合本身已过滤），命中即用工商主体规范名补 `aliases`、用统一社会信用代码补 `uscc`，并追加一条**绑定工商照面 evidence_id** 的核验 Claim 到 selection_reasons（约定 2：有据可查、未命中绝不伪造证据）；拉到的每条 Source 预分配 evidence_id 累加进 `evidence_sources`（TypedDict 无 reducer，读旧值合并返回），runner 成功事务统一落库连边；`MAX_VERIFY=20`/`VERIFY_CONCURRENCY=5` 控开放平台配额，无工商源 key 时全部未命中、链路无副作用。graph 接入 dedupe→verify→score。`tests/test_deal_sourcing_nodes.py` 新增 3 用例（命中富化+证据累加/未命中不造证据/空候选与无源透传），该文件 14 用例、全套 131 测试通过）
- [x] 前端项目工作台详情页（`frontend/src/pages/WorkspacePage.tsx` 接通 `api/deals.py`：左侧项目库列表——全部/项目库/按管线状态筛选，已放弃项目按设计收起画像只留名+状态；右侧详情——项目画像/赛道判断、机构匹配度分项（FitScoreBreakdown 七维）、投资亮点/初步风险（Claim 渲染，inferred 标「推断」、有据标证据数，约定 2）、信息缺口/待验证问题、推荐下一步、材料事实、关联企业工商信息；顶部管线流转按钮据 `PIPELINE_NEXT`（镜像后端守卫）只显示合法下一态，用户反馈动作 add_to_library/follow/dismiss/abandon/create_workspace 显示当前态并写后端 domain_events。`lib/types.ts` 镜像 `objects/deal.py`（DealProfile/DealStatus/DealSummary/DealDetail 等），`lib/api.ts` 新增 listDeals/getDealDetail/transitionDeal/triggerDealAction 与 token 注入位（setAuthToken，待登录页落地，开发期依赖后端 AUTH_DEV_FALLBACK）。esbuild transform 校验三文件 TSX 语法通过）
- [ ] Deal Intake 系统主动推送触发流；deal_sourcing 工商核验深度匹配（创始人/官网级实体对齐，待 Company 业务对象沉淀）；旧版 .doc/.xls 二进制与扫描件 OCR 解析；前端文件上传入口 + deal_ref 块渲染（消息流中的 deal_ref 块点击进工作台）
- [x] 项目库 / 项目工作台后端 API（`api/deals.py` + `services/deals.py`：Deal Intake 创建的 Deal 此前无读取/推进入口，本增量补齐——`GET /api/deals` 项目库列表（租户过滤、按管线状态/是否入库筛、批量取 Company 名免 N+1、已放弃项目据 is_abandoned 收起）；`GET /api/deals/{id}` 项目工作台详情（完整画像 + 关联 Company）；`POST /transition` 管线状态流转——确定性守卫 `PIPELINE_TRANSITIONS`（sourced→screening→pre_dd→ic_ready→approved/rejected，reject 可从任意非终态、ic_ready 可回退 pre_dd、跳级/自环/终态出口一律 422），改 status 并记 `deal.{to_status}` 事件（deal.approved/rejected 已在历史回放白名单供经验沉淀，约定 4）；`POST /actions/{action}` 用户反馈——add_to_library/follow/dismiss/abandon/create_workspace 更新 data.user_feedback/workspace 块（follow 与 dismiss 互斥）并各记一条 domain_event。`objects/deal.py` 向后兼容扩展 DealUserFeedback（设计字段 11）/DealWorkspace（设计字段 12）可选块，默认值保证既有 deals.data 仍校验通过；动作补丁入库前经 DealProfile 强校验绝不落脏数据。`tests/test_deals.py` 16 用例覆盖流转守卫/动作互斥与校验/不可变输入/summary 投影/向后兼容，全部通过，compileall 通过）
- [x] Thesis「生成项目池」专用端点（`POST /api/deliverables/{id}/generate-deal-pool`：加载存储的 Thesis 视图经 `services/thesis_context.thesis_context_from_payload` 压成精简上下文——赛道判断/子赛道/产业链位置/机构匹配度/风险/近期信号——喂给 deal_sourcing `gen_search_strategy` 据整个赛道判断拆策略，而非仅赛道名；产出 DealList 自动 `source_type=thesis_generated` 且 `source_thesis_id` 回链。流前完成租户过滤+类型校验（非 Thesis 422），生成器内 SessionLocal 短事务翻转 Thesis 状态→`deal_pool_generated`、记账 `thesis.deal_pool_requested`、新建会话承载 run 与 assistant 消息，再复用 `run_deal_sourcing` 同构编排，SSE 协议 progress/object/error/done 与对话端点一致。`thesis_context_from_payload` 纯函数对缺字段/脏数据宽容，`tests/test_thesis_context.py` 3 用例覆盖完整提取/空字段剔除/脏数据容错，全套 128 测试通过）
- [ ] Agent 执行迁 ARQ 队列 + Postgres checkpointer（当前内联在请求流中执行，编排已收敛在 runner，整体搬迁即可）
- [ ] Langfuse 接入（自部署或云版）
- [ ] auth 接库集成测试（compose 起 postgres 后跑注册/登录全流程）
- [ ] 用户邀请加入既有机构（多用户；注册仅做机构引导）
- [x] preferences 写路径（`GET`/`PUT /api/preferences`；PUT 经 `InvestmentPreference` 校验后创建新 active 版本、旧版置否、写 `preference.updated` 事件；版本号由服务层分配并忽略入参；脏输入 422 不入库；经验沉淀 diff 确认流 Phase 4 复用本写路径）
- [x] 前端登录页 + token 注入（`pages/LoginPage.tsx` 登录/注册机构双模式表单，调 `/api/auth/login`、`/api/auth/register`，成功拿 JWT 经 `lib/auth.tsx` AuthProvider 存 localStorage 并 `setAuthToken` 注入；`bootstrapAuth()` 在 main.tsx 渲染前回灌 token 保证首屏请求带 Authorization；`RequireAuth` 守卫包住 `/` 与 `/workspace`，未登录跳 /login 并记来源回跳；`api.ts` 的 `apiJson` 与 SSE `sendMessage` 统一注入 Bearer 头（此前 SSE 漏带）；ChatPage 侧栏加退出登录。后端 `settings.auth_dev_fallback` 默认已为 False——登录闭环就此打通，无需再依赖 dev 回退。esbuild 逐文件 TSX transform 校验 6 文件语法通过）

## 经验沉淀 Agent 路线（按 `agent_design/经验沉淀Agent.docx`，2026-06-15 新增设计）

经验沉淀（投资学习）Agent 把用户行为转化为机构偏好，反哺赛道前瞻 / 项目获取 / Pre-DD 三个 Agent。设计文档定义四层管线（实时产生 → 经验归纳 → 偏好改进 → 最终沉淀）与五个对象（Message、UserAction、ExperienceEvent、Preference_Advice、Preference）。**与技术规划 Phase 4「周级 cron」的差异**：设计文档要求每 5 分钟增量扫描 + 每 1 小时聚合 + 强信号实时生成 Advice，且即便强信号也一律进人工审阅、绝不直接覆盖 Preference——经验沉淀的对象/字段/节奏以本设计文档为权威，技术规划仅保留架构主线。现状：`agents/experience/graph.py` 与 `worker/main.py` 仅有 `distill_experience` 周级 cron 桩。

落地按以下独立可验证的增量推进（建议顺序）：

- [x] **五对象 Schema + ORM/迁移**：`objects/experience.py` 落地 UserAction / ExperienceEvent / PreferenceAdvice 三系统对象（不进 SCHEMA_REGISTRY，类比 Message）+ 全部枚举（`UserActionType`/`SignalType`/`ExperienceEventType`/`ExperienceStatus`/`AdviceType`/`ReviewStatus`/`Polarity`/`SignalStrength`）+ 行为权重表常量 `ACTION_WEIGHTS`（查看详情+1…生成 Pre-DD Brief+5…放弃项目-5…标记风险不可接受-6）+ 嵌套子结构（target_snapshot/action_strength/observed_pattern/preference_impact/suggested_changes/review/application 等，全部带默认值便于增量填充）；`objects/preference.py` 的 `InvestmentPreference` 扩展为 `declared_strategy` + `learned_preference`（5 张 `WeightedItem` 权重表每项带 confidence）双块，并补 anti_preference/preferred_deal_profile/risk_boundary/scoring_weights/版本溯源字段，**保留早期扁平字段故旧 `preferences.data` 仍校验通过**；ORM 加 `UserActionRow`/`ExperienceEventRow`/`PreferenceAdviceRow` 三表（user_actions 带 `scanned` 标志供 5min 增量扫描去重、experience_events 带 `advice_generated` 标志供 1h 聚合筛选）；Alembic `0002_experience_objects` 迁移建三表+索引；`test_migration_contract` 重构为**跨 versions/ 全部迁移并集校验**（增量迁移不漂移）；新增 `test_experience_schemas.py` 7 用例（快照/权重表对账/生命周期默认/审阅队列默认/向后兼容旧 payload/双块），全套 **154 测试通过**，`alembic upgrade head --sql` 离线生成 0001→0002 全部 19 表 OK
- [x] **UserAction 落库（约定 4 的强化）**：新增 `services/user_actions.py`——deal/thesis 动作端点在写 domain_events 的同一事务里落结构化 `UserAction`（`user_actions` 表，payload 存完整 UserAction + 去规范化列 action_type/target/polarity/weight/confidence/`scanned=False` 供 5min 增量扫描）。`record_user_action` 按动作映射表挂接：项目工作台反馈动作（add_to_library→加入项目库 / follow→关注 / dismiss→不感兴趣 / abandon→放弃 / create_workspace→建工作台）、管线流转（pre_dd→生成 Pre-DD Brief +5 / ic_ready→准备上会 +6 / rejected→放弃推进 -5）、赛道交付物（follow_track→关注赛道 +2 / generate_deal_pool→生成项目池 +2）。**必须保存 `target_snapshot`**：`snapshot_from_deal` 从 DealProfile 抽赛道（extraction.track 缺则回退 analysis.track_judgement）/子赛道/阶段/fit_score（缺字段不臆造），`snapshot_from_thesis` 抽赛道名，对象后续被更新也不丢复盘上下文。`action_strength` 取自设计文档行为权重表常量 `ACTION_WEIGHTS`、显式 UI 点击 confidence=1.0、未在表中记 neutral。**设计取舍**：sourced→screening（系统初筛推进，无偏好信号）与 approved（立项通过，UserActionType 枚举暂无对应类型）不落 UserAction，仅保留 domain_events 供经验沉淀历史回放，待补专用类型；开发回退无登录用户（user_id=None）跳过 UserAction（非空外键）但 domain_event 照常写，主链路不破。`tests/test_user_actions.py` 10 用例覆盖权重表对账/映射表合法性/快照抽取与回退与容空/UserAction 组装/无用户跳过，与 test_deals/test_experience_schemas 同跑 32 测试通过，compileall 通过
- [ ] **PreferenceSignal 抽取**：Message 路径——LLM（STANDARD）判 `preference_signal_candidate` 并抽取 signal_type（显式偏好/反偏好/推荐纠偏/风险边界/策略修正/临时请求），**区分长期偏好与单次任务指令**（"这次先帮我找下游"不沉淀，"以后这个赛道不看上游"才沉淀）；UserAction 路径——纯函数按权重表 + target_snapshot 出 polarity/weight
- [ ] **ExperienceEvent 匹配/更新/创建 + 生命周期**：纯函数匹配维度（同用户/机构、同赛道/子赛道/产业链位置/风险类型、同行为方向、时间窗、语义相似）→ 命中则更新（追加 source_id、更新 confidence/time_window/observed_pattern/preference_impact），否则建新；状态机 open→candidate→advice_generated→accepted/rejected→archived
- [ ] **每 5 分钟增量扫描 cron**：`last_processed_message_id` / `last_processed_user_action_id` 游标增量读取，跑抽取→匹配→更新 ExperienceEvent；`processing_status.experience_agent_scanned` 防重复处理。先以 ARQ cron（5 分钟）落地，无 ARQ 时留手动触发端点便于离线验证
- [ ] **每 1 小时聚合 + 强信号实时 → Preference_Advice**：1 小时 cron 扫 status=candidate/open 且达阈值（confidence>0.75 / 证据数足够 / strong 信号 / 多弱信号成稳定模式 / 未生成过 / 未被拒绝过相似）的事件，转成 `suggested_changes`（field_path + operation + current/suggested_value + delta + reason）；强显式指令实时生成（仍入审阅队列）
- [ ] **Preference_Advice 人工审阅 API + 前端审阅卡片**：`GET /api/preference-advice`（pending 列表，前端只展示自然语言解释�