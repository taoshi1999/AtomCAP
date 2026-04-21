import { prisma } from '@/src/server/db'
import { TRPCError } from '@trpc/server'

export async function requireProjectOrThrow(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '项目不存在' })
  }
  return project
}

/** 将各阶段行上的计数字段与真实外键行数对齐 */
export async function refreshWorkflowPhaseCountsForProject(projectId: string) {
  const phases = await prisma.projectWorkflowPhase.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })
  for (const ph of phases) {
    const [hc, tc, mc] = await Promise.all([
      prisma.projectHypothesis.count({
        where: { projectId, workflowPhaseId: ph.id },
      }),
      prisma.projectTerm.count({
        where: { projectId, workflowPhaseId: ph.id },
      }),
      prisma.projectMaterial.count({
        where: { projectId, workflowPhaseId: ph.id },
      }),
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

async function resolveWorkflowPhaseIdForNewItem(
  projectId: string,
  explicit?: string | null,
) {
  if (explicit) {
    const ph = await prisma.projectWorkflowPhase.findFirst({
      where: { id: explicit, projectId },
    })
    if (ph) return ph.id
  }
  const active = await prisma.projectWorkflowPhase.findFirst({
    where: { projectId, status: 'active' },
    orderBy: { sortOrder: 'asc' },
  })
  return active?.id ?? null
}

async function nextHypothesisSortOrder(projectId: string) {
  const agg = await prisma.projectHypothesis.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  })
  return (agg._max.sortOrder ?? 0) + 1
}

async function nextTermSortOrder(projectId: string) {
  const agg = await prisma.projectTerm.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  })
  return (agg._max.sortOrder ?? 0) + 1
}

export async function nextWorkflowPhaseSortOrder(projectId: string) {
  const agg = await prisma.projectWorkflowPhase.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  })
  return (agg._max.sortOrder ?? 0) + 1
}

const HYP_STATUS = new Set(['verified', 'pending', 'risky'])
const TERM_STATUS = new Set(['approved', 'pending', 'rejected'])
const PHASE_STATUS = new Set(['completed', 'active', 'upcoming'])

export async function createProjectHypothesisRow(input: {
  projectId: string
  direction: string
  category: string
  name: string
  body?: string | null
  status?: string | null
  workflowPhaseId?: string | null
}) {
  await requireProjectOrThrow(input.projectId)
  const status =
    input.status && HYP_STATUS.has(input.status) ? input.status : 'pending'
  const workflowPhaseId = await resolveWorkflowPhaseIdForNewItem(
    input.projectId,
    input.workflowPhaseId,
  )
  const row = await prisma.projectHypothesis.create({
    data: {
      projectId: input.projectId,
      workflowPhaseId,
      direction: input.direction,
      category: input.category,
      name: input.name,
      body: input.body ?? null,
      status,
      sortOrder: await nextHypothesisSortOrder(input.projectId),
    },
  })
  await refreshWorkflowPhaseCountsForProject(input.projectId)
  return row
}

export async function createProjectTermRow(input: {
  projectId: string
  direction: string
  category: string
  name: string
  body?: string | null
  status?: string | null
  workflowPhaseId?: string | null
}) {
  await requireProjectOrThrow(input.projectId)
  const status =
    input.status && TERM_STATUS.has(input.status) ? input.status : 'pending'
  const workflowPhaseId = await resolveWorkflowPhaseIdForNewItem(
    input.projectId,
    input.workflowPhaseId,
  )
  const row = await prisma.projectTerm.create({
    data: {
      projectId: input.projectId,
      workflowPhaseId,
      direction: input.direction,
      category: input.category,
      name: input.name,
      body: input.body ?? null,
      status,
      sortOrder: await nextTermSortOrder(input.projectId),
    },
  })
  await refreshWorkflowPhaseCountsForProject(input.projectId)
  return row
}

export async function createProjectMaterialRow(input: {
  projectId: string
  name: string
  format?: string | null
  size?: string | null
  description?: string | null
  category?: string | null
  workflowPhaseId?: string | null
}) {
  await requireProjectOrThrow(input.projectId)
  const workflowPhaseId = await resolveWorkflowPhaseIdForNewItem(
    input.projectId,
    input.workflowPhaseId,
  )
  const row = await prisma.projectMaterial.create({
    data: {
      projectId: input.projectId,
      workflowPhaseId,
      name: input.name,
      format: input.format?.trim() || 'PDF',
      size: input.size?.trim() || null,
      description: input.description?.trim() || null,
      category: input.category?.trim() || '通用材料',
    },
  })
  await refreshWorkflowPhaseCountsForProject(input.projectId)
  return row
}

export async function createProjectWorkflowPhaseRow(input: {
  projectId: string
  groupLabel: string
  name: string
  fullLabel: string
  status?: string | null
  hypothesesCount?: number | null
  termsCount?: number | null
  materialsCount?: number | null
}) {
  await requireProjectOrThrow(input.projectId)
  const status =
    input.status && PHASE_STATUS.has(input.status) ? input.status : 'upcoming'
  const sortOrder = await nextWorkflowPhaseSortOrder(input.projectId)
  const row = await prisma.projectWorkflowPhase.create({
    data: {
      projectId: input.projectId,
      sortOrder,
      groupLabel: input.groupLabel,
      name: input.name,
      fullLabel: input.fullLabel,
      hypothesesCount: input.hypothesesCount ?? 0,
      termsCount: input.termsCount ?? 0,
      materialsCount: input.materialsCount ?? 0,
      status,
    },
  })
  await refreshWorkflowPhaseCountsForProject(input.projectId)
  return row
}

/**
 * 完成当前「进行中」阶段并激活下一个「待启动」阶段（按 sortOrder）。
 */
export async function advanceProjectWorkflowPhase(projectId: string) {
  await requireProjectOrThrow(projectId)
  return prisma.$transaction(async (tx) => {
    const phases = await tx.projectWorkflowPhase.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })
    const activeIdx = phases.findIndex((p) => p.status === 'active')
    const nextIdx = phases.findIndex(
      (p, i) => i > activeIdx && p.status === 'upcoming',
    )
    if (activeIdx < 0 || nextIdx < 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '无可推进的阶段：需要存在「进行中」与至少一个排在它之后的「待启动」阶段',
      })
    }
    const today = new Date()
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )
    await tx.projectWorkflowPhase.update({
      where: { id: phases[activeIdx]!.id },
      data: {
        status: 'completed',
        endDate: todayDate,
      },
    })
    await tx.projectWorkflowPhase.update({
      where: { id: phases[nextIdx]!.id },
      data: {
        status: 'active',
        startDate: todayDate,
      },
    })
    return { ok: true as const }
  }).then(async () => {
    await refreshWorkflowPhaseCountsForProject(projectId)
    return { ok: true as const }
  })
}
