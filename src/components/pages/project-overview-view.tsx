"use client"

/**
 * 《页面重构流程》⑤ 项目概览纯展示：只接 props，不 fetch、不使用 next-auth / next/navigation。
 * 数据由路由页 `api.project.getOverview`（或 SPA 父级）注入；本文件仅负责排版与轻量展示格式化。
 */

import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Clock,
  Briefcase,
  User,
  Calendar,
  Tag,
  MessageCircle,
  ListChecks,
  Scale,
  FolderOpen,
} from "lucide-react"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Progress } from "@/src/components/ui/progress"
import { Separator } from "@/src/components/ui/separator"
import { cn } from "@/src/lib/utils"
import { formatDisplayDateTime } from "@/src/lib/datetime"

/** 与 `loadProjectOverviewDto` → 列表卡片 / getOverview.project 对齐的卡片字段 */
export type ProjectOverviewCardFields = {
  name?: string
  description?: string
  round?: string
  valuation?: string
  status?: string
  owner?: { name: string; initials?: string }
  strategyName?: string
  createdAt?: string
  tags?: string[]
  logo?: string
  diligenceProgressPct?: number | null
  riskLevelLabel?: string | null
  overviewNextStepHint?: string | null
}

export type ProjectOverviewPersistedViewProps = {
  project: ProjectOverviewCardFields
  overviewCounts?: { hypotheses: number; terms: number; materials: number }
  overviewPhaseLabel?: string | null
  onOpenCommunicationCenter: () => void
}

