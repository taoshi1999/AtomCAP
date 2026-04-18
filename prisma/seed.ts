import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 模拟项目的负责人
const availableOwners = [
  { id: "zhangwei", name: "张伟", email: "zhangwei@test.com" },
  { id: "lisi", name: "李四", email: "lisi@test.com" },
  { id: "wangfang", name: "王芳", email: "wangfang@test.com" },
  { id: "zhaoqiang", name: "赵强", email: "zhaoqiang@test.com" },
  { id: "chenzong", name: "陈总", email: "chenzong@test.com" },
]

// 模拟项目
const initialProjects = [
  {
    id: "proj_2",
    name: "月之暗面",
    logo: "月",
    description: "新一代AI搜索与对话平台",
    tags: ["AI", "A轮"],
    status: "投中期",
    round: "A轮",
    ownerId: "lisi",
    strategyId: "2",
    strategyName: "大模型应用",
    creatorId: "zhangwei", // Default creator
    createdAt: new Date("2023-09-20"),
  },
  {
    id: "proj_3",
    name: "智谱AI",
    logo: "智",
    description: "认知大模型技术与应用开发",
    tags: ["AI", "C轮"],
    status: "投后期",
    round: "C轮",
    ownerId: "wangfang",
    strategyId: "1",
    strategyName: "AI基础设施",
    creatorId: "zhangwei",
    createdAt: new Date("2023-08-10"),
  },
  {
    id: "proj_4",
    name: "百川智能",
    logo: "百",
    description: "大语言模型研发与应用",
    tags: ["AI", "B轮"],
    status: "投中期",
    round: "B轮",
    ownerId: "zhangwei",
    strategyId: "1",
    strategyName: "AI基础设施",
    creatorId: "zhangwei",
    createdAt: new Date("2023-07-05"),
  },
  {
    id: "proj_5",
    name: "零一万物",
    logo: "零",
    description: "通用AI助理与多模态模型",
    tags: ["AI", "A轮"],
    status: "投前期",
    round: "A轮",
    ownerId: "lisi",
    strategyId: "2",
    strategyName: "大模型应用",
    creatorId: "zhangwei",
    createdAt: new Date("2023-11-01"),
  },
  {
    id: "proj_6",
    name: "阶跃星辰",
    logo: "阶",
    description: "多模态大模型与智能体平台",
    tags: ["AI", "Pre-A"],
    status: "投前期",
    round: "Pre-A",
    ownerId: "zhaoqiang",
    strategyId: "2",
    strategyName: "大模型应用",
    creatorId: "zhangwei",
    createdAt: new Date("2023-12-15"),
  },
  {
    id: "proj_7",
    name: "深势科技",
    logo: "深",
    description: "AI for Science，分子模拟与药物设计",
    tags: ["AI+科学", "B轮"],
    status: "投后期",
    round: "B轮",
    ownerId: "chenzong",
    strategyId: "4",
    strategyName: "生物科技",
    creatorId: "zhangwei",
    createdAt: new Date("2023-06-20"),
  },
  {
    id: "proj_8",
    name: "衬远科技",
    logo: "衬",
    description: "AI驱动的电商与消费品创新",
    tags: ["AI+消费", "A轮"],
    status: "投前期",
    round: "A轮",
    ownerId: "wangfang",
    strategyId: "6",
    strategyName: "出海电商",
    creatorId: "zhangwei",
    createdAt: new Date("2024-01-10"),
  },
]

async function main() {
  console.log('Seeding data...')
  
  // 1. Upsert users
  for (const owner of availableOwners) {
    const user = await prisma.user.upsert({
      where: { email: owner.email },
      update: {},
      create: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        password: "password123", // Using an unhashed string for seeding where auth is simple mock
      },
    })
    console.log(`Created/Updated user: ${user.name}`)
  }

  // 2. Clear old projects then create new mock projects
  // await prisma.project.deleteMany({}) // optional
  for (const proj of initialProjects) {
    const project = await prisma.project.upsert({
      where: { id: proj.id },
      update: proj,
      create: proj,
    })
    console.log(`Created/Updated project: ${project.name}`)
  }

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
