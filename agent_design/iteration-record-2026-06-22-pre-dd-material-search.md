# 2026-06-22 自动迭代记录：项目材料全文检索

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

前两轮已经完成项目材料上传、解析入库，并把材料归位到 Pre-DD 14 类任务树。下一步最有价值的小闭环是让这些私有材料可以被检索和引用：这与技术规划中 `documents/chunks` 的 RAG 路线一致，也能让项目工作台从“展示材料”进一步变成“围绕材料工作”的入口。本轮先实现确定性关键词全文检索，后续再替换为 embedding / hybrid search。

## 完成事项

1. 后端材料检索服务
   - `backend/app/services/deal_materials.py` 新增 `_query_terms`、`project_material_search_result` 与 `search_material_records`。
   - 支持按用户关键词在文件名和 Chunk 正文中检索，返回命中文件、chunk、匹配词、片段摘录和简单相关性分数。
   - 新增 `search_deal_materials`，带租户过滤与 Deal 归属校验。

2. 新增 API 端点
   - `GET /api/deals/{deal_id}/materials/search?q=...&limit=...`
   - 当前 MVP 基于已解析 Chunk 做关键词片段召回；未找到项目返回 404。

3. 前端项目工作台检索入口
   - `frontend/src/lib/types.ts` 新增 `DealMaterialSearchResult`。
   - `frontend/src/lib/api.ts` 新增 `searchDealMaterials`。
   - `frontend/src/pages/WorkspacePage.tsx` 在“项目材料”卡片中加入搜索框、搜索按钮和命中片段展示。

4. 测试
   - `backend/tests/test_deals.py` 新增材料检索纯函数测试，覆盖命中排序、匹配词、片段摘录和空查询。

## 验证结果

- `backend`: `.venv\Scripts\python.exe -m pytest tests\test_deals.py tests\test_document_extract.py -q`
  - 结果：通过，`41 passed`。
- `backend`: `.venv\Scripts\python.exe -m compileall app`
  - 结果：通过。
- `frontend`: `npx tsc -b`
  - 结果：通过。
- `backend`: `.venv\Scripts\python.exe -m pytest`
  - 结果：通过，`351 passed`，仅保留既有 JWT 测试密钥长度 warning。
- `frontend`: `npm run build`
  - 结果：通过，TypeScript 与 Vite 生产构建成功。
- `root`: `git diff --check`
  - 结果：通过；仅提示 Windows 下若干已改文件未来可能被 Git 转换为 CRLF。

## 发现的问题

- 当前检索是关键词匹配，不具备语义召回、同义词扩展和向量排序能力。
- 检索结果还没有进入 evidence_items / evidence_links，因此只能作为材料片段展示，尚未成为正式 Claim 证据链。
- 项目工作台 AI 助手还没有自动读取检索结果作为上下文，需要后续把检索能力接入对话。

## 下一轮建议

1. 将材料检索结果沉淀为可引用 EvidenceItem，并支持 Pre-DD Brief 的 Claim 展开来源。
2. 增加 Chunk 切片策略，避免单个大 Chunk 影响检索片段质量。
3. 把项目工作台 PageAssistant 的上下文扩展为“项目画像 + Pre-DD 缺口 + 材料检索摘要”。
