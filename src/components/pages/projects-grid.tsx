"use client"

import { useState } from "react"
import {
  FolderKanban, Search, Plus, X, Upload, Folder,
  ChevronLeft, ChevronRight, Check, Loader2, FileText,
} from "lucide-react"
import { Badge } from "@/src/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import { cn } from "@/src/lib/utils"
import { type Strategy } from "./strategies-grid"
import {
  mockLocalFolders,
  getFormatIcon,
  getFormatColor,
  type MockFile,
} from "@/src/components/pages/project-materials"

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
  { value: "未立项", color: "bg-gray-50 text-gray-600 border-gray-200" },
  { value: "投前期", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "Early-stage", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "投中期", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "Mid-stage", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "投后期", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "Late-stage", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "已退出", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "待立项", color: "bg-gray-50 text-gray-600 border-gray-200" },
]

/** Helper to look up status color by value */
export function getStatusColor(status: string): string {
  return statusOptions.find((o) => o.value === status)?.color ?? statusOptions[0].color
}

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
  uploadedFiles?: MockFile[]
}

export const initialProjects: Project[] = [
  {
    id: "2",
    name: "月之暗面",
    logo: "月",
    description: "新一代AI搜索与对话平台",
    tags: ["AI", "A轮"],
    status: "投中期",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    valuation: "10亿 USD",
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
    status: "投后期",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "15亿 USD",
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
    status: "投中期",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    valuation: "12亿 USD",
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
    status: "投前期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "8亿 USD",
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
    status: "投前期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "5亿 USD",
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
    status: "投后期",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "20亿 USD",
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
    status: "投前期",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "6亿 USD",
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
  const [selectedOwnerId, setSelectedOwnerId] = useState("zhangwei")
  const [selectedStrategyId, setSelectedStrategyId] = useState("")

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<MockFile[]>([])
  const [uploadSelectedFiles, setUploadSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadCurrentFolderId, setUploadCurrentFolderId] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "uploading">("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [materialDescription, setMaterialDescription] = useState("")
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
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
      status: statusOptions[0].value,
      statusColor: statusOptions[0].color,
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
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
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
    setSelectedOwnerId("zhangwei")
    setSelectedStrategyId("")
    setNewTags("")
    setUploadedFiles([])
    setUploadSelectedFiles(new Set())
    setUploadCurrentFolderId(null)
    setUploadState("idle")
    setUploadProgress(0)
    setMaterialDescription("")
    setIsGeneratingDescription(false)
  }

  // Mock file descriptions for AI generation
  const mockFileDescriptions: Record<string, string> = {
    "f16": "闫俊杰的个人简历，详细介绍了其在人工智能领域的研究经历、技术专长及项目成果，可用于评估核心技术团队成员的专业能力和行业背景。",
    "f17": "张伟的个人简历，包含教育背景、工作经历及技术技能说明，可作为团队能力评估的参考材料。",
    "f18": "李四的个人简历，涵盖职业发展历程及专业资质证书信息。",
    "f1": "Gartner发布的2024年度生成式AI与大模型行业研究报告，涵盖全球市场规模预测、主要玩家格局分析、技术成熟度曲线及应用落地趋势，可作为策略市场规模假设的权威数据支撑依据。",
    "f2": "IDC发布的大模型行业深度分析报告，包含技术演进路径和商业化前景评估。",
    "f3": "麦肯锡对生成式AI市场规模的预测分析，涵盖各行业应用场景。",
    "f4": "AI行业竞争格局分析演示文档，包含主要竞争对手对比。",
    "f13": "AI投融资趋势报告，涵盖投资热点和估值趋势分析。",
    "f14": "估值数据库，包含行业主要公司的估值数据和财务指标。",
    "f15": "VC投资案例汇总，收录近期AI领域重点投资案例。",
  }

  function openUploadDialog() {
    setUploadSelectedFiles(new Set())
    setUploadCurrentFolderId(null)
    setUploadState("idle")
    setUploadProgress(0)
    setMaterialDescription("")
    setIsGeneratingDescription(false)
    setIsUploadOpen(true)
  }

  function handleUploadToggleFile(fileId: string) {
    setUploadSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
        // Clear description if no files selected
        if (next.size === 0) {
          setMaterialDescription("")
        } else {
          // Generate description for remaining files
          generateDescriptionForFiles(next)
        }
      } else {
        next.add(fileId)
        // Generate description for newly selected file
        generateDescriptionForFiles(next)
      }
      return next
    })
  }

  function generateDescriptionForFiles(fileIds: Set<string>) {
    setIsGeneratingDescription(true)
    setMaterialDescription("")
    setTimeout(() => {
      const descriptions: string[] = []
      fileIds.forEach((id) => {
        if (mockFileDescriptions[id]) {
          descriptions.push(mockFileDescriptions[id])
        } else {
          // Generate a generic description based on file name
          const allFiles = mockLocalFolders.flatMap((f) => f.files)
          const file = allFiles.find((f) => f.id === id)
          if (file) {
            descriptions.push(`${file.name}：该文件可作为项目研究和分析的参考材料。`)
          }
        }
      })
      setMaterialDescription(descriptions.join("\n\n"))
      setIsGeneratingDescription(false)
    }, 1200)
  }

  function handleUploadConfirm() {
    if (uploadSelectedFiles.size === 0 || uploadState === "uploading") return
    setUploadState("uploading")
    setUploadProgress(0)
    setTimeout(() => setUploadProgress(100), 50)
    setTimeout(() => {
      const allFiles = mockLocalFolders.flatMap((f) => f.files)
      const selected = allFiles.filter((f) => uploadSelectedFiles.has(f.id))
      // Add description to each selected file
      const selectedWithDescriptions = selected.map((f) => ({
        ...f,
        description: mockFileDescriptions[f.id] || `${f.name}：该文件可作为项目研究和分析的参考材料。`,
      }))
      setUploadedFiles((prev) => {
        // Merge, avoid duplicates by id
        const existingIds = new Set(prev.map((f) => f.id))
        return [...prev, ...selectedWithDescriptions.filter((f) => !existingIds.has(f.id))]
      })
      setIsUploadOpen(false)
      setUploadState("idle")
      setUploadProgress(0)
      setUploadSelectedFiles(new Set())
      setMaterialDescription("")
    }, 1400)
  }

  function handleRemoveUploadedFile(fileId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8">
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

            {/* Upload Materials Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[#374151]">上传材料</Label>
                <button
                  type="button"
                  onClick={openUploadDialog}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                >
                  <Upload className="h-3.5 w-3.5" />
                  上传材料
                </button>
              </div>
              {uploadedFiles.length > 0 ? (
                <div className="rounded-lg border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                  {uploadedFiles.map((file) => {
                    const FormatIcon = getFormatIcon(file.format)
                    return (
                      <div key={file.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                          <FormatIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                        </div>
                        <span className="flex-1 truncate text-sm text-[#374151]">{file.name}</span>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${getFormatColor(file.format)}`}>
                          {file.format}
                        </Badge>
                        <span className="text-xs text-[#9CA3AF] shrink-0">{file.size}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedFile(file.id)}
                          className="ml-1 rounded p-0.5 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">暂无上传材料，点击右侧按钮上传</p>
              )}
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

      {/* Upload Materials Sub-dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { if (!open && uploadState !== "uploading") setIsUploadOpen(false) }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">上传项目材料</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              从本机文件夹中选择并上传材料文件
            </DialogDescription>
          </DialogHeader>

          {uploadState === "uploading" ? (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <Loader2 className="h-10 w-10 animate-spin text-[#2563EB]" />
              <p className="text-sm font-medium text-[#374151]">
                正在上传 {uploadSelectedFiles.size} 个文件...
              </p>
              <div className="w-full px-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className="h-full bg-[#2563EB] transition-all duration-[1200ms] ease-in-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Material Description Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">材料简介</Label>
                <div className="rounded-lg border border-[#E5E7EB] bg-white min-h-[80px] p-3">
                  {isGeneratingDescription ? (
                    <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
                      <span>AI正在生成材料简介...</span>
                    </div>
                  ) : materialDescription ? (
                    <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{materialDescription}</p>
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">选择文件后，AI将自动生成材料简介</p>
                  )}
                </div>
              </div>

              {/* File browser */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">选择文件</Label>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280]">
                  <Folder className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
                  <span>本机文档</span>
                  {uploadCurrentFolderId && (
                    <>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="text-[#374151] font-medium">
                        {mockLocalFolders.find(f => f.id === uploadCurrentFolderId)?.name}
                      </span>
                    </>
                  )}
                </div>

                {/* Browser pane */}
                <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
                  {uploadCurrentFolderId && (
                    <button
                      onClick={() => setUploadCurrentFolderId(null)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      返回上一层
                    </button>
                  )}
                  <div className="max-h-[240px] overflow-y-auto divide-y divide-[#F3F4F6]">
                    {uploadCurrentFolderId ? (
                      (mockLocalFolders.find(f => f.id === uploadCurrentFolderId)?.files || []).map((file) => {
                        const isSelected = uploadSelectedFiles.has(file.id)
                        const FormatIcon = getFormatIcon(file.format)
                        return (
                          <button
                            key={file.id}
                            onClick={() => handleUploadToggleFile(file.id)}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors",
                              isSelected ? "bg-blue-50" : "hover:bg-[#F9FAFB]"
                            )}
                          >
                            <div className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                              isSelected ? "bg-[#2563EB] border-[#2563EB]" : "border-[#D1D5DB]"
                            )}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                              <FormatIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                            </div>
                            <span className="flex-1 truncate text-sm text-[#374151]">{file.name}</span>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${getFormatColor(file.format)}`}>
                              {file.format}
                            </Badge>
                            <span className="text-xs text-[#9CA3AF] shrink-0 w-14 text-right">{file.size}</span>
                          </button>
                        )
                      })
                    ) : (
                      mockLocalFolders.map((folder) => {
                        const selectedInFolder = folder.files.filter((f) => uploadSelectedFiles.has(f.id)).length
                        return (
                          <button
                            key={folder.id}
                            onClick={() => setUploadCurrentFolderId(folder.id)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-[#F9FAFB] transition-colors"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-50">
                              <Folder className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <span className="flex-1 text-sm text-[#374151]">{folder.name}</span>
                            {selectedInFolder > 0 && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] shrink-0">
                                已选 {selectedInFolder}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {uploadSelectedFiles.size > 0 && (
                  <p className="text-xs text-[#2563EB]">已选择 {uploadSelectedFiles.size} 个文件</p>
                )}
              </div>
            </div>
          )}

          {uploadState === "idle" && (
            <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB] mt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUploadConfirm}
                disabled={uploadSelectedFiles.size === 0}
                className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                上传 {uploadSelectedFiles.size > 0 ? `${uploadSelectedFiles.size} 个` : ""}文件
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
