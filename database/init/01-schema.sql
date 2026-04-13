-- =====================================================
-- AtomCAP 数据库初始化脚本
-- =====================================================
-- 数据库：atomcap
-- 用户：atomcap_user
-- 端口：5433 (外部) / 5432 (容器内)
-- 创建时间：2026-04-12
-- =====================================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 用户表
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  image VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
COMMENT ON INDEX idx_users_email IS '邮箱索引，用于快速查找用户';

-- 添加注释
COMMENT ON TABLE users IS '用户表：存储系统用户信息';
COMMENT ON COLUMN users.id IS '用户 ID，自增主键';
COMMENT ON COLUMN users.email IS '用户邮箱，唯一，用于登录';
COMMENT ON COLUMN users.password_hash IS 'bcrypt 加密后的密码';
COMMENT ON COLUMN users.name IS '用户姓名';
COMMENT ON COLUMN users.image IS '用户头像 URL 地址';
COMMENT ON COLUMN users.created_at IS '记录创建时间';
COMMENT ON COLUMN users.updated_at IS '记录更新时间';

-- =====================================================
-- 2. 会话表（NextAuth 用）
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会话表索引
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 添加注释
COMMENT ON TABLE sessions IS '会话表：NextAuth 会话管理';
COMMENT ON COLUMN sessions.id IS '会话 ID，自增主键';
COMMENT ON COLUMN sessions.user_id IS '关联用户 ID，外键';
COMMENT ON COLUMN sessions.token IS '会话 Token，唯一';
COMMENT ON COLUMN sessions.expires_at IS '会话过期时间';
COMMENT ON COLUMN sessions.created_at IS '会话创建时间';

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 示例数据（可选）
-- =====================================================
-- 注意：实际使用时请删除或注释掉以下 INSERT 语句

-- 示例用户 1
-- 邮箱：test@example.com
-- 密码：123456 (加密后)
INSERT INTO users (email, password_hash, name) 
VALUES (
  'test@example.com',
  '$2b$10$wCWQnI2oGtxryZE56MGsj.Cmqa3v3Ebg7W7OIuEySwb6yo1jwRTD2',
  '测试用户'
)
ON CONFLICT (email) DO NOTHING;

-- 示例用户 2
-- 邮箱：1587491654@qq.com
-- 密码：123456 (加密后)
INSERT INTO users (email, password_hash, name) 
VALUES (
  '1587491654@qq.com',
  '$2b$10$yKotCwEqjWWQGIn0dwHGGOguYI6USA9kB3ey1V3IdVn1v9kScxfae',
  '5'
)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 查询示例
-- =====================================================

-- 查看所有表
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 查看用户表结构
-- \d users

-- 查询所有用户
-- SELECT id, email, name, created_at FROM users;

-- 根据邮箱查询用户
-- SELECT id, email, password_hash, name FROM users WHERE email = 'test@example.com';

-- 统计用户数量
-- SELECT COUNT(*) FROM users;

-- =====================================================
-- 清理命令（谨慎使用）
-- =====================================================

-- 清空所有数据（包括自增序列）
-- TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE;

-- 删除单个表
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 删除触发器
-- DROP TRIGGER IF EXISTS update_users_updated_at ON users;
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- =====================================================
-- 完成
-- =====================================================
