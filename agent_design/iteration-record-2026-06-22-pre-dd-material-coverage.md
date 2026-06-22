# 2026-06-22 自动迭代记录：Pre-DD 材料归位到任务树

## 参考资料

- `README.md`
- `技术规划.md`
- `AtomCAP_商业计划书_0616.docx`
- `MVP功能设计.docx`
- `agent_design/Pre DD Agent.docx`
- `agent_design/项目获取Agent.docx`
- `agent_design/经验沉淀Agent.docx`
- `agent_design/赛道前瞻Agent.docx`
- `agent_design/迭代计划.md`

## 本轮判断

上一轮已经完成项目工作台材料上传入口：文件可以解析、绑定 Deal，并以 `Document` / `Chunk` 入库。
但 Pre-DD Agent 的核心要求是“自动完成 14 类资料补全、完整度评分、缺口清单和 Brief 输出”，因此材料不能只停留在清单展示。本轮选择一个低风险、可验证的 MVP 增量：用确定性关键词规则把上传材料归位到 Pre-DD 14 类任务树，并让 Brief checklist 看到这些材料依据。

## 完成事项

1. Pre-DD 材料归位规则
   - `backend/app/services/pre_dd.py` 新增 `MATERIAL_KEYWORD_SPECS` 与 `infer_material_task_hits`。
   - 支持把上传材料文本命中到 14 类任务项：BP/产品、股权、组织、业务、营销、盈利、财务、供应商、客户、竞争、市场、团队、融资、发展。
   - 每条命中保留 `document_id`、文件名、任务 key、关键词和短摘录。
   - BP 类材料即使没有明显关键词，也会默认进入 `bp_product`，避免“上传 BP 后任务树无反馈”。

2. 项目详情联动任务树
   - `backend/app/services/deal_materials.py` 的材料投影新增 `pre_dd_task_keys` 与 `pre_dd_task_hits`。
   - `backend/app/services/deals.py` 在生成项目详情时，把材料命中传入 `build_pre_dd_workspace`。
   - `build_pre_dd_workspace` 对命中材料的任务项标记为 `partial`，并在任务项里返回 `materials`。

3. Brief 草稿吸收材料依据
   - `backend/app/services/pre_dd_brief.py` 的 checklist 答案会把相关上传材料摘录写入“相关材料”。
   - 当前仍保持保守口径：材料命中只代表“部分覆盖”，不直接宣称完整完成。

4. 前端工作台展示
   - `frontend/src/lib/types.ts` 新增 `PreDDMaterialHit`，扩展 `PreDDChecklistItem` 与 `DealMaterial`。
   - `frontend/src/pages/WorkspacePage.tsx` 在材料卡片显示归位标签，在 Pre-DD 任务卡片展示相关材料摘录。

5. 测试
   - `backend/tests/test_deals.py` 新增材料归位测试：
     - 上传文本可命中融资、客户、财务、竞争等任务项。
     - 任务树会因材料命中变为 `partial` 并保留材料引用。
     - Brief checklist 会包含“相关材料”依据。

## 验证结果

- `backend`: `.venv\Scripts\python.exe -m pytest tests\test_deals.py tests\test_document_extract.py -q`
  - 结果：通过，`39 passed`。
- `backend`: `.venv\Scripts\python.exe -m compileall app`
  - 结果：通过。
- `frontend`: `npx tsc -b`
  - 结果：通过。
- `backend`: `.venv\Scripts\python.exe -m pytest`
  - 结果：通过，`349 passed`，仅保留既有 JWT 测试密钥长度 warning。
- `frontend`: `npm run build`
  - 结果：通过，TypeScript 与 Vite 生产构建成功。
- `root`: `git diff --check`
  - 结果：通过；仅提示 Windows 下若干已改文件未来可能被 Git 转换为 CRLF。

## 发现的问题

- 当前归位是关键词规则，适合作为 MVP 反馈闭环；后续需要 LLM/embedding 分类来降低漏召回和误匹配。
- 材料命中仍未写入证据链表，也没有把 `Chunk` 作为 `Claim.evidence_ids` 的正式来源。
- Pre-DD 完整度还没有按材料质量或覆盖深度细分，命中材料只将任务项提升到 `partial`。

## 下一轮建议

1. 增加材料 Chunk 切片与全文/向量检索，为项目工作台问答提供私有材料上下文。
2. 把 Pre-DD Brief 的 Claim 与材料 Chunk 建立 evidence link，支持前端展开来源。
3. 为材料归位增加 LLM 分类兜底，输出冲突、缺口和需人工确认项。
