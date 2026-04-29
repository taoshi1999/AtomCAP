"use client"

import { useParams } from "next/navigation"
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Briefcase,
  User,
  Calendar,
  Tag,
  Clock,
  FileText,
  PieChart,
  Target,
} from "lucide-react"
import { api } from "@/src/trpc/react"
import { Badge } from "@/src/components/ui/badge"

function formatDate(d?: Date | string | null) {
  if (!d) return "-"
  const date = typeof d === "string" ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return "-"
  return date.toISOString().slice(0, 10)
}

function timeAgo(d?: Date | string | null) {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return formatDate(date)
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const { data: project, isLoading, error } = api.project.getById.useQuery({ id: projectId })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载项目概览...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-red-500">加载失败：{error?.message || "项目不存在"}</div>
      </div>
    )
  }

  const tags = project.tags
    ? project.tags.split(",").map((t) => t.replace(/[{}]/g, "").trim()).filter(Boolean)
    : []

  const metrics = [
    {
      label: "估值",
      value: project.valuation || "待定",
      unit: project.valuation ? "" : "",
      icon: DollarSign,
      trend: project.round || "-",
      trendUp: true,
    },
    {
      label: "累计投资金额",
      value: project.totalInvestment != null ? `${project.totalInvestment}` : "待定",
      unit: project.totalInvestment != null ? "亿" : "",
      icon: TrendingUp,
      trend: project.budget != null ? `预算 ${project.budget}亿` : "-",
      trendUp: true,
    },
    {
      label: "IRR",
      value: project.irr != null ? `${project.irr}` : "待评估",
      unit: project.irr != null ? "%" : "",
      icon: PieChart,
      trend: project.irr != null && project.irr >= 20 ? "表现良好" : "-",
      trendUp: (project.irr ?? 0) >= 20,
    },
    {
      label: "项目状态",
      value: project.status || "设立期",
      unit: "",
      icon: ShieldAlert,
      trend: project.priority ? `优先级 ${project.priority}` : "-",
      trendUp: false,
    },
  ]

  const documents = (project as any).documents as Array<{
    id: string
    name: string
    format?: string | null
    category?: string | null
    createdAt: Date | string
  }> | undefined

  const timeline = (documents || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {project.name}
            {project.round ? ` - ${project.round}` : ""} 投资项目仪表盘
            {project.industry && <span className="ml-2 text-[#2563EB]">(行业: {project.industry})</span>}
          </p>
        </div>

        {/* Project Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-white text-xl font-bold">
              {project.logo || project.name?.charAt(0) || "P"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#111827]">{project.name}</h2>
              <p className="mt-0.5 text-sm text-[#6B7280]">
                {project.description || "暂无项目简介"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {tags.map((tag, idx) => (
                <Badge key={idx} className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                  {tag}
                </Badge>
              ))}
              {project.round && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                  {project.round}
                </Badge>
              )}
              {project.stage && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                  {project.stage}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">负责人</p>
                <p className="text-sm font-medium text-[#111827]">
                  {project.managerName || "待分配"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">所属行业</p>
                <p className="text-sm font-medium text-[#111827]">{project.industry || "未分类"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">创建日期</p>
                <p className="text-sm font-medium text-[#111827]">{formatDate(project.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Target className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">所处阶段</p>
                <p className="text-sm font-medium text-[#111827]">{project.stage || "设立期"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
                <Tag className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">投资轮次</p>
                <p className="text-sm font-medium text-[#111827]">{project.round || "未知"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                <Calendar className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">最近更新</p>
                <p className="text-sm font-medium text-[#111827]">{formatDate(project.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((m) => {
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
                <p className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"}`}>
                  {m.trend}
                </p>
              </div>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
                <Clock className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mt-3 text-sm text-[#6B7280]">暂无动态记录</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">项目材料与活动将在此处显示</p>
            </div>
          ) : (
            <div className="space-y-4">
              {timeline.map((doc, idx) => (
                <div key={doc.id} className="flex items-start gap-4">
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    {idx < timeline.length - 1 && <div className="mt-1 h-8 w-px bg-[#E5E7EB]" />}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm text-[#374151]">
                      新增{doc.category || "项目"}材料
                      <span className="ml-1 font-medium">{doc.name}</span>
                    </p>
                    {doc.format && (
                      <p className="text-xs text-[#6B7280]">{doc.format.toUpperCase()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-[#9CA3AF]">
                    <Clock className="h-3 w-3" />
                    {timeAgo(doc.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
