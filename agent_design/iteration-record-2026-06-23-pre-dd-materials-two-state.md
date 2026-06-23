# 2026-06-23 迭代记录：Pre-DD 资料二态工作区

## 背景

用户要求将项目工作台中的“Pre DD 资料任务树”调整为“Pre DD 资料”，并按 14 项 Pre-DD 材料清单展示每项资料的简介、已收集材料和待收集建议。资料项只保留“已收集 / 待收集”两种人工整理状态，用户可以手动切换。

## 本轮完成

1. 后端 Pre-DD 资料视图扩展
   - `backend/app/services/pre_dd.py`
   - 为 14 项资料补充一句话简介，覆盖 BP、股权结构、组织架构、业务模式、营销模式、盈利模式、财务指标、上下游、竞争、市场、团队、融资估值和未来发展方向。
   - 每项资料新增 `collection_status`、`collected_materials`、`suggestions` 字段。
   - 系统完整度 `status` 继续保留，用于 Brief 和系统判断；人工二态 `collection_status` 只用于工作台分组。
   - 默认只有真实结构化事实或上传材料命中时才进入“已收集”；仅因为存在缺口或待验证问题的资料仍保持“待收集”。

2. 人工状态持久化
   - `backend/app/objects/deal.py`
   - `backend/app/services/deals.py`
   - `backend/app/api/deals.py`
   - 新增 `PreDDMaterialCollectionStatus` 与 `DealProfile.pre_dd_material_statuses`。
   - 新增 `POST /api/deals/{deal_id}/pre-dd/materials/{task_key}/status`，用于手动切换 14 项资料的“已收集 / 待收集”状态。
   - 写入 `deal.pre_dd_material_status_updated` 事件，保留审计轨迹。

3. 前端工作台改版
   - `frontend/src/lib/types.ts`
   - `frontend/src/lib/api.ts`
   - `frontend/src/pages/WorkspacePage.tsx`
   - 区块标题改为“Pre-DD 资料”。
   - 14 项资料按“已收集”和“待收集”分组展示。
   - 每张资料卡固定展示“简介 / 已收集材料 / 待收集建议”三段内容。
   - 每张资料卡提供“已收集 / 待收集”切换按钮，切换后刷新项目详情并重排分组。

4. 测试补充
   - `backend/tests/test_deals.py`
   - 覆盖资料命中进入已收集材料、简介和待收集建议生成、人工状态覆盖、状态持久化与事件记录。

## 验证

- `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_deals.py -q`
  - 结果：36 passed
- `backend\.venv\Scripts\python.exe -m compileall backend/app backend/tests`
  - 结果：通过
- `cd frontend; npm run build`
  - 结果：TypeScript 与 Vite production build 通过

## 发现的问题

- 默认系统 Python 环境缺少 `pydantic_settings`，直接运行 `pytest` 会失败；使用项目自带 `backend/.venv` 可正常执行。
- 当前“已收集材料”只整合 DealProfile 结构化事实与机构上传材料命中；市场信号等公开信息尚未映射回 Pre-DD 资料项。

## 下一轮建议

1. 将项目级“近期市场信号”中可信的公开信息按规则映射到 Pre-DD 14 类资料，作为“系统捕获的公开信息”展示。
2. 为 Pre-DD 资料卡中的机构材料增加点击跳转到对应项目材料片段的链接。
3. 在 Brief 生成逻辑中优先引用 `collected_materials` 的 evidence_id，让 Pre-DD Brief 与资料卡共享同一证据链。
