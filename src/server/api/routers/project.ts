import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '../../db'
import type { Context } from '../context'
import { TRPCError } from '@trpc/server'
import type { ProjectHypothesis, ProjectTerm, ProjectWorkflowPhase, ProjectMaterial, Document } from '@prisma/client'

function getStatusColorForGrid(status: string | null) {
  const options: Record<string, string> = {
    未立项: 'bg-gray-50 text-gray-600 border-gray-200',
    投前阶段: 'bg-blue-50 text-blue-700 border-blue-200',
    投中阶段: 'bg-amber-50 text-amber-700 border-amber-200',
    投后阶段: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    已退出: 'bg-red-50 text-red-700 border-red-200',
  }
  return status && options[status] ? options[status]! : 'bg-gray-50 text-gray-600 border-gray-200'
}

function toYmd(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString().slice(0, 10)
}

function normalizeHypothesisRowStatus(s: string): 'verified' | 'pending' | 'risky' {
  const t = s.trim().toLowerCase()
  if (t === 'verified' || s.includes('成立')) return 'verified'
  if (t === 'risky' || s.includes('不成立')) return 'risky'
  return 'pending'
}

function normalizeTermRowStatus(s: string): 'approved' | 'pending' | 'rejected' {
  const t = s.trim().toLowerCase()
  if (t === 'approved' || s.includes('通过')) return 'approved'
  if (t === 'rejected' || s.includes('否决')) return 'rejected'
  return 'pending'
}

function phaseLifecycleFromDb(s: string): 'completed' | 'active' | 'upcoming' {
  const t = s.trim().toLowerCase()
  if (t === 'completed' || s.includes('已完成')) return 'completed'
  if (t === 'active' || s.includes('进行')) return 'active'
  return 'upcoming'
}

function mapProjectToGridDto(p: {
  id: string
  name: string
  logo: string | null
  description: string | null
  tags: string | null
  stage: string | null
  valuation: string | null
  round: string | null
  managerId: string | null
  managerName: string | null
  createdAt: Date
}) {
  return {
    id: p.id,
    name: p.name,
    logo: p.logo || (p.name.length > 0 ? p.name[0]! : 'P'),
    description: p.description || '',
    tags: p.tags ? p.tags.split(',').map((t) => t.replace(/[{}]/g, '').trim()) : [],
    status: p.stage || '未立项',
    statusColor: getStatusColorForGrid(p.stage),
    valuation: p.valuation || '待定',
    round: (p.round || '未知轮次').replace(/[{}]/g, ''),
    owner: {
      id: p.managerId || '1',
      name: p.managerName || '未指派',
      initials: (p.managerName || '未指派').substring(0, 1),
    },
    createdAt: p.createdAt.toISOString(),
  }
}

function defaultHypothesisDetail(row: ProjectHypothesis) {
  const ymd = (d: Date) => d.toISOString().split('T')[0]!
  if (row.body) {
    try {
      const parsed = JSON.parse(row.body) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && 'id' in parsed) {
        return parsed as unknown
      }
    } catch {
      /* fall through */
    }
  }
  return {
    id: row.id,
    title: row.name,
    qaId: `QA-${row.id.slice(0, 8)}`,
    createdAt: ymd(row.createdAt),
    updatedAt: ymd(row.updatedAt),
    status: normalizeHypothesisRowStatus(row.status),
    creator: { name: '张伟', role: '投资经理' },
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: '',
      status: 'pending' as const,
      content: '',
      creator: { name: '', role: '' },
      reviewers: [] as { name: string; role: string }[],
      createdAt: '',
      comments: [] as { author: string; content: string; time: string }[],
    },
    verification: {
      conclusion: '',
      status: 'pending' as const,
      content: '',
      creator: { name: '', role: '' },
      reviewers: [] as { name: string; role: string }[],
      createdAt: '',
      comments: [] as { author: string; content: string; time: string }[],
    },
    linkedTerms: [] as { id: string; title: string; termId: string; status: 'approved' | 'pending' | 'rejected' }[],
  }
}

function defaultTermDetail(row: ProjectTerm) {
  const ymd = (d: Date) => d.toISOString().split('T')[0]!
  if (row.body) {
    try {
      const parsed = JSON.parse(row.body) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && 'id' in parsed) {
        return parsed as unknown
      }
    } catch {
      /* fall through */
    }
  }
  const emptyPerson = { name: '张伟', role: '投资经理' }
  const emptySection = {
    content: '',
    files: [] as { name: string; size: string; date: string }[],
    linkedHypotheses: [] as { id: string; title: string; status: 'verified' | 'pending' | 'risky' }[],
    creator: emptyPerson,
    reviewers: [] as { name: string; role: string }[],
    createdAt: '',
    comments: [] as { author: string; content: string; time: string }[],
  }
  return {
    id: row.id,
    title: row.name,
    termId: `TM-${row.id.slice(0, 8)}`,
    createdAt: ymd(row.createdAt),
    updatedAt: ymd(row.updatedAt),
    status: normalizeTermRowStatus(row.status),
    creator: emptyPerson,
    ourDemand: { ...emptySection },
    ourBasis: { ...emptySection },
    bilateralConflict: { content: '', creator: emptyPerson, reviewers: [], createdAt: '', comments: [] },
    ourBottomLine: { content: '', creator: emptyPerson, reviewers: [], createdAt: '', comments: [] },
    compromiseSpace: { content: '', creator: emptyPerson, reviewers: [], createdAt: '', comments: [] },
    negotiationResult: {
      conclusion: '',
      status: 'partial' as const,
      content: '',
      creator: { name: '', role: '' },
      reviewers: [] as { name: string; role: string }[],
      createdAt: '',
      comments: [] as { author: string; content: string; time: string }[],
    },
    implementationStatus: {
      status: 'not-started' as const,
      content: '',
      creator: { name: '', role: '' },
      reviewers: [] as { name: string; role: string }[],
      createdAt: '',
      comments: [] as { author: string; content: string; time: string }[],
    },
  }
}

