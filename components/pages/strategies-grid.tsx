"use client"

import { useState } from "react"
import { Briefcase, Search, Plus, Target, TrendingUp, Building2, Cpu, Zap, Leaf } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Available owners
const availableOwners = [
  { id: "zhangwei", name: "张伟", initials: "张伟" },
  { id: "lisi", name: "李四", initials: "李四" },
  { id: "wangfang", name: "王芳", initials: "王芳" },
  { id: "zhaoqiang", name: "赵强", initials: "赵强" },
  { id: "chenzong", name: "陈总", initials: "陈总" },
]

// Strategy type configurations
const strategyTypeConfig = {
  "主题策略": { color: "bg-blue-50 text-blue-700 border-blue-200", iconBg: "bg-blue-100 text-blue-600" },
  "赛道策略": { color: "bg-violet-50 text-violet-700 border-violet-200", iconBg: "bg-violet-100 text-violet-600" },
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
  type: "主题策略" | "赛道策略"
  typeColor: string
  icon: typeof Cpu
  iconBg: string
  description: string
  projectCount: number
  totalInvest: string
  returnRate: string
  owner: { id: string; name: string; initials: string }
  createdAt: string
  parentStrategyId?: string // 赛道策略挂靠的主题策略ID
  parentStrategyName?: string // 赛道策略挂靠的主题策略名称
}

export interface PendingStrategy {
  id: string
  strategy: Omit<Strategy, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

export const initialStrategies: Strategy[] = [
  {
    id: "1",
    name: "AI基础设施",
    type: "主题策略",
    typeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Cpu,
    iconBg: "bg-blue-100 text-blue-600",
    description: "聚焦AI算力、模型训练框架和基础软件生态投资",
    projectCount: 12,
    totalInvest: "8.5亿",
    returnRate: "+32%",
    owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
    createdAt: "2023-06-15",
  },
  {
    id: "2",
    name: "大模型应用",
    type: "赛道策略",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Target,
    iconBg: "bg-violet-100 text-violet-600",
    description: "关注大语言模型的企业级和消费级应用落地场景",
    projectCount: 8,
    totalInvest: "5.2亿",
    returnRate: "+18%",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    createdAt: "2023-07-20",
    parentStrategyId: "1",
    parentStrategyName: "AI基础设施",
  },
  {
    id: "3",
    name: "企业服务SaaS",
    type: "赛道策略",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Building2,
    iconBg: "bg-emerald-100 text-emerald-600",
    description: "覆盖CRM、ERP、协同办公等企业数字化转型赛道",
    projectCount: 15,
    totalInvest: "12亿",
    returnRate: "+25%",
    owner: { id: "wangfang", name: "王芳", initials: "王芳" },
    createdAt: "2023-03-10",
    parentStrategyId: "1",
    parentStrategyName: "AI基础设施",
  },
  {
    id: "4",
    name: "生物科技",
    type: "主题策略",
    typeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Zap,
    iconBg: "bg-rose-100 text-rose-600",
    description: "布局AI制药、基因治疗和精准医疗等前沿领域",
    projectCount: 6,
    totalInvest: "4.8亿",
    returnRate: "+12%",
    owner: { id: "zhaoqiang", name: "赵强", initials: "赵强" },
    createdAt: "2023-09-05",
  },
  {
    id: "5",
    name: "新能源汽车",
    type: "赛道策略",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Leaf,
    iconBg: "bg-lime-100 text-lime-600",
    description: "智能驾驶、动力电池和充电基础设施全产业链投资",
    projectCount: 10,
    totalInvest: "18亿",
    returnRate: "+28%",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    createdAt: "2023-05-18",
    parentStrategyId: "4",
    parentStrategyName: "生物科技",
  },
  {
    id: "6",
    name: "出海电商",
    type: "赛道策略",
    typeColor: "bg-violet-50 text-violet-700 border-violet-200",
    icon: TrendingUp,
    iconBg: "bg-amber-100 text-amber-600",
    description: "跨境电商平台、品牌出海和供应链服务生态",
    projectCount: 9,
    totalInvest: "6.3亿",
    returnRate: "+22%",
    owner: { id: "chenzong", name: "陈总", initials: "陈总" },
    createdAt: "2023-08-25",
    parentStrategyId: "4",
    parentStrategyName: "生物科技",
  },
]

interface StrategiesGridProps {
  strategies: Strategy[]
  onStrategiesChange: (strategies: Strategy[]) => void
  onSelectStrategy?: (strategyId: string) => void
  onCreatePending?: (pending: PendingStrategy) => void
}

export function StrategiesGrid({ strategies, onStrategiesChange, onSelectStrategy, onCreatePending }: StrategiesGridProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newType, setNewType] = useState<"主题策略" | "赛道策略">("主题策略")
  const [selectedIconIndex, setSelectedIconIndex] = useState(0)
  const [selectedOwnerId, setSelectedOwnerId] = useState("zhangwei")
  const [selectedParentStrategyId, setSelectedParentStrategyId] = useState<string>("")

