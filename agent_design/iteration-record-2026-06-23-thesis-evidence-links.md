# 2026-06-23 自动迭代记录：赛道详情证据链可信来源与可跳转

## 参考资料

- `README.md`
- `技术规划.md`
- `MVP功能设计.docx`
- `AtomCAP_商业计划书_0616.docx`
- `agent_design/赛道前瞻Agent.docx`
- `agent_design/项目获取Agent.docx`
- `agent_design/Pre DD Agent.docx`
- `agent_design/经验沉淀Agent.docx`
- `agent_design/迭代计划.md`
- 既有自动迭代记录，尤其是 Pre-DD 材料上传、材料归位、材料检索与 EvidencePanel 建议任务

## 本轮判断

产品与技术规划反复强调：AtomCAP 的专用 Agent 交付物必须对象化、可复用，并且每个结论都要有严密的可视化证据链；没有证据支撑的结论要显式标记为模型推断，不能用无关材料、偏好或关键词搜索冒充来源。

本轮用户反馈的赛道详情弹窗中，风险论点被静态投资偏好行填充为论据，造成论点和论据明显错配。这会直接伤害 AtomCAP 最核心的可信度承诺。因此本轮选择一个高价值且可完成的 MVP 增量：让 Thesis 详情页只展示当前论点真实绑定的 evidence source，并让不同来源可点击跳转。

## 完成事项

1. 后端交付物详情返回真实证据来源
   - `GET /api/deliverables/{id}` 新增 `evidence_items` 字段。
   - 新增 `backend/app/services/evidence_projection.py`，只投影当前 payload 实际引用到的 `evidence_ids`，并按当前机构过滤，避免暴露无关证据。
   - 证据投影包含 `id/source_type/title/url/snippet/published_at/connector/raw`，为前端跳转提供稳定结构。

2. 赛道详情证据链去除错误拼接
   - `ThesisView` 不再对任意论点追加全部投资偏好，也不再通过关键词模糊匹配市场信号充当证据。
   - 只有论点本身带 `evidence_ids` 时才展示对应证据；没有证据时显示“模型推断/未绑定可追溯证据”的说明。
   - 只有“与本机构匹配度”和“建议”这类确实来自偏好综合判断的模块，才显式展示当前投资偏好作为论据。

3. 论据支持按来源跳转
   - 投资偏好论据跳转到当前投资偏好页：`/?view=preference`。
   - 市场信号论据跳转到证据原始网页。
   - 项目材料论据跳转到对应项目工作台材料锚点：`/workspace/{dealId}#material-{documentId}`。
   - 工作台材料卡片新增稳定 `material-{id}` 锚点，进入页面后自动滚动到对应材料。

4. “近期市场信号”查看详情修正
   - 有真实网页或材料来源时，按钮直接跳转来源。
   - 没有来源时只打开证据说明，不再把关键词拼成公共搜索链接误导为“详情”。

## 验证命令与结果

- `cd backend; .\.venv\Scripts\python.exe -m pytest tests\test_collect_signals.py -q`
  - 结果：`15 passed`
- `cd backend; .\.venv\Scripts\python.exe -m compileall app`
  - 结果：通过
- `cd frontend; npm run build`
  - 结果：TypeScript 与 Vite 生产构建通过

## 发现的问题

- 当前证据展示逻辑仍在 `ThesisView` 内部，Deal、Pre-DD Brief、DD Report 还没有共享同一个 EvidencePanel。
- 老交付物如果没有返回 `evidence_items`，前端会保守显示“未绑定可追溯证据”，不会编造来源。
- 价值链分段弹窗仍保留“相关市场信号”的辅助展示，后续应统一改为正式 EvidencePanel，减少局部逻辑分叉。

## 下一轮建议

1. 抽象全局 `EvidencePanel` 组件，统一 Thesis、Deal、Pre-DD Brief 与 DD Report 的证据展开交互。
2. 为项目材料检索命中沉淀正式 `EvidenceItem`，让 Pre-DD Brief 的 Claim 能跳转到材料片段。
3. 增加端到端或组件测试，覆盖“无证据不展示假来源”和“三类来源可跳转”。
