import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '../../db'
import type { Context } from '../context'
import { TRPCError } from '@trpc/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const fallbackProjects = [
  {
    id: 'cmoe66sq4001blau3s0opse8i',
    name: '月之暗面',
    logo: '月',
    description: '新一代AI搜索与对话平台',
    tags: ['AI', 'A轮'],
    status: '投中阶段',
    round: 'A轮',
    valuation: '待定',
    owner: { id: 'lisi', name: '李四', initials: '李' },
    createdAt: '2023-09-20T00:00:00.000Z',
    stage: '投中阶段',
    industry: 'AI',
    managerId: 'lisi',
    managerName: '李四',
  },
  {
    id: 'fallback-project-2',
    name: '智谱AI',
    logo: '智',
    description: '认知大模型技术与应用开发',
    tags: ['AI', 'C轮'],
    status: '投后阶段',
    round: 'C轮',
    valuation: '待定',
    owner: { id: 'wangfang', name: '王芳', initials: '王' },
    createdAt: '2023-08-10T00:00:00.000Z',
    stage: '投后阶段',
    industry: 'AI',
    managerId: 'wangfang',
    managerName: '王芳',
  },
  {
    id: 'fallback-project-3',
    name: '百川智能',
    logo: '百',
    description: '大语言模型研发与应用',
    tags: ['AI', 'B轮'],
    status: '投中阶段',
    round: 'B轮',
    valuation: '待定',
    owner: { id: 'zhangwei', name: '张伟', initials: '张' },
    createdAt: '2023-07-05T00:00:00.000Z',
    stage: '投中阶段',
    industry: 'AI',
    managerId: 'zhangwei',
    managerName: '张伟',
  },
  {
    id: 'fallback-project-4',
    name: '零一万物',
    logo: '零',
    description: '通用AI助理与多模态模型',
    tags: ['AI', 'A轮'],
    status: '投前阶段',
    round: 'A轮',
    valuation: '待定',
    owner: { id: 'lisi', name: '李四', initials: '李' },
    createdAt: '2023-11-01T00:00:00.000Z',
    stage: '投前阶段',
    industry: 'AI',
    managerId: 'lisi',
    managerName: '李四',
  },
  {
    id: 'fallback-project-5',
    name: '阶跃星辰',
    logo: '阶',
    description: '多模态大模型与智能体平台',
    tags: ['AI', 'Pre-A'],
    status: '投前阶段',
    round: 'Pre-A',
    valuation: '待定',
    owner: { id: 'zhaoqiang', name: '赵强', initials: '赵' },
    createdAt: '2023-12-15T00:00:00.000Z',
    stage: '投前阶段',
    industry: 'AI',
    managerId: 'zhaoqiang',
    managerName: '赵强',
  },
]

const fallbackMaterialsByProject: Record<string, Array<{
  id: string
  name: string
  format: string
  size: string
  category: string
  description: string
  url: string
  createdAt: string
}>> = {
  cmoe66sq4001blau3s0opse8i: [
    {
      id: 'sample-material-1',
      name: '月之暗面-尽调纪要.md',
      format: 'MD',
      size: '12KB',
      category: '尽调材料',
      description: '项目团队访谈纪要，包含产品进展、商业化路径和近期融资安排。',
      url: '/sample-materials/due-diligence-notes.md',
      createdAt: '2024-03-12T00:00:00.000Z',
    },
    {
      id: 'sample-material-2',
      name: '月之暗面-财务模型.csv',
      format: 'CSV',
      size: '8KB',
      category: '财务资料',
      description: '三年收入、毛利率与现金流预测样例，便于快速核对关键假设。',
      url: '/sample-materials/financial-model.csv',
      createdAt: '2024-03-10T00:00:00.000Z',
    },
    {
      id: 'sample-material-3',
      name: '月之暗面-市场摘要.txt',
      format: 'TXT',
      size: '6KB',
      category: '市场研究',
      description: '行业竞争格局、目标客户画像与海外可比公司摘要样例。',
      url: '/sample-materials/market-summary.txt',
      createdAt: '2024-03-08T00:00:00.000Z',
    },
  ],
}

type PersistedMaterialRecord = {
  id: string
  projectId: string
  name: string
  format: string
  size: string
  category: string
  description: string
  url: string
  createdAt: string
  updatedAt: string
}

const fallbackMaterialsStorePath = path.join(
  process.cwd(),
  'data',
  'project-materials-fallback.json'
)

