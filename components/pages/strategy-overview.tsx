"use client"

import {
  Cpu,
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  Target,
  ArrowUpRight,
  Inbox,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { type Strategy } from "@/components/pages/strategies-grid"

// Default strategy info for existing strategies (fallback)
const defaultStrategyInfo = {
  name: "AI\u57FA\u7840\u8BBE\u65BD",
  type: "\u4E3B\u9898\u7B56\u7565",
  typeColor: "bg-blue-50 text-blue-700 border-blue-200",
  description:
    "\u805A\u7126AI\u7B97\u529B\u3001\u6A21\u578B\u8BAD\u7EC3\u6846\u67B6\u548C\u57FA\u7840\u8F6F\u4EF6\u751F\u6001\u6295\u8D44\u3002\u672C\u7B56\u7565\u56F4\u7ED5\u4EBA\u5DE5\u667A\u80FD\u4EA7\u4E1A\u7684\u5E95\u5C42\u57FA\u7840\u8BBE\u65BD\u8FDB\u884C\u5E03\u5C40\uFF0C\u6DB5\u76D6GPU/TPU\u7B97\u529B\u82AF\u7247\u3001\u5206\u5E03\u5F0F\u8BAD\u7EC3\u6846\u67B6\u3001\u6A21\u578B\u63A8\u7406\u4F18\u5316\u3001\u6570\u636E\u6807\u6CE8\u5E73\u53F0\u3001MLOps\u5DE5\u5177\u94FE\u7B49\u6838\u5FC3\u9886\u57DF\uFF0C\u65E8\u5728\u6355\u6349AI\u4EA7\u4E1A\u7206\u53D1\u671F\u7684\u5E95\u5C42\u4EF7\u503C\u3002",
  createdAt: "2023-06-15",
  updatedAt: "2024-01-20",
  manager: "\u5F20\u4F1F",
  status: "\u6D3B\u8DC3",
  projectCount: 12,
  totalInvest: "8.5\u4EBF",
  returnRate: "+32%",
  avgValuation: "15\u4EBF",
}

const appliedProjects = [
  {
    id: "1",
    name: "MiniMax",
    logo: "M",
    logoBg: "bg-[#1F2937]",
    round: "B\u8F6E",
    status: "\u5C3D\u8C03\u4E2D",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "10\u4EBF USD",
    investAmount: "5000\u4E07 USD",
  },
  {
    id: "2",
    name: "\u667A\u8C31AI",
    logo: "\u667A",
    logoBg: "bg-violet-600",
    round: "A\u8F6E",
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "8\u4EBF USD",
    investAmount: "3000\u4E07 USD",
  },
  {
    id: "3",
    name: "\u58C1\u4EDE\u79D1\u6280",
    logo: "\u58C1",
    logoBg: "bg-rose-600",
    round: "C\u8F6E",
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "25\u4EBF USD",
    investAmount: "1\u4EBF USD",
  },
  {
    id: "4",
    name: "\u6469\u5C14\u7EBF\u7A0B",
    logo: "\u6469",
    logoBg: "bg-amber-600",
    round: "B\u8F6E",
    status: "\u89C2\u5BDF\u4E2D",
    statusColor: "bg-gray-50 text-gray-600 border-gray-200",
    valuation: "12\u4EBF USD",
    investAmount: "-",
  },
  {
    id: "5",
    name: "\u71E7\u539F\u79D1\u6280",
    logo: "\u71E7",
    logoBg: "bg-cyan-600",
    round: "C\u8F6E",
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "18\u4EBF USD",
    investAmount: "8000\u4E07 USD",
  },
]

const investFocus = [
  { label: "GPU/TPU\u7B97\u529B\u82AF\u7247", weight: "\u9AD8" },
  { label: "\u5206\u5E03\u5F0F\u8BAD\u7EC3\u6846\u67B6", weight: "\u9AD8" },
  { label: "\u6A21\u578B\u63A8\u7406\u4F18\u5316", weight: "\u4E2D" },
  { label: "\u6570\u636E\u6807\u6CE8\u5E73\u53F0", weight: "\u4E2D" },
  { label: "MLOps\u5DE5\u5177\u94FE", weight: "\u4F4E" },
]

interface StrategyOverviewProps {
  strategy?: Strategy
}

export function StrategyOverview({ strategy }: StrategyOverviewProps) {
  // If strategy is provided (new strategy), use its data
  // Otherwise use default strategy info
  const isNewStrategy = strategy && strategy.id.startsWith("new-")
  
  const info = strategy ? {
    name: strategy.name,
    type: strategy.type,
    typeColor: strategy.typeColor,
    description: strategy.description,
    createdAt: strategy.createdAt,
    updatedAt: strategy.createdAt, // Same as createdAt for new strategies
    manager: strategy.owner.name,
    status: isNewStrategy ? "\u65B0\u5EFA" : "\u6D3B\u8DC3",
    projectCount: strategy.projectCount,
    totalInvest: strategy.totalInvest,
    returnRate: strategy.returnRate,
    avgValuation: isNewStrategy ? "-" : "15\u4EBF",
    iconBg: strategy.iconBg,
    Icon: strategy.icon,
  } : {
    ...defaultStrategyInfo,
    iconBg: "bg-blue-100 text-blue-600",
    Icon: Cpu,
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-5xl px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{"\u7B56\u7565\u6982\u89C8"}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {info.name} - {info.type}
          </p>
        </div>

        {/* Strategy Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${info.iconBg}`}>
              <info.Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#111827]">
                  {info.name}
                </h2>
                <Badge className={`${info.typeColor} hover:bg-blue-50`}>
                  {info.type}
                </Badge>
                <Badge className={isNewStrategy ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"}>
                  {info.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                {info.description}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#9CA3AF]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {"\u521B\u5EFA: "}
                  {info.createdAt}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {"\u66F4\u65B0: "}
                  {info.updatedAt}
                </span>
                <span className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                      {info.manager.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  {"\u8D1F\u8D23\u4EBA: "}
                  {info.manager}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u9879\u76EE\u6570"}</span>
              <Target className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.projectCount}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{"\u4E2A\u5DF2\u5173\u8054\u9879\u76EE"}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u603B\u6295\u8D44\u989D"}</span>
              <DollarSign className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.totalInvest}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">USD</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u6536\u76CA\u7387"}</span>
              <TrendingUp className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className={`text-2xl font-bold ${info.returnRate === "+0%" ? "text-[#9CA3AF]" : "text-emerald-600"}`}>
              {info.returnRate}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{"\u7EFC\u5408\u56DE\u62A5"}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u5E73\u5747\u4F30\u503C"}</span>
              <ArrowUpRight className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.avgValuation}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">USD</p>
          </div>
        </div>

        {/* Investment Focus */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-4">
            {"\u6295\u8D44\u91CD\u70B9\u9886\u57DF"}
          </h3>
          {isNewStrategy ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9CA3AF]">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">{"\u6682\u65E0\u6295\u8D44\u91CD\u70B9\u9886\u57DF"}</p>
              <p className="text-xs mt-1">{"\u8BF7\u5728\u5047\u8BBE\u6E05\u5355\u4E2D\u6DFB\u52A0\u6295\u8D44\u91CD\u70B9"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investFocus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
                >
                  <span className="text-sm text-[#374151]">{item.label}</span>
                  <Badge
                    className={
                      item.weight === "\u9AD8"
                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50"
                        : item.weight === "\u4E2D"
                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50"
                    }
                  >
                    {"\u4F18\u5148\u7EA7: "}
                    {item.weight}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applied Projects */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#111827]">
              {"\u5DF2\u5E94\u7528\u9879\u76EE"}
            </h3>
            <span className="text-xs text-[#9CA3AF]">
              {"\u5171 "}
              {isNewStrategy ? 0 : appliedProjects.length}
              {" \u4E2A\u9879\u76EE"}
            </span>
          </div>
          {isNewStrategy ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9CA3AF]">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">{"\u6682\u65E0\u5173\u8054\u9879\u76EE"}</p>
              <p className="text-xs mt-1">{"\u5F85\u5C06\u7B56\u7565\u5E94\u7528\u5230\u9879\u76EE\u4E2D"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appliedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E5E7EB] px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${project.logoBg}`}
                  >
                    {project.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111827]">
                      {project.name}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      {"\u4F30\u503C: "}
                      {project.valuation}
                    </p>
                  </div>
                  <Badge className="bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50 text-xs">
                    {project.round}
                  </Badge>
                  <Badge className={`${project.statusColor} text-xs`}>
                    {project.status}
                  </Badge>
                  <span className="text-sm text-[#374151] w-28 text-right">
                    {project.investAmount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
