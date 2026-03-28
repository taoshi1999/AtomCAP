# AtomCAP - PE/VC投资决策管理系统

AtomCAP是一个面向PE/VC机构的投资决策研究与管理系统，提供从策略制定到项目管理的全流程投资决策支持。

## 目录结构

```
├── app/                        # Next.js App Router
│   ├── api/                    # API 路由
│   │   └── generate-report/    # 项目汇报文档生成接口，在工作流的AI智能问答页面，我让用户可以下载他生成的文档，所以用这个接口来生成docx文件。
│   ├── layout.tsx              # 全局布局（字体、主题、Metadata）
│   └── page.tsx                # 主页面（全局状态管理、路由控制）
├── components/
│   ├── pages/                  # 页面级组件
│   │   ├── login.tsx           # 登录页面
│   │   ├── dashboard.tsx       # 数据概览仪表盘
│   │   ├── projects-grid.tsx   # 项目列表页
│   │   ├── project-detail.tsx  # 项目详情页（侧边栏导航）
│   │   ├── strategies-grid.tsx # 策略列表页
│   │   ├── strategy-detail.tsx # 策略详情页
│   │   ├── strategy-overview.tsx    # 策略概览
│   │   ├── strategy-hypotheses.tsx  # 策略假设管理
│   │   ├── strategy-terms.tsx       # 策略条款管理
│   │   ├── hypothesis-checklist.tsx # 项目假设清单
│   │   ├── term-sheet.tsx           # 项目条款清单
│   │   ├── project-materials.tsx    # 项目材料管理
│   │   ├── project-overview.tsx     # 项目概览
│   │   ├── workflow.tsx             # 项目工作流
│   │   ├── change-requests.tsx      # 变更请求审批
│   │   ├── data-analytics.tsx       # 数据分析
│   │   └── system-settings.tsx      # 系统设置
│   ├── app-topbar.tsx          # 顶部导航栏
│   ├── app-sidebar.tsx         # 侧边栏
│   ├── theme-provider.tsx      # 主题提供器
│   └── ui/                     # shadcn/ui 组件库
├── hooks/                      # React Hooks
├── lib/                        # 工具函数
└── public/                     # 静态资源
```

---

## 数据结构

### 1. 策略

**位置**: `components/pages/strategies-grid.tsx`

```typescript
interface Strategy {
  id: string
  name: string                              // 策略名称
  icon: typeof Cpu                          // 图标组件
  iconBg: string                            // 图标背景色
  description: string                       // 策略描述
  projectCount: number                      // 关联项目数
  totalInvest: string                       // 投资总额
  returnRate: string                        // 回报率
  owner: { id: string; name: string; initials: string }  // 负责人
  createdAt: string                         // 创建时间
  frameworkName?: string                    // 分析框架名称
  parentStrategyId?: string                 // 父策略ID
  parentStrategyName?: string               // 父策略名称
}

interface PendingStrategy {
  id: string
  strategy: Omit<Strategy, "id">
  changeId: string                          // 变更单号
  changeName: string                        // 变更名称
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}
```

### 2. 项目

**位置**: `components/pages/projects-grid.tsx`

```typescript
interface Project {
  id: string
  name: string                              // 项目名称
  logo: string                              // Logo（首字母）
  description: string                       // 项目描述
  tags: string[]                            // 标签
  status: string                            // 状态（设立期/存续期）
  statusColor: string
  valuation: string                         // 估值
  round: string                             // 轮次
  owner: { id: string; name: string; initials: string }
  strategyId?: string                       // 关联策略ID
  strategyName?: string
  createdAt: string
}

interface PendingProject {
  id: string
  project: Omit<Project, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
  uploadedFiles?: MockFile[]                // 上传的项目材料
}
```

### 3. 工作流

**位置**: `components/pages/workflow.tsx`

```typescript
interface Phase {
  id: string
  groupLabel: string                        // 阶段组（设立期/存续期）
  name: string                              // 阶段名（阶段1/阶段2...）
  fullLabel: string                         // 完整标签
  assignee: string                          // 负责人
  assigneeAvatar: string
  hypothesesCount: number                   // 假设数量
  termsCount: number                        // 条款数量
  materialsCount: number                    // 材料数量
  status: "completed" | "active" | "upcoming"
  startDate: string
  endDate?: string
  logs: PhaseLog[]                          // 操作日志
}

interface PhaseLog {
  action: string
  date: string
  author: string
}

interface PendingPhase {
  id: string
  projectId: string
  projectName: string
  phase: Omit<Phase, "id">
  changeId: string
  changeName: string
  changeType: "next-setup" | "next-duration" | "enter-duration" | "first-setup"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}
```

