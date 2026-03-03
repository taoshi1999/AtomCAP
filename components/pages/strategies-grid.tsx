"use client"

import { useState } from "react"
import { Briefcase, Search, Plus, Target, TrendingUp, Building2, Cpu, Zap, Leaf, Upload, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Strategy type configurations
const strategyTypeConfig = {
  "\u4E3B\u9898\u7B56\u7565": { color: "bg-blue-50 text-blue-700 border-blue-200", iconBg: "bg-blue-100 text-blue-600" },
  "\u8D5B\u9053\u7B56\u7565": { color: "bg-violet-50 text-violet-700 border-violet-200", iconBg: "bg-violet-100 text-violet-600" },
  "\u884C\u4E1A\u7B56\u7565": { color: "bg-emerald-50 text-emerald-700 border-emerald-200", iconBg: "bg-emerald-100 text-emerald-600" },
}

// Available icons for selection
const availableIcons = [
  { icon: Cpu, bg: "bg-blue-100 text-blue-600", name: "CPU" },
  { icon: Target, bg: "bg-violet-100 text-violet-600", name: "Target" },
  { icon: Building2, bg: "bg-emerald-100 text-emerald-600", name: "Building" },
  { icon: Zap, bg: "bg-rose-100 text-rose-600", name: "Zap" },
  { icon: Leaf, bg: "bg-lime-100 text-lime-600", name: "Leaf" },
  { icon: TrendingUp, bg: "bg-amber-100 text-amber-600", name: "Trending" },
  { icon: Briefcase, bg: "bg-indigo-100 text-indigo-600", name: "Briefcase" },
]

export interface Strategy {
  id: string
  name: string
  type: string
  typeColor: string
  icon: typeof Cpu
  iconBg: string
  description: string
  projectCount: number
  totalInvest: string
  returnRate: string
}

export const initialStrategies: Strategy[] = [
  {
    id: "1",
    name: "AI\u57FA\u7840\u8BBE\u65BD",
    type: "\u4E3B\u9898\u7B56\u7565",
    typeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Cpu,
    iconBg: "bg-blue-100 text-blue-600",
    description: "\u805A\u7126AI\u7B97\u529B\u3001\u6A21\u578B\u8BAD\u7EC3\u6846\u67B6\u548C\u57FA\u7840\u8F6F\u4EF6\u751F\u6001\u6295\u8D44",
    projectCount: 12,
    totalInvest: "8.5\u4EBF",
    returnRate: "+32%",
  },
  {
    id: "2",
    name: "\u5927\u6A21\u578B\u5E94\u7528",
    type: "\u8D5B\u9053\u7B56\u7565",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Target,
    iconBg: "bg-violet-100 text-violet-600",
    description: "\u5173\u6CE8\u5927\u8BED\u8A00\u6A21\u578B\u7684\u4F01\u4E1A\u7EA7\u548C\u6D88\u8D39\u7EA7\u5E94\u7528\u843D\u5730\u573A\u666F",
    projectCount: 8,
    totalInvest: "5.2\u4EBF",
    returnRate: "+18%",
  },
  {
    id: "3",
    name: "\u4F01\u4E1A\u670D\u52A1SaaS",
    type: "\u884C\u4E1A\u7B56\u7565",
    typeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Building2,
    iconBg: "bg-emerald-100 text-emerald-600",
    description: "\u8986\u76D6CRM\u3001ERP\u3001\u534F\u540C\u529E\u516C\u7B49\u4F01\u4E1A\u6570\u5B57\u5316\u8F6C\u578B\u8D5B\u9053",
    projectCount: 15,
    totalInvest: "12\u4EBF",
    returnRate: "+25%",
  },
  {
    id: "4",
    name: "\u751F\u7269\u79D1\u6280",
    type: "\u4E3B\u9898\u7B56\u7565",
    typeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Zap,
    iconBg: "bg-rose-100 text-rose-600",
    description: "\u5E03\u5C40AI\u5236\u836F\u3001\u57FA\u56E0\u6CBB\u7597\u548C\u7CBE\u51C6\u533B\u7597\u7B49\u524D\u6CBF\u9886\u57DF",
    projectCount: 6,
    totalInvest: "4.8\u4EBF",
    returnRate: "+12%",
  },
  {
    id: "5",
    name: "\u65B0\u80FD\u6E90\u6C7D\u8F66",
    type: "\u8D5B\u9053\u7B56\u7565",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Leaf,
    iconBg: "bg-lime-100 text-lime-600",
    description: "\u667A\u80FD\u9A7E\u9A76\u3001\u52A8\u529B\u7535\u6C60\u548C\u5145\u7535\u57FA\u7840\u8BBE\u65BD\u5168\u4EA7\u4E1A\u94FE\u6295\u8D44",
    projectCount: 10,
    totalInvest: "18\u4EBF",
    returnRate: "+28%",
  },
  {
    id: "6",
    name: "\u51FA\u6D77\u7535\u5546",
    type: "\u884C\u4E1A\u7B56\u7565",
    typeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: TrendingUp,
    iconBg: "bg-amber-100 text-amber-600",
    description: "\u8DE8\u5883\u7535\u5546\u5E73\u53F0\u3001\u54C1\u724C\u51FA\u6D77\u548C\u4F9B\u5E94\u94FE\u670D\u52A1\u751F\u6001",
    projectCount: 9,
    totalInvest: "6.3\u4EBF",
    returnRate: "+22%",
  },
]

interface StrategiesGridProps {
  strategies: Strategy[]
  onStrategiesChange: (strategies: Strategy[]) => void
  onSelectStrategy?: (strategyId: string) => void
}

export function StrategiesGrid({ strategies, onStrategiesChange, onSelectStrategy }: StrategiesGridProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newType, setNewType] = useState<string>("\u4E3B\u9898\u7B56\u7565")
  const [selectedIconIndex, setSelectedIconIndex] = useState(0)

  const filteredStrategies = strategies.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleCreate() {
    if (!newName.trim()) return

    const typeConfig = strategyTypeConfig[newType as keyof typeof strategyTypeConfig]
    const iconConfig = availableIcons[selectedIconIndex]

    const newStrategy: Strategy = {
      id: `new-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      typeColor: typeConfig.color,
      icon: iconConfig.icon,
      iconBg: iconConfig.bg,
      description: newDescription.trim() || "\u6682\u65E0\u7B56\u7565\u7B80\u4ECB",
      projectCount: 0,
      totalInvest: "0",
      returnRate: "+0%",
    }

    onStrategiesChange([newStrategy, ...strategies])
    setIsCreateOpen(false)
    resetForm()
  }

  function resetForm() {
    setNewName("")
    setNewDescription("")
    setNewType("\u4E3B\u9898\u7B56\u7565")
    setSelectedIconIndex(0)
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-7xl px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">{"\u7B56\u7565\u5217\u8868"}</h1>
              <p className="text-sm text-[#6B7280]">
                {"\u5171 "}{strategies.length}{" \u4E2A\u6295\u8D44\u7B56\u7565"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder={"\u641C\u7D22\u7B56\u7565..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <Plus className="h-4 w-4" />
              {"\u65B0\u5EFA\u7B56\u7565"}
            </button>
          </div>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-3 gap-5">
          {filteredStrategies.map((strategy) => {
            const Icon = strategy.icon
            return (
              <button
                key={strategy.id}
                onClick={() => onSelectStrategy?.(strategy.id)}
                className="group flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-6 text-left transition-all hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-[#2563EB]/5"
              >
                {/* Icon & Type */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${strategy.iconBg} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${strategy.typeColor}`}
                  >
                    {strategy.type}
                  </span>
                </div>

                {/* Info */}
                <h3 className="text-base font-semibold text-[#111827] mb-1">
                  {strategy.name}
                </h3>
                <p className="text-xs text-[#6B7280] mb-5 leading-relaxed">
                  {strategy.description}
                </p>

                {/* Stats Row */}
                <div className="mt-auto grid grid-cols-3 gap-3 rounded-lg bg-[#F9FAFB] p-3">
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">{"\u9879\u76EE\u6570"}</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {strategy.projectCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">{"\u603B\u6295\u8D44\u989D"}</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {strategy.totalInvest}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">{"\u6536\u76CA\u7387"}</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {strategy.returnRate}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Create Strategy Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">{"\u65B0\u5EFA\u7B56\u7565"}</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              {"\u521B\u5EFA\u4E00\u4E2A\u65B0\u7684\u6295\u8D44\u7B56\u7565\uFF0C\u7528\u4E8E\u7BA1\u7406\u548C\u8DDF\u8E2A\u7279\u5B9A\u9886\u57DF\u7684\u6295\u8D44\u9879\u76EE"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Logo Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">{"\u7B56\u7565Logo"}</Label>
              <div className="flex flex-wrap gap-2">
                {availableIcons.map((item, index) => {
                  const IconComponent = item.icon
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedIconIndex(index)}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                        item.bg,
                        selectedIconIndex === index
                          ? "ring-2 ring-[#2563EB] ring-offset-2"
                          : "hover:opacity-80"
                      )}
                    >
                      <IconComponent className="h-5 w-5" />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="strategy-name" className="text-sm font-medium text-[#374151]">
                {"\u7B56\u7565\u540D\u79F0"}
              </Label>
              <Input
                id="strategy-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={"\u8F93\u5165\u7B56\u7565\u540D\u79F0"}
                className="h-10"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="strategy-desc" className="text-sm font-medium text-[#374151]">
                {"\u7B56\u7565\u7B80\u4ECB"}
              </Label>
              <textarea
                id="strategy-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={"\u8F93\u5165\u7B56\u7565\u7B80\u4ECB..."}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">{"\u7B56\u7565\u7C7B\u578B"}</Label>
              <div className="flex gap-2">
                {Object.keys(strategyTypeConfig).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                      newType === type
                        ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
            >
              {"\u53D6\u6D88"}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {"\u521B\u5EFA"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
