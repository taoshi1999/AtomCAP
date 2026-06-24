# 2026-06-24 迭代记录：Pre-DD Breif 独立区域与版本查看

## 本轮目标

将项目工作台中的资料管理和分析输出分离：`Pre-DD 资料`仅保留资料卡片，新增独立的 `Pre-DD Breif` 区域，根据当前资料生成分析结果，并允许查看多次生成的历史版本。

## 完成事项

- `Pre-DD 资料`区域移除待验证问题和风险扫描队列，只保留已收集/待收集资料卡片。
- 在其下新增独立的 `Pre-DD Breif` 区域：
  - 提供“生成 Pre-DD Breif”按钮。
  - 首次进入自动加载历史版本。
  - 生成新版本后自动选中新版本。
  - 历史版本以可点击标签展示，并且一次只展示当前选中的一份 Breif。
  - 版本标签包含版本序号和生成时间。
- 项目工作台移除重复模块：
  - 投资亮点。
  - 信息缺口 / 待验证问题。
  - 推荐下一步。
  - 材料事实。
- 修正 Breif 生成数据链：
  - 生成接口读取当前项目材料库。
  - 汇总材料的 `pre_dd_task_hits` 后再构建 Pre-DD 工作区。
  - 上传材料对应的证据与摘要会进入新生成 Breif 的 checklist。
- 保留“初步风险”独立模块，便于用户在未生成 Breif 时仍能快速查看项目风险。

## 验证命令与结果

- `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_deals.py -q`
  - 结果：38 passed。
- `backend\.venv\Scripts\ruff.exe check backend/app/api/deals.py backend/app/services/deal_materials.py backend/app/services/pre_dd.py backend/tests/test_deals.py`
  - 结果：通过。
- `cd frontend && npm run build`
  - 结果：通过。
- `backend\.venv\Scripts\python.exe -m pytest backend/tests -q`
  - 结果：372 passed（12 条既有 JWT 测试密钥长度 warning）。

## 发现的问题

- 当前版本序号根据最近返回的历史列表计算；若未来支持删除中间版本，应改为后端持久化版本号。
- Breif 目前为确定性结构化整理，不调用完整 Pre-DD Agent；后续可以在保持版本模型不变的前提下升级分析深度。

## 下一次迭代建议

1. 为版本增加用户备注和生成时的资料快照摘要。
2. 支持比较两个 Breif 版本之间新增、删除和变化的结论。
3. 将 Breif 生成升级为异步任务，并展示生成进度。