### 4. 假设

**位置**: `components/pages/hypothesis-checklist.tsx`

#### 4.1 假设列表项
```typescript
interface HypothesisTableItem {
  id: string
  direction: string                         // 假设方向（一级类目）
  category: string                          // 假设类别（二级类目）
  name: string                              // 假设名称
  owner: string                             // 负责人
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"  // 成立/待验证/不成立
}
```

#### 4.2 项目假设详情
```typescript
interface HypothesisDetail {
  id: string
  title: string
  qaId: string                              // QA编号
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
  creator: PersonInfo
  valuePoints: ValuePoint[]                 // 价值点列表
  riskPoints: RiskPoint[]                   // 风险点列表
  committeeDecision: CommitteeDecision      // 投委决议
  verification: Verification                // 验证情况
  linkedTerms: LinkedTerm[]                 // 关联条款
}

// 价值点
interface ValuePoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

// 风险点
interface RiskPoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

// 投委决议
interface CommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

// 验证跟踪
interface Verification {
  conclusion: string
  status: "confirmed" | "invalidated" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}
```

#### 4.3 策略假设详情
```typescript
interface StrategyHypothesis {
  id: string
  strategyId: string
  direction: string
  category: string
  name: string
  content: string                           // 假设内容描述
  reason: string                            // 假设原因
  relatedMaterials: string[]                // 关联材料ID
  owner: string
  createdAt: string
  updatedAt: string
}
```

### 5. 条款

**位置**: `components/pages/term-sheet.tsx`

#### 5.1 条款列表项
```typescript
interface TermTableItem {
  id: string
  direction: string                         // 条款方向（一级类目）
  category: string                          // 条款类别（二级类目）
  name: string                              // 条款名称
  owner: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
}
```

#### 5.2 项目条款详情
```typescript
interface TermDetail {
  id: string
  title: string
  termId: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
  creator: PersonInfo
  ourDemand: SectionContent                 // 我方诉求
  ourBasis: SectionContent                  // 我方依据
  bilateralConflict: SectionContent         // 双方冲突
  ourBottomLine: SectionContent             // 我方底线
  compromiseSpace: SectionContent           // 妥协空间
  negotiationResult: NegotiationResult      // 谈判结果
  implementationStatus: ImplementationStatus // 落实情况
}

interface SectionContent {
  content: string
  files?: { name: string; size: string; date: string }[]
  linkedHypotheses?: LinkedHypothesis[]
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface NegotiationResult {
  conclusion: string
  status: "agreed" | "partial" | "rejected"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface ImplementationStatus {
  status: "implemented" | "in-progress" | "not-started"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}
```

#### 5.3 策略条款详情
```typescript
interface StrategyTerm {
  id: string
  strategyId: string
  direction: string
  category: string
  name: string
  content: string                           // 条款内容
  recommendation: string                    // 建议
  relatedMaterials: string[]                // 关联材料
  relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
  owner: string
  createdAt: string
  updatedAt: string
}
```

### 6. 材料

**位置**: `components/pages/project-materials.tsx`, `components/pages/strategies-grid.tsx`

```typescript
interface MaterialItem {
  id: string
  name: string
  format: string                            // PDF/DOCX/XLSX/PPTX
  size: string
  description: string
}

interface StrategyMaterial {
  id: string
  strategyId: string
  name: string
  format: string
  size: string
  description: string
  category: "通用材料" | "行业研究" | "竞品分析" | "财务模型"
  owner: string
  createdAt: string
  updatedAt: string
}

interface PendingMaterial {
  id: string
  material: Omit<StrategyMaterial, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}
```

### 7. AI生成建议

**位置**: `components/pages/workflow.tsx`

