import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { prisma } from '../../db'
import type { Context } from '../context'
import { TRPCError } from '@trpc/server'
import { loadProjectOverviewDto } from '../services/project-overview'
import {
  advanceProjectWorkflowPhase,
  createProjectHypothesisRow,
  createProjectMaterialRow,
  createProjectTermRow,
  createProjectWorkflowPhaseRow,
} from '../services/project-mutations'
import {
  createHypothesisPointComment,
  createTermSectionComment,
} from '../services/project-comments'

export const projectRouter = createTRPCRouter({
  /**
   * 项目详情页概览（US-005）：UI-ready DTO，含三清单计数与当前阶段。
   */
  getOverview: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input }) => {
      const dto = await loadProjectOverviewDto(input.projectId)
      if (!dto) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '项目不存在',
        })
      }
      return dto
    }),

  /**
   * 获取所有项目（分页列表）
   */
  
  getProjsForGrid: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(10)
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page || 1;
      const limit = input?.limit || 10;
      const skip = (page - 1) * limit;

      const data = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      const getStatusColor = (status: string | null) => {
        const options: Record<string, string> = {
          "未立项": "bg-gray-50 text-gray-600 border-gray-200",
          "投前阶段": "bg-blue-50 text-blue-700 border-blue-200",
          "投中阶段": "bg-amber-50 text-amber-700 border-amber-200",
          "投后阶段": "bg-emerald-50 text-emerald-700 border-emerald-200",
          "已退出": "bg-red-50 text-red-700 border-red-200",
        };
        return (status && options[status]) ? options[status] : "bg-gray-50 text-gray-600 border-gray-200";
      };

      return data.map(project => ({
        id: project.id,
        name: project.name,
        logo: project.logo || (project.name.length > 0 ? project.name[0] : "P"),
        description: project.description || "",
        tags: project.tags ? project.tags.split(",").map(t => t.replace(/[{}]/g, "").trim()) : [],
        status: project.stage || "未立项",
        statusColor: getStatusColor(project.stage),
        valuation: project.valuation || "待定",
        round: (project.round || "未知轮次").replace(/[{}]/g, ""),
        owner: {
          id: project.managerId || "1",
          name: project.managerName || "未指派",
          initials: (project.managerName || "未指派").substring(0, 1)
        },
        createdAt: project.createdAt.toISOString()
      }));
    }),

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
   * 创建新项目 - US-003
   * 支持字段：公司名称、描述、赛道标签、投资轮次、负责人
   * 项目编号由Prisma自动生成(cuid)
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
        logo: z.string().optional(),
        tags: z.string().optional(),
        round: z.string().optional(),
        valuation: z.string().optional(),
        managerId: z.string().optional(),
        managerName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '用户未登录或会话已过期',
        })
      }

      try {
        const project = await prisma.project.create({
          data: {
            name: input.name,
            description: input.description,
            status: input.status,
            priority: input.priority,
            industry: input.industry,
            stage: input.stage,
            budget: input.budget,
            logo: input.logo,
            tags: input.tags,
            round: input.round,
            valuation: input.valuation,
            managerId: input.managerId,
            managerName: input.managerName,
            creatorId: ctx.session.user.id,
          },
        })

        return project
      } catch (error: any) {
        console.error('[project.create] Database error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || '创建项目失败',
          cause: error,
        })
      }
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
        valuation: z.string().optional(),
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

  createHypothesis: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        direction: z.string().min(1).max(128),
        category: z.string().min(1).max(128),
        name: z.string().min(1).max(512),
        body: z.string().max(100_000).optional(),
        status: z.enum(['verified', 'pending', 'risky']).optional(),
        workflowPhaseId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return createProjectHypothesisRow(input)
    }),

  createTerm: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        direction: z.string().min(1).max(128),
        category: z.string().min(1).max(128),
        name: z.string().min(1).max(512),
        body: z.string().max(100_000).optional(),
        status: z.enum(['approved', 'pending', 'rejected']).optional(),
        workflowPhaseId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return createProjectTermRow(input)
    }),

  createMaterial: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        name: z.string().min(1).max(512),
        format: z.string().max(32).optional(),
        size: z.string().max(64).optional(),
        description: z.string().max(20_000).optional(),
        category: z.string().max(128).optional(),
        workflowPhaseId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return createProjectMaterialRow(input)
    }),

  /** 完成当前进行中阶段并激活下一待启动阶段 */
  advanceWorkflowPhase: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return advanceProjectWorkflowPhase(input.projectId)
    }),

  addHypothesisPointComment: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        hypothesisId: z.string().min(1),
        pointKind: z.enum(['value', 'risk']),
        pointKey: z.string().min(1).max(180),
        content: z.string().min(1).max(50_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const u = ctx.session.user
      const authorName = u?.name?.trim() || u?.email || '用户'
      return createHypothesisPointComment({
        projectId: input.projectId,
        hypothesisId: input.hypothesisId,
        pointKind: input.pointKind,
        pointKey: input.pointKey,
        content: input.content,
        authorName,
      })
    }),

  addTermSectionComment: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        termId: z.string().min(1),
        sectionKey: z
          .enum([
            'ourDemand',
            'ourBasis',
            'bilateralConflict',
            'ourBottomLine',
            'compromiseSpace',
            'negotiationResult',
            'implementationStatus',
          ]),
        content: z.string().min(1).max(50_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const u = ctx.session.user
      const authorName = u?.name?.trim() || u?.email || '用户'
      return createTermSectionComment({
        projectId: input.projectId,
        termId: input.termId,
        sectionKey: input.sectionKey,
        content: input.content,
        authorName,
      })
    }),

  createWorkflowPhase: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        groupLabel: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        fullLabel: z.string().min(1).max(512),
        status: z.enum(['completed', 'active', 'upcoming']).optional(),
        hypothesesCount: z.number().int().min(0).max(99999).optional(),
        termsCount: z.number().int().min(0).max(99999).optional(),
        materialsCount: z.number().int().min(0).max(99999).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return createProjectWorkflowPhaseRow(input)
    }),
})
