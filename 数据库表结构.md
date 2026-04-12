# 📊 数据库表结构总结

## ✅ 已创建的表

### 1. **users** - 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 用户 ID（自增） |
| `email` | VARCHAR(255) | 邮箱（唯一） |
| `password_hash` | VARCHAR(255) | 加密密码 |
| `name` | VARCHAR(255) | 姓名 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**当前数据**: 2 条记录
- test@example.com (测试用户)
- 1587491654@qq.com (5)

---

### 2. **sessions** - 会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 会话 ID（自增） |
| `user_id` | INTEGER | 用户 ID（外键） |
| `token` | VARCHAR(255) | 会话 Token（唯一） |
| `expires_at` | TIMESTAMP | 过期时间 |
| `created_at` | TIMESTAMP | 创建时间 |

**当前数据**: 0 条记录

---

## 🔗 表关系

```
users (1) ──< (N) sessions
```

- 一个用户可以有多个会话
- 删除用户时自动删除相关会话 (CASCADE)

---

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | 完整数据库文档 |
| [database/init/01-schema.sql](database/init/01-schema.sql) | SQL 建表脚本 |
| [init-db.sql](init-db.sql) | 简化版初始化脚本 |

---

## 🔧 快速查询

```sql
-- 查看所有用户
SELECT id, email, name FROM users;

-- 查看表结构
\d users
\d sessions

-- 统计记录数
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM sessions;
```

---

## 🚀 数据库信息

- **主机**: localhost
- **端口**: 5433
- **数据库**: atomcap
- **用户**: atomcap_user
- **密码**: atomcap_password_2024

---

## 📝 加密说明

- **算法**: bcrypt
- **强度**: 10 rounds
- **示例**: 
  - 明文：`123456`
  - 加密：`$2b$10$wCWQnI2oGtx...`
