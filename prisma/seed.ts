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
