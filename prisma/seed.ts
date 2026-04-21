/**
 * Prisma seed 脚本（T3 Stack 规范）
 *
 * 运行方式：
 *   - 开发环境手动：pnpm db:seed （或 npx prisma db seed）
 *   - 生产部署：build 脚本中已串入 `prisma db seed`，每次部署自动执行
 *
 * 幂等性：
 *   所有写入都使用「清空表 → 批量插入」，或使用 upsert，
 *   保证重复运行不会产生重复数据。
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedDashboardOverview() {
  // 数据看板顶部 4 个核心卡片只用最新一条，直接清空重写
  await prisma.dashboardOverview.deleteMany()
  await prisma.dashboardOverview.create({
    data: {
      totalProjectCount: 128,
      totalInvestment: 52.6, // 亿元
      fundCount: 8,
      newProjectCount: 24,
      irrMedian: 22.5,
      dpiDistribution: '12/20',
      avgReturnMultiple: 2.4,
      exitWinRate: 68,
      avgProjectDuration: 186, // 小时
      invalidEfficiency: 12.5,
      approvalPassRate: 78,
      highRiskProjectCount: 3,
      compliancePendingCount: 7,
      todayMeetingCount: 4,
    },
  })
}

async function seedDashboardCharts() {
  // 图表宽表：清空后批量插入
  await prisma.dashboardChart.deleteMany()

  // 1) 赛道投资分布（饼图）
  const trackRows = [
    { trackName: '硬科技', trackInvestAmount: 18.2, trackRatio: 34.6 },
    { trackName: '新能源', trackInvestAmount: 12.5, trackRatio: 23.8 },
    { trackName: '医疗健康', trackInvestAmount: 9.8, trackRatio: 18.6 },
    { trackName: '企业服务', trackInvestAmount: 6.4, trackRatio: 12.2 },
    { trackName: '消费', trackInvestAmount: 3.5, trackRatio: 6.7 },
    { trackName: '其他', trackInvestAmount: 2.2, trackRatio: 4.1 },
  ]

  // 2) 本年度立项/投决/退出趋势（柱状图）
  const stageMonths = ['1月', '2月', '3月', '4月', '5月', '6月']
  const stageData = [
    { 立项: 6, 投决: 3, 退出: 1 },
    { 立项: 8, 投决: 4, 退出: 2 },
    { 立项: 5, 投决: 2, 退出: 1 },
    { 立项: 9, 投决: 5, 退出: 3 },
    { 立项: 7, 投决: 4, 退出: 2 },
    { 立项: 10, 投决: 6, 退出: 3 },
  ]
  const stageRows = stageMonths.flatMap((month, idx) => ([
    { statisticMonth: month, stageName: '立项', stageProjectCount: stageData[idx]!['立项'] },
    { statisticMonth: month, stageName: '投决', stageProjectCount: stageData[idx]!['投决'] },
    { statisticMonth: month, stageName: '退出', stageProjectCount: stageData[idx]!['退出'] },
  ]))

  // 3) IRR 行业对标（折线图）
  const benchmarkRows = [
    { quarter: '2024Q1', fundIrr: 18.5, industryAvgIrr: 15.2, industryTopIrr: 22.1 },
    { quarter: '2024Q2', fundIrr: 20.1, industryAvgIrr: 16.0, industryTopIrr: 23.5 },
    { quarter: '2024Q3', fundIrr: 21.8, industryAvgIrr: 16.8, industryTopIrr: 24.2 },
    { quarter: '2024Q4', fundIrr: 22.5, industryAvgIrr: 17.3, industryTopIrr: 25.0 },
    { quarter: '2025Q1', fundIrr: 23.2, industryAvgIrr: 17.6, industryTopIrr: 25.8 },
    { quarter: '2025Q2', fundIrr: 24.0, industryAvgIrr: 18.1, industryTopIrr: 26.4 },
  ]

  // 4) 团队效能 TOP5
  const managerRows = [
    { managerName: '张伟', managerProjectCount: 12, managerAvgCycle: 42, managerEfficiencyScore: 95 },
    { managerName: '李娜', managerProjectCount: 10, managerAvgCycle: 48, managerEfficiencyScore: 91 },
    { managerName: '王强', managerProjectCount: 9, managerAvgCycle: 52, managerEfficiencyScore: 88 },
    { managerName: '赵敏', managerProjectCount: 8, managerAvgCycle: 55, managerEfficiencyScore: 85 },
    { managerName: '陈曦', managerProjectCount: 7, managerAvgCycle: 60, managerEfficiencyScore: 82 },
  ]

  await prisma.dashboardChart.createMany({
    data: [
      ...trackRows,
      ...stageRows,
      ...benchmarkRows,
      ...managerRows,
    ],
  })
}

async function seedDashboardTodos() {
  await prisma.dashboardTodo.deleteMany()

  const now = Date.now()
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000)
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000)

  await prisma.dashboardTodo.createMany({
    data: [
      {
        type: '立项审批',
        title: '智芯半导体 A 轮立项审批',
        projectName: '智芯半导体',
        submitter: '张伟',
        submitTime: hoursAgo(5),
        deadline: hours(3),
        priority: 'urgent',
        operation: '处理',
      },
      {
        type: '投决材料预审',
        title: '绿能科技 Pre-A 投决材料预审',
        projectName: '绿能科技',
        submitter: '李娜',
        submitTime: hoursAgo(12),
        deadline: hours(18),
        priority: 'urgent',
        operation: '处理',
      },
      {
        type: '尽调报告审核',
        title: '康健生物尽调报告审核',
        projectName: '康健生物',
        submitter: '王强',
        submitTime: hoursAgo(26),
        deadline: hours(40),
        priority: 'normal',
        operation: '处理',
      },
      {
        type: '条款清单审批',
        title: '云途 SaaS 条款清单审批',
        projectName: '云途 SaaS',
        submitter: '赵敏',
        submitTime: hoursAgo(48),
        deadline: hours(72),
        priority: 'normal',
        operation: '处理',
      },
      {
        type: '合规风险处置',
        title: '星火智能合规风险处置',
        projectName: '星火智能',
        submitter: '陈曦',
        submitTime: hoursAgo(72),
        deadline: hours(120),
        priority: 'low',
        operation: '处理',
      },
    ],
  })
}

/**
 * 项目列表 seed
 *
 * Project 需要 creatorId 指向一个真实 User（外键 + onDelete: Cascade），
 * 所以先 upsert 一个专门的种子账号 `seed@atomcap.local`。
 *
 * 幂等策略：
 *   - 种子用户用 upsert（按 email 唯一约束命中）
 *   - 只删除 `creatorId == seedUser.id` 的项目，避免误删真实数据
 *   - 相关 Task / Document 在 schema 里配置了 onDelete: Cascade，会随之清理
 */