#### 7.1 假设改进建议
```typescript
interface GeneratedSuggestion {
  id: string
  title: string
  content: string
  linkedTerms: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
  hypotheses: SuggestionHypothesis[]
}

interface SuggestionHypothesis {
  id: string
  direction: string
  category: string
  name: string
  isExisting: boolean                       // 是否已存在（修改/新建）
  valuePoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
  riskPoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
}
```

#### 7.2 条款构建建议
```typescript
interface GeneratedTermSuggestion {
  id: string
  title: string
  content: string
  linkedHypotheses: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
  terms: SuggestionTerm[]
}

interface SuggestionTerm {
  id: string
  direction: string
  category: string
  name: string
  isExisting: boolean
  ourDemand: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  ourBasis: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  bilateralConflict: { content: string }
  ourBottomLine: { content: string }
  compromiseSpace: { content: string }
}
```

#### 7.3 材料补充建议
```typescript
interface GeneratedMaterialSuggestion {
  id: string
  title: string
  content: string
  linkedHypotheses: { id: string; name: string }[]
  linkedTerms: { id: string; name: string }[]
  materials: SuggestionMaterial[]
}
```

#### 7.4 AI调研材料
```typescript
interface GeneratedAiResearchGroup {
  id: string
  title: string
  content: string
  linkedHypotheses: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
  questions: AiResearchQuestion[]
}

interface AiResearchQuestion {
  id: string
  question: string
  answer: string
  sources: string[]
  isExpanded: boolean
}
```

### 8. 变更请求

**位置**: `components/pages/workflow.tsx`

#### 8.1 项目假设变更
```typescript
interface PendingProjectHypothesis {
  id: string
  projectId: string
  projectName: string
  hypothesis: ProjectHypothesisFormData
  materialOptions: { id: string; name: string; format: string; size?: string }[]
  changeId: string
  changeName: string
  changeType: "create"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

interface ProjectHypothesisFormData {
  direction: string
  category: string
  name: string
  valuePoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
  riskPoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
}
```

#### 8.2 投委决议变更
```typescript
interface PendingCommitteeDecision {
  id: string
  projectId: string
  projectName: string
  hypothesisId: string
  hypothesisName: string
  decision: CommitteeDecisionFormData
  changeId: string
  changeName: string
  changeType: "committee-decision"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

interface CommitteeDecisionFormData {
  content: string
  conclusion: "假设成立" | "假设不成立"
  reviewers: { name: string; role: string }[]
}
```

#### 8.3 项目条款变更
```typescript
interface PendingProjectTerm {
  id: string
  projectId: string
  projectName: string
  term: ProjectTermFormData
  materialOptions: { id: string; name: string; format: string; size?: string }[]
  hypothesisOptions: { id: string; name: string }[]
  changeId: string
  changeName: string
  changeType: "create"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

interface ProjectTermFormData {
  direction: string
  category: string
  name: string
  ourDemand: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  ourBasis: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  bilateralConflict: { content: string }
  ourBottomLine: { content: string }
  compromiseSpace: { content: string }
}
```

### 9. 通用类型

```typescript
interface PersonInfo {
  name: string
  role: string
  avatar?: string
}

interface LinkedTerm {
  id: string
  title: string
  status: "approved" | "pending" | "rejected"
}

interface LinkedHypothesis {
  id: string
  title: string
  status: "verified" | "pending" | "risky"
}
```

---

## 页面功能说明

### 登录页 (`login.tsx`)
- 用户名/密码/验证码登录
- 验证码为静态图片展示
- 登录成功后跳转到仪表盘

### 仪表盘 (`dashboard.tsx`)
- 展示关键指标统计
- 项目状态分布图表
- 最近活动列表

### 策略管理 (`strategies-grid.tsx`, `strategy-detail.tsx`)
- 策略列表（支持搜索、卡片展示）
- 策略创建（多步骤向导：基本信息 → 数据来源 → 策略审核）
- 策略详情：概览、假设模板、条款模板、材料管理
- AI一键生成：假设/条款/材料推荐

### 项目管理 (`projects-grid.tsx`, `project-detail.tsx`)
- 项目列表
- 项目创建（关联策略，继承模板）
- 项目详情子页面：
  - 概览：基本信息、阶段进度
  - 假设清单：验证状态、价值点/风险点、投委决议
  - 条款清单：谈判状态、六大板块（我方诉求→落实情况）
  - 材料管理：通用材料、项目专属材料
  - 工作流：阶段管理、AI智能助手

