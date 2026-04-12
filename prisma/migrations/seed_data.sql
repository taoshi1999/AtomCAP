SET client_encoding TO 'UTF8';

INSERT INTO projects (id, code, name, logo, description, tags, status, valuation, round, "ownerId", "ownerName", "strategyId", "strategyName", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PRJ2604100001', '月之暗面', '月', '新一代AI搜索与对话平台', ARRAY['AI', 'A轮'], '投中期', '10亿 USD', 'A轮', 'lisi', '李四', '2', '大模型应用', '2023-09-20', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100002', '智谱AI', '智', '认知大模型技术与应用开发', ARRAY['AI', 'C轮'], '投后期', '15亿 USD', 'C轮', 'wangfang', '王芳', '1', 'AI基础设施', '2023-08-10', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100003', '百川智能', '百', '大语言模型研发与应用', ARRAY['AI', 'B轮'], '投中期', '12亿 USD', 'B轮', 'zhangwei', '张伟', '1', 'AI基础设施', '2023-07-05', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100004', '零一万物', '零', '通用AI助理与多模态模型', ARRAY['AI', 'A轮'], '投前期', '8亿 USD', 'A轮', 'lisi', '李四', '2', '大模型应用', '2023-11-01', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100005', '阶跃星辰', '阶', '多模态大模型与智能体平台', ARRAY['AI', 'Pre-A'], '投前期', '5亿 USD', 'Pre-A', 'zhaoqiang', '赵强', '2', '大模型应用', '2023-12-15', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100006', '深势科技', '深', 'AI for Science，分子模拟与药物设计', ARRAY['AI+科学', 'B轮'], '投后期', '20亿 USD', 'B轮', 'chenzong', '陈总', '4', '生物科技', '2023-06-20', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRJ2604100007', '衬远科技', '衬', 'AI驱动的电商与消费品创新', ARRAY['AI+消费', 'A轮'], '投前期', '6亿 USD', 'A轮', 'wangfang', '王芳', '6', '出海电商', '2024-01-10', CURRENT_TIMESTAMP);
