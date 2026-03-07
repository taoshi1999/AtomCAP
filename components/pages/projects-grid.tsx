"use client"

import { useState } from "react"
import { FolderKanban, Search, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { type Strategy } from "./strategies-grid"

// Available owners
const availableOwners = [
  { id: "zhangwei", name: "张伟", initials: "张伟" },
  { id: "lisi", name: "李四", initials: "李四" },
  { id: "wangfang", name: "王芳", initials: "王芳" },
  { id: "zhaoqiang", name: "赵强", initials: "赵强" },
  { id: "chenzong", name: "陈总", initials: "陈总" },
]

// Investment rounds
const investmentRounds = ["Pre-A", "A轮", "B轮", "C轮", "D轮", "战略投资"]

// Project status options
const statusOptions = [
  { value: "设立期", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "存续期", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
]

export interface Project {
  id: string
  name: string
  logo: string
  description: string
  tags: string[]
  status: string
  statusColor: string
  valuation: string
  round: string
  owner: { id: string; name: string; initials: string }
  strategyId?: string
  strategyName?: string
  createdAt: string
}

export interface PendingProject {
  id: string
  project: Omit<Project, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

export const initialProjects: Project[] = [
  {
    id: "1",
    name: "MiniMax",
    logo: "M",
    description: "通用人工智能科技公司，专注于大模型研发",
    tags: ["AI", "B轮"],
    status: "设立期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    round: "B轮",
    owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
    strategyId: "1",
    strategyName: "AI基础设施",
    createdAt: "2023-10-15",
  },
  {
    id: "2",
    name: "月之暗面",
    logo: "月",
    description: "新一代AI搜索与对话平台",
    tags: ["AI", "A轮"],
    status: "存续期",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    round: "A轮",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: "2023-09-20",
  },
  {
    id: "3",
    name: "智谱AI",
    logo: "智",
    description: "认知大模型技术与应用开发",
    tags: ["AI", "C轮"],
    status: "设立期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    round: "C轮",
    owner: { id: "wangfang", name: "王芳", initials: "王芳" },
    strategyId: "1",
    strategyName: "AI基础设施",
    createdAt: "2023-08-10",
  },
  {
    id: "4",
    name: "百川智能",
    logo: "百",
    description: "大语言模型研发与应用",
    tags: ["AI", "B轮"],
    status: "存续期",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    round: "B轮",
    owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
    strategyId: "1",
    strategyName: "AI基础设施",
    createdAt: "2023-07-05",
  },
  {
    id: "5",
    name: "零一万物",
    logo: "零",
    description: "通用AI助理与多模态模型",
    tags: ["AI", "A轮"],
    status: "设立期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    round: "A轮",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: "2023-11-01",
  },
  {
    id: "6",
    name: "阶跃星辰",
    logo: "阶",
    description: "多模态大模型与智能体平台",
    tags: ["AI", "Pre-A"],
    status: "设立期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    round: "Pre-A",
    owner: { id: "zhaoqiang", name: "赵强", initials: "赵强" },
    strategyId: "2",
    strategyName: "大模型应用",
    createdAt: "2023-12-15",
  },
  {
    id: "7",
    name: "深势科技",
    logo: "深",
    description: "AI for Science，分子模拟与药物设计",
    tags: ["AI+科学", "B轮"],
    status: "存续期",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    round: "B轮",
    owner: { id: "chenzong", name: "陈总", initials: "陈总" },
    strategyId: "4",
    strategyName: "生物科技",
    createdAt: "2023-06-20",
  },
  {
    id: "8",
    name: "衬远科技",
    logo: "衬",
    description: "AI驱动的电商与消费品创新",
    tags: ["AI+消费", "A轮"],
    status: "设立期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    round: "A轮",
    owner: { id: "wangfang", name: "王芳", initials: "王芳" },
    strategyId: "6",
    strategyName: "出海电商",
    createdAt: "2024-01-10",
  },
]

interface ProjectsGridProps {
  projects: Project[]
  strategies: Strategy[]
  onProjectsChange: (projects: Project[]) => void
  onSelectProject: (projectId: string) => void
  onCreatePending?: (pending: PendingProject) => void
}

export function ProjectsGrid({ projects, strategies, onProjectsChange, onSelectProject, onCreatePending }: ProjectsGridProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newLogo, setNewLogo] = useState("")
  const [newValuation, setNewValuation] = useState("")
  const [selectedRound, setSelectedRound] = useState("A轮")
  const [selectedStatus, setSelectedStatus] = useState(statusOptions[0])
  const [selectedOwnerId, setSelectedOwnerId] = useState("zhangwei")
  const [selectedStrategyId, setSelectedStrategyId] = useState("")
  const [newTags, setNewTags] = useState("")

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleCreate() {
    if (!newName.trim() || !selectedStrategyId) return

    const owner = availableOwners.find((o) => o.id === selectedOwnerId) || availableOwners[0]
    const strategy = strategies.find((s) => s.id === selectedStrategyId)

    const newProject: Omit<Project, "id"> = {
      name: newName.trim(),
      logo: newLogo.trim() || newName.trim().charAt(0),
      description: newDescription.trim() || "暂无项目简介",
      tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
      status: selectedStatus.value,
      statusColor: selectedStatus.color,
      valuation: newValuation.trim() || "待定",
      round: selectedRound,
      owner,
      strategyId: selectedStrategyId,
      strategyName: strategy?.name || "",
      createdAt: new Date().toISOString().split("T")[0],
    }

    const pendingRequest: PendingProject = {
      id: `pending-project-${Date.now()}`,
      project: newProject,
      changeId: `CR-P-${Date.now().toString().slice(-6)}`,
      changeName: `新建项目: ${newName.trim()}`,
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
    setNewLogo("")
    setNewValuation("")
    setSelectedRound("A轮")
    setSelectedStatus(statusOptions[0])
    setSelectedOwnerId("zhangwei")
    setSelectedStrategyId("")
    setNewTags("")
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-7xl px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">项目列表</h1>
              <p className="text-sm text-[#6B7280]">
                共 {projects.length} 个投资项目
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="搜索项目..."
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
              新建项目
            </button>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-4 gap-5">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 text-left transition-all hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-[#2563EB]/5"
            >
              {/* Logo & Status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111827] text-lg font-bold text-white transition-transform group-hover:scale-105">
                  {project.logo}
                </div>
                <Badge
                  className={`${project.statusColor} hover:${project.statusColor} text-xs`}
                >
                  {project.status}
                </Badge>
              </div>

              {/* Info */}
              <h3 className="text-base font-semibold text-[#111827] mb-1">
                {project.name}
              </h3>
              <p className="text-xs text-[#6B7280] mb-3 line-clamp-2 leading-relaxed">
                {project.description}
              </p>

              {/* Owner */}
              <div className="flex items-center gap-2 mb-3">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                    {project.owner.initials.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-[#6B7280]">负责人: {project.owner.name}</span>
              </div>

              {/* Footer: Tags & Valuation */}
              <div className="mt-auto flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-medium text-[#374151]">
                  {project.valuation}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">新建项目</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              填写项目信息并选择策略模板创建新的投资项目
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Strategy Template Selection - Required */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">
                策略模板 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-[#6B7280] mb-2">
                选择策略模板后，项目将继承该策略的假设和条款
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                {strategies.map((strategy) => {
                  const Icon = strategy.icon
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => setSelectedStrategyId(strategy.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                        selectedStrategyId === strategy.id
                          ? "border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      )}
                    >
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", strategy.iconBg)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#111827] truncate">{strategy.name}</p>
                        <p className="text-xs text-[#6B7280]">{strategy.type}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {!selectedStrategyId && (
                <p className="text-xs text-amber-600">请选择一个策略模板</p>
              )}
            </div>

            {/* Project Logo & Name */}
            <div className="grid grid-cols-[80px_1fr] gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">Logo</Label>
                <Input
                  placeholder="M"
                  value={newLogo}
                  onChange={(e) => setNewLogo(e.target.value.slice(0, 2))}
                  className="text-center text-lg font-bold"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">
                  项目名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="输入项目名称"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">项目简介</Label>
              <textarea
                placeholder="输入项目简介..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] outline-none transition-colors focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-[#9CA3AF] min-h-[80px] resize-none"
              />
            </div>

            {/* Valuation & Round */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">估值</Label>
                <Input
                  placeholder="如: 10亿 USD"
                  value={newValuation}
                  onChange={(e) => setNewValuation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">轮次</Label>
                <div className="flex flex-wrap gap-1.5">
                  {investmentRounds.map((round) => (
                    <button
                      key={round}
                      type="button"
                      onClick={() => setSelectedRound(round)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all",
                        selectedRound === round
                          ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                          : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                      )}
                    >
                      {round}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">标签</Label>
              <Input
                placeholder="用逗号分隔多个标签，如: AI, B轮"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
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

            {/* Status Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">项目状态</Label>
              <div className="flex gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                      selectedStatus.value === status.value
                        ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                    )}
                  >
                    {status.value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
            <button
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
            >
              <X className="h-4 w-4" />
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !selectedStrategyId}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              创建
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
