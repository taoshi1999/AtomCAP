# 2026-06-23 自动迭代记录：全局 EvidencePanel 前端组件

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
- 既有自动迭代记录，尤其是 `iteration-record-2026-06-23-thesis-evidence-links.md`

## 本轮判断

技术规划明确提出 EvidencePanel 全局复用，任何带 `evidence_ids` 的字段都应该可以展开来源列表与原文摘录。上一轮已经修复 Thesis 详情中的证据错配和来源跳转，但弹窗 UI 与证据来源 helper 仍写在 `ThesisView` 内部，后续 Deal、Pre-DD Brief、DD Report 无法复用。

因此本轮选择一个低风险、高复用价值的 MVP 增量：先抽象通用 EvidencePanel 组件与证据跳转 helper，并保持 Thesis 当前行为不变。

## 完成事项

1. 新增证据链通用类型与 helper
   - 新增 `frontend/src/lib/evidence.ts`。
   - 抽出 `EvidenceArgument`、`EvidenceRow`、`EvidenceDialogState`、`EvidenceTarget` 等通用类型。
   - 抽出 `evidenceIds`、`evidenceTarget`、`argumentFromEvidence`。
   - 保留三类可跳转来源：
     - 公开网页：直接打开 `url`。
     - 项目材料：跳转 `/workspace/{dealId}#material-{documentId}`。
     - 投资偏好：跳转 `/?view=preference`。

2. 新增全局 EvidencePanel 组件
   - 新增 `frontend/src/components/EvidencePanel.tsx`。
   - 统一渲染“论点 / 论据”双列表、来源类型徽标、外链图标、摘要摘录。
   - 支持可点击论据与不可点击说明项，避免无证据时展示假来源。

3. ThesisView 接入复用组件
   - `ThesisView` 删除局部 `EvidenceDialog` 和重复证据 helper。
   - 保留 Thesis 业务组装逻辑：只有匹配度与建议模块可以显式挂投资偏好，风险/机会等论点仍只展示真实绑定证据或推断说明。
   - 市场信号按钮继续复用真实 evidence target，不回退到关键词搜索。

## 验证命令与结果

- `cd frontend; npm run build`
  - 结果：TypeScript 与 Vite 生产构建通过
- `cd backend; .\.venv\Scripts\python.exe -m pytest tests\test_collect_signals.py -q`
  - 结果：`15 passed`
- `cd backend; .\.venv\Scripts\python.exe -m compileall app`
  - 结果：通过

## 发现的问题

- 本轮先完成组件抽象和 Thesis 接入，Deal / Pre-DD Brief / DD Report 尚未迁移到 EvidencePanel。
- `EvidencePanel` 当前仍是弹窗形态；后续可能需要增加嵌入式模式，用于项目工作台卡片内的小型证据列表。
- 价值链分段弹窗中的“相关资料”仍是辅助搜索/信号入口，尚未接入正式 evidence source。

## 下一轮建议

1. 将项目工作台中的 Deal 亮点、风险、Pre-DD Brief checklist 接入 `EvidencePanel`。
2. 为 `EvidencePanel` 增加轻量嵌入式展示模式，支持在任务卡片或 Brief 小节中直接显示证据来源。
3. 把项目材料检索命中正式沉淀为 `EvidenceItem`，让材料片段成为可跳转、可复用的标准证据。
