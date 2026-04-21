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

import { PrismaClient, type Prisma } from '@prisma/client'
import {
  minimaxHypothesisCreateMany,
  minimaxTermCreateMany,
} from './minimax-dual-list.seed-data'

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
        diligenceProgressPct: 58,
        riskLevelLabel: '中',
        overviewNextStepHint:
          '补充数据安全与算力供应链尽调材料，完成核心假设验证闭环后推进投决。',
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
        diligenceProgressPct: 72,
        riskLevelLabel: '低',
        overviewNextStepHint: '跟踪下一轮融资条款与董事会治理安排，完善投后定期复盘。',
      },
      {
        name: 'MiniMax',
        description:
          '通用人工智能科技公司，专注大模型与 AI 原生应用。',
        logo: 'M',
        tags: 'AI,大模型,B轮',
        status: '设立期',
        stage: '投前阶段',
        round: 'B轮',
        industry: '人工智能',
        managerId: 'zhangwei',
        managerName: '张伟',
        totalInvestment: 2.0,
        creatorId: seedUser.id,
        diligenceProgressPct: 45,
        riskLevelLabel: '中高',
        overviewNextStepHint:
          '按假设清单完成团队/财务/市场关键验证，并按条款清单推进清算优先、防稀释与董事会等核心条款谈判。',
      },
    ],
  })

  await seedProjectWorkspaceArtifacts(seedUser.id)
}

/** 将 stage 表上的计数与按 workflow_phase_id 关联的行数对齐（种子与迁移后回填用） */
async function syncProjectWorkflowPhaseCounts(projectId: string) {
  const phases = await prisma.projectWorkflowPhase.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })
  for (const ph of phases) {
    const hypWhere = { projectId, workflowPhaseId: ph.id } as Prisma.ProjectHypothesisWhereInput
    const termWhere = { projectId, workflowPhaseId: ph.id } as Prisma.ProjectTermWhereInput
    const matWhere = { projectId, workflowPhaseId: ph.id } as Prisma.ProjectMaterialWhereInput
    const [hc, tc, mc] = await Promise.all([
      prisma.projectHypothesis.count({ where: hypWhere }),
      prisma.projectTerm.count({ where: termWhere }),
      prisma.projectMaterial.count({ where: matWhere }),
    ])
    await prisma.projectWorkflowPhase.update({
      where: { id: ph.id },
      data: {
        hypothesesCount: hc,
        termsCount: tc,
        materialsCount: mc,
      },
    })
  }
}

/**
 * US-005：为种子项目写入假设清单 / 条款清单（双清单）、材料与工作流阶段。
 * MiniMax 项目写入与《花旗 MiniMax 案例》一致的双清单完整演示数据（见 minimax-dual-list.seed-data.ts）。
 */
