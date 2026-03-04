"use client"

import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Vote,
  Upload,
  CheckCircle2,
  FileText,
  Clock,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const metrics = [
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
  {
    label: "IC 投票进度",
    value: "4/6",
    unit: "票",
    icon: Vote,
    trend: "进行中",
    trendUp: true,
  },
]

const timeline = [
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
    owner?: { name: string }
    strategyName?: string
    createdAt?: string
  }
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const isNewProject = project?.createdAt && new Date(project.createdAt).getTime() > Date.now() - 86400000 * 7

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {project?.name || "MiniMax"} - {project?.round || "B轮"}投资项目仪表盘
            {project?.strategyName && <span className="ml-2 text-[#2563EB]">({project.strategyName})</span>}
          </p>
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
                {"通用人工智能科技公司，专注于大模型研发"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                AI
              </Badge>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                B轮
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                尽调中
              </Badge>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((m) => {
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
                  className={`mt-1 text-xs ${
                    m.trendUp ? "text-emerald-600" : "text-[#6B7280]"
                  }`}
                >
                  {m.trend}
                </p>
              </div>
            )
          })}
        </div>

        {/* IC Vote Progress */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-3 text-base font-semibold text-[#111827]">IC 投票进度</h3>
          <Progress value={67} className="h-2" />
          <div className="mt-2 flex justify-between text-xs text-[#6B7280]">
            <span>已通过 4 票</span>
            <span>需要 6 票</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
          <div className="space-y-4">
            {timeline.map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className="flex items-start gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {idx < timeline.length - 1 && (
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
