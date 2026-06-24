# 2026-06-24 迭代记录：大模型生成会话名称

## 本轮目标

会话名称不再直接截取用户发送的第一句话，而是在一轮完整对话结束后，由大模型根据用户和助手的共同内容总结生成。

## 完成事项

- 普通会话创建时不再写入 `title_hint` 或用户首句，初始标题为空。
- 每轮回答完成后读取最近的用户与助手消息，使用 fast 模型生成 6-18 字左右的中文主题标题。
- 标题提示词明确要求抽象概括共同讨论主题，不得直接复制任意一条消息原句。
- 增加标题清洗与守卫：
  - 去除“会话标题”等前缀及引号、句末标点。
  - 标题最长 30 字。
  - 若模型仍完整照抄某条消息，则拒绝该标题并保留旧标题。
  - 模型失败或超时不影响会话主流程。
- 普通文本对话、材料上传分析、赛道生成项目池三条会话入口均接入模型命名。
- 项目工作台会话继续使用“项目工作台 · 项目名”的稳定业务标题。
- 前端流式阶段不再用用户首句临时命名，统一显示“未命名对话”；回答结束刷新首页后显示模型标题。

## 验证结果

- `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_conversation_titles.py backend/tests/test_conversation_list.py backend/tests/test_chat_stream.py backend/tests/test_stream_metadata.py -q`
  - 结果：41 passed。
- `backend\.venv\Scripts\python.exe -m pytest backend/tests -q`
  - 结果：378 passed（12 条既有 JWT 测试密钥长度 warning）。
- `backend\.venv\Scripts\ruff.exe check backend/app/services/conversation_titles.py backend/app/services/conversations.py backend/app/api/conversations.py backend/app/api/deliverables.py backend/tests/test_conversation_titles.py backend/tests/test_conversation_list.py`
  - 结果：通过。
- `cd frontend && npm run build`
  - 结果：通过。

## 后续建议

- 如标题生成调用的延迟需要进一步降低，可改为后台任务并通过会话列表增量刷新标题。