async function seedProjects() {
  const seedUser = await prisma.user.upsert({
    where: { email: 'seed@atomcap.local' },
    update: {},
    create: {
      email: 'seed@atomcap.local',
      name: 'Seed User',
    },
  })

  await prisma.project.deleteMany({ where: { creatorId: seedUser.id } })

  await prisma.project.createMany({
    data: [
      {
        name: '月之暗面',
        description: '新一代 AI 搜索与对话平台，聚焦长上下文与复杂推理能力。',
        logo: '月',
        tags: 'AI,A轮',
        status: '投中期',
        stage: '投中阶段',
        round: 'A轮',
        industry: '人工智能',
        managerId: 'lisi',
        managerName: '李四',
        totalInvestment: 1.2, // 亿元
        creatorId: seedUser.id,
      },
      {
        name: '智谱 AI',
        description: '认知大模型技术与企业级应用开发，国产大模型第一梯队。',
        logo: '智',
        tags: 'AI,C轮',
        status: '投后期',
        stage: '投后阶段',
        round: 'C轮',
        industry: '人工智能',
        managerId: 'wangfang',
        managerName: '王芳',
        totalInvestment: 3.5,
        irr: 28.4,
        creatorId: seedUser.id,
      },
    ],
  })
}

/**
 * 策略列表 seed
 *
 * Strategy 没有外键依赖（不挂到 User 也不挂到 Project），
 * 所以直接 deleteMany + createMany 即可保持幂等。
 *
 * iconName 的取值必须与 /strategies 页里 ICON_MAP 的 key 对齐
 * （CPU / Target / Building / Zap / Leaf / Trending / Briefcase），
 * 否则前端会回退到 Target 图标。
 */