  // Get theme strategies for parent selection
  const themeStrategies = strategies.filter((s) => s.type === "主题策略")

  const filteredStrategies = strategies.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleCreate() {
    if (!newName.trim()) return
    // 赛道策略必须选择挂靠的主题策略
    if (newType === "赛道策略" && !selectedParentStrategyId) return

    const typeConfig = strategyTypeConfig[newType]
    const iconConfig = availableIcons[selectedIconIndex]
    const owner = availableOwners.find((o) => o.id === selectedOwnerId) || availableOwners[0]
    const parentStrategy = themeStrategies.find((s) => s.id === selectedParentStrategyId)

    const newStrategy: Omit<Strategy, "id"> = {
      name: newName.trim(),
      type: newType,
      typeColor: typeConfig.color,
      icon: iconConfig.icon,
      iconBg: iconConfig.bg,
      description: newDescription.trim() || "暂无策略简介",
      projectCount: 0,
      totalInvest: "0",
      returnRate: "+0%",
      owner,
      createdAt: new Date().toISOString().split("T")[0],
      ...(newType === "赛道策略" && parentStrategy
        ? { parentStrategyId: parentStrategy.id, parentStrategyName: parentStrategy.name }
        : {}),
    }

    const pendingRequest: PendingStrategy = {
      id: `pending-${Date.now()}`,
      strategy: newStrategy,
      changeId: `CR-${Date.now().toString().slice(-6)}`,
      changeName: `新创策略: ${newName.trim()}`,
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }

    onCreatePending?.(pendingRequest)
    setIsCreateOpen(false)
    resetForm()
  }

  function resetForm() {
    setNewName("")
    setNewDescription("")
    setNewType("主题策略")
    setSelectedIconIndex(0)
    setSelectedOwnerId("zhangwei")
    setSelectedParentStrategyId("")
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
              <h1 className="text-2xl font-bold text-[#111827]">策略列表</h1>
              <p className="text-sm text-[#6B7280]">共 {strategies.length} 个投资策略</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="搜索策略..."
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
              新创策略
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
                {strategy.type === "赛道策略" && strategy.parentStrategyName && (
                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      挂靠主题：{strategy.parentStrategyName}
                    </span>
                  </div>
                )}
                <p className="text-xs text-[#6B7280] mb-3 leading-relaxed">
                  {strategy.description}
                </p>

                {/* Owner */}
                <div className="flex items-center gap-2 mb-4">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-[#E5E7EB] text-[9px] text-[#374151]">
                      {strategy.owner.initials.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-[#6B7280]">{"\u8D1F\u8D23\u4EBA: "}{strategy.owner.name}</span>
                </div>

                {/* Stats Row */}
                <div className="mt-auto grid grid-cols-3 gap-3 rounded-lg bg-[#F9FAFB] p-3">
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">项目数</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {strategy.projectCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">总投资额</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {strategy.totalInvest}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">收益率</p>
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
            <DialogTitle className="text-lg font-semibold text-[#111827]">新创策略</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              创建一个新的投资策略，用于管理和跟踪特定领域的投资项目
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Logo Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">策略Logo</Label>
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
                策略名称
              </Label>
              <Input
                id="strategy-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入策略名称"
                className="h-10"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="strategy-desc" className="text-sm font-medium text-[#374151]">
                策略简介
              </Label>
              <textarea
                id="strategy-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="输入策略简介..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Owner Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">负责人</Label>
              <div className="flex flex-wrap gap-2">
                {availableOwners.map((owner) => (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => setSelectedOwnerId(owner.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                      selectedOwnerId === owner.id
                        ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                    )}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                        {owner.initials.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    {owner.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">策略类型</Label>
              <div className="flex gap-2">
                {(Object.keys(strategyTypeConfig) as Array<"主题策略" | "赛道策略">).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setNewType(type)
                      if (type === "主题策略") {
                        setSelectedParentStrategyId("")
                      }
                    }}
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

            {/* Parent Strategy Selection (only for 赛道策略) */}
            {newType === "赛道策略" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">
                  挂靠主题策略 <span className="text-red-500">*</span>
                </Label>
                {themeStrategies.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] p-3 bg-[#F9FAFB] rounded-lg">
                    暂无可挂靠的主题策略，请先创建主题策略
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {themeStrategies.map((strategy) => {
                      const Icon = strategy.icon
                      return (
                        <button
                          key={strategy.id}
                          type="button"
                          onClick={() => setSelectedParentStrategyId(strategy.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                            selectedParentStrategyId === strategy.id
                              ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                              : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                          )}
                        >
                          <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", strategy.iconBg)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          {strategy.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-[#9CA3AF]">
                  赛道策略将继承所选主题策略的假设清单和条款清单
                </p>
              </div>
            )}
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
              取消
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || (newType === "赛道策略" && !selectedParentStrategyId)}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
