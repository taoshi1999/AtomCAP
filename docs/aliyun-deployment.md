# AtomCAP 阿里云部署文档

本文档面向准备把 AtomCAP 部署到阿里云 ECS 的开发和运维人员，目标是给出一条可落地、可维护、可逐步扩展的生产部署路线。

当前 AtomCAP 是一套 React + FastAPI + PostgreSQL/pgvector + Redis + LiteLLM 的多 Agent 投研工作台。前端所有 API 请求都使用同源相对路径 `/api/...`，因此生产环境推荐使用 Nginx 统一提供静态前端和反向代理后端 API。

## 1. 技术路线总览

### 推荐生产路线

推荐使用“应用容器在 ECS，状态服务托管在云产品”的路线：

```mermaid
flowchart LR
  User["用户浏览器"] --> DNS["域名 DNS"]
  DNS --> Nginx["ECS Nginx<br/>HTTPS / 静态前端 / /api 反代"]
  Nginx --> Backend["backend 容器<br/>FastAPI + SSE"]
  Backend --> Worker["worker 容器<br/>ARQ/后台任务"]
  Backend --> LiteLLM["LiteLLM 容器<br/>模型网关，可选"]
  Worker --> Redis["阿里云 Redis<br/>或 ECS Redis 容器"]
  Backend --> Redis
  Backend --> RDS["阿里云 RDS PostgreSQL<br/>pgvector"]
  Worker --> RDS
  Backend --> Providers["DeepSeek / DashScope / OpenAI / Bocha / QCC / Tavily"]
  Backend --> Files["ECS 数据盘<br/>generated_files"]
```

这条路线的特点：

- ECS 只运行无状态或半无状态应用容器：`backend`、`worker`、`litellm`、`nginx`。
- PostgreSQL 推荐使用阿里云 RDS PostgreSQL，开启 `pgvector` 扩展。
- Redis 推荐使用阿里云云数据库 Redis；预算有限时可先用容器 Redis。
- 前端构建产物由 Nginx 直接托管，避免再跑一个 Node 服务。
- Nginx 对 `/api/`、SSE、文件下载、上传等请求反向代理到后端。
- `backend/generated_files` 需要持久化到 ECS 数据盘，后续可迁移到 OSS。

### 低成本单机路线

如果是 MVP 验证、小团队内测，可以先采用单台 ECS + Docker Compose：

- PostgreSQL 使用 `pgvector/pgvector:pg16` 容器。
- Redis 使用 `redis:7-alpine` 容器。
- LiteLLM、backend、worker 均使用容器。
- Nginx 安装在 ECS 宿主机上，托管前端并反代后端。

单机路线部署快，但生产风险更高：数据库、缓存、文件和应用同机，扩容、备份和故障隔离都弱。正式生产建议迁移到 RDS/Redis 托管服务。

## 2. 阿里云资源规划

### ECS

建议配置：

| 环境 | ECS 建议 | 说明 |
| --- | --- | --- |
| 内测 / Demo | 2 vCPU / 4 GB RAM / 80 GB ESSD | 可跑 backend、worker、LiteLLM、Nginx；数据库建议仍用 RDS |
| 小规模生产 | 4 vCPU / 8 GB RAM / 100-200 GB ESSD | 支持多人并发、文件生成、材料解析 |
| 中等规模生产 | 8 vCPU / 16 GB RAM 以上 | 建议再拆分 worker、应用和文件存储 |

系统建议：

- Alibaba Cloud Linux 3/4、Ubuntu 22.04 LTS 或 Debian 12。
- 打开自动安全更新。
- 单独挂载一块数据盘到 `/data`，用于 `generated_files`、Nginx 日志、备份中转。

### RDS PostgreSQL

AtomCAP 依赖 PostgreSQL 和 `pgvector`。

建议：

- RDS PostgreSQL 14 或更高版本。
- 确认实例支持 `pgvector` 扩展。
- 创建独立数据库：`atomcap`。
- 创建独立账号：`atomcap_app`。
- 仅允许 ECS 所在 VPC/安全组访问 RDS，不开放公网。

