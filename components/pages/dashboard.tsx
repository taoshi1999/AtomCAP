"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  FolderKanban,
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Users,
  ChevronRight,
  Calendar,
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
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [dbData, setDbData] = useState<any>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 【前端核心逻辑】 异步请求触发机制
  // React 使用了生命周期钩子 useEffect，它会在组件渲染完成后立即执行一次里面的代码。
  // 在这个回调中自动触发 fetch 请求后端打包加工好的 /api/dashboard 数据。
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const data = await response.json()
          setDbData(data) // 成功拿到大 JSON 包后，存入页面的 dbData 状态中，引发下面的 React 动态再渲染。
        }
      } catch (err) {
        console.error('Failed to load dashboard data from API', err)
      }
    }
    loadData()
  }, [])

  const currentScaleOverview = {
    totalFundSize: dbData?.overview?.totalInvestment ?? 0,
    fundCount: dbData?.overview?.fundCount ?? 0,
    projectCount: dbData?.overview?.totalProjectCount ?? 0,
    newProjectsThisYear: dbData?.overview?.newProjectCount ?? 0,
  }

  const currentReturnMetrics = {
    irrMedian: dbData?.overview?.irrMedian ?? 0,
    dpiDistribution: { 
      above1: dbData?.overview?.dpiDistribution?.split('/')[0] ?? "0",
      below1: dbData?.overview?.dpiDistribution?.split('/')[1] ?? "0"
    },
    avgProjectReturn: dbData?.overview?.avgReturnMultiple ?? 0,
    exitWinRate: dbData?.overview?.exitWinRate ?? 0,
  }

  const currentEfficiencyMetrics = {
    avgWorkHours: dbData?.overview?.avgProjectDuration ?? 0,
    avgWorkHoursChange: 0,
    invalidDueDiligenceRate: dbData?.overview?.invalidEfficiency ?? 0,
    invalidDueDiligenceChange: 0,
    approvalRate: dbData?.overview?.approvalPassRate ?? 0,
  }

  const currentRiskOverview = {
    highRiskProjects: dbData?.overview?.highRiskProjectCount ?? 0,
    complianceTodos: dbData?.overview?.compliancePendingCount ?? 0,
    todayMeetingProjects: dbData?.overview?.todayMeetingCount ?? 0,
  }

  const currentTodos = (dbData?.todos || []).map((todo: any) => ({
    id: todo.id,
    type: todo.type || "未知事项",
    typeColor: "bg-blue-50 text-blue-700",
    title: todo.title || "-",
    project: todo.projectName || "-",
    submitter: todo.submitter || "-",
    submitTime: todo.submitTime ? new Date(todo.submitTime).toLocaleString("zh-CN") : "-",
    deadline: todo.deadline ? new Date(todo.deadline).toLocaleString("zh-CN") : "-",
    urgency: todo.priority === '紧急' ? 'urgent' : (todo.priority === '一般' ? 'normal' : 'low')
  }))

  const activeTeamRanking = (dbData?.charts || [])
    .filter((c: any) => c.managerName)
    .map((c: any) => ({
      name: c.managerName,
      projects: c.managerProjectCount || 0,
      avgDays: c.managerAvgCycle || 0,
      score: c.managerEfficiencyScore || 0
    }))

  const defaultColors = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#F59E0B"]
  const trackDistribution = (dbData?.charts || [])
    .filter((c: any) => c.trackName)
    .map((c: any, i: number) => ({
      name: c.trackName,
      value: c.trackRatio || 0,
      color: defaultColors[i % defaultColors.length]
    }))

  const projectTrendMap: Record<string, any> = {}
  ;(dbData?.charts || []).filter((c: any) => c.statisticMonth).forEach((c: any) => {
    if (!projectTrendMap[c.statisticMonth]) {
      projectTrendMap[c.statisticMonth] = { month: c.statisticMonth, 立项: 0, 投决: 0, 退出: 0 }
    }
    if (c.stageName === "立项") projectTrendMap[c.statisticMonth].立项 += c.stageProjectCount || 0
    if (c.stageName === "投决") projectTrendMap[c.statisticMonth].投决 += c.stageProjectCount || 0
    if (c.stageName === "退出") projectTrendMap[c.statisticMonth].退出 += c.stageProjectCount || 0
  })
  const projectTrend = Object.values(projectTrendMap)

  const benchmarkData = (dbData?.charts || [])
    .filter((c: any) => c.quarter)
    .map((c: any) => ({
      quarter: c.quarter,
      ourIRR: c.fundIrr || 0,
      industryP50: c.industryAvgIrr || 0,
      industryP75: c.industryTopIrr || 0,
      ourDPI: 0, dpiP50: 0
    }))

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

  const urgencyConfig = {
    urgent: { label: "紧急", color: "bg-red-100 text-red-700 border-red-200" },
    normal: { label: "一般", color: "bg-amber-100 text-amber-700 border-amber-200" },
    low: { label: "较低", color: "bg-gray-100 text-gray-600 border-gray-200" },
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6] overflow-x-hidden">
      <div className="px-4 py-4 md:px-6 md:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">数据看板</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              基金运营核心指标实时监控
            </p>
          </div>
          <div className="text-sm text-[#6B7280]">
            数据更新时间: {formatTime(currentTime)}
          </div>
        </div>

        {/* 4 Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-xl font-bold text-[#111827]">{currentScaleOverview.totalFundSize}<span className="text-sm font-normal text-[#6B7280] ml-1">亿元</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">在管基金数量</p>
                <p className="text-xl font-bold text-[#111827]">{currentScaleOverview.fundCount}<span className="text-sm font-normal text-[#6B7280] ml-1">支</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">在管项目总数</p>
                <p className="text-xl font-bold text-[#111827]">{currentScaleOverview.projectCount}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">本年度新增项目</p>
                <p className="text-xl font-bold text-[#2563EB]">{currentScaleOverview.newProjectsThisYear}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span></p>
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
                <p className="text-xl font-bold text-emerald-600">{currentReturnMetrics.irrMedian}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">DPI分布</p>
                <p className="text-sm font-medium text-[#111827]">
                  <span className="text-emerald-600">{currentReturnMetrics.dpiDistribution.above1}</span>
                  <span className="text-[#9CA3AF]">/</span>
                  <span className="text-amber-600">{currentReturnMetrics.dpiDistribution.below1}</span>
                </p>
                <p className="text-[10px] text-[#9CA3AF]">{'>'}1x / {'<'}1x</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">平均回报率</p>
                <p className="text-xl font-bold text-[#111827]">{currentReturnMetrics.avgProjectReturn}<span className="text-sm font-normal text-[#6B7280] ml-1">x</span></p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">退出胜率</p>
                <p className="text-xl font-bold text-emerald-600">{currentReturnMetrics.exitWinRate}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
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
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-[#111827]">{currentEfficiencyMetrics.avgWorkHours}<span className="text-sm font-normal text-[#6B7280] ml-1">小时</span></p>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    currentEfficiencyMetrics.avgWorkHoursChange < 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  )}>
                    {currentEfficiencyMetrics.avgWorkHoursChange > 0 ? "+" : ""}{currentEfficiencyMetrics.avgWorkHoursChange}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">无效尽调占比</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-[#111827]">{currentEfficiencyMetrics.invalidDueDiligenceRate}%</p>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    currentEfficiencyMetrics.invalidDueDiligenceChange < 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  )}>
                    {currentEfficiencyMetrics.invalidDueDiligenceChange > 0 ? "+" : ""}{currentEfficiencyMetrics.invalidDueDiligenceChange}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">立项过会率</p>
                <p className="text-lg font-bold text-[#111827]">{currentEfficiencyMetrics.approvalRate}<span className="text-sm font-normal text-[#6B7280] ml-1">%</span></p>
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
                  currentRiskOverview.highRiskProjects > 0 ? "text-red-600" : "text-[#111827]"
                )}>
                  {currentRiskOverview.highRiskProjects}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B7280]">合规待办事项</p>
                <p className={cn(
                  "text-lg font-bold",
                  currentRiskOverview.complianceTodos > 5 ? "text-amber-600" : "text-[#111827]"
                )}>
                  {currentRiskOverview.complianceTodos}<span className="text-sm font-normal text-[#6B7280] ml-1">项</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B7280]">今日待上会项目</p>
                <p className="text-lg font-bold text-[#2563EB]">
                  {currentRiskOverview.todayMeetingProjects}<span className="text-sm font-normal text-[#6B7280] ml-1">个</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* 赛道投资分布饼图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 w-full overflow-x-auto">
              <h3 className="font-semibold text-[#111827] mb-1">赛道投资分布</h3>
              <p className="text-sm text-[#6B7280] mb-4">按投资金额占比统计</p>
              <div className="h-[240px] flex items-center justify-center min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trackDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }: any) => `${name} ${value}%`}
                      labelLine={false}
                    >
                      {trackDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {trackDistribution.map((item: any, idx: number) => (
                  <div key={`${item.name}-${idx}`} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-[#6B7280]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 本年度立项/投决/退出趋势柱状图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">项目流程趋势</h3>
              <p className="text-sm text-[#6B7280] mb-4">本年度立项/投决/退出数量</p>
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
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* IRR/DPI对标行业分位值折线图 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">IRR行业对标</h3>
              <p className="text-sm text-[#6B7280] mb-4">基金IRR与行业分位值对比</p>
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
            </div>

            {/* 团队项目效能排行TOP5 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="font-semibold text-[#111827] mb-1">团队效能排行</h3>
              <p className="text-sm text-[#6B7280] mb-4">TOP5成员项目效能评分</p>
              <div className="space-y-3">
                {activeTeamRanking.map((member: any, index: number) => (
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
              {currentTodos.filter((d: any) => d.urgency === "urgent").length} 项紧急
            </Badge>
          </div>

          <div className="rounded-lg border border-[#E5E7EB] overflow-x-auto w-full">
            <table className="w-full min-w-[900px]">
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
                {currentTodos.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <Badge className={cn("text-xs", item.typeColor)}>
                        {item.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[#111827]">{item.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#6B7280]">{item.project}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                          <span className="text-[10px] text-[#6B7280]">{item.submitter.slice(0, 1)}</span>
                        </div>
                        <span className="text-sm text-[#6B7280]">{item.submitter}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#6B7280]">{item.submitTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-sm",
                        item.urgency === "urgent" ? "text-red-600 font-medium" : "text-[#6B7280]"
                      )}>
                        {item.deadline}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-xs", urgencyConfig[item.urgency as keyof typeof urgencyConfig].color)}>
                        {urgencyConfig[item.urgency as keyof typeof urgencyConfig].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-sm text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1">
                        处理
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
