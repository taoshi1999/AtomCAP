import { prisma } from '@/src/server/db'
import { mapProjectRowToListItem } from '@/src/lib/project-list-mapper'

/** 假设价值点 / 风险点评论（锚定 pointKey） */
export type WorkspaceCommentDto = {
  id: string
  author: string
  content: string
  time: string
}

/** 与 `HypothesisChecklist` / `hypothesis-checklist` 表格行一致 */
export type ProjectHypothesisRowDto = {
  id: string
  workflowPhaseId?: string | null
  direction: string
  category: string
  name: string
  body?: string
  owner: string
  createdAt: string
  updatedAt: string
  status: 'verified' | 'pending' | 'risky'
  /** pointKey → 评论列表（见 `hypothesis-checklist` 生成的 `${id}-vp-1` / `-rp-1`） */
  pointComments?: Record<string, WorkspaceCommentDto[]>
}

/** 与 `TermSheet` / `term-sheet` 表格行一致 */
export type ProjectTermRowDto = {
  id: string
  workflowPhaseId?: string | null
  direction: string
  category: string
  name: string
  body?: string
  owner: string
  createdAt: string
  updatedAt: string
  status: 'approved' | 'pending' | 'rejected'
  /** sectionKey → 评论（ourDemand / ourBasis / …） */
  sectionComments?: Record<string, WorkspaceCommentDto[]>
}

/** 与 `strategies-grid` StrategyMaterial 一致（strategyId 复用为项目 id） */
export type ProjectMaterialRowDto = {
  id: string
  strategyId: string
  workflowPhaseId?: string | null
  name: string
  format: string
  size: string
  description: string
  category: string
  owner: string
  createdAt: string
}

/** 与 `workflow` Phase 一致 */
export type ProjectWorkflowPhaseDto = {
  id: string
  groupLabel: string
  name: string
  fullLabel: string
  assignee: string
  assigneeAvatar: string
  hypothesesCount: number
  termsCount: number
  materialsCount: number
  status: 'completed' | 'active' | 'upcoming'
  startDate: string
  endDate?: string
  logs: { action: string; date: string; author: string }[]
}

function mapHypothesisUiStatus(raw: string): ProjectHypothesisRowDto['status'] {
  if (raw === 'verified' || raw === 'risky') return raw
  return 'pending'
}

function mapTermUiStatus(raw: string): ProjectTermRowDto['status'] {
  if (raw === 'approved' || raw === 'rejected') return raw
  return 'pending'
}

function mapPhaseUiStatus(raw: string): ProjectWorkflowPhaseDto['status'] {
  if (raw === 'completed' || raw === 'active' || raw === 'upcoming') return raw
  return 'upcoming'
}

