# 2026-06-21 自动迭代记录：Pre-DD Brief 历史回看

## 参考资料

- `README.md`
- `技术规划.md`
- `AtomCAP_商业计划书_0616.docx`
- `MVP功能设计.docx`
- `agent_design/` 下的 Agent 设计文档与迭代计划

## 本轮判断

上一轮已经让项目工作台能生成结构化 Pre-DD Brief，并以 `dd_report` 交付对象入库。但前端只展示本次生成结果，刷新或重新进入项目后看不到历史 Brief。根据商业计划书和 Pre-DD Agent 设计，项目工作台应当是“迭代积累、有据可查的立项依据”，因此本轮补齐 Brief 历史回看能力。

## 完成事项

1. 后端 Brief 历史查询
   - `backend/app/services/pre_dd_brief.py` 新增 `project_pre_dd_brief` 与 `list_pre_dd_briefs`。
   - 从 `deliverables` 中读取同租户 `dd_report`，筛选当前 `deal_id` 且带 `brief` 的条目。
   - 返回 `deliverable_id`、`payload`、`created_at`、`updated_at`，供工作台渲染。

2. 新增 API 端点
   - `GET /api/deals/{deal_id}/pre-dd/briefs`
   - 先校验 Deal 归属当前租户，再返回最近生成的 Brief 列表。
   - 保持 `POST /pre-dd/brief` 生成入口不变。

3. 前端项目工作台回看
   - `frontend/src/lib/api.ts` 新增 `listPreDDBriefs` 与历史项类型。
   - `frontend/src/pages/WorkspacePage.tsx` 进入项目详情时自动加载历史 Brief。
   - 生成新 Brief 后刷新历史；若刷新失败，仍用本次生成响应即时展示。
   - Pre-DD 区块新增“最近生成”列表，展示生成时间、项目名、完整度和 Brief 结构化内容。

4. 测试
   - `backend/tests/test_deals.py` 新增历史投影测试，覆盖目标项目匹配、跨项目过滤、旧版无 `brief` 的 `dd_report` 不进入历史列表。

## 验证结果

- `backend`: `.venv\Scripts\python.exe -m pytest tests\test_deals.py -q`
  - 结果：通过，`21 passed`。
- `backend`: `.venv\Scripts\python.exe -m compileall app`
  - 结果：通过。
- `frontend`: `npx tsc -b`
  - 结果：通过。
- `backend`: `.venv\Scripts\python.exe -m pytest`
  - 结果：通过，`346 passed`，仅保留既有 JWT 测试密钥长度 warning。
- `frontend`: `npm run build`
  - 结果：通过，TypeScript 与 Vite 生产构建成功。
- `root`: `git diff --check`
  - 结果：通过；仅提示 Windows 下若干已改文件未来可能被 Git 转换为 CRLF。

## 发现的问题

- 当前历史查询为 MVP 轻量实现：按租户和 `dd_report` 类型取最近若干条，再在 Python 中按 `payload.deal_id` 过滤。数据量变大后应补 JSONB 表达式索引或显式的 `deal_deliverables` 关联表。
- Brief 历史只在项目工作台展示，尚未进入统一交付物详情页或消息流对象卡片。
- 当前 Brief 内容仍来自 DealProfile 与只读任务树，未接入材料库 / RAG / 公开数据交叉验证。

## 下一轮建议

1. 增加项目工作台材料上传入口，把上传材料绑定到 `documents.deal_id` 并刷新 Pre-DD 任务树。
2. 抽象 EvidencePanel，让 Brief、Deal 和 Thesis 的 `Claim.evidence_ids` 可以统一展开。
3. 为 `dd_report` 增加统一对象渲染组件，支持从首页交付物列表打开 Brief。
