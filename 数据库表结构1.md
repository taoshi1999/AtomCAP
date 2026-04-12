# AtomCAP 数据库表结构文档

## 📊 数据库概览

**数据库名称**: `atomcap`  
**数据库用户**: `atomcap_user`  
**端口**: `5433` (外部) / `5432` (容器内)

---

## 📋 表列表

| 表名 | 说明 | 记录数 |
|------|------|--------|
| `users` | 用户表 | 2 |
| `sessions` | 会话表（NextAuth 用） | 0 |

---

## 🔍 表结构详情

### 1️⃣ **users** - 用户表

**用途**: 存储系统用户信息

| 字段名 | 数据类型 | 约束 | 说明 | 示例 |
|--------|----------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, AUTO INCREMENT | 用户 ID | 1 |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | 邮箱（登录账号） | test@example.com |
| `password_hash` | VARCHAR(255) | NOT NULL | 加密后的密码 | $2b$10$wCWQnI2oGtx... |
| `name` | VARCHAR(255) | NULL | 用户姓名 | 测试用户 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 | 2026-04-12 09:37:18 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 | 2026-04-12 09:37:18 |

**索引**:
- `users_pkey` - 主键索引 (id)
- `idx_users_email` - 邮箱索引 (email)
- `users_email_key` - 唯一约束 (email)

**外键关系**:
- 被 `sessions.user_id` 引用 (ON DELETE CASCADE)

**示例数据**:
```sql
 id |       email       |                        password_hash                        |   name   |         created_at         |         updated_at
----+-------------------+-------------------------------------------------------------+----------+----------------------------+----------------------------
  1 | test@example.com  | $2b$10$wCWQnI2oGtxryZE56MGsj.Cmqa3v3Ebg7W7OIuEySwb6yo1jwRTD2 | 测试用户  | 2026-04-12 09:37:18.972844 | 2026-04-12 09:37:18.972844
  2 | 1587491654@qq.com | $2b$10$yKotCwEqjWWQGIn0dwHGGOguYI6USA9kB3ey1V3IdVn1v9kScxfae | 5        | 2026-04-12 10:33:37.261299 | 2026-04-12 10:33:37.261299
```

---

### 2️⃣ **sessions** - 会话表

**用途**: NextAuth 会话管理（JWT 模式备用）

| 字段名 | 数据类型 | 约束 | 说明 | 示例 |
|--------|----------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, AUTO INCREMENT | 会话 ID | 1 |
| `user_id` | INTEGER | FOREIGN KEY → users(id) | 用户 ID | 1 |
| `token` | VARCHAR(255) | UNIQUE, NOT NULL | 会话 Token | abc123... |
| `expires_at` | TIMESTAMP | NOT NULL | 过期时间 | 2026-04-19 09:37:18 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 | 2026-04-12 09:37:18 |

**索引**:
- `sessions_pkey` - 主键索引 (id)
- `idx_sessions_token` - Token 索引 (token)
- `idx_sessions_user_id` - 用户 ID 索引 (user_id)
- `sessions_token_key` - 唯一约束 (token)

**外键关系**:
- `user_id` → `users(id)` (ON DELETE CASCADE)

---

## 🔐 密码加密说明

**加密算法**: bcrypt  
**Salt Rounds**: 10  
**示例**:
```
明文密码：123456
加密后：$2b$10$wCWQnI2oGtxryZE56MGsj.Cmqa3v3Ebg7W7OIuEySwb6yo1jwRTD2
```

**加密位置**: `lib/auth.ts`
```typescript
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}
```

---

## 💾 SQL 建表语句

### users 表
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### sessions 表
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
```

---

## 🔗 表关系图

```
┌─────────────────┐
│     users       │
│─────────────────│
│ PK id           │
│    email (UNQ)  │◄───────┐
│    password_hash│        │
│    name         │        │
│    created_at   │        │
│    updated_at   │        │
└────────┬────────┘        │
         │                 │
         │ ON DELETE       │
         │ CASCADE         │
         │                 │
         ▼                 │
┌─────────────────┐        │
│    sessions     │        │
│─────────────────│        │
│ PK id           │        │
│ FK user_id ─────┘        │
│    token (UNQ)  │        │
│    expires_at   │        │
│    created_at   │        │
└─────────────────┘        
```

---

## 📝 常用查询示例

### 1. 查询所有用户
```sql
SELECT id, email, name, created_at FROM users;
```

### 2. 根据邮箱查询用户（登录用）
```sql
SELECT id, email, password_hash, name 
FROM users 
WHERE email = 'test@example.com';
```

### 3. 查询用户的会话
```sql
SELECT s.id, s.token, s.expires_at, u.email 
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE u.email = 'test@example.com';
```

### 4. 删除过期会话
```sql
DELETE FROM sessions WHERE expires_at < NOW();
```

---

## 🚀 数据库连接信息

### 环境变量 (.env)
```env
DATABASE_URL="postgresql://atomcap_user:atomcap_password_2024@localhost:5433/atomcap?schema=public"
```

### Node.js 连接示例
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Docker 访问
```bash
# 进入容器
docker exec -it atomcap-postgres psql -U atomcap_user -d atomcap

# 查看表
\dt

# 查看表结构
\d users

# 查询数据
SELECT * FROM users;
```

---

## 📊 当前数据状态

**最后更新时间**: 2026-04-12 10:33:37

| 表名 | 记录数 | 最后操作 |
|------|--------|----------|
| users | 2 | INSERT |
| sessions | 0 | - |

---

## 🔧 维护命令

### 清空所有数据
```sql
TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE;
```

### 备份数据库
```bash
docker exec atomcap-postgres pg_dump -U atomcap_user atomcap > backup.sql
```

### 恢复数据库
```bash
docker exec -i atomcap-postgres psql -U atomcap_user -d atomcap < backup.sql
```

---

## 📚 相关文档

- [DATABASE_FIX.md](DATABASE_FIX.md) - 数据库连接问题解决
- [NEXTAUTH_SETUP.md](NEXTAUTH_SETUP.md) - NextAuth 配置指南
- [init-db.sql](init-db.sql) - 数据库初始化脚本