/** 已落库项目概览（数据来自 DB / getOverview DTO） */
export function ProjectOverviewPersistedView({
  project,
  overviewCounts,
  overviewPhaseLabel,
  onOpenCommunicationCenter,
}: ProjectOverviewPersistedViewProps) {
  const counts = overviewCounts ?? { hypotheses: 0, terms: 0, materials: 0 }
  const phaseLine = overviewPhaseLabel?.trim() || "未配置激活阶段"
  const completion = project.diligenceProgressPct ?? 0
  const riskLabel = project.riskLevelLabel?.trim() || "待评估"
  const nextHint =
    project.overviewNextStepHint?.trim() ||
    "优先补齐法务与财务材料，完成关键假设验证后再进入投决。"

  const vm = {
    name: project.name || "项目",
    description: project.description?.trim() || "暂无项目简介",
    round: project.round?.trim() || "待定",
    valuation: project.valuation?.trim() || "待定",
    status: project.status || "设立期",
    owner: project.owner?.name || "待分配",
    strategy: project.strategyName || "未关联策略",
    createdAt: project.createdAt ? formatDisplayDateTime(project.createdAt) : "—",
    logo: project.logo?.trim() || (project.name ?? "").trim().charAt(0) || "P",
    tags: project.tags ?? [],
  }

  const valuationUsdUnit = vm.valuation === "" || vm.valuation === "待定" ? "" : "USD"

  const metrics = [
    {
      label: "估值",
      value: vm.valuation,
      unit: valuationUsdUnit,
      icon: DollarSign,
      note: "来自项目档案（数据库）",
    },
    {
      label: "融资轮次",
      value: vm.round,
      unit: "",
      icon: TrendingUp,
      note: project.status || "当前项目阶段",
    },
    {
      label: "风险等级",
      value: riskLabel,
      unit: "",
      icon: ShieldAlert,
      note: "尽调后更新",
    },
  ]

  const statusStyle =
    vm.status === "已退出"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-300 bg-slate-100 text-slate-800"

  return (
    <div className="h-full overflow-auto bg-[#f3f4f6]">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Briefing</p>
            <h1 className="mt-1 truncate text-[28px] font-semibold leading-tight text-slate-900">{vm.name}</h1>
            <p className="mt-1 truncate text-sm text-slate-600">
              {vm.round} · {vm.strategy}
              <span className="ml-2 text-xs text-slate-400">（概览数据来自数据库）</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            type="button"
            onClick={onOpenCommunicationCenter}
          >
            <MessageCircle className="h-4 w-4" />
            交流中心
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Card className="overflow-hidden rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
              <div className="h-[92px] w-full bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155]" />
              <CardContent className="-mt-8 pb-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm">
                    {vm.logo}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-white">{vm.name}</p>
                      <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px] font-semibold", statusStyle)}>
                        {vm.status}
                      </Badge>
                      <Badge variant="outline" className="border-slate-300 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {vm.round}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-[520px] rounded-md bg-black/25 px-2.5 py-1.5 text-sm leading-5 text-slate-50 backdrop-blur-[1px]">
                      {vm.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {vm.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="border-slate-300 bg-white text-[11px] text-slate-700">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {metrics.map((m) => {
                const Icon = m.icon
                return (
                  <Card key={m.label} className="rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="text-[12px] text-slate-500">{m.label}</CardDescription>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                          <Icon className="h-4 w-4 text-slate-600" />
                        </div>
                      </div>
                      <CardTitle className="text-[34px] font-semibold leading-none tracking-tight text-slate-900">
                        {m.value}
                        {m.unit ? <span className="ml-1 text-sm font-medium text-slate-500">{m.unit}</span> : null}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-slate-500">{m.note}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card className="rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">三清单与阶段（数据库）</CardTitle>
                <CardDescription className="text-slate-500">假设 / 条款 / 材料在库条数与当前工作流阶段</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                      <ListChecks className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">假设清单</p>
                      <p className="text-xl font-semibold text-slate-900">{counts.hypotheses}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                      <Scale className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">条款清单</p>
                      <p className="text-xl font-semibold text-slate-900">{counts.terms}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                      <FolderOpen className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">项目材料</p>
                      <p className="text-xl font-semibold text-slate-900">{counts.materials}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/80 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-blue-900/80">当前阶段</p>
                  <p className="mt-1 text-sm font-semibold text-blue-950">{phaseLine}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">最近动态</CardTitle>
                <CardDescription className="text-slate-500">审计留痕与协作事件（后续可接库表）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">暂无动态记录</p>
                  <p className="mt-1 text-xs text-slate-500">清单与阶段数据已从数据库加载。</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <Card className="rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">关键事实</CardTitle>
                <CardDescription className="text-slate-500">Executive Snapshot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-[88px_1fr] items-center gap-2 py-1.5 text-sm">
                  <span className="text-slate-500">负责人</span>
                  <span className="justify-self-end font-semibold text-slate-800">{vm.owner}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-[88px_1fr] items-center gap-2 py-1.5 text-sm">
                  <span className="text-slate-500">关联策略</span>
                  <span className="justify-self-end font-semibold text-slate-800">{vm.strategy}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-[88px_1fr] items-center gap-2 py-1.5 text-sm">
                  <span className="text-slate-500">创建日期</span>
                  <span className="justify-self-end font-semibold text-slate-800">{vm.createdAt}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-[88px_1fr] items-center gap-2 py-1.5 text-sm">
                  <span className="text-slate-500">项目状态</span>
                  <span className="justify-self-end">
                    <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px] font-semibold", statusStyle)}>
                      {vm.status}
                    </Badge>
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">风控与推进</CardTitle>
                <CardDescription className="text-slate-500">Risk & Execution（数据库）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-500">尽调完成度</span>
                    <span className="font-semibold text-slate-800">
                      {project.diligenceProgressPct == null ? "—" : `${completion}%`}
                    </span>
                  </div>
                  <Progress
                    value={project.diligenceProgressPct == null ? 0 : completion}
                    className="h-2 bg-slate-200 [&>div]:bg-slate-700"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">下一步建议</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{nextHint}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export type ProjectOverviewNewProjectViewProps = {
  project: ProjectOverviewCardFields
  onOpenCommunicationCenter: () => void
}

/** 新建项目（SPA 本地）概览 */
export function ProjectOverviewNewProjectView({ project, onOpenCommunicationCenter }: ProjectOverviewNewProjectViewProps) {
  const newMetrics = [
    {
      label: "估值",
      value: project.valuation || "待定",
      unit: project.valuation ? "USD" : "",
      icon: DollarSign,
      trend: "新项目",
      trendUp: true,
    },
    {
      label: "融资轮次",
      value: project.round || "待定",
      unit: "",
      icon: TrendingUp,
      trend: "设立期",
      trendUp: true,
    },
    {
      label: "风险指数",
      value: "待评估",
      unit: "",
      icon: ShieldAlert,
      trend: "-",
      trendUp: false,
    },
  ]

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {project.name} - {project.round || "待定"}投资项目仪表盘
            {project.strategyName && <span className="ml-2 text-[#2563EB]">(策略: {project.strategyName})</span>}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-xl font-bold text-white">
              {project.logo || project.name?.charAt(0) || "P"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#111827]">{project.name}</h2>
              <p className="mt-0.5 text-sm text-[#6B7280]">{project.description || "暂无项目简介"}</p>
            </div>
            <div className="flex items-center gap-3">
              {project.tags?.map((tag, idx) => (
                <Badge key={idx} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                  {tag}
                </Badge>
              ))}
              {project.round && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">{project.round}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">负责人</p>
                <p className="text-sm font-medium text-[#111827]">{project.owner?.name || "待分配"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">关联策略</p>
                <p className="text-sm font-medium text-[#111827]">{project.strategyName || "无"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">创建日期</p>
                <p className="text-sm font-medium text-[#111827]">{project.createdAt || "今天"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Tag className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">项目状态</p>
                <p className="text-sm font-medium text-[#111827]">{project.status || "设立期"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {newMetrics.map((m) => {
            const Icon = m.icon
            return (
              <div key={m.label} className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">{m.label}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                    <Icon className="h-4 w-4 text-[#6B7280]" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#111827]">
                  {m.value}
                  {m.unit && <span className="ml-1 text-sm font-normal text-[#9CA3AF]">{m.unit}</span>}
                </p>
                <p className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"}`}>{m.trend}</p>
              </div>
            )
          })}
          <button
            type="button"
            onClick={onOpenCommunicationCenter}
            className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2563EB]/30 bg-gradient-to-br from-[#EFF6FF] to-white p-5 transition-all hover:border-[#2563EB] hover:shadow-md hover:shadow-blue-100"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB]/10 transition-colors group-hover:bg-[#2563EB]/20">
              <MessageCircle className="h-5 w-5 text-[#2563EB]" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-[#2563EB]">交流中心</p>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">团队协作沟通</p>
          </button>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
              <Clock className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mt-3 text-sm text-[#6B7280]">暂无动态记录</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">项目活动将在此处显示</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 无项目上下文时的占位（不在此请求数据） */
export function ProjectOverviewEmptyView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#f3f4f6] px-6">
      <p className="text-sm font-medium text-slate-800">暂无项目数据</p>
      <p className="max-w-md text-center text-xs text-slate-500">
        请从「项目」列表打开具体项目；已落库项目的概览由数据库经 getOverview 注入。
      </p>
    </div>
  )
}
