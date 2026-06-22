# 2026-06-21 自动迭代记录：Pre-DD Brief 草稿入口

## 参考资料

- `README.md`
- `技术规划.md`
- `AtomCAP_商业计划书_0616.docx`
- `MVP功能设计.docx`
- `agent_design/` 下的 Agent 设计文档与迭代计划

## 本轮判断

商业计划书、技术规划与 `agent_design/Pre DD Agent.docx` 都把项目工作台定位为立项会前的信息准备区。当前代码已经有 Deal 详情、14 项 Pre-DD 资料任务树与完整度评分，但还缺少一个可被用户显式触发、可入库复用的 Pre-DD Brief 草稿。

因此本轮优先实现一个不依赖长流程 Agent 的 MVP 入口：基于当前 `DealProfile` 与只读 Pre-DD 任务树，确定性生成 `dd_report` 交付对象，并在项目工作台展示。

## 完成事项

1. 扩展 `DDReport` 契约
   - 在 `backend/app/objects/dd_report.py` 中新增 `PreDDBrief` 块。
   - 保留原有 `checklist` / `sections` / `open_questions` 字段，向后兼容既有 `dd_report` payload。

2. 新增 Brief 组装服务
   - 新增 `backend/app/services/pre_dd_brief.py`。
   - 从 `DealProfile` 与 `build_pre_dd_workspace` 生成项目概览、机构匹配度、资料完整度、核心亮点、Top 风险、待验证问题和建议下一步。
   - 不调用 LLM，不编造证据；无证据结论经 `Claim` 自动标记 `inferred=True`。

3. 新增后端端点
   - `POST /api/deals/{deal_id}/pre-dd/brief`。
   - 生成 `DeliverableType.DD_REPORT` 并走 `save_deliverable` 的 Schema 强校验入库。
   - 写 `deal.pre_dd_brief_generated` domain_event。
   - 落 `UserActionType.GENERATE_PRE_DD_BRIEF`，作为经验沉淀 Agent 的强正向行为信号。

4. 项目工作台前端接入
   - `frontend/src/lib/types.ts` 新增 `DDReport` / `PreDDBrief` 类型。
   - `frontend/src/lib/api.ts` 新增 `generatePreDDBrief`。
   - `frontend/src/pages/WorkspacePage.tsx` 在 Pre-DD 资料任务树中加入真实“生成 Pre-DD Brief”按钮，并展示返回的 Brief 草稿。

5. 测试补充
   - `backend/tests/test_deals.py` 增加 Brief 生成测试，覆盖 `DDReport` Schema 校验、完整度、亮点、风险、待验证问题和下一步。

## 验证结果

- `backend`: `.venv\Scripts\python.exe -m pytest tests\test_deals.py -q`
  - 结果：通过，`20 passed`。
- `backend`: `.venv\Scripts\python.exe -m compileall app`
  - 结果：通过。
- `frontend`: `npx tsc -b`
  - 结果：通过。

## 发现的问题

- 当前 Brief 仍是基于 DealProfile 的确定性草稿，不会读取材料库、RAG、工商/司法/招聘等公开数据做交叉验证。
- `dd_report` 的前端目前只在项目工作台即时展示新生成结果，尚未接入交付物详情页的持久化历史列表。
- 工作树中已有上一轮项目状态变迁图改动，以及此前的 `0004_conversation_workspace_type.py`、`iteration-record-2026-06-21-schema-migration.md` 未提交改动；本轮继续保护这些变更。

## 下一轮建议

1. 接入 `dd_report` 历史列表：让项目工作台可以看到最近生成的 Brief，而不是只显示本次响应。
2. 将项目材料上传与 Pre-DD 任务树绑定：每个 checklist item 能显示对应材料来源与证据。
3. 建全局 EvidencePanel：统一 Thesis、Deal、DDReport 的证据展开体验。
4. 增加后端启动健康检查：检测 Alembic 是否在 head，避免已有数据库缺字段时页面先报 500。
