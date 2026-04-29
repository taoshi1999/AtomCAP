"use client"

import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp,
  Briefcase,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/src/components/ui/chart"
import { Badge } from "@/src/components/ui/badge"
import { cn } from "@/src/lib/utils"

/* ------------------------------------------------------------------ */
/*  Types (match the shape returned by api.dashboard.getOverview)     */
/* ------------------------------------------------------------------ */

export interface DashboardOverviewDTO {
  totalProjectCount: number
  totalInvestment: number | null
  fundCount: number
  newProjectCount: number
  irrMedian: number | null
  dpiDistribution: string | null // 形如 "12/20"
  avgReturnMultiple: number | null
  exitWinRate: number | null
  avgProjectDuration: number | null
  invalidEfficiency: number | null
  approvalPassRate: number | null
  highRiskProjectCount: number
  compliancePendingCount: number
  todayMeetingCount: number
  updatedAt: string | Date
}

export interface DashboardChartRow {
  id: string
  trackName: string | null
  trackInvestAmount: number | null
  trackRatio: number | null
  stageName: string | null
  stageProjectCount: number | null
  statisticMonth: string | null
  quarter: string | null
  fundIrr: number | null
  industryTopIrr: number | null
  industryAvgIrr: number | null
  managerName: string | null
  managerProjectCount: number | null
  managerAvgCycle: number | null
  managerEfficiencyScore: number | null
}

export interface DashboardTodoDTO {
  id: string
  type: string | null
  title: string | null
  projectName: string | null
  submitter: string | null
  submitTime: string | Date | null
  deadline: string | Date | null
  priority: string | null // "urgent" | "normal" | "low"
  operation: string | null
  createdAt: string | Date
}