async function seedStrategies() {
  await prisma.strategy.deleteMany()

  await prisma.strategy.createMany({
    data: [
      {
        name: 'AI 基础设施',
        iconName: 'CPU',
        frameworkName: '早期项目筛选框架',
        description: '聚焦 AI 算力、模型训练框架和基础软件生态投资。',
        managerName: '张伟',
        projectCount: 12,
        totalInvestment: '8.5亿',
        returnRate: '+32%',
      },
      {
        name: '大模型应用',
        iconName: 'Target',
        frameworkName: '早期项目筛选框架',
        description: '关注大语言模型的企业级和消费级应用落地场景。',
        managerName: '李四',
        projectCount: 8,
        totalInvestment: '5.2亿',
        returnRate: '+18%',
      },
      {
        name: '企业数字化',
        iconName: 'Building',
        frameworkName: '价值投资评估框架',
        description: '聚焦企业数字化转型、智能化升级和业务流程优化。',
        managerName: '王芳',
        projectCount: 15,
        totalInvestment: '12亿',
        returnRate: '+25%',
      },
      {
        name: '生物科技',
        iconName: 'Zap',
        frameworkName: '早期项目筛选框架',
        description: '布局 AI 制药、基因治疗和精准医疗等前沿领域。',
        managerName: '赵强',
        projectCount: 6,
        totalInvestment: '4.8亿',
        returnRate: '+12%',
      },
      {
        name: '清洁能源',
        iconName: 'Leaf',
        frameworkName: 'ESG 合规审查框架',
        description: '聚焦新能源、储能技术和绿色低碳产业投资。',
        managerName: '李四',
        projectCount: 10,
        totalInvestment: '18亿',
        returnRate: '+28%',
      },
    ],
  })
}

async function seedHypotheses() {
  await prisma.hypothesis.deleteMany()

  const strategies = await prisma.strategy.findMany({ select: { id: true, name: true } })
  const aiStrategy = strategies.find((s) => s.name === 'AI 基础设施')
  const llmStrategy = strategies.find((s) => s.name === '大模型应用')

  if (!aiStrategy) return

  await prisma.hypothesis.createMany({
    data: [
      {
        strategyId: aiStrategy.id,
        title: '国产AI芯片在推理场景下可替代英伟达方案',
        description: '随着国产AI芯片技术的持续进步，在特定推理场景下，国产芯片的性价比和能效比已接近或达到英伟达方案的水平。',
        direction: '技术攻关',
        category: '算力与芯片',
        owner: '张伟',
        status: 'verified',
        committeeConclusion: '成立',
        committeeContent: '经投委会审议，国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，该假设成立。',
        committeeStatus: 'approved',
        committeeCreatorName: '王总',
        committeeCreatorRole: '投委会主席',
        committeeCreatedAt: new Date('2026-02-10'),
        verificationConclusion: '符合预期',
        verificationContent: '投资后6个月跟踪显示，国产芯片在推理场景的性价比持续提升，与预期一致。',
        verificationStatus: 'confirmed',
        verificationCreatorName: '张伟',
        verificationCreatorRole: '投资经理',
        verificationCreatedAt: new Date('2026-03-15'),
      },
      {
        strategyId: aiStrategy.id,
        title: '云端AI芯片市场将在3年内达到500亿美元规模',
        description: '基于大模型训练和推理需求的爆发式增长，预计全球云端AI芯片市场将在2027年达到500亿美元规模。',
        direction: '技术攻关',
        category: '算力与芯片',
        owner: '李四',
        status: 'pending',
      },
      {
        strategyId: aiStrategy.id,
        title: '开源大模型训练框架将成为主流技术路线',
        description: '开源社区在大模型训练框架领域的贡献持续增长，预计将成为主流技术路线。',
        direction: '技术攻关',
        category: '模型训练框架',
        owner: '王五',
        status: 'pending',
      },
      {
        strategyId: aiStrategy.id,
        title: '分布式训练效率提升是大模型竞争关键',
        description: '随着模型规模持续扩大，分布式训练效率将成为大模型竞争的关键因素。',
        direction: '技术攻关',
        category: '模型训练框架',
        owner: '张伟',
        status: 'risky',
        committeeConclusion: '不成立',
        committeeContent: '经投委会审议，分布式训练效率虽重要，但并非唯一关键因素，数据质量和模型架构同样重要，该假设过于绝对。',
        committeeStatus: 'rejected',
        committeeCreatorName: '王总',
        committeeCreatorRole: '投委会主席',
        committeeCreatedAt: new Date('2026-02-20'),
      },
      {
        strategyId: aiStrategy.id,
        title: 'AI编译器将成为新的基础软件投资赛道',
        description: 'AI编译器作为连接硬件和框架的桥梁，将成为新的基础软件投资赛道。',
        direction: '技术攻关',
        category: '基础软件生态',
        owner: '李四',
        status: 'pending',
      },
      {
        strategyId: aiStrategy.id,
        title: 'MLOps平台市场需求将快速增长',
        description: '随着大模型在企业场景的落地，MLOps平台的市场需求将快速增长。',
        direction: '技术攻关',
        category: '基础软件生态',
        owner: '王五',
        status: 'verified',
        committeeConclusion: '成立',
        committeeContent: '经投委会审议，MLOps需求增长趋势明确，多家头部企业已开始采购相关平台，该假设成立。',
        committeeStatus: 'approved',
        committeeCreatorName: '王总',
        committeeCreatorRole: '投委会主席',
        committeeCreatedAt: new Date('2026-01-28'),
        verificationConclusion: '符合预期',
        verificationContent: '投后跟踪显示MLOps平台采购需求持续增长，与预期一致。',
        verificationStatus: 'confirmed',
        verificationCreatorName: '王五',
        verificationCreatorRole: '分析师',
        verificationCreatedAt: new Date('2026-03-20'),
      },
      ...(llmStrategy ? [{
        strategyId: llmStrategy.id,
        title: '大模型在企业客服场景的替代率将达到80%',
        description: '随着大模型能力提升，预计在企业客服场景中，大模型的替代率将达到80%。',
        direction: '市场判断',
        category: '应用落地',
        owner: '李四',
        status: 'pending',
      }] : []),
    ],
  })
}