function dateOnly(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function formatWorkspaceCommentTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function mapHypothesisPointCommentsByHypothesis(
  rows: {
    id: string
    hypothesisId: string
    pointKey: string
    authorName: string
    content: string
    createdAt: Date
  }[],
): Map<string, Record<string, WorkspaceCommentDto[]>> {
  const out = new Map<string, Record<string, WorkspaceCommentDto[]>>()
  for (const r of rows) {
    const dto: WorkspaceCommentDto = {
      id: r.id,
      author: r.authorName,
      content: r.content,
      time: formatWorkspaceCommentTime(r.createdAt),
    }
    if (!out.has(r.hypothesisId)) out.set(r.hypothesisId, {})
    const inner = out.get(r.hypothesisId)!
    if (!inner[r.pointKey]) inner[r.pointKey] = []
    inner[r.pointKey].push(dto)
  }
  return out
}

function mapTermSectionCommentsByTerm(
  rows: {
    id: string
    termId: string
    sectionKey: string
    authorName: string
    content: string
    createdAt: Date
  }[],
): Map<string, Record<string, WorkspaceCommentDto[]>> {
  const out = new Map<string, Record<string, WorkspaceCommentDto[]>>()
  for (const r of rows) {
    const dto: WorkspaceCommentDto = {
      id: r.id,
      author: r.authorName,
      content: r.content,
      time: formatWorkspaceCommentTime(r.createdAt),
    }
    if (!out.has(r.termId)) out.set(r.termId, {})
    const inner = out.get(r.termId)!
    if (!inner[r.sectionKey]) inner[r.sectionKey] = []
    inner[r.sectionKey].push(dto)
  }
  return out
}

/**
 * US-005 项目工作区：概览 + 假设/条款/材料清单 + 工作流阶段，全部来自 Prisma（UI-ready DTO）。
 */
export async function loadProjectOverviewDto(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return null

  const managerName = project.managerName?.trim() || '未指派'
  const assigneeAvatar = managerName.slice(0, 1) || '?'

  const [hypothesisRows, termRows, materialRows, phaseRows] = await Promise.all([
    prisma.projectHypothesis.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.projectTerm.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.projectMaterial.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.projectWorkflowPhase.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const hypIds = hypothesisRows.map((h) => h.id)
  const termIds = termRows.map((t) => t.id)

  const [hypothesisPointCommentRows, termSectionCommentRows] = await Promise.all([
    hypIds.length > 0
      ? prisma.projectHypothesisPointComment.findMany({
          where: { hypothesisId: { in: hypIds } },
          orderBy: { createdAt: 'asc' },
        })
      : [],
    termIds.length > 0
      ? prisma.projectTermSectionComment.findMany({
          where: { termId: { in: termIds } },
          orderBy: { createdAt: 'asc' },
        })
      : [],
  ])

  const hypCommentsByHyp = mapHypothesisPointCommentsByHypothesis(hypothesisPointCommentRows)
  const termCommentsByTerm = mapTermSectionCommentsByTerm(termSectionCommentRows)

  const hypotheses: ProjectHypothesisRowDto[] = hypothesisRows.map((h) => ({
    id: h.id,
    workflowPhaseId: h.workflowPhaseId ?? null,
    direction: h.direction,
    category: h.category,
    name: h.name,
    body: h.body ?? undefined,
    owner: managerName,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    status: mapHypothesisUiStatus(h.status),
    pointComments: hypCommentsByHyp.get(h.id),
  }))

  const terms: ProjectTermRowDto[] = termRows.map((t) => ({
    id: t.id,
    workflowPhaseId: t.workflowPhaseId ?? null,
    direction: t.direction,
    category: t.category,
    name: t.name,
    body: t.body ?? undefined,
    owner: managerName,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    status: mapTermUiStatus(t.status),
    sectionComments: termCommentsByTerm.get(t.id),
  }))

  const materials: ProjectMaterialRowDto[] = materialRows.map((m) => ({
    id: m.id,
    strategyId: projectId,
    workflowPhaseId: m.workflowPhaseId ?? null,
    name: m.name,
    format: m.format,
    size: m.size ?? '',
    description: m.description ?? '',
    category: m.category,
    owner: managerName,
    createdAt: m.createdAt.toISOString(),
  }))

  const phases: ProjectWorkflowPhaseDto[] = phaseRows.map((row) => ({
    id: row.id,
    groupLabel: row.groupLabel,
    name: row.name,
    fullLabel: row.fullLabel,
    assignee: managerName,
    assigneeAvatar,
    hypothesesCount: hypothesisRows.filter((h) => h.workflowPhaseId === row.id)
      .length,
    termsCount: termRows.filter((t) => t.workflowPhaseId === row.id).length,
    materialsCount: materialRows.filter((m) => m.workflowPhaseId === row.id)
      .length,
    status: mapPhaseUiStatus(row.status),
    startDate: dateOnly(row.startDate),
    endDate: row.endDate ? dateOnly(row.endDate) : undefined,
    logs: [],
  }))

  const activePhase = phaseRows.find((p) => p.status === 'active') ?? null
  const card = mapProjectRowToListItem(project)

  return {
    project: {
      ...card,
      diligenceProgressPct: project.diligenceProgressPct ?? null,
      riskLevelLabel: project.riskLevelLabel ?? null,
      overviewNextStepHint: project.overviewNextStepHint ?? null,
    },
    counts: {
      hypotheses: hypotheses.length,
      terms: terms.length,
      materials: materials.length,
    },
    currentPhase: activePhase
      ? {
          label: activePhase.fullLabel,
          phaseId: activePhase.id,
          groupLabel: activePhase.groupLabel,
        }
      : {
          label: null,
          phaseId: null,
          groupLabel: null,
        },
    hypotheses,
    terms,
    materials,
    phases,
  }
}