export interface DashboardViewProps {
  overview: DashboardOverviewDTO | null
  charts: DashboardChartRow[]
  todos: DashboardTodoDTO[]
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const TRACK_COLORS = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#F59E0B", "#0EA5E9", "#A855F7"]

const TODO_TYPE_COLORS: Record<string, string> = {
  立项审批: "bg-blue-50 text-blue-700",
  投决材料预审: "bg-purple-50 text-purple-700",
  尽调报告审核: "bg-emerald-50 text-emerald-700",
  条款清单审批: "bg-amber-50 text-amber-700",
  项目退出申请: "bg-red-50 text-red-700",
  合规风险处置: "bg-orange-50 text-orange-700",
}

const URGENCY_CONFIG = {
  urgent: { label: "紧急", color: "bg-red-100 text-red-700 border-red-200" },
  normal: { label: "一般", color: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "较低", color: "bg-gray-100 text-gray-600 border-gray-200" },
} as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseDpiDistribution(raw: string | null): { above1: number; below1: number } {
  if (!raw) return { above1: 0, below1: 0 }
  const parts = raw.split(/[\/,\s]+/).map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
  return { above1: parts[0] ?? 0, below1: parts[1] ?? 0 }
}

function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—"
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DashboardView({ overview, charts, todos }: DashboardViewProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  /* --- 从 charts 宽表中派生 4 组图表数据 ---------------------------- */

  const trackDistribution = useMemo(() => {
    return charts
      .filter((c) => c.trackName && c.trackRatio !== null)
      .map((c, i) => ({
        name: c.trackName!,
        value: c.trackRatio!,
        color: TRACK_COLORS[i % TRACK_COLORS.length],
      }))
  }, [charts])

  const projectTrend = useMemo(() => {
    // 把所有有 statisticMonth 的行按月份分组，每组内按 stageName 累加 stageProjectCount
    const byMonth = new Map<string, { month: string; 立项: number; 投决: number; 退出: number }>()
    for (const c of charts) {
      if (!c.statisticMonth || !c.stageName || c.stageProjectCount === null) continue
      const bucket = byMonth.get(c.statisticMonth) ?? { month: c.statisticMonth, 立项: 0, 投决: 0, 退出: 0 }
      if (c.stageName === "立项" || c.stageName === "投决" || c.stageName === "退出") {
        bucket[c.stageName] += c.stageProjectCount
      }
      byMonth.set(c.statisticMonth, bucket)
    }
    return Array.from(byMonth.values())
  }, [charts])

  const benchmarkData = useMemo(() => {
    return charts
      .filter((c) => c.quarter && c.fundIrr !== null)
      .map((c) => ({
        quarter: c.quarter!,
        ourIRR: c.fundIrr!,
        industryP50: c.industryAvgIrr ?? 0,
        industryP75: c.industryTopIrr ?? 0,
      }))
  }, [charts])

  const teamRanking = useMemo(() => {
    return charts
      .filter((c) => c.managerName && c.managerEfficiencyScore !== null)
      .map((c) => ({
        name: c.managerName!,
        projects: c.managerProjectCount ?? 0,
        avgDays: c.managerAvgCycle ?? 0,
        score: c.managerEfficiencyScore!,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [charts])

  /* --- 派生 overview 各卡片数据 ------------------------------------ */

  const scaleOverview = {
    totalFundSize: overview?.totalInvestment ?? 0,
    fundCount: overview?.fundCount ?? 0,
    projectCount: overview?.totalProjectCount ?? 0,
    newProjectsThisYear: overview?.newProjectCount ?? 0,
  }

  const dpi = parseDpiDistribution(overview?.dpiDistribution ?? null)
  const returnMetrics = {
    irrMedian: overview?.irrMedian ?? 0,
    dpiDistribution: dpi,
    avgProjectReturn: overview?.avgReturnMultiple ?? 0,
    exitWinRate: overview?.exitWinRate ?? 0,
  }

  const efficiencyMetrics = {
    avgWorkHours: overview?.avgProjectDuration ?? 0,
    invalidDueDiligenceRate: overview?.invalidEfficiency ?? 0,
    approvalRate: overview?.approvalPassRate ?? 0,
  }

  const riskOverview = {
    highRiskProjects: overview?.highRiskProjectCount ?? 0,
    complianceTodos: overview?.compliancePendingCount ?? 0,
    todayMeetingProjects: overview?.todayMeetingCount ?? 0,
  }

  const urgentTodoCount = todos.filter((t) => t.priority === "urgent").length

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">数据看板</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              基金运营核心指标实时监控
            </p>
          </div>
          <div className="text-sm text-[#6B7280]">
            {currentTime ? `数据更新时间: ${formatTime(currentTime)}` : ""}
          </div>
        </div>

        {/* 4 Core Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {/* 规模总览 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-[#111827]">规模总览</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">基金总规模</p>
                <p className="text-xl font-bold text-[#111827]">{scaleOverview.totalFundSize}<span className="text-sm font-normal text-[#6B7280] ml-1">亿元</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">在管基金数量</p>
                <p className="text-xl font-bold text-[#111827]">{scaleOverview.fundCount}<span className="text-sm font-normal text-[#6B7280] ml-1">支</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">在管项目总数</p>
                <p className="text-xl font-bold text-[#111827]">{scaleOverview.projectCount}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">本年度新增项目</p>
                <p className="text-xl font-bold text-[#2563EB]">{scaleOverview.newProjectsThisYear}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span></p>
              </div>
            </div>
          </div>

          {/* 收益核心 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-[#111827]">收益核心</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">IRR中位数</p>
                <p className="text-xl font-bold text-emerald-600">{returnMetrics.irrMedian}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">DPI分布</p>
                <p className="text-sm font-medium text-[#111827]">
                  <span className="text-emerald-600">{returnMetrics.dpiDistribution.above1}</span>
                  <span className="text-[#9CA3AF]">/</span>
                  <span className="text-amber-600">{returnMetrics.dpiDistribution.below1}</span>
                </p>
                <p className="text-[10px] text-[#9CA3AF]">{'>'}1x / {'<'}1x</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">平均回报率</p>
                <p className="text-xl font-bold text-[#111827]">{returnMetrics.avgProjectReturn}<span className="text-sm font-normal text-[#6B7280] ml-1">x</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">退出胜率</p>
                <p className="text-xl font-bold text-emerald-600">{returnMetrics.exitWinRate}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
              </div>
            </div>
          </div>

          {/* 效率核心 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-[#111827]">效率核心</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs text-[#6B7280] mb-1">单项目平均耗时</p>
                <p className="text-xl font-bold text-[#111827]">{efficiencyMetrics.avgWorkHours}<span className="text-sm font-normal text-[#6B7280] ml-1">小时</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">无效尽调占比</p>
                <p className="text-lg font-bold text-[#111827]">{efficiencyMetrics.invalidDueDiligenceRate}%</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">立项过会率</p>
                <p className="text-lg font-bold text-[#111827]">{efficiencyMetrics.approvalRate}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
              </div>
            </div>
          </div>

          {/* 风险总览 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <h3 className="font-semibold text-[#111827]">风险总览</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B7280]">高风险项目</p>
                <p className={cn(
                  "text-lg font-bold",
                  riskOverview.highRiskProjects > 0 ? "text-red-600" : "text-[#111827]"
                )}>
                  {riskOverview.highRiskProjects}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B7280]">合规待办事项</p>
                <p className={cn(
                  "text-lg font-bold",
                  riskOverview.complianceTodos > 5 ? "text-amber-600" : "text-[#111827]"
                )}>
                  {riskOverview.complianceTodos}<span className="text-sm font-normal text-[#6B7280] ml-1">项</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B7280]">今日待上会项目</p>
                <p className="text-lg font-bold text-[#2563EB]">
                  {riskOverview.todayMeetingProjects}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* 赛道投资分布饼图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">赛道投资分布</h3>
              <p className="text-sm text-[#6B7280] mb-4">按投资金额占比统计</p>
              {trackDistribution.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-[#9CA3AF]">
                  暂无赛道数据
                </div>
              ) : (
                <>
                  <div className="h-[240px] flex items-center justify-center">
                    <PieChart width={450} height={240}>
                      <Pie
                        data={trackDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${value}%`}
                        labelLine={false}
                      >
                        {trackDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {trackDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-[#6B7280]">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 本年度立项/投决/退出趋势柱状图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">项目流程趋势</h3>
              <p className="text-sm text-[#6B7280] mb-4">本年度立项/投决/退出数量</p>
              {projectTrend.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-[#9CA3AF]">
                  暂无趋势数据
                </div>
              ) : (
                <ChartContainer
                  config={{
                    立项: { label: "立项", color: "#2563EB" },
                    投决: { label: "投决", color: "#7C3AED" },
                    退出: { label: "退出", color: "#059669" },
                  }}
                  className="h-[240px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="立项" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="投决" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="退出" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* IRR/DPI对标行业分位值折线图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">IRR行业对标</h3>
              <p className="text-sm text-[#6B7280] mb-4">基金IRR与行业分位值对比</p>
              {benchmarkData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-[#9CA3AF]">
                  暂无对标数据
                </div>
              ) : (
                <ChartContainer
                  config={{
                    ourIRR: { label: "本基金IRR", color: "#2563EB" },
                    industryP50: { label: "行业P50", color: "#9CA3AF" },
                    industryP75: { label: "行业P75", color: "#D1D5DB" },
                  }}
                  className="h-[240px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={benchmarkData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} padding={{ left: 30, right: 30 }} />
                      <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} unit="%" width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="ourIRR" stroke="#2563EB" strokeWidth={2} dot={{ fill: "#2563EB" }} name="本基金IRR" />
                      <Line type="monotone" dataKey="industryP50" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="行业P50" />
                      <Line type="monotone" dataKey="industryP75" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="行业P75" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>

            {/* 团队项目效能排行TOP5 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">团队效能排行</h3>
              <p className="text-sm text-[#6B7280] mb-4">TOP5成员项目效能评分</p>
              {teamRanking.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#9CA3AF]">
                  暂无团队数据
                </div>
              ) : (
                <div className="space-y-3">
                  {teamRanking.map((member, index) => (
                    <div key={member.name} className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        index === 0 ? "bg-amber-100 text-amber-700" :
                          index === 1 ? "bg-gray-200 text-gray-600" :
                            index === 2 ? "bg-orange-100 text-orange-700" :
                              "bg-gray-100 text-gray-500"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[#111827]">{member.name}</span>
                          <span className="text-sm font-bold text-[#2563EB]">{member.score}分</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                          <span>项目数: {member.projects}</span>
                          <span>平均周期: {member.avgDays}天</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 我的待办决策事项 */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#111827]">我的待办决策事项</h3>
              <p className="text-sm text-[#6B7280]">按紧急程度排序</p>
            </div>
            <Badge className="bg-red-100 text-red-700 border-red-200">
              {urgentTodoCount} 项紧急
            </Badge>
          </div>

          {todos.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#9CA3AF]">暂无待办事项</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
              <table className="w-full">
                <thead className="bg-[#F9FAFB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">事项类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">事项名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">关联项目</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">提交人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">提交时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">截止时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">紧急程度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {todos.map((item) => {
                    const urgency = (item.priority ?? "normal") as keyof typeof URGENCY_CONFIG
                    const urgencyConf = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG.normal
                    const typeColor = (item.type && TODO_TYPE_COLORS[item.type]) ?? "bg-gray-50 text-gray-700"
                    return (
                      <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3">
                          <Badge className={cn("text-xs", typeColor)}>
                            {item.type ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-[#111827]">{item.title ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-[#6B7280]">{item.projectName ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                              <span className="text-[10px] text-[#6B7280]">{item.submitter?.slice(0, 1) ?? "?"}</span>
                            </div>
                            <span className="text-sm text-[#6B7280]">{item.submitter ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-[#6B7280]">{formatDateTime(item.submitTime)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-sm",
                            urgency === "urgent" ? "text-red-600 font-medium" : "text-[#6B7280]"
                          )}>
                            {formatDateTime(item.deadline)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn("text-xs", urgencyConf.color)}>
                            {urgencyConf.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-sm text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1">
                            处理
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