/**
 * 项目工作流阶段 seed（US-005 项目详情页 - 工作流子页）
 *
 * 为每个种子项目创建工作流阶段数据，包含设立期、投前期、投中期、投后期的完整流程。
 * 幂等策略：按 projectId 删除后重新插入。
 */
async function seedProjectWorkflowPhases() {
  const seedUser = await prisma.user.findUnique({
    where: { email: 'seed@atomcap.local' },
    select: { id: true },
  })
  if (!seedUser) return

  const projects = await prisma.project.findMany({
    where: { creatorId: seedUser.id },
    select: { id: true, name: true, stage: true },
  })

  for (const project of projects) {
    await prisma.projectWorkflowPhase.deleteMany({ where: { projectId: project.id } })
  }

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)

  for (const project of projects) {
    const baseDate = daysAgo(90)
    const isPost = project.stage?.includes('投后')
    const isMid = project.stage?.includes('投中')

    const phases = [
      {
        projectId: project.id,
        sortOrder: 0,
        groupLabel: '设立期',
        name: '项目筹备',
        fullLabel: '设立期 - 项目筹备',
        hypothesesCount: 0,
        termsCount: 0,
        materialsCount: 2,
        status: 'completed',
        startDate: baseDate,
        endDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        sortOrder: 1,
        groupLabel: '投前期',
        name: '立项',
        fullLabel: '投前期 - 立项',
        hypothesesCount: 6,
        termsCount: 3,
        materialsCount: 5,
        status: 'completed',
        startDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 21 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        sortOrder: 2,
        groupLabel: '投前期',
        name: '尽调',
        fullLabel: '投前期 - 尽调',
        hypothesesCount: 12,
        termsCount: 8,
        materialsCount: 15,
        status: 'completed',
        startDate: new Date(baseDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        sortOrder: 3,
        groupLabel: '投中期',
        name: '投决',
        fullLabel: '投中期 - 投决',
        hypothesesCount: 15,
        termsCount: 12,
        materialsCount: 20,
        status: isMid || isPost ? 'completed' : 'active',
        startDate: new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        endDate: isMid || isPost ? new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000) : null,
      },
      ...(isMid || isPost
        ? [
            {
              projectId: project.id,
              sortOrder: 4,
              groupLabel: '投中期',
              name: '交割',
              fullLabel: '投中期 - 交割',
              hypothesesCount: 18,
              termsCount: 15,
              materialsCount: 25,
              status: isPost ? 'completed' : 'active',
              startDate: new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000),
              endDate: isPost ? new Date(baseDate.getTime() + 75 * 24 * 60 * 60 * 1000) : null,
            },
          ]
        : []),
      ...(isPost
        ? [
            {
              projectId: project.id,
              sortOrder: 5,
              groupLabel: '投后期',
              name: '存续管理',
              fullLabel: '投后期 - 存续管理',
              hypothesesCount: 20,
              termsCount: 18,
              materialsCount: 30,
              status: 'active',
              startDate: new Date(baseDate.getTime() + 75 * 24 * 60 * 60 * 1000),
              endDate: null,
            },
          ]
        : []),
    ]

    await prisma.projectWorkflowPhase.createMany({ data: phases as any })
  }
}

