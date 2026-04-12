import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateProjectCode } from "@/lib/project-code"

const initialProjects = [
  {
    name: "月之暗面",
    logo: "月",
    description: "新一代AI搜索与对话平台",
    tags: ["AI", "A轮"],
    status: "投中期",
    round: "A轮",
    valuation: "10亿 USD",
    ownerId: "lisi",
    ownerName: "李四",
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: new Date("2023-09-20"),
  },
  {
    name: "智谱AI",
    logo: "智",
    description: "认知大模型技术与应用开发",
    tags: ["AI", "C轮"],
    status: "投后期",
    round: "C轮",
    valuation: "15亿 USD",
    ownerId: "wangfang",
    ownerName: "王芳",
    strategyId: "1",
    strategyName: "AI基础设施",
    createdAt: new Date("2023-08-10"),
  },
  {
    name: "百川智能",
    logo: "百",
    description: "大语言模型研发与应用",
    tags: ["AI", "B轮"],
    status: "投中期",
    round: "B轮",
    valuation: "12亿 USD",
    ownerId: "zhangwei",
    ownerName: "张伟",
    strategyId: "1",
    strategyName: "AI基础设施",
    createdAt: new Date("2023-07-05"),
  },
  {
    name: "零一万物",
    logo: "零",
    description: "通用AI助理与多模态模型",
    tags: ["AI", "A轮"],
    status: "投前期",
    round: "A轮",
    valuation: "8亿 USD",
    ownerId: "lisi",
    ownerName: "李四",
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: new Date("2023-11-01"),
  },
  {
    name: "阶跃星辰",
    logo: "阶",
    description: "多模态大模型与智能体平台",
    tags: ["AI", "Pre-A"],
    status: "投前期",
    round: "Pre-A",
    valuation: "5亿 USD",
    ownerId: "zhaoqiang",
    ownerName: "赵强",
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: new Date("2023-12-15"),
  },
  {
    name: "深势科技",
    logo: "深",
    description: "AI for Science，分子模拟与药物设计",
    tags: ["AI+科学", "B轮"],
    status: "投后期",
    round: "B轮",
    valuation: "20亿 USD",
    ownerId: "chenzong",
    ownerName: "陈总",
    strategyId: "4",
    strategyName: "生物科技",
    createdAt: new Date("2023-06-20"),
  },
  {
    name: "衬远科技",
    logo: "衬",
    description: "AI驱动的电商与消费品创新",
    tags: ["AI+消费", "A轮"],
    status: "投前期",
    round: "A轮",
    valuation: "6亿 USD",
    ownerId: "wangfang",
    ownerName: "王芳",
    strategyId: "6",
    strategyName: "出海电商",
    createdAt: new Date("2024-01-10"),
  },
]

export async function POST() {
  try {
    const existingProjects = await prisma.project.findMany()
    
    if (existingProjects.length > 0) {
      return NextResponse.json({
        message: "数据库已有数据，跳过初始化",
        count: existingProjects.length,
      })
    }

    const projectsToCreate = initialProjects.map((p) => ({
      code: generateProjectCode(),
      ...p,
    }))

    await prisma.project.createMany({
      data: projectsToCreate,
    })

    return NextResponse.json({
      message: "初始化成功",
      count: projectsToCreate.length,
    })
  } catch (error) {
    console.error("初始化失败:", error)
    return NextResponse.json(
      { error: "初始化失败" },
      { status: 500 }
    )
  }
}