function mapPhaseRow(p: ProjectWorkflowPhase) {
  return {
    id: p.id,
    groupLabel: p.groupLabel,
    name: p.name,
    fullLabel: p.fullLabel,
    assignee: '',
    assigneeAvatar: '',
    hypothesesCount: p.hypothesesCount,
    termsCount: p.termsCount,
    materialsCount: p.materialsCount,
    status: phaseLifecycleFromDb(p.status),
    startDate: toYmd(p.startDate) ?? '',
    endDate: toYmd(p.endDate),
    logs: [] as { action: string; date: string; author: string }[],
  }
}

function mapMaterialRow(m: ProjectMaterial) {
  return {
    id: m.id,
    strategyId: '',
    name: m.name,
    format: m.format,
    size: m.size ?? '—',
    description: m.description ?? '',
    category: m.category,
    owner: '张伟',
    createdAt: m.createdAt.toISOString().split('T')[0]!,
  }
}

function mapDocumentRow(d: Document) {
  return {
    id: d.id,
    strategyId: '',
    name: d.name,
    format: d.format ?? 'PDF',
    size: d.size ?? '—',
    description: '',
    category: d.category ?? '',
    owner: '张伟',
    createdAt: d.createdAt.toISOString().split('T')[0]!,
  }
}

export const projectRouter = createTRPCRouter({
  /**
   * 获取所有项目
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

      return data.map(project => ({
        id: project.id,
        name: project.name,
        logo: project.logo || (project.name.length > 0 ? project.name[0] : "P"),
        description: project.description || "",
        tags: project.tags ? project.tags.split(",").map(t => t.replace(/[{}]/g, "").trim()) : [],
        status: project.stage || "未立项",
        statusColor: getStatusColorForGrid(project.stage),
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
   * 项目详情五子页聚合：概览 / 假设 / 条款 / 材料 / 工作流 所需 UI-ready DTO
   */
  getDetailBundle: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input }) => {
      const row = await prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          projectHypotheses: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          projectTerms: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          projectMaterials: { orderBy: { createdAt: 'desc' } },
          workflowPhases: { orderBy: { sortOrder: 'asc' } },
          documents: { orderBy: { createdAt: 'desc' } },
        },
      })

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '项目不存在' })
      }

      const hypotheses = row.projectHypotheses.map((h) => ({
        id: h.id,
        direction: h.direction,
        category: h.category,
        name: h.name,
        owner: '张伟',
        createdAt: h.createdAt.toISOString().split('T')[0]!,
        updatedAt: h.updatedAt.toISOString().split('T')[0]!,
        status: normalizeHypothesisRowStatus(h.status),
      }))

      const hypothesisDetails: Record<string, unknown> = {}
      for (const h of row.projectHypotheses) {
        hypothesisDetails[h.id] = defaultHypothesisDetail(h)
      }

      const terms = row.projectTerms.map((t) => ({
        id: t.id,
        direction: t.direction,
        category: t.category,
        name: t.name,
        owner: '张伟',
        createdAt: t.createdAt.toISOString().split('T')[0]!,
        updatedAt: t.updatedAt.toISOString().split('T')[0]!,
        status: normalizeTermRowStatus(t.status),
      }))

      const termDetails: Record<string, unknown> = {}
      for (const t of row.projectTerms) {
        termDetails[t.id] = defaultTermDetail(t)
      }

      const materialsFromRows = row.projectMaterials.map(mapMaterialRow)
      const materialsFromDocs = row.documents.map(mapDocumentRow)
      const materials = [...materialsFromRows, ...materialsFromDocs]

      const phases = row.workflowPhases.map(mapPhaseRow)

      const stageLabel = row.stage ?? ''
      const isExited = stageLabel.includes('退出') || (row.status ?? '').includes('退出')

      return {
        project: mapProjectToGridDto(row),
        phases,
        hypotheses,
        hypothesisDetails,
        terms,
        termDetails,
        materials,
        isExited,
        savedGeneratedSuggestions: [],
        savedGeneratedTermSuggestions: [],
        savedGeneratedMaterialSuggestions: [],
        savedGeneratedAiResearchGroups: [],
      }
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
})
