# 2026-06-24 迭代记录：Pre-DD 手动状态与卡片定向上传

## 本轮目标

简化项目工作台的 Pre-DD 资料区域：不展示资料完整度和资料数量，十四类资料初始均为“待收集”，状态只由用户手动切换，并允许在每张资料卡片上直接上传对应类别的私有材料。

## 完成事项

- 移除 Pre-DD 资料区域顶部的完整度、已收集数量和待收集数量展示。
- 移除 Pre-DD Brief 卡片中的完整度徽标和完整度摘要，避免该区域再次出现资料完整度信息。
- 未经过用户手动操作的十四项资料统一返回 `pending`，不再根据画像字段、公开信息或上传材料自动切换成“已收集”。
- 保留每张卡片的“已收集 / 待收集”分段控制，用户操作继续持久化到 `pre_dd_material_statuses`。
- 每张资料卡新增“上传资料”按钮，并把卡片的 `task_key` 与文件一起提交。
- 后端材料上传接口新增可选 `task_key`：
  - 校验指定类别是否属于十四类 Pre-DD 资料。
  - 用户指定类别优先于系统关键词识别，并作为首个资料命中项返回。
  - 普通“项目材料”上传入口保持原有自动分类逻辑。
- 上传材料后刷新项目详情，使文件立即出现在对应卡片的“已收集材料”列表中；上传不会自动改变卡片状态。

## 验证命令与结果

- `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_deals.py -q`
  - 结果：37 passed。
- `backend\.venv\Scripts\ruff.exe check backend/app/services/pre_dd.py backend/app/services/deal_materials.py backend/app/api/deals.py backend/tests/test_deals.py`
  - 结果：通过。
- `cd frontend && npm run build`
  - 结果：通过。
- `backend\.venv\Scripts\python.exe -m pytest backend/tests -q`
  - 结果：371 passed（12 条既有 JWT 测试密钥长度 warning）。

## 发现的问题

- 当前一个资料卡一次只支持上传一个文件；如需批量上传，可后续为文件选择器增加 `multiple` 并逐个展示进度。
- 上传材料与手动资料状态刻意解耦：即使已上传文件，状态仍由投资人员确认，避免系统替用户宣告资料已收集完成。

## 下一次迭代建议

1. 为资料卡片增加材料删除、下载和预览能力。
2. 支持在资料卡内批量上传并展示单文件进度与失败重试。
3. 将系统捕获的公开信息与机构上传材料分栏展示，并增加来源筛选。