### 工作流 (`workflow.tsx`)
- 阶段卡片管理（设立期/存续期）
- AI功能入口：
  - 假设改进建议
  - 条款构建建议
  - 材料补充建议
  - AI研究助手
  - AI智能问答（支持文档生成）
- 阶段操作日志

### 变更请求 (`change-requests.tsx`)
- 待审批变更列表
- 支持审批/驳回
- 变更类型：策略、项目、阶段、假设、条款、材料、投委决议

---

## 状态管理

主页面 `app/page.tsx` 使用 `useState` 管理全局状态：

| 状态 | 说明 |
|------|------|
| `strategies` | 策略列表 |
| `pendingStrategies` | 待审批策略 |
| `projects` | 项目列表 |
| `pendingProjects` | 待审批项目 |
| `projectPhases` | 项目阶段 (Record<projectId, Phase[]>) |
| `pendingPhases` | 待审批阶段 |
| `strategyHypotheses` | 策略假设模板 (Record<strategyId, StrategyHypothesis[]>) |
| `strategyTerms` | 策略条款模板 (Record<strategyId, StrategyTerm[]>) |
| `strategyMaterials` | 策略材料 (Record<strategyId, StrategyMaterial[]>) |
| `projectHypotheses` | 项目假设列表 (Record<projectId, HypothesisTableItem[]>) |
| `projectHypothesisDetails` | 项目假设详情 (Record<projectId, Record<hypothesisId, HypothesisDetail>>) |
| `projectTerms` | 项目条款列表 (Record<projectId, TermTableItem[]>) |
| `projectTermDetails` | 项目条款详情 (Record<projectId, Record<termId, TermDetail>>) |
| `projectMaterialsMap` | 项目材料 (Record<projectId, StrategyMaterial[]>) |
| `savedProjectSuggestions` | AI生成的假设建议缓存 |
| `savedProjectTermSuggestions` | AI生成的条款建议缓存 |
| `savedProjectMaterialSuggestions` | AI生成的材料建议缓存 |
| `savedProjectAiResearchGroups` | AI研究结果缓存 |

---

## 后端开发指南

### Swagger

1. **认证**
   - `POST /api/auth/login` - 用户登录
   - `POST /api/auth/logout` - 用户登出

2. **策略**
   - `GET /api/strategies` - 获取策略列表
   - `POST /api/strategies` - 创建策略的变更请求
   - `GET /api/strategies/:id` - 获取策略详情
   - `PUT /api/strategies/:id` - 创建更新策略的变更请求
   - `GET /api/strategies/:id/hypotheses` - 获取策略假设模板
   - `GET /api/strategies/:id/terms` - 获取策略条款模板
   - `GET /api/strategies/:id/materials` - 获取策略材料

3. **项目**
   - `GET /api/projects` - 获取项目列表
   - `POST /api/projects` - 创建项目的变更请求
   - `GET /api/projects/:id` - 获取项目详情
   - `GET /api/projects/:id/phases` - 获取项目阶段
   - `GET /api/projects/:id/hypotheses` - 获取项目假设
   - `GET /api/projects/:id/terms` - 获取项目条款
   - `GET /api/projects/:id/materials` - 获取项目材料

4. **变更请求**
   - `GET /api/change-requests` - 获取变更请求列表
   - `POST /api/change-requests/:id/approve` - 审批通过
   - `POST /api/change-requests/:id/reject` - 驳回

5. **AI功能**
   - `POST /api/ai/hypotheses/suggest` - 生成假设建议
   - `POST /api/ai/terms/suggest` - 生成条款建议
   - `POST /api/ai/materials/suggest` - 生成材料收集建议
   - `POST /api/ai/research` - AI调研材料
   - `POST /api/ai/chat` - AI智能问答

### 数据库设计

- MySQL
- 主要表：users, strategies, projects, phases, hypotheses, terms, materials, change_requests
- 评论使用单独表或JSONB字段

---

## 技术栈

- **前端框架**: React + TypeScript + Tailwind CSS
- **后端框架**: 按照后端同学比较熟悉的技术栈，暂定Django + Python + Mybatis
- multirepo架构，前后端分离开发，两个仓库，前端项目名：**AtomCAP**，后端项目名**AtomCAP-server**

