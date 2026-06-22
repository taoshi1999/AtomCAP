# 2026-06-22 自动迭代记录：项目工作台材料上传入口

## 参考资料

- `README.md`
- `技术规划.md`
- `AtomCAP_商业计划书_0616.docx`
- `MVP功能设计.docx`
- `agent_design/` 下的 Agent 设计文档与迭代计划

## 本轮判断

上一轮已经补齐项目工作台 Pre-DD Brief 生成与历史回看，但 Brief 仍主要来自
`DealProfile` 的结构化画像和确定性任务树。根据 Pre-DD Agent 设计，项目工作台需要承接 BP、
项目表、访谈纪要等项目材料，并让材料成为后续 RAG、风险扫描和 Brief 生成的基础。因此本轮优先做一个小闭环：上传材料、解析文本、绑定项目、展示材料清单。

## 完成事项

1. 后端项目材料服务
   - 新增 `backend/app/services/deal_materials.py`。
   - 复用 `document_extract.extract_text` 解析 PDF / Word / Excel / 文本。
   - 上传后创建 `Document`，并把解析正文作为首个 `Chunk` 保存。
   - 写入 `deal.material_uploaded` 事件，payload 包含 `document_id`、文件名、格式、来源类型、文本长度和解析告警。

2. 项目详情与上传 API
   - `GET /api/deals/{deal_id}` 新增 `materials` 字段，返回当前项目材料清单、文本预览和解析元信息。
   - 新增 `POST /api/deals/{deal_id}/materials`，带租户过滤与项目归属校验。
   - 解析依赖缺失返回 503，格式/超限/空文本等用户侧问题返回 400。
   - `Document.deal_id` 增加 ORM 索引声明，并新增 Alembic 迁移 `0005_document_deal_id_index.py`。

3. 前端项目工作台材料区块
   - `frontend/src/lib/types.ts` 新增 `DealMaterial` 类型，并扩展 `DealDetail.materials`。
   - `frontend/src/lib/api.ts` 新增 `uploadDealMaterial`，使用 `FormData` 上传。
   - `frontend/src/pages/WorkspacePage.tsx` 增加“项目材料”区块，支持上传、展示材料列表、解析状态、文本预览和告警。
   - 上传成功后刷新当前项目详情；刷新失败时仍保留本次上传返回的材料行。

4. 测试
   - `backend/tests/test_deals.py` 新增 `project_deal_material` 投影测试，覆盖 Chunk 元信息、文本预览、解析告警和时间字段。

## 验证结果

- `backend`: `.venv\Scripts\python.exe -m pytest tests\test_deals.py tests\test_document_extract.py -q`
  - 结果：通过，`37 passed`。
- `backend`: `.venv\Scripts\python.exe -m compileall app`
  - 结果：通过。
- `frontend`: `npx tsc -b`
  - 结果：通过。
- `backend`: `.venv\Scripts\python.exe -m pytest`
  - 结果：通过，`347 passed`，仅保留既有 JWT 测试密钥长度 warning。
- `frontend`: `npm run build`
  - 结果：通过，TypeScript 与 Vite 生产构建成功。
- `root`: `git diff --check`
  - 结果：通过；仅提示 Windows 下若干已改文件未来可能被 Git 转换为 CRLF。

## 发现的问题

- 当前材料正文只作为单个 `Chunk` 保存，尚未做按页/段落切片、embedding、混合检索或证据引用回填。
- Pre-DD 任务树和 Brief 还没有消费 `documents/chunks`，因此上传材料目前主要完成项目级材料沉淀和展示。
- `documents.deal_id` 仍未加外键约束；本轮先补索引以降低迁移风险，后续可在确认历史数据后补 FK。

## 下一轮建议

1. 将项目材料接入 Pre-DD 任务树：按上传文本识别 14 类材料覆盖情况，刷新完整度和缺口。
2. 增加 Chunk 切片与材料内检索，为项目工作台问答提供私有材料上下文。
3. 让 Pre-DD Brief 引用材料 Chunk，生成可展开的证据来源。
