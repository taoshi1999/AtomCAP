import type { Project as ProjectRow } from '@prisma/client'

/**
 * 与列表卡片字段对齐（负责人为 manager* 平铺字段）。
 */
const STATUS_COLOR_BY_LABEL: Record<string, string> = {
  未立项: 'bg-gray-50 text-gray-600 border-gray-200',
  投前阶段: 'bg-blue-50 text-blue-700 border-blue-200',
  投前期: 'bg-blue-50 text-blue-700 border-blue-200',
  投中阶段: 'bg-amber-50 text-amber-700 border-amber-200',
  投中期: 'bg-amber-50 text-amber-700 border-amber-200',
  投后阶段: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  投后期: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  已退出: 'bg-red-50 text-red-700 border-red-200',
}

function statusColorFor(displayStatus: string): string {
  return STATUS_COLOR_BY_LABEL[displayStatus] ?? 'bg-gray-50 text-gray-600 border-gray-200'
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.replace(/[{}]/g, '').trim())
    .filter(Boolean)
}

export type ProjectListGridItem = {
  id: string
  name: string
  logo: string
  description: string
  tags: string[]
  status: string
  statusColor: string
  valuation: string
  round: string
  owner: { id: string; name: string; initials: string }
  strategyId?: string
  strategyName?: string
  createdAt: string
  updatedAt: string
}

export function mapProjectRowToListItem(p: ProjectRow): ProjectListGridItem {
  const displayStatus = p.stage?.replace(/[{}]/g, '').trim() || p.status?.replace(/[{}]/g, '').trim() || '未立项'
  const managerName = p.managerName?.trim() || '未指派'
  const managerId = p.managerId?.trim() || '1'

  return {
    id: p.id,
    name: p.name,
    logo: p.logo || (p.name.length > 0 ? p.name[0]! : 'P'),
    description: p.description ?? '',
    tags: parseTags(p.tags),
    status: displayStatus,
    statusColor: statusColorFor(displayStatus),
    valuation: p.valuation ?? '待定',
    round: (p.round ?? '未知轮次').replace(/[{}]/g, ''),
    owner: {
      id: managerId,
      name: managerName,
      initials: managerName.slice(0, 1),
    },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}