async function seedProjectWorkspaceArtifacts(seedUserId: string) {
  const projects = await prisma.project.findMany({
    where: { creatorId: seedUserId },
    orderBy: { name: 'asc' },
  })

  for (const p of projects) {
    await prisma.projectHypothesis.deleteMany({ where: { projectId: p.id } })
    await prisma.projectTerm.deleteMany({ where: { projectId: p.id } })
    await prisma.projectMaterial.deleteMany({ where: { projectId: p.id } })
    await prisma.projectWorkflowPhase.deleteMany({ where: { projectId: p.id } })

    if (p.name === 'MiniMax') {
      await prisma.projectWorkflowPhase.createMany({
        data: [
          {
            projectId: p.id,
            sortOrder: 1,
            groupLabel: '投前期',
            name: '立项',
            fullLabel: '投前期 · 立项',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'completed',
            startDate: new Date('2025-01-06'),
            endDate: new Date('2025-01-28'),
          },
          {
            projectId: p.id,
            sortOrder: 2,
            groupLabel: '投前期',
            name: '尽调执行',
            fullLabel: '投前期 · 尽调执行',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'active',
            startDate: new Date('2025-02-01'),
            endDate: null,
          },
          {
            projectId: p.id,
            sortOrder: 3,
            groupLabel: '投中期',
            name: '协议谈判',
            fullLabel: '投中期 · 协议谈判',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'upcoming',
            startDate: null,
            endDate: null,
          },
          {
            projectId: p.id,
            sortOrder: 4,
            groupLabel: '投中期',
            name: '交割准备',
            fullLabel: '投中期 · 交割与划款准备',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'upcoming',
            startDate: null,
            endDate: null,
          },
          {
            projectId: p.id,
            sortOrder: 5,
            groupLabel: '投后期',
            name: '首次投后',
            fullLabel: '投后期 · 首次投后管理',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'upcoming',
            startDate: null,
            endDate: null,
          },
          {
            projectId: p.id,
            sortOrder: 6,
            groupLabel: '投后期',
            name: '季度跟踪',
            fullLabel: '投后期 · 季度运营跟踪',
            hypothesesCount: 0,
            termsCount: 0,
            materialsCount: 0,
            status: 'upcoming',
            startDate: null,
            endDate: null,
          },
        ],
      })
      const minimaxPhaseRows = await prisma.projectWorkflowPhase.findMany({
        where: { projectId: p.id },
        orderBy: { sortOrder: 'asc' },
      })
      const activeMiniMaxPhaseId = minimaxPhaseRows.find((ph) => ph.status === 'active')?.id
      if (!activeMiniMaxPhaseId) {
        throw new Error('MiniMax seed: 未找到进行中阶段')
      }

      await prisma.projectHypothesis.createMany({
        data: minimaxHypothesisCreateMany(p.id, activeMiniMaxPhaseId) as never,
      })
      await prisma.projectTerm.createMany({
        data: minimaxTermCreateMany(p.id, activeMiniMaxPhaseId) as never,
      })
      const minimaxMaterialRows = [
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: 'MiniMax 招股说明书摘要',
          format: 'PDF',
          size: '2.1MB',
          category: '法务',
          description: '案例公开披露摘要（演示用）',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '假设清单工作底稿',
          format: 'PDF',
          size: '890KB',
          category: '投前',
          description: '双清单之一：假设论证与一致性评价',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '条款谈判备忘录',
          format: 'DOCX',
          size: '420KB',
          category: '法务',
          description: '双清单之二：基准条款与条款细则',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '大模型行业与竞品对标研报',
          format: 'PDF',
          size: '5.6MB',
          category: '行业研究',
          description: '市场规模、竞争格局与可比公司估值区间（演示）',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '管理层访谈纪要（多轮）',
          format: 'DOCX',
          size: '1.1MB',
          category: '投前',
          description: '战略、产品路线与商业化节奏纪要',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '财务模型与估值敏感性分析',
          format: 'XLSX',
          size: '2.8MB',
          category: '财务',
          description: '收入拆分、Burn 与融资情景假设',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '数据合规与跨境架构说明',
          format: 'PDF',
          size: '640KB',
          category: '合规',
          description: '数据权属、内容安全与 ODI 相关要点索引',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '核心技术能力第三方评测摘要',
          format: 'PDF',
          size: '3.2MB',
          category: '技术',
          description: '文本/语音/视频模型能力对标摘录（演示）',
        },
        {
          projectId: p.id,
          workflowPhaseId: activeMiniMaxPhaseId,
          name: '客户与收入抽样尽调底稿',
          format: 'PPTX',
          size: '4.5MB',
          category: '业务',
          description: '重点客户合同、续约与 ARR 抽样（演示）',
        },
      ]
      await prisma.projectMaterial.createMany({
        data: minimaxMaterialRows,
      })
      await syncProjectWorkflowPhaseCounts(p.id)
      continue
    }

    const genericMaterialBase = [
      {
        name: `${p.name} 尽调备忘录`,
        format: 'PDF',
        size: '1.2MB',
        category: '法务',
        description: '种子数据：项目材料',
      },
      {
        name: `${p.name} 财务与业务数据包`,
        format: 'XLSX',
        size: '3.4MB',
        category: '财务',
        description: '种子数据：业务与财务底稿索引',
      },
      {
        name: `${p.name} 行业与竞品速览`,
        format: 'PDF',
        size: '2.0MB',
        category: '行业研究',
        description: '演示：赛道规模与主要玩家一页纸',
      },
      {
        name: `${p.name} 合规与数据清单`,
        format: 'PDF',
        size: '780KB',
        category: '合规',
        description: '演示：尽调问题清单与资料索引',
      },
      {
        name: `${p.name} 投资委员会材料包`,
        format: 'PPTX',
        size: '6.1MB',
        category: '投前',
        description: '演示：投决会汇报主文件（占位）',
      },
    ]

    await prisma.projectWorkflowPhase.createMany({
      data: [
        {
          projectId: p.id,
          sortOrder: 1,
          groupLabel: '投前期',
          name: '立项',
          fullLabel: '投前期 · 立项',
          hypothesesCount: 0,
          termsCount: 0,
          materialsCount: 0,
          status: 'completed',
          startDate: new Date('2025-01-08'),
          endDate: new Date('2025-01-25'),
        },
        {
          projectId: p.id,
          sortOrder: 2,
          groupLabel: '投前期',
          name: '尽调执行',
          fullLabel: '投前期 · 尽调执行',
          hypothesesCount: 0,
          termsCount: 0,
          materialsCount: 0,
          status: 'active',
          startDate: new Date('2025-02-01'),
          endDate: null,
        },
        {
          projectId: p.id,
          sortOrder: 3,
          groupLabel: '投中期',
          name: '协议谈判',
          fullLabel: '投中期 · 协议谈判',
          hypothesesCount: 0,
          termsCount: 0,
          materialsCount: 0,
          status: 'upcoming',
          startDate: null,
          endDate: null,
        },
        {
          projectId: p.id,
          sortOrder: 4,
          groupLabel: '投中期',
          name: '交割准备',
          fullLabel: '投中期 · 交割与划款准备',
          hypothesesCount: 0,
          termsCount: 0,
          materialsCount: 0,
          status: 'upcoming',
          startDate: null,
          endDate: null,
        },
        {
          projectId: p.id,
          sortOrder: 5,
          groupLabel: '投后期',
          name: '首次投后',
          fullLabel: '投后期 · 首次投后管理',
          hypothesesCount: 0,
          termsCount: 0,
          materialsCount: 0,
          status: 'upcoming',
          startDate: null,
          endDate: null,
        },
      ],
    })

    const genericPhaseRows = await prisma.projectWorkflowPhase.findMany({
      where: { projectId: p.id },
      orderBy: { sortOrder: 'asc' },
    })
    const activeGenericPhaseId = genericPhaseRows.find((ph) => ph.status === 'active')?.id
    if (!activeGenericPhaseId) {
      throw new Error(`Generic project seed (${p.name}): 未找到进行中阶段`)
    }

    await prisma.projectHypothesis.createMany({
      data: [
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '市场',
          category: '商业',
          name: '目标细分市场规模与增速可支撑本轮估值',
          body: '需结合行业报告与第三方数据交叉验证；关注竞争格局与渗透率假设。',
          status: 'pending',
          sortOrder: 1,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '技术',
          category: '产品',
          name: '核心模型能力具备可验证的差异化指标',
          body: '以可量化指标（延迟、效果、成本）建立验证计划，并与竞品对标。',
          status: 'pending',
          sortOrder: 2,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '合规',
          category: '数据安全',
          name: '数据与模型合规可满足监管与下游客户要求',
          body: '梳理数据权属、跨境与内容安全要求，形成差距清单与整改路径。',
          status: 'pending',
          sortOrder: 3,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '财务',
          category: '回报',
          name: '单位经济模型与现金流可支撑投资回收期假设',
          body: '拆分收入驱动与成本结构，对关键参数做敏感性分析。',
          status: 'pending',
          sortOrder: 4,
        },
      ] as never,
    })

    await prisma.projectTerm.createMany({
      data: [
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '治理',
          category: '股东权利',
          name: '优先清算权与参与分配机制',
          body: '明确清算事件定义、参与分配顺序及视同转换机制；与律师对齐条款清单。',
          status: 'pending',
          sortOrder: 1,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '经济',
          category: '反稀释',
          name: '完全棘轮 / 加权平均反稀释条款',
          body: '根据后续融资节奏选择加权平均为主、完全棘轮为底线谈判组合。',
          status: 'pending',
          sortOrder: 2,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '治理',
          category: '董事会',
          name: '董事提名权与重大事项否决权范围',
          body: '列示保护性事项清单，争取按里程碑递减否决权范围。',
          status: 'pending',
          sortOrder: 3,
        },
        {
          projectId: p.id,
          workflowPhaseId: activeGenericPhaseId,
          direction: '退出',
          category: '回购',
          name: '回购触发条件、价格与支付方式',
          body: '区分流动性回购与惩罚性回购；约定分期支付与顺延机制。',
          status: 'pending',
          sortOrder: 4,
        },
      ] as never,
    })

    await prisma.projectMaterial.createMany({
      data: genericMaterialBase.map((row) => ({
        projectId: p.id,
        workflowPhaseId: activeGenericPhaseId,
        ...row,
      })),
    })

    await syncProjectWorkflowPhaseCounts(p.id)
  }
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
        description:
          '随着国产AI芯片技术的持续进步，在特定推理场景下，国产芯片的性价比和能效比已接近或达到英伟达方案的水平。',
        direction: '技术攻关',
        category: '算力与芯片',
        owner: '张伟',
        status: 'verified',
        committeeConclusion: '成立',
        committeeContent:
          '经投委会审议，国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，该假设成立。',
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
        title: '开源框架生态决定模型迭代效率上限',
        description:
          'PyTorch / JAX 等开源生态的工具链成熟度与社区活跃度，决定团队迭代模型与工程的效率天花板。',
        direction: '基础设施',
        category: '框架生态',
        owner: '李娜',
        status: 'pending',
      },
      ...(llmStrategy
        ? [
            {
              strategyId: llmStrategy.id,
              title: '大模型在企业客服场景的替代率将达到80%',
              description:
                '随着大模型能力提升，预计在企业客服场景中，大模型的替代率将达到80%。',
              direction: '市场判断',
              category: '应用落地',
              owner: '李四',
              status: 'pending',
            },
          ]
        : []),
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
  console.log('  ✔ Project（含 MiniMax）+ US-005 双清单 workspace')

  await seedStrategies()
  console.log('  ✔ Strategy (×5)')

  await seedHypotheses()
  console.log('  ✔ Hypothesis（策略中心）')

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