初始化 SQL：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE DATABASE atomcap;
```

如果 RDS 不允许普通账号创建扩展，需要使用高权限账号先执行 `CREATE EXTENSION`。

### Redis

Redis 用于缓存、队列和部分 Agent 运行状态。

建议：

- 生产使用阿里云云数据库 Redis。
- Redis 不需要公网访问。
- `REDIS_URL` 使用内网地址。
- 如果使用密码，格式为：

```text
redis://:PASSWORD@redis-internal-host:6379/0
```

### 域名和 HTTPS

建议：

- 使用阿里云 DNS 解析域名到 ECS 公网 IP。
- Nginx 负责 TLS 终止。
- 证书可以选择：
  - 阿里云 SSL 证书服务，下载 Nginx 格式证书后上传到 ECS。
  - Let's Encrypt + Certbot 自动签发和续期。

### 安全组

公网入方向只开放：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| 80/tcp | `0.0.0.0/0` | HTTP，主要用于跳转 HTTPS 或证书签发 |
| 443/tcp | `0.0.0.0/0` | HTTPS |
| 22/tcp | 管理员固定 IP | SSH 运维 |

不要对公网开放：

- `8000` backend
- `4000` LiteLLM
- `5432` PostgreSQL
- `6379` Redis

如果使用托管 RDS/Redis，数据库安全组或白名单只允许 ECS 内网访问。

## 3. 服务器基础准备

以下命令以 Ubuntu 22.04 为例，Alibaba Cloud Linux 可按阿里云 Docker 安装文档替换包管理命令。

### 3.1 创建部署用户

```bash
adduser atomcap
usermod -aG sudo atomcap
su - atomcap
```

### 3.2 安装基础工具

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg lsb-release ufw nginx
```

### 3.3 安装 Docker 和 Compose

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker atomcap
newgrp docker

docker version
docker compose version
```

### 3.4 准备目录

```bash
sudo mkdir -p /opt/atomcap
sudo mkdir -p /data/atomcap/generated_files
sudo mkdir -p /data/atomcap/nginx/logs
sudo chown -R atomcap:atomcap /opt/atomcap /data/atomcap
```

## 4. 拉取代码和准备环境变量

```bash
cd /opt/atomcap
git clone <你的 Git 仓库地址> app
cd app
cp .env.example .env.production
```

编辑 `.env.production`：

```bash
nano .env.production
```

生产环境至少需要调整：

```dotenv
# PostgreSQL：推荐 RDS 内网地址
DATABASE_URL=postgresql+asyncpg://atomcap_app:CHANGE_ME@rds-internal-host:5432/atomcap

# Redis：推荐云 Redis 内网地址
REDIS_URL=redis://:CHANGE_ME@redis-internal-host:6379/0

# 生产必须关闭开发回退
AUTH_DEV_FALLBACK=false

# 使用强随机值，至少 32 字节以上
JWT_SECRET=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Agent 生成文件目录，容器内路径
GENERATED_FILES_DIR=/srv/generated_files

# LLM 路由
LLM_PROVIDER=auto
LLM_REQUEST_TIMEOUT_SECONDS=120
LLM_CONNECT_TIMEOUT_SECONDS=10

# 推荐优先使用 DashScope 或 DeepSeek
DASHSCOPE_API_KEY=...
DEEPSEEK_API_KEY=...

# 如果要用 OpenAI ASR 做会议录音转写
OPENAI_API_KEY=...
OPENAI_ASR_MODEL=whisper-1

# 外部数据源
BOCHA_API_KEY=...
QCC_APP_KEY=...
QCC_SECRET_KEY=...
TAVILY_API_KEY=...

