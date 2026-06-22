# 迭代记录：Pre-DD 项目材料证据链

日期：2026-06-22  
自动化：atomcap

## 本轮目标

在已完成“项目材料上传、材料任务覆盖、材料全文搜索”的基础上，把上传材料接入 AtomCAP 的 EvidenceItem 证据链，使项目工作台里的材料命中、搜索命中和 Pre-DD Brief checklist 能携带可追溯的 evidence_id。

## 参考资料复核

- `README.md`、`技术规划.md`：强调对象系统、私域 RAG、结论必须可追溯到证据。
- `agent_design` 下项目获取、Pre-DD、证据链相关设计：项目工作台应沉淀 14 类材料，材料应能支撑后续尽调判断。
- `AtomCAP_商业计划书_0616.docx`、`MVP功能设计.docx`：MVP 的差异化能力包括“证据链可视化”和私域材料/公开数据交叉验证。

## 完成事项

- 上传项目材料时同步创建 `EvidenceItemRow`：
  - `source_type=private_material`
  - `connector=upload`
  - `raw` 中记录 `deal_id`、`document_id`、`chunk_id`、文件格式、来源类型和文本长度。
- 将生成的 `evidence_id` 写入首个 `Chunk.meta.evidence_id`，并在 `deal.material_uploaded` 事件 payload 中记录。
- `project_deal_material`、`project_material_search_result`、`infer_material_task_hits` 均透传 `evidence_id`。
- Pre-DD Brief checklist 的材料回答会收集材料 `evidence_id`：
  - 有 evidence_id 时生成 `Claim(inferred=False)`。
  - 无 evidence_id 时仍保持推断标记，符合“无证据必须显式 inferred”的约定。
- 前端类型同步新增：
  - `PreDDMaterialHit.evidence_id`
  - `DealMaterial.evidence_id`
  - `DealMaterialSearchResult.evidence_id`
- 项目工作台 UI 增加轻量证据提示：
  - Pre-DD 任务卡材料行显示“证据”徽标。
  - 材料搜索命中显示“可引用”徽标。
  - 材料卡片显示“证据”徽标。
- 新增/维护测试，覆盖材料投影、上传落 EvidenceItem、搜索结果、任务命中、Brief Claim 引用证据。

## 验证命令与结果

- `cd backend; .\.venv\Scripts\python.exe -m pytest tests\test_deals.py -q`
  - 结果：通过，`27 passed`
- `cd backend; .\.venv\Scripts\python.exe -m compileall app`
  - 结果：通过
- `cd frontend; npx tsc -b`
  - 结果：通过

## 发现的问题

- 现阶段只把上传材料首个全文 Chunk 建成一个 EvidenceItem，尚未按页/段落拆分为更细粒度证据。后续接入 embedding/hybrid search 时需要拆分 chunk，并让 evidence raw 保存更精确的位置。
- Brief checklist 目前只在材料命中项上引用 evidence_id，尚未把 Profile 中已有结论的 evidence_ids 与材料证据自动合并。

## 下一轮建议

- 建立“材料片段级 evidence”与 Chunk 切分策略，为 RAG 检索和引用定位做准备。
- 在 Pre-DD Brief 详情里展示 checklist 的 evidence_ids 来源列表，让用户能从 Brief 直接跳回原材料片段。
- 增加材料删除/重传时的 EvidenceItem 生命周期策略，避免失效证据继续被引用。