/**
 * 项目级假设清单 seed（US-005 项目详情页 - 假设清单子页）
 *
 * 为每个种子项目创建项目级假设数据，继承自策略假设模板。
 * 幂等策略：按 projectId 删除后重新插入。
 */
async function seedProjectHypotheses() {
  const seedUser = await prisma.user.findUnique({
    where: { email: 'seed@atomcap.local' },
    select: { id: true },
  })
  if (!seedUser) return

  const projects = await prisma.project.findMany({
    where: { creatorId: seedUser.id },
    select: { id: true, name: true },
  })

  for (const project of projects) {
    await prisma.projectHypothesis.deleteMany({ where: { projectId: project.id } })
  }

  const hypothesesTemplates = [
    { direction: '技术攻关', category: '算力与芯片', name: '国产AI芯片可满足大模型推理需求', status: 'verified' },
    { direction: '技术攻关', category: '算力与芯片', name: '自研芯片在特定场景有成本优势', status: 'pending' },
    { direction: '市场判断', category: '市场规模', name: '目标市场未来3年复合增长率>30%', status: 'verified' },
    { direction: '市场判断', category: '市场规模', name: '细分赛道天花板足够高（>100亿）', status: 'pending' },
    { direction: '团队评估', category: '核心团队', name: '创始人具备行业头部企业高管背景', status: 'verified' },
    { direction: '团队评估', category: '核心团队', name: '技术团队在大模型领域有深厚积累', status: 'verified' },
    { direction: '商业模式', category: '盈利能力', name: '单位经济模型可在12个月内转正', status: 'pending' },
    { direction: '商业模式', category: '盈利能力', name: '客户续约率可维持在80%以上', status: 'pending' },
    { direction: '竞争格局', category: '竞争优势', name: '相比竞品有2代以上的技术领先优势', status: 'verified' },
    { direction: '竞争格局', category: '竞争优势', name: '核心算法已形成专利壁垒', status: 'pending' },
    { direction: '风险控制', category: '合规风险', name: '数据合规方案已通过法务审核', status: 'verified' },
    { direction: '风险控制', category: '合规风险', name: '算法备案可在投资后6个月内完成', status: 'pending' },
  ]

  for (const project of projects) {
    const hypotheses = hypothesesTemplates.map((h, idx) => ({
      projectId: project.id,
      direction: h.direction,
      category: h.category,
      name: h.name,
      status: h.status,
      sortOrder: idx,
      body: JSON.stringify({
        valuePoints: [
          { id: `vp-${idx}-1`, title: '价值点示例：技术领先性', evidence: { description: '示例证据描述', files: [] }, analysis: { content: '示例分析内容', creator: { name: '张伟', role: '投资经理' }, reviewers: [], createdAt: new Date().toISOString().split('T')[0], comments: [] }, comments: [] },
        ],
        riskPoints: [
          { id: `rp-${idx}-1`, title: '风险点示例：市场竞争加剧', evidence: { description: '示例风险描述', files: [] }, analysis: { content: '示例风险分析', creator: { name: '张伟', role: '投资经理' }, reviewers: [], createdAt: new Date().toISOString().split('T')[0], comments: [] }, comments: [] },
        ],
        committeeDecision: {
          conclusion: h.status === 'verified' ? '假设成立' : h.status === 'risky' ? '假设不成立' : '待审议',
          status: h.status === 'verified' ? 'approved' : h.status === 'risky' ? 'rejected' : 'pending',
          content: '投委会审议意见示例',
          creator: { name: '王总', role: '投委会主席' },
          reviewers: [{ name: '陈总', role: '风控总监' }],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        verification: {
          conclusion: h.status === 'verified' ? '符合预期' : '待验证',
          status: h.status === 'verified' ? 'confirmed' : 'pending',
          content: '验证情况描述示例',
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        linkedTerms: [],
      }),
    }))

    await prisma.projectHypothesis.createMany({ data: hypotheses })
  }
}

/**
 * 项目级条款清单 seed（US-005 项目详情页 - 条款清单子页）
 *
 * 为每个种子项目创建项目级条款数据，涵盖估值、治理、退出等关键条款。
 * 幂等策略：按 projectId 删除后重新插入。
 */
async function seedProjectTerms() {
  const seedUser = await prisma.user.findUnique({
    where: { email: 'seed@atomcap.local' },
    select: { id: true },
  })
  if (!seedUser) return

  const projects = await prisma.project.findMany({
    where: { creatorId: seedUser.id },
    select: { id: true, name: true },
  })

  for (const project of projects) {
    await prisma.projectTerm.deleteMany({ where: { projectId: project.id } })
  }

  const termsTemplates = [
    { direction: '估值条款', category: '投前估值', name: '本轮投前估值10亿美元', status: 'approved' },
    { direction: '估值条款', category: '融资规模', name: '本轮融资规模2亿美元', status: 'approved' },
    { direction: '估值条款', category: '期权池', name: '投后期权池预留15%', status: 'approved' },
    { direction: '治理条款', category: '董事会', name: '投资人享有1个董事会席位', status: 'approved' },
    { direction: '治理条款', category: '保护性条款', name: '重大事项需投资人董事同意', status: 'approved' },
    { direction: '治理条款', category: '信息权', name: '按月提供财务和经营数据', status: 'approved' },
    { direction: '退出条款', category: '优先清算', name: '投资人享有1倍非参与优先清算权', status: 'approved' },
    { direction: '退出条款', category: '共同出售', name: '投资人享有共同出售权', status: 'pending' },
    { direction: '退出条款', category: '反稀释', name: '加权平均反稀释保护', status: 'approved' },
    { direction: '退出条款', category: '回购', name: '5年后公司未上市创始人回购', status: 'rejected' },
    { direction: '限制条款', category: '竞业禁止', name: '创始人5年竞业禁止承诺', status: 'approved' },
    { direction: '限制条款', category: '股份锁定', name: '创始人股份4年成熟期', status: 'approved' },
  ]

  for (const project of projects) {
    const terms = termsTemplates.map((t, idx) => ({
      projectId: project.id,
      direction: t.direction,
      category: t.category,
      name: t.name,
      status: t.status,
      sortOrder: idx,
      body: JSON.stringify({
        ourDemand: {
          content: '我方诉求内容示例',
          files: [{ name: '估值模型.xlsx', size: '1.2MB', date: new Date().toISOString().split('T')[0] }],
          linkedHypotheses: [],
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [{ name: '李娜', role: '高级分析师' }],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        ourBasis: {
          content: '我方依据内容示例',
          files: [],
          linkedHypotheses: [],
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        bilateralConflict: {
          content: '双方分歧点描述',
          creator: { name: '创始人', role: 'CEO' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        ourBottomLine: {
          content: '我方底线描述',
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        compromiseSpace: {
          content: '妥协空间描述',
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        negotiationResult: {
          conclusion: t.status === 'approved' ? '谈判达成' : t.status === 'rejected' ? '谈判否决' : '部分达成',
          status: t.status === 'approved' ? 'agreed' : t.status === 'rejected' ? 'rejected' : 'partial',
          content: '谈判结果详情',
          creator: { name: '王总', role: '合伙人' },
          reviewers: [{ name: '陈总', role: '法务总监' }],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
        implementationStatus: {
          status: t.status === 'approved' ? 'implemented' : 'not-started',
          conclusion: t.status === 'approved' ? '已落实' : '待落实',
          content: '落实情况描述',
          creator: { name: '张伟', role: '投资经理' },
          reviewers: [],
          createdAt: new Date().toISOString().split('T')[0],
          comments: [],
        },
      }),
    }))

    await prisma.projectTerm.createMany({ data: terms })
  }
}

/**
 * 项目材料 seed（US-005 项目详情页 - 项目材料子页）
 *
 * 为每个种子项目创建项目级材料数据，包括BP、财务模型、尽调报告等。
 * 幂等策略：按 projectId 删除后重新插入。
 */
async function seedProjectMaterials() {
  const seedUser = await prisma.user.findUnique({
    where: { email: 'seed@atomcap.local' },
    select: { id: true },
  })
  if (!seedUser) return

  const projects = await prisma.project.findMany({
    where: { creatorId: seedUser.id },
    select: { id: true, name: true },
  })

  for (const project of projects) {
    await prisma.projectMaterial.deleteMany({ where: { projectId: project.id } })
  }

  const materialsTemplates = [
    { name: '商业计划书(BP)', format: 'PDF', size: '12.5 MB', category: '核心材料', description: '项目商业计划书完整版，包含市场分析、产品规划、商业模式、财务预测等内容' },
    { name: '财务预测模型_2024-2028', format: 'XLSX', size: '3.2 MB', category: '财务材料', description: '未来5年财务预测模型，包含收入、成本、利润、现金流等详细测算' },
    { name: '技术架构白皮书', format: 'PDF', size: '8.7 MB', category: '技术材料', description: '核心技术架构详细说明，包括系统架构图、技术栈选型、性能指标等' },
    { name: '竞品分析报告', format: 'PDF', size: '5.4 MB', category: '市场材料', description: '主要竞争对手分析，包括竞品功能对比、市场份额、优劣势评估' },
    { name: '法律尽调报告', format: 'PDF', size: '2.1 MB', category: '法务材料', description: '法务尽调报告，涵盖股权结构、知识产权、合规风险、重大合同等' },
    { name: '财务尽调报告', format: 'PDF', size: '4.8 MB', category: '财务材料', description: '财务尽调报告，包含历史财务数据核实、内控评估、税务合规等' },
    { name: '客户访谈记录汇总', format: 'DOCX', size: '1.6 MB', category: '市场材料', description: 'Top 20客户访谈记录汇总，包含客户画像、需求分析、满意度评估' },
    { name: '核心团队简历', format: 'PDF', size: '6.3 MB', category: '团队材料', description: '创始团队及核心高管简历，包含教育背景、工作经历、项目经验' },
    { name: '投资条款清单(Term Sheet)', format: 'PDF', size: '0.8 MB', category: '交易材料', description: '投资条款清单草案，包含估值、治理、退出等核心条款' },
    { name: '投决会汇报材料', format: 'PPTX', size: '15.2 MB', category: '核心材料', description: '投决会汇报PPT，包含投资逻辑、风险分析、回报预测、投后规划' },
  ]

  for (const project of projects) {
    const materials = materialsTemplates.map((m) => ({
      projectId: project.id,
      name: m.name,
      format: m.format,
      size: m.size,
      category: m.category,
      description: m.description,
    }))

    await prisma.projectMaterial.createMany({ data: materials })
  }
}

async function main() {
  console.log('🌱 Seeding database...')

  await seedDashboardOverview()
  console.log('  ✔ DashboardOverview')

  await seedDashboardCharts()
  console.log('  ✔ DashboardChart')

  await seedDashboardTodos()
  console.log('  ✔ DashboardTodo')

  await seedProjects()
  console.log('  ✔ Project (×2)')

  // US-005: 项目详情五子页关联数据（必须按依赖顺序执行：先阶段，后假设/条款/材料）
  await seedProjectWorkflowPhases()
  console.log('  ✔ ProjectWorkflowPhase')

  await seedProjectHypotheses()
  console.log('  ✔ ProjectHypothesis')

  await seedProjectTerms()
  console.log('  ✔ ProjectTerm')

  await seedProjectMaterials()
  console.log('  ✔ ProjectMaterial')

  await seedStrategies()
  console.log('  ✔ Strategy (×5)')

  await seedHypotheses()
  console.log('  ✔ Hypothesis')

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