async function readPersistedFallbackMaterials() {
  try {
    const raw = await fs.readFile(fallbackMaterialsStorePath, 'utf8')
    const parsed = JSON.parse(raw) as PersistedMaterialRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function writePersistedFallbackMaterials(records: PersistedMaterialRecord[]) {
  await fs.mkdir(path.dirname(fallbackMaterialsStorePath), { recursive: true })
  await fs.writeFile(
    fallbackMaterialsStorePath,
    JSON.stringify(records, null, 2),
    'utf8'
  )
}

async function getFallbackMaterials(projectId: string) {
  const persisted = await readPersistedFallbackMaterials()
  const persistedForProject = persisted
    .filter((item) => item.projectId === projectId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      format: item.format.toUpperCase(),
      size: item.size,
      category: item.category,
      description: item.description,
      url: item.url,
      createdAt: item.createdAt,
    }))

  const seeded = fallbackMaterialsByProject[projectId]
    ?? fallbackMaterialsByProject['cmoe66sq4001blau3s0opse8i']
    ?? []

  const merged = new Map<string, {
    id: string
    name: string
    format: string
    size: string
    category: string
    description: string
    url: string
    createdAt: string
  }>()

  for (const item of seeded) {
    merged.set(item.url || `${item.name}-${item.createdAt}`, item)
  }

  for (const item of persistedForProject) {
    merged.set(item.url || `${item.name}-${item.createdAt}`, item)
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

async function persistFallbackMaterials(input: {
  projectId: string
  materials: Array<{
    name: string
    format: string
    size: string
    description: string
    url: string
    category?: string
  }>
}) {
  const existing = await readPersistedFallbackMaterials()
  const now = new Date().toISOString()
  const created = input.materials.map((material, index) => ({
    id: `fallback-material-${Date.now()}-${index}`,
    projectId: input.projectId,
    name: material.name,
    format: material.format.toLowerCase(),
    size: material.size,
    category: material.category || '项目材料',
    description: material.description,
    url: material.url,
    createdAt: now,
    updatedAt: now,
  }))

  await writePersistedFallbackMaterials([...created, ...existing])
  return created
}

function isDbUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Can't reach database server")
    || message.includes('Authentication failed')
    || message.includes('password authentication failed')
}

function getStatusColor(status: string | null) {
  const options: Record<string, string> = {
    '未立项': 'bg-gray-50 text-gray-600 border-gray-200',
    '投前阶段': 'bg-blue-50 text-blue-700 border-blue-200',
    '投前期': 'bg-blue-50 text-blue-700 border-blue-200',
    '投中阶段': 'bg-amber-50 text-amber-700 border-amber-200',
    '投中期': 'bg-amber-50 text-amber-700 border-amber-200',
    '投后阶段': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '投后期': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '已退出': 'bg-red-50 text-red-700 border-red-200',
  }
  return (status && options[status]) ? options[status] : 'bg-gray-50 text-gray-600 border-gray-200'
}

function mapFallbackProjectForGrid(project: typeof fallbackProjects[number]) {
  return {
    id: project.id,
    name: project.name,
    logo: project.logo,
    description: project.description,
    tags: project.tags,
    status: project.status,
    statusColor: getStatusColor(project.status),
    valuation: project.valuation,
    round: project.round,
    owner: project.owner,
    createdAt: project.createdAt,
  }
}

function buildFallbackProjectDetail(projectId: string) {
  const matched = fallbackProjects.find((project) => project.id === projectId) ?? fallbackProjects[0]!
  return {
    id: projectId,
    name: matched.name,
    description: matched.description,
    status: matched.status,
    priority: '中',
    industry: matched.industry,
    stage: matched.stage,
    budget: null,
    logo: matched.logo,
    tags: matched.tags.join(','),
    round: matched.round,
    valuation: matched.valuation,
    managerId: matched.managerId,
    managerName: matched.managerName,
    totalInvestment: null,
    irr: null,
    creatorId: 'fallback-user',
    createdAt: new Date(matched.createdAt),
    updatedAt: new Date(matched.createdAt),
    tasks: [],
    documents: [],
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

      try {
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
      } catch (error) {
        if (!isDbUnavailable(error)) {
          throw error
        }
        console.warn('[project.getProjsForGrid] Falling back to mock data:', error)
        return fallbackProjects.slice(skip, skip + limit).map(mapFallbackProjectForGrid)
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }: { ctx: Context }) => {
    try {
      const projects = await prisma.project.findMany({
        orderBy: {
          createdAt: 'desc' as const,
        },
      })

      return projects
    } catch (error) {
      if (!isDbUnavailable(error)) {
        throw error
      }
      console.warn('[project.getAll] Falling back to mock data:', error)
      return fallbackProjects.map((project) => buildFallbackProjectDetail(project.id))
    }
  }),

  /**
   * 获取单个项目详情
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }: { input: { id: string } }) => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: input.id },
          include: {
            tasks: true,
            documents: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        })

        if (!project) {
          throw new Error('项目不存在')
        }

        return project
      } catch (error) {
        if (!isDbUnavailable(error)) {
          throw error
        }
        console.warn('[project.getById] Falling back to mock data:', error)
        return buildFallbackProjectDetail(input.id)
      }
    }),

  getMaterials: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
          },
        })

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '项目不存在',
          })
        }

        const documents = await prisma.document.findMany({
          where: { projectId: input.projectId },
          orderBy: {
            createdAt: 'desc',
          },
        })

        return documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          format: (doc.format || 'UNKNOWN').toUpperCase(),
          size: doc.size || '-',
          category: doc.category || '未分类',
          description: doc.description || '暂无简介',
          url: doc.url || '',
          createdAt: doc.createdAt.toISOString(),
        }))
      } catch (error) {
        if (!isDbUnavailable(error)) {
          throw error
        }
        console.warn('[project.getMaterials] Falling back to mock materials:', error)
        return getFallbackMaterials(input.projectId)
      }
    }),

  createMaterials: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        materials: z.array(
          z.object({
            name: z.string().min(1),
            format: z.string().min(1),
            size: z.string().min(1),
            description: z.string().min(1, '每个文件都需要填写简介'),
            url: z.string().url(),
            category: z.string().optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
          },
        })

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '项目不存在',
          })
        }

        return prisma.$transaction(
          input.materials.map((material) =>
            prisma.document.create({
              data: {
                projectId: input.projectId,
                name: material.name,
                format: material.format.toLowerCase(),
                size: material.size,
                description: material.description,
                category: material.category || '项目材料',
                url: material.url,
              },
            })
          )
        )
      } catch (error) {
        if (!isDbUnavailable(error)) {
          throw error
        }
        console.warn('[project.createMaterials] Database unavailable, persisting to server fallback store:', error)
        return persistFallbackMaterials(input)
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