# LiteLLM 网关
LITELLM_MASTER_KEY=replace-with-a-long-random-litellm-key
LITELLM_BASE_URL=http://litellm:4000
```

生成随机密钥示例：

```bash
openssl rand -hex 32
```

## 5. 生产 Docker Compose

建议在服务器创建一个独立的生产 compose 文件，不直接改开发用 `docker-compose.yml`。

创建 `docker-compose.prod.yml`：

```yaml
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-v1.72.0
    command: ["--config", "/app/config.yaml", "--port", "4000"]
    env_file:
      - .env.production
    volumes:
      - ./litellm/config.yaml:/app/config.yaml:ro
    restart: unless-stopped
    networks:
      - atomcap

  backend:
    build: ./backend
    env_file:
      - .env.production
    volumes:
      - /data/atomcap/generated_files:/srv/generated_files
    depends_on:
      - litellm
    restart: unless-stopped
    networks:
      - atomcap
    ports:
      - "127.0.0.1:8000:8000"

  worker:
    build: ./backend
    command: ["arq", "worker.main.WorkerSettings"]
    env_file:
      - .env.production
    volumes:
      - /data/atomcap/generated_files:/srv/generated_files
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - atomcap

networks:
  atomcap:
    driver: bridge
```

说明：

- `backend` 只绑定到 `127.0.0.1:8000`，由 Nginx 反代，公网无法直接访问。
- `generated_files` 持久化到 ECS 数据盘。
- 如果不使用 LiteLLM，而是后端直连 DeepSeek/OpenAI，也可以暂时保留 LiteLLM 容器不用；当前配置会在 direct key 不可用时回退到 LiteLLM。

如果走低成本单机路线，把 PostgreSQL/Redis 也加进 compose：

```yaml
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: atomcap
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: atomcap
    volumes:
      - /data/atomcap/postgres:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - atomcap

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - /data/atomcap/redis:/data
    restart: unless-stopped
    networks:
      - atomcap
```

并把 `.env.production` 改成：

```dotenv
DATABASE_URL=postgresql+asyncpg://atomcap:change-me@postgres:5432/atomcap
REDIS_URL=redis://redis:6379/0
```

## 6. 初始化数据库

### 6.1 启动应用容器

```bash
cd /opt/atomcap/app
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

### 6.2 执行迁移

生产以 Alembic 迁移为准：

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

当前 `backend/app/main.py` 启动时也会尝试：

- `CREATE EXTENSION IF NOT EXISTS vector`
- `Base.metadata.create_all`

这用于开发和首次启用功能时兜底。生产环境仍应显式执行 Alembic，并在 RDS 上预先确认 `pgvector` 扩展可用。

### 6.3 检查后端

```bash
curl -sS http://127.0.0.1:8000/api/home
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

如果 `AUTH_DEV_FALLBACK=false`，未登录访问 `/api/home` 返回 401 是正常的。

## 7. 构建和发布前端

AtomCAP 前端请求全部使用相对路径 `/api/...`，因此前端构建不需要配置 API 域名，只要 Nginx 同源反代即可。

在服务器上构建：

```bash
cd /opt/atomcap/app/frontend
npm ci
npm run build

