import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '../../db'
import type { Context } from '../context'
import { generateProjectCode } from '@/src/lib/project-code'

export const projectRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        ownerId: z.string().optional(),
        strategyId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }: { input: any; ctx: Context }) => {
      const where: any = {}
      if (input?.status) where.status = input.status
      if (input?.ownerId) where.ownerId = input.ownerId
      if (input?.strategyId) where.strategyId = input.strategyId

      const projects = await prisma.project.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: {
          createdAt: 'desc' as const,
        },
      })

      return projects
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }: { input: { id: string } }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.id },
        include: {
          tasks: true,
          documents: true,
        },
      })

      if (!project) {
        throw new Error('项目不存在')
      }

      return project
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        logo: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        valuation: z.string().optional(),
        round: z.string().optional(),
        ownerId: z.string().optional(),
        ownerName: z.string().optional(),
        strategyId: z.string().optional(),
        strategyName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      const code = generateProjectCode()

      const project = await prisma.project.create({
        data: {
          code,
          name: input.name,
          logo: input.logo || input.name.charAt(0),
          description: input.description || "",
          tags: input.tags || [],
          status: "待立项",
          valuation: input.valuation || "",
          round: input.round || "",
          ownerId: input.ownerId || "",
          ownerName: input.ownerName || "",
          strategyId: input.strategyId || "",
          strategyName: input.strategyName || "",
          creatorId: ctx.session.user.id,
        },
      })

      return project
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        logo: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.string().optional(),
        valuation: z.string().optional(),
        round: z.string().optional(),
        ownerId: z.string().optional(),
        ownerName: z.string().optional(),
        strategyId: z.string().optional(),
        strategyName: z.string().optional(),
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      const { id, ...data } = input

      return prisma.project.update({
        where: { id },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }: { input: { id: string } }) => {
      return prisma.project.delete({
        where: { id: input.id },
      })
    }),

  init: protectedProcedure.mutation(async () => {
    const existingProjects = await prisma.project.findMany()

    if (existingProjects.length > 0) {
      return {
        message: "数据库已有数据，跳过初始化",
        count: existingProjects.length,
      }
    }

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
      },
    ]

    const projectsToCreate = initialProjects.map((p) => ({
      ...p,
      code: generateProjectCode(),
      creatorId: "system",
    }))

    await prisma.project.createMany({
      data: projectsToCreate,
    })

    return {
      message: "初始化成功",
      count: projectsToCreate.length,
    }
  }),
})
