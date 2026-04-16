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
} from "@/src/components/ui/chart"
import { Badge } from "@/src/components/ui/badge"
import { cn } from "@/src/lib/utils"

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

// 规模总览
const scaleOverview = {
  totalFundSize: 85.6,  // 亿元
  fundCount: 5,
  projectCount: 32,
  newProjectsThisYear: 8,
}

// 收益核心
const returnMetrics = {
  irrMedian: 18.5,  // %
  dpiDistribution: { above1: 12, below1: 20 },
  avgProjectReturn: 2.3,  // 倍数
  exitWinRate: 72,  // %
}

// 效率核心
const efficiencyMetrics = {
  avgWorkHours: 156,  // 小时
  avgWorkHoursChange: -12,  // 同比变化 %
  invalidDueDiligenceRate: 18,  // %
  invalidDueDiligenceChange: -5,  // 同比变化
  approvalRate: 35,  // 立项过会率 %
}

// 风险总览
const riskOverview = {
  highRiskProjects: 3,
  complianceTodos: 7,
  todayMeetingProjects: 2,
}

// 赛道投资分布
const trackDistribution = [
  { name: "大模型应用", value: 35, color: "#2563EB" },
  { name: "AI基础设施", value: 25, color: "#7C3AED" },
  { name: "企业服务", value: 20, color: "#059669" },
  { name: "医疗健康", value: 12, color: "#DC2626" },
  { name: "金融科技", value: 8, color: "#F59E0B" },
]

// 本年度立项/投决/退出趋势
const projectTrend = [
  { month: "1月", 立项: 3, 投决: 1, 退出: 0 },
  { month: "2月", 立项: 2, 投决: 2, 退出: 1 },
  { month: "3月", 立项: 4, 投决: 1, 退出: 0 },
  { month: "4月", 立项: 2, 投决: 3, 退出: 1 },
  { month: "5月", 立项: 5, 投决: 2, 退出: 0 },
  { month: "6月", 立项: 3, 投决: 2, 退出: 2 },
]

// IRR/DPI对标行业分位值
const benchmarkData = [
  { quarter: "2023Q1", ourIRR: 15, industryP50: 12, industryP75: 18, ourDPI: 0.8, dpiP50: 0.6 },
  { quarter: "2023Q2", ourIRR: 16, industryP50: 13, industryP75: 19, ourDPI: 0.85, dpiP50: 0.65 },
  { quarter: "2023Q3", ourIRR: 17, industryP50: 14, industryP75: 20, ourDPI: 0.9, dpiP50: 0.7 },
  { quarter: "2023Q4", ourIRR: 18, industryP50: 14, industryP75: 21, ourDPI: 0.95, dpiP50: 0.72 },
  { quarter: "2024Q1", ourIRR: 18.5, industryP50: 15, industryP75: 22, ourDPI: 1.0, dpiP50: 0.75 },
]

// 团队项目效能排行
const teamRanking = [
  { name: "张伟", projects: 8, avgDays: 45, score: 95 },
  { name: "李四", projects: 6, avgDays: 52, score: 88 },
  { name: "王五", projects: 7, avgDays: 58, score: 82 },
  { name: "赵六", projects: 5, avgDays: 48, score: 80 },
  { name: "陈总", projects: 4, avgDays: 42, score: 78 },
]

// 待办决策事项
const pendingDecisions = [
  {
    id: "1",
    type: "立项审批",
    typeColor: "bg-blue-50 text-blue-700",
    title: "智元机器人A轮投资立项申请",
    project: "智元机器人",
    submitter: "张伟",
    submitTime: "2024-03-08 09:30",
    deadline: "2024-03-10 18:00",
    urgency: "urgent",
  },
  {
    id: "2",
    type: "投决材料预审",
    typeColor: "bg-purple-50 text-purple-700",
    title: "MiniMax B轮投资决策材料预审",
    project: "MiniMax",
    submitter: "李四",
    submitTime: "2024-03-07 14:20",
    deadline: "2024-03-09 12:00",
    urgency: "urgent",
  },
  {
    id: "3",
    type: "尽调报告审核",
    typeColor: "bg-emerald-50 text-emerald-700",
    title: "阶跃星辰技术尽调报告审核",
    project: "阶跃星辰",
    submitter: "王五",
    submitTime: "2024-03-07 10:15",
    deadline: "2024-03-12 18:00",
    urgency: "normal",
  },
  {
    id: "4",
    type: "条款清单审批",
    typeColor: "bg-amber-50 text-amber-700",
    title: "百川智能投资条款清单审批",
    project: "百川智能",
    submitter: "赵六",
    submitTime: "2024-03-06 16:45",
    deadline: "2024-03-11 18:00",
    urgency: "normal",
  },
  {
    id: "5",
    type: "项目退出申请",
    typeColor: "bg-red-50 text-red-700",
    title: "深势科技股权转让退出申请",
    project: "深势科技",
    submitter: "张伟",
    submitTime: "2024-03-05 11:00",
    deadline: "2024-03-15 18:00",
    urgency: "low",
  },
  {
    id: "6",
    type: "合规风险处置",
    typeColor: "bg-orange-50 text-orange-700",
    title: "零一万物关联交易合规审查",
    project: "零一万物",
    submitter: "陈总",
    submitTime: "2024-03-08 08:00",
    deadline: "2024-03-09 18:00",
    urgency: "urgent",
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
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

  const urgencyConfig = {
    urgent: { label: "紧急", color: "bg-red-100 text-red-700 border-red-200" },
    normal: { label: "一般", color: "bg-amber-100 text-amber-700 border-amber-200" },
    low: { label: "较低", color: "bg-gray-100 text-gray-600 border-gray-200" },
  }

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
            数据更新时间: {formatTime(currentTime)}
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
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-[#111827]">{efficiencyMetrics.avgWorkHours}<span className="text-sm font-normal text-[#6B7280] ml-1">小时</span></p>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    efficiencyMetrics.avgWorkHoursChange < 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  )}>
                    {efficiencyMetrics.avgWorkHoursChange > 0 ? "+" : ""}{efficiencyMetrics.avgWorkHoursChange}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">无效尽调占比</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-[#111827]">{efficiencyMetrics.invalidDueDiligenceRate}%</p>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    efficiencyMetrics.invalidDueDiligenceChange < 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  )}>
                    {efficiencyMetrics.invalidDueDiligenceChange > 0 ? "+" : ""}{efficiencyMetrics.invalidDueDiligenceChange}%
                  </span>
                </div>
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
              {pendingDecisions.filter(d => d.urgency === "urgent").length} 项紧急
            </Badge>
          </div>

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
                {pendingDecisions.map((item) => (
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
