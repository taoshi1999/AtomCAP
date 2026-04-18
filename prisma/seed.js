const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 0. 清除原有数据，确保重复执行不会产生多次叠加的数据
  await prisma.dashboardTodo.deleteMany()
  await prisma.dashboardChart.deleteMany()
  await prisma.dashboardOverview.deleteMany()
  await prisma.project.deleteMany()
  await prisma.strategy.deleteMany()

  // 1. 总览数据
  await prisma.dashboardOverview.create({
    data: {
      totalProjectCount: 68,
      totalInvestment: 85.6,
      fundCount: 5,
      newProjectCount: 8,
      irrMedian: 18.5,
      dpiDistribution: "12/20",
      avgReturnMultiple: 2.3,
      exitWinRate: 72,
      avgProjectDuration: 156,
      invalidEfficiency: 18,
      approvalPassRate: 35,
      highRiskProjectCount: 6,
      compliancePendingCount: 7,
      todayMeetingCount: 2,
    }
  })

  // 2. 图表数据
  await prisma.dashboardChart.createMany({
    data: [
      {
        trackName: "大模型应用", trackInvestAmount: 30.5, trackRatio: 35,
        stageName: "立项", stageProjectCount: 5, statisticMonth: "1月", quarter: "2024Q1",
        fundIrr: 18.5, industryTopIrr: 25.0, industryAvgIrr: 15.0,
        managerName: "李四", managerProjectCount: 12, managerAvgCycle: 45, managerEfficiencyScore: 95
      },
      {
        trackName: "AI基础设施", trackInvestAmount: 20.0, trackRatio: 25,
        stageName: "投决", stageProjectCount: 2, statisticMonth: "2月", quarter: "2024Q2",
        fundIrr: 19.2, industryTopIrr: 26.0, industryAvgIrr: 16.0,
        managerName: "王五", managerProjectCount: 8, managerAvgCycle: 50, managerEfficiencyScore: 88
      }
    ]
  })

  // 3. 待办事项
  await prisma.dashboardTodo.create({
    data: {
      type: "立项审批",
      title: "智元机器人A轮投资审批",
      projectName: "智元机器人",
      submitter: "张1",
      submitTime: new Date(),
      deadline: new Date("2025-04-30"),
      priority: "紧急",
      operation: "处理"
    }
  })
  // 4. 项目数据测试
  await prisma.project.create({
    data: {
      name: "智元机器人1",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

   await prisma.project.create({
    data: {
      name: "智元机器人2",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

   await prisma.project.create({
    data: {
      name: "智元机器人3",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

   await prisma.project.create({
    data: {
      name: "智元机器人4",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

  await prisma.project.create({
    data: {
      name: "智元机器人5",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

  await prisma.project.create({
    data: {
      name: "智元机器人6",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

  await prisma.project.create({
    data: {
      name: "智元机器人7",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })

  await prisma.project.create({
    data: {
      name: "智元机器人8",
      logo: "智",
      description: "专注于通用人形机器人和具身智能的创新企业",
      stage: "投前期",
      tags: "AI,机器人,A轮",
      round: "A轮",
      managerId: "zhangwei",
      managerName: "张三管理员",
      totalInvestment: 200,
      irr: 20
    }
  })


  // 5. 策略数据测试
  await prisma.strategy.create({
    data: {
      iconName: "Cpu",
      name: "AI基础设施投资策略",
      frameworkName: "赛道研究",
      description: "聚焦AI算力、模型训练、数据服务等基础设施层面的关键环节",
      managerName: "张三",
      projectCount: 5,
      totalInvestment: "5.5亿",
      returnRate: "+28%"
    }
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())