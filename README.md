# AtomCAP - PE/VC 投资决策管理系统

AtomCAP 是一个面向 PE/VC 机构的全流程投资决策管理平台，基于 [T3 Stack](https://create.t3.gg/) 构建。平台涵盖投资策略制定、项目管理、假设验证、条款谈判、材料管理及 AI 辅助研究等核心功能模块，帮助投资团队系统化地推进从策略到退出的完整投资决策流程。

## 核心功能

- **策略管理** — 创建和管理投资策略（主题策略/赛道策略），配置假设模板、条款模板和材料库
- **项目管理** — 项目全生命周期管理，涵盖投前、投中、投后及退出阶段
- **假设验证** — 围绕投资假设进行价值点/风险点分析，支持委员会审议和验证跟踪
- **条款管理** — 投资条款的制定、谈判记录和落实情况追踪
- **变更审批** — 统一的变更请求审批工作流，覆盖策略/项目/假设/条款/材料等变更
- **报告生成** — 一键生成阶段性项目进展汇报（Word 文档）

## 技术栈

- **框架** — [Next.js](https://nextjs.org) (App Router)
- **类型安全 API** — [tRPC](https://trpc.io)
- **数据库 ORM** — [Prisma](https://prisma.io) + PostgreSQL
- **认证** — [NextAuth.js](https://next-auth.js.org) (JWT + Credentials)
- **样式** — [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **环境变量校验** — [@t3-oss/env-nextjs](https://env.t3.gg) + Zod

## 项目目录结构

```
AtomCAP/
├── prisma/
│   ├── schema.prisma              # Prisma 数据模型定义（User/Session/Project/Task/Document）
│   └── migrations/                # 数据库迁移文件（版本化 SQL）
├── public/                        # 静态资源（图片等）
├── src/
│   ├── env.mjs                    # 环境变量运行时校验（T3 标准）
│   ├── app/                       # Next.js App Router 页面与 API
│   │   ├── layout.tsx             # 根布局（Providers 包裹）
│   │   ├── page.tsx               # 首页（SPA 主入口，未登录时显示登录组件）
│   │   ├── globals.css            # 全局样式
│   │   ├── register/
│   │   │   └── page.tsx           # 注册页面
│   │   └── api/
│   │       ├── trpc/
│   │       │   └── [trpc]/
│   │       │       └── route.ts   # tRPC HTTP 适配器（动态路由）
│   │       ├── auth/
│   │       │   ├── [...nextauth]/
│   │       │   │   └── route.ts   # NextAuth.js 认证端点
│   │       │   ├── login/
│   │       │   │   └── route.ts   # REST 登录接口
│   │       │   └── register/
│   │       │       └── route.ts   # REST 注册接口
│   │       └── generate-report/
│   │           └── route.ts       # Word 报告生成接口
│   ├── server/                    # 服务端代码（T3 标准）
│   │   ├── auth.ts                # NextAuth 配置 + 密码工具函数
│   │   ├── db.ts                  # Prisma 客户端单例
│   │   └── api/
│   │       ├── trpc.ts            # tRPC 初始化（router/procedure 定义）
│   │       ├── root.ts            # tRPC 根路由（合并所有子路由）
│   │       ├── context.ts         # tRPC 上下文（session + db 注入）
│   │       └── routers/
│   │           ├── auth.ts        # 认证相关 tRPC 路由
│   │           └── project.ts     # 项目相关 tRPC 路由
│   ├── trpc/                      # tRPC 客户端（T3 标准）
│   │   └── react.tsx              # React 客户端 api + TRPCReactProvider
│   ├── components/                # React 组件
│   │   ├── Providers.tsx          # 全局 Provider 组合（Session + tRPC）
│   │   ├── UserStatus.tsx         # 用户登录状态组件
│   │   ├── app-topbar.tsx         # 顶部导航栏
│   │   ├── app-sidebar.tsx        # 侧边栏
│   │   ├── theme-provider.tsx     # 主题切换 Provider
│   │   ├── pages/                 # 页面级业务组件
│   │   │   ├── dashboard.tsx      # 仪表盘
│   │   │   ├── projects-grid.tsx  # 项目列表
│   │   │   ├── project-detail.tsx # 项目详情
│   │   │   ├── project-overview.tsx    # 项目概览
│   │   │   ├── project-materials.tsx   # 项目材料管理
│   │   │   ├── strategies-grid.tsx     # 策略列表
│   │   │   ├── strategy-center.tsx     # 策略中心
│   │   │   ├── strategy-detail.tsx     # 策略详情
│   │   │   ├── strategy-overview.tsx   # 策略概览
│   │   │   ├── strategy-hypotheses.tsx # 策略假设管理
│   │   │   ├── strategy-terms.tsx      # 策略条款管理
│   │   │   ├── hypothesis-checklist.tsx # 假设验证清单
│   │   │   ├── term-sheet.tsx          # 条款清单
│   │   │   ├── workflow.tsx            # 投资工作流
│   │   │   ├── change-requests.tsx     # 变更审批中心
│   │   │   ├── analysis-frameworks.tsx # 分析框架
│   │   │   ├── consultation-center.tsx # 咨询中心
│   │   │   ├── research-center.tsx     # 研究中心
│   │   │   ├── data-analytics.tsx      # 数据分析
│   │   │   ├── login.tsx               # 登录组件（嵌入式）
│   │   │   └── system-settings.tsx     # 系统设置
│   │   └── ui/                    # shadcn/ui 基础组件库
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── table.tsx
│   │       └── ...                # 其余 shadcn/ui 组件
│   ├── hooks/                     # 自定义 React Hooks
│   │   ├── use-mobile.tsx         # 移动端检测
│   │   └── use-toast.ts           # Toast 通知
│   └── lib/                       # 通用工具函数
│       └── utils.ts               # cn() 等工具函数
├── .env                           # 环境变量（不提交到 Git）
├── middleware.ts                  # Next.js 中间件（路由保护）
├── next.config.mjs                # Next.js 配置（含 env 校验）
├── tailwind.config.ts             # Tailwind CSS 配置
├── tsconfig.json                  # TypeScript 配置
├── components.json                # shadcn/ui 配置
├── postcss.config.mjs             # PostCSS 配置
└── package.json                   # 项目依赖与脚本
```

## 数据库模型

```
User ──< Session        用户拥有多个会话
User ──< Project        用户创建多个项目
Project ──< Task        项目包含多个任务
Project ──< Document    项目包含多个文档
```

| 模型 | 表名 | 说明 |
|------|------|------|
| `User` | `users` | 用户账户，存储认证信息（邮箱、密码哈希、头像等） |
| `Session` | `sessions` | 用户会话，关联到 User，支持会话过期管理 |
| `Project` | `projects` | 投资项目，包含名称、状态、行业、阶段、预算等字段 |
| `Task` | `tasks` | 项目任务，关联到 Project，支持状态/优先级/负责人/截止日期 |
| `Document` | `documents` | 项目文档，关联到 Project，记录文件名、格式、分类等 |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接字符串和 NextAuth 密钥

# 执行数据库迁移
npx prisma migrate deploy

# 启动开发服务器
npm run dev
```

## 构建与部署

```bash
# 生产构建（同步数据库 + 编译）
npx prisma db push && next build

# 或直接使用
npm run build

# 启动生产服务
npm run start
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（Turbopack） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run db:migrate` | 执行数据库迁移（`prisma migrate deploy`） |
| `npm run db:migrate:dev` | 开发环境创建迁移（`prisma migrate dev`） |
| `npm run db:generate` | 重新生成 Prisma 客户端 |
| `npm run db:studio` | 启动 Prisma Studio 数据库管理界面 |

## 添加业务逻辑（T3 工作流）

在本项目中新增一个业务功能，遵循 tRPC → Prisma → React 的标准 T3 流程：

1. **定义数据模型**（如涉及新表）
   - 修改 `prisma/schema.prisma`
   - 运行 `npm run db:push` 同步到数据库

2. **编写 tRPC 路由**
   - 在 `src/server/api/routers/` 下新建 `xxx.ts`
   - 使用 `createTRPCRouter` + `publicProcedure` / `protectedProcedure` 定义 procedures
   - 通过 `ctx.db` 访问 Prisma 客户端

3. **注册路由**
   - 在 `src/server/api/root.ts` 中 import 并合并到 `appRouter`

4. **前端调用**
   - 在任意客户端组件中：`import { api } from '@/src/trpc/react'`
   - 使用 `api.xxx.yyy.useQuery()` / `.useMutation()`

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/atomcap` |
| `NEXTAUTH_SECRET` | NextAuth JWT 签名密钥 | 随机字符串 |
| `NEXTAUTH_URL` | 应用 URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_NAME` | 应用名称（可选） | `AtomCAP` |
| `NEXT_PUBLIC_API_URL` | API 地址（可选） | `http://localhost:3000` |