sudo mkdir -p /var/www/atomcap
sudo rsync -a --delete dist/ /var/www/atomcap/
sudo chown -R www-data:www-data /var/www/atomcap
```

如果服务器不安装 Node，也可以在 CI/CD 或本地构建后上传 `frontend/dist` 到 `/var/www/atomcap`。

## 8. Nginx 配置

创建 `/etc/nginx/sites-available/atomcap.conf`：

```nginx
server {
    listen 80;
    server_name atomcap.example.com;

    # 如果暂未配置 HTTPS，可先使用 HTTP；配置证书后改成跳转 HTTPS。
    root /var/www/atomcap;
    index index.html;

    client_max_body_size 100m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / ReAct 流式输出关键配置
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/atomcap.conf /etc/nginx/sites-enabled/atomcap.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 8.1 HTTPS 配置

使用阿里云 SSL 证书：

1. 在阿里云 SSL 证书控制台申请或上传证书。
2. 下载 Nginx 格式证书。
3. 上传到 ECS，例如：

```bash
sudo mkdir -p /etc/nginx/ssl/atomcap
sudo cp atomcap.example.com.pem /etc/nginx/ssl/atomcap/fullchain.pem
sudo cp atomcap.example.com.key /etc/nginx/ssl/atomcap/privkey.key
sudo chmod 600 /etc/nginx/ssl/atomcap/privkey.key
```

修改 Nginx：

```nginx
server {
    listen 80;
    server_name atomcap.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name atomcap.example.com;

    ssl_certificate /etc/nginx/ssl/atomcap/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/atomcap/privkey.key;

    root /var/www/atomcap;
    index index.html;
    client_max_body_size 100m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

重新加载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 首次上线检查

### 9.1 容器检查

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml logs --tail=100 worker
docker compose -f docker-compose.prod.yml logs --tail=100 litellm
```

### 9.2 API 检查

```bash
curl -i https://atomcap.example.com/api/models
curl -i https://atomcap.example.com/api/home
```

`/api/home` 未登录返回 401 正常；如果返回 502，检查 Nginx 反代和 backend 容器。

### 9.3 前端检查

浏览器访问：

```text
https://atomcap.example.com
```

检查：

- 注册机构和首个用户。
- 登录后首页可进入。
- 新建对话可收到 SSE 流式响应。
- 项目库可打开。
- 上传材料和生成文件可下载。
- 项目库批量勾选后可导出 Excel。
- Pre-DD Report 可导出 Word。

## 10. 发布流程

建议每次发布使用以下流程：

```bash
cd /opt/atomcap/app
git fetch --all
git checkout <目标分支>
git pull

# 后端镜像
docker compose -f docker-compose.prod.yml build backend worker
docker compose -f docker-compose.prod.yml up -d backend worker litellm

# 数据库迁移
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 前端
cd frontend
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/atomcap/
sudo systemctl reload nginx

# 验证
cd /opt/atomcap/app
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### 回滚

```bash
cd /opt/atomcap/app
git checkout <上一个稳定 commit>
docker compose -f docker-compose.prod.yml up -d --build backend worker

cd frontend
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/atomcap/
sudo systemctl reload nginx
```

注意：数据库迁移如果包含不可逆 schema 变更，代码回滚不等于数据库回滚。生产发布前应做好 RDS 快照。

## 11. 备份和恢复

### RDS

推荐使用阿里云 RDS 自动备份和快照策略：

- 每日自动备份。
- 发布前手动快照。
- 保留周期按机构合规要求设置。

手动逻辑备份：

```bash
pg_dump "$DATABASE_URL" > atomcap-$(date +%F).sql
```

如果使用 asyncpg URL，`pg_dump` 需要换成标准 libpq URL：

```text
postgresql://atomcap_app:PASSWORD@host:5432/atomcap
```

### generated_files

文件生成、会议录音和导出文件默认在：

```text
/data/atomcap/generated_files
```

建议每日同步到 OSS：

```bash
# 示例：使用 ossutil，需先配置 AK
ossutil64 cp -r /data/atomcap/generated_files oss://your-bucket/atomcap/generated_files --update
```

### 配置备份

需要备份：

- `/opt/atomcap/app/.env.production`
- `/etc/nginx/sites-available/atomcap.conf`
- `/etc/nginx/ssl/atomcap/`
- `docker-compose.prod.yml`

密钥文件不能提交 Git。

## 12. 安全加固清单

上线前必须完成：

- `AUTH_DEV_FALLBACK=false`。
- `JWT_SECRET` 和 `LITELLM_MASTER_KEY` 使用强随机值。
- 安全组只开放 80/443，SSH 只允许管理员固定 IP。
- 不开放 8000/4000/5432/6379 到公网。
- RDS/Redis 仅允许 ECS 内网访问。
- Nginx 开启 HTTPS。
- `.env.production` 权限限制：

```bash
chmod 600 /opt/atomcap/app/.env.production
```

- 定期轮换第三方 API Key。
- 生产日志避免输出用户上传材料全文和密钥。
- 对上传材料容量设置 Nginx `client_max_body_size` 和后端业务限制。

## 13. 运维常用命令

查看状态：

```bash
docker compose -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f litellm
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

重启：

```bash
docker compose -f docker-compose.prod.yml restart backend worker
sudo systemctl reload nginx
```

进入后端容器：

```bash
docker compose -f docker-compose.prod.yml exec backend bash
```

检查环境变量是否生效：

```bash
docker compose -f docker-compose.prod.yml exec backend python - <<'PY'
from app.config import settings
print(settings.auth_dev_fallback)
print(settings.database_url.split('@')[-1])
print(settings.generated_files_dir)
PY
```

## 14. 常见问题

### 14.1 前端白屏

检查：

- `/var/www/atomcap/index.html` 是否存在。
- `npm run build` 是否成功。
- Nginx `try_files $uri $uri/ /index.html;` 是否配置。
- 浏览器控制台是否有 JS 加载 404。

### 14.2 API 502

检查：

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:8000/api/models
sudo nginx -t
```

常见原因：

- backend 容器未启动。
- backend 没绑定到 `127.0.0.1:8000`。
- Nginx `proxy_pass` 写错。
- 数据库连接失败导致 backend 反复重启。

### 14.3 SSE/ReAct 流式输出卡住

检查 Nginx：

```nginx
proxy_buffering off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

同时检查 LLM 超时配置：

```dotenv
LLM_REQUEST_TIMEOUT_SECONDS=120
LLM_CONNECT_TIMEOUT_SECONDS=10
```

### 14.4 数据库启动报 vector 扩展错误

处理：

1. 确认 RDS PostgreSQL 版本支持 pgvector。
2. 使用高权限账号执行：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. 再执行：

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 14.5 文件下载 404

检查：

- `GENERATED_FILES_DIR=/srv/generated_files`。
- `backend` 和 `worker` 是否都挂载了 `/data/atomcap/generated_files:/srv/generated_files`。
- 文件 sidecar JSON 是否存在：

```bash
find /data/atomcap/generated_files -maxdepth 2 -type f | head
```

### 14.6 上传材料或会议录音失败

检查：

- Nginx `client_max_body_size`。
- ECS 数据盘容量。
- backend 日志。
- 浏览器请求是否携带登录 token。

## 15. 后续演进建议

当用户量或数据量增长后，建议逐步演进：

1. 把 `backend` 和 `worker` 拆到不同 ECS 或 ACK。
2. 把生成文件和会议录音迁移到 OSS，数据库只保留 file key 和元数据。
3. 使用 ALB/SLB 承接公网流量，ECS 只开放内网。
4. 用 ACK 或 EDAS 管理容器发布和滚动升级。
5. 接入云监控、SLS 日志服务和告警。
6. 为 RDS 开启更严格备份、审计和慢查询监控。
7. 把 Langfuse 或等价可观测平台独立部署，避免和主业务抢资源。

## 参考资料

- [阿里云 ECS 安全组使用说明](https://www.alibabacloud.com/help/en/ecs/user-guide/start-using-security-groups)
- [阿里云 ECS 安全组最佳实践和常见场景](https://www.alibabacloud.com/help/en/ecs/user-guide/security-groups-for-different-use-cases)
- [阿里云 ECS 安装和使用 Docker / Docker Compose](https://www.alibabacloud.com/help/en/ecs/user-guide/install-and-use-docker)
- [阿里云 SSL 证书安装到 Nginx/Tengine](https://www.alibabacloud.com/help/en/ssl-certificate/install-ssl-certificates-on-nginx-servers-or-tengine-servers)
- [阿里云 SSL 证书下载说明](https://www.alibabacloud.com/help/en/ssl-certificate/download-an-ssl-certificate)
- [阿里云 RDS PostgreSQL pgvector 使用指南](https://www.alibabacloud.com/help/en/rds/apsaradb-rds-for-postgresql/pgvector-use-guide)
