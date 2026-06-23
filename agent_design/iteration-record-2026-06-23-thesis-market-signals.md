# 2026-06-23 迭代记录：赛道详情近期市场信号重构

## 本轮目标

将赛道详情页的“近期市场信号”按项目工作台相同逻辑重构：支持五类信息分类、自动首次收集、手动再次收集，并确保每条信号通过 evidence item 跳转到对应网页或材料来源，而不是触发关键词搜索。

## 完成事项

- 后端新增赛道市场信号收集服务，按财经新闻、工商信息、专利信息、学术论文、人事变动五类生成赛道级检索关键词。
- 新增 `POST /api/deliverables/{deliverable_id}/market-signals/collect`，收集结果写回 Thesis `recent_signals`，并保存来源到 `evidence_items`。
- Thesis `MarketSignal` 新增可选 `category` 字段，兼容历史无分类信号。
- 前端赛道详情“近期市场信号”支持五类筛选、自动首次收集和“再次收集”按钮。
- 前端继续使用 evidence target 跳转真实网页或项目材料；缺失来源时仅展示证据说明，不把关键词搜索伪装成证据。
- 补充后端单元测试，覆盖赛道五类关键词生成和收集后证据落库/回写 Thesis payload。

## 验证命令与结果

- 通过：`cd backend && .venv\Scripts\python.exe -m pytest tests/test_collect_signals.py tests/test_deals.py -q`，50 passed。
- 通过：`cd backend && .venv\Scripts\python.exe -m compileall app`。
- 通过：`cd frontend && npm run build`。
- 通过：`git diff --check`，仅输出既有 Windows 换行提示。

## 发现的问题

- 赛道级“工商信息”不是单一公司工商查询，当前实现采用公开信号检索“代表公司/企业工商”等关键词；后续如果接入结构化公司实体抽取，可进一步精准调用工商 connector。
- 当前“再次收集”会用最新收集结果覆盖 `recent_signals`，适合 MVP 保持视图干净；后续如需保留历史，可增加 collected batch 和增量合并策略。

## 下一轮建议

- 将赛道详情和项目工作台的市场信号分类标签、按钮和空状态抽成共享前端组件，减少 UI 分叉。
- 为市场信号收集增加来源质量评分或去噪规则，过滤明显无关的泛新闻。
- 在信号列表中展示来源 connector 与采集时间，辅助用户判断新鲜度和可信度。
