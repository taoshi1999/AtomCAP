import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '../../db'
import type { Context } from '../context'

export const projectRouter = createTRPCRouter({
  /**
   * 获取所有项目
   */
  getAll: protectedProcedure.query(async ({ ctx }: { ctx: Context }) => {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: 'desc' as const,
      },
    })

    return projects
  }),

  /**
   * 获取单个项目详情
   */
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

  /**
   * 创建新项目
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        industry: z.string().optional(),
        stage: z.string().optional(),
        budget: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      const project = await prisma.project.create({
        data: {
          ...input,
          creatorId: ctx.session.user.id,
        },
      })

      return project
    }),

  /**
   * 更新项目
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        industry: z.string().optional(),
        stage: z.string().optional(),
        budget: z.number().optional(),
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      const { id, ...data } = input

      return prisma.project.update({
        where: { id },
        data,
      })
    }),

  /**
   * 删除项目
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }: { input: { id: string } }) => {
      return prisma.project.delete({
        where: { id: input.id },
      })
    }),
})
