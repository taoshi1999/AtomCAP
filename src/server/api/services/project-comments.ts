import { prisma } from '@/src/server/db'
import { TRPCError } from '@trpc/server'

const POINT_KIND = new Set(['value', 'risk'])

const TERM_SECTION_KEYS = new Set([
  'ourDemand',
  'ourBasis',
  'bilateralConflict',
  'ourBottomLine',
  'compromiseSpace',
  'negotiationResult',
  'implementationStatus',
])

export async function requireHypothesisInProject(hypothesisId: string, projectId: string) {
  const row = await prisma.projectHypothesis.findFirst({
    where: { id: hypothesisId, projectId },
    select: { id: true },
  })
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '假设不存在或不属于该项目' })
  }
}

export async function requireTermInProject(termId: string, projectId: string) {
  const row = await prisma.projectTerm.findFirst({
    where: { id: termId, projectId },
    select: { id: true },
  })
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '条款不存在或不属于该项目' })
  }
}

export async function createHypothesisPointComment(input: {
  hypothesisId: string
  projectId: string
  pointKind: string
  pointKey: string
  content: string
  authorName: string
}) {
  await requireHypothesisInProject(input.hypothesisId, input.projectId)
  const kind =
    POINT_KIND.has(input.pointKind) ? input.pointKind : null
  if (!kind) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'pointKind 须为 value 或 risk',
    })
  }
  const key = input.pointKey.trim()
  if (!key || key.length > 180) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'pointKey 无效' })
  }
  const text = input.content.trim()
  if (!text || text.length > 50_000) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '评论内容无效' })
  }

  return prisma.projectHypothesisPointComment.create({
    data: {
      hypothesisId: input.hypothesisId,
      pointKind: kind,
      pointKey: key,
      content: text,
      authorName: input.authorName.trim().slice(0, 128) || '用户',
    },
  })
}

export async function createTermSectionComment(input: {
  termId: string
  projectId: string
  sectionKey: string
  content: string
  authorName: string
}) {
  await requireTermInProject(input.termId, input.projectId)
  const sk = input.sectionKey.trim()
  if (!TERM_SECTION_KEYS.has(sk)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '无效的区块标识' })
  }
  const text = input.content.trim()
  if (!text || text.length > 50_000) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '评论内容无效' })
  }

  return prisma.projectTermSectionComment.create({
    data: {
      termId: input.termId,
      sectionKey: sk,
      content: text,
      authorName: input.authorName.trim().slice(0, 128) || '用户',
    },
  })
}
