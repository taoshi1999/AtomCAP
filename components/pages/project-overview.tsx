"use client"

import {
  DollarSign,
  TrendingUp,
  ShieldAlert,

  Upload,
  CheckCircle2,
  FileText,
  Clock,
  Briefcase,
  User,
  Calendar,
  Tag,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const defaultMetrics = [
  {
    label: "估值",
    value: "10亿",
    unit: "USD",
    icon: DollarSign,
    trend: "+15%",
    trendUp: true,
  },
  {
    label: "累计融资金额",
    value: "3.2亿",
    unit: "USD",
    icon: TrendingUp,
    trend: "B轮",
    trendUp: true,
  },
  {
    label: "风险指数",
    value: "低",
    unit: "",
    icon: ShieldAlert,
    trend: "2/10",
    trendUp: false,
  },
]

const defaultTimeline = [
  {
    user: "张伟",
    avatar: "张",
    action: "上传了财务报表",
    target: "MiniMax_财务数据_2023Q4.xlsx",
    time: "2小时前",
    icon: Upload,
    color: "bg-blue-100 text-blue-600",
  },
  {
    user: "李四",
    avatar: "李",
    action: "完成了技术尽调",
    target: "AI 模型架构评估报告",
    time: "5小时前",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    user: "王芳",
    avatar: "王",
    action: "更新了条款草案",
    target: "B轮投资条款 v2.1",
    time: "昨天 16:30",
    icon: FileText,
    color: "bg-amber-100 text-amber-600",
  },
  {
    user: "赵强",
    avatar: "赵",
    action: "添加了竞品分析",
    target: "智谱AI vs MiniMax 对比报告",
    time: "昨天 10:15",
    icon: TrendingUp,
    color: "bg-violet-100 text-violet-600",
  },
]

interface ProjectOverviewProps {
  project?: {
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
  }
  isNewProject?: boolean
}

export function ProjectOverview({ project, isNewProject = false }: ProjectOverviewProps) {
  // For new projects, show their own data
  if (isNewProject && project) {
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
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {project.name} - {project.round || "待定"}投资项目仪表盘
              {project.strategyName && <span className="ml-2 text-[#2563EB]">(策略: {project.strategyName})</span>}
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
              <div className="flex items-center gap-3">
                {project.tags?.map((tag, idx) => (
                  <Badge key={idx} className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                    {tag}
                  </Badge>
                ))}
                {project.round && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                    {project.round}
                  </Badge>
                )}
                {/* <Badge className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50">
                  新建项目
                </Badge> */}
              </div>
            </div>
          </div>

          {/* Basic Info for New Projects */}
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

          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            {newMetrics.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.label}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">{m.label}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                      <Icon className="h-4 w-4 text-[#6B7280]" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[#111827]">
                    {m.value}
                    {m.unit && (
                      <span className="ml-1 text-sm font-normal text-[#9CA3AF]">
                        {m.unit}
                      </span>
                    )}
                  </p>
                  <p className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"}`}>
                    {m.trend}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Empty Timeline */}
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

  // Default view for existing projects (MiniMax etc)
  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
          <p className="mt-1 text-sm text-[#6B7280]">MiniMax - B轮投资项目仪表盘</p>
        </div>

        {/* Project Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-white text-xl font-bold">
              M
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#111827]">MiniMax</h2>
              <p className="mt-0.5 text-sm text-[#6B7280]">
                通用人工智能科技公司，专注于大模型研发
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                AI
              </Badge>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                B轮
              </Badge>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                设立期
              </Badge>
            </div>
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">负责人</p>
                <p className="text-sm font-medium text-[#111827]">张伟</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">关联策略</p>
                <p className="text-sm font-medium text-[#111827]">大模型应用</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">创建日期</p>
                <p className="text-sm font-medium text-[#111827]">2024-01-15</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Tag className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">项目状态</p>
                <p className="text-sm font-medium text-[#111827]">设立期</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {defaultMetrics.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.label}
                className="rounded-xl border border-[#E5E7EB] bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">{m.label}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                    <Icon className="h-4 w-4 text-[#6B7280]" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#111827]">
                  {m.value}
                  {m.unit && (
                    <span className="ml-1 text-sm font-normal text-[#9CA3AF]">
                      {m.unit}
                    </span>
                  )}
                </p>
                <p
                  className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"
                    }`}
                >
                  {m.trend}
                </p>
              </div>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
          <div className="space-y-4">
            {defaultTimeline.map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className="flex items-start gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {idx < defaultTimeline.length - 1 && (
                      <div className="mt-1 h-8 w-px bg-[#E5E7EB]" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm text-[#374151]">
                      <span className="font-medium">{item.user}</span>{" "}
                      {item.action}
                    </p>
                    <p className="text-xs text-[#6B7280]">{item.target}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-[#9CA3AF]">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
