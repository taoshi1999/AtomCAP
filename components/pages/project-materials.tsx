"use client"

import { useState } from "react"
import {
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FolderOpen,
  Plus,
  X,
  Upload,
  Loader2,
  Folder,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { StrategyMaterial, PendingMaterial } from "@/components/pages/strategies-grid"

// ─── Existing mock material data ─────────────────────────────────────────────

export interface MaterialItem {
  id: string
  name: string
  format: string
  size: string
  description: string
}

const materials: MaterialItem[] = [
  {
    id: "m1",
    name: "GPU_AI芯片行业全景报告_2024",
    format: "PDF",
    size: "6.8 MB",
    description: "涵盖英伟达、AMD、华为昇腾等主要厂商的AI芯片市场份额、技术路线及竞争格局分析",
  },
  {
    id: "m2",
    name: "全球算力基础设施市场规模分析",
    format: "PDF",
    size: "4.3 MB",
    description: "IDC发布的全球AI算力基础设施市场规模预测，含数据中心、云算力及边缘算力细分数据",
  },
  {
    id: "m3",
    name: "主流AI训练框架技术对比",
    format: "DOCX",
    size: "2.1 MB",
    description: "PyTorch、TensorFlow、JAX等主流训练框架的性能基准、生态成熟度及企业采用情况对比",
  },
  {
    id: "m4",
    name: "云服务商GPU算力价格对比表",
    format: "XLSX",
    size: "0.8 MB",
    description: "AWS、Azure、GCP、阿里云等主流云厂商A100/H100算力租赁价格及性价比横向对比",
  },
  {
    id: "m5",
    name: "AI基础设施投融资趋势报告_2023-2024",
    format: "PDF",
    size: "5.6 MB",
    description: "全球AI基础设施领域融资事件、投资机构偏好及典型案例汇总，含估值倍数参考区间",
  },
  {
    id: "m6",
    name: "数据中心能耗与可持续发展白皮书",
    format: "PDF",
    size: "3.2 MB",
    description: "大模型训练能耗数据、PUE标准及主要云厂商碳中和路线图，用于评估ESG合规风险",
  },
  {
    id: "m7",
    name: "大模型训练成本结构分析",
    format: "XLSX",
    size: "1.4 MB",
    description: "主流大模型（GPT-4、Llama、文心等）训练成本拆解：算力、数据、人力占比及趋势",
  },
  {
    id: "m8",
    name: "AI芯片技术路线图_GPU_TPU_NPU",
    format: "PPTX",
    size: "9.7 MB",
    description: "英伟达Blackwell、谷歌TPU v5、华为昇腾910C等新一代AI芯片架构与性能演进路线图",
  },
  {
    id: "m9",
    name: "AI监管合规政策汇编",
    format: "PDF",
    size: "2.9 MB",
    description: "中国《生成式AI管理办法》、欧盟EU AI Act、美国AI行政令等主要市场监管政策要点摘编",
  },
  {
    id: "m10",
    name: "国内外AI基础软件生态图谱",
    format: "PDF",
    size: "7.1 MB",
    description: "MLOps工具链、向量数据库、推理优化框架等AI基础软件全栈生态图谱及主要玩家分布",
  },
]

/** 返回指定策略模板的预置材料列表（用于新建项目时的继承） */
export function getTemplateMaterialsForStrategy(strategyId: string): MaterialItem[] {
  if (strategyId === "1") return materials
  return []
}

// ─── Mock local file browser data ────────────────────────────────────────────

interface MockFile {
  id: string
  name: string
  format: string
  size: string
  matchCategories: string[]
  description?: string
}

interface MockFolder {
  id: string
  name: string
  files: MockFile[]
}

const mockLocalFolders: MockFolder[] = [
  {
    id: "folder-1",
    name: "AI行业研究",
    files: [
      { id: "f1", name: "大模型行业研究报告_Gartner_2024.pdf", format: "PDF", size: "6.8 MB", matchCategories: ["行业报告"] },
      { id: "f2", name: "大模型行业研究报告_IDC_2024.pdf", format: "PDF", size: "5.2 MB", matchCategories: ["行业报告"] },
      { id: "f3", name: "生成式AI市场规模预测_麦肯锡_2024.pdf", format: "PDF", size: "4.1 MB", matchCategories: ["行业报告"] },
      { id: "f4", name: "AI竞争格局分析_2024.pptx", format: "PPTX", size: "7.2 MB", matchCategories: [] },
    ],
  },
  {
    id: "folder-2",
    name: "监管政策",
    files: [
      { id: "f5", name: "EU_AI_Act_2024.pdf", format: "PDF", size: "2.9 MB", matchCategories: ["政策法规"] },
      { id: "f6", name: "生成式AI管理暂行办法_2023.pdf", format: "PDF", size: "1.2 MB", matchCategories: ["政策法规"] },
      { id: "f7", name: "美国AI行政令_2023.pdf", format: "PDF", size: "0.8 MB", matchCategories: ["政策法规"] },
      { id: "f8", name: "各国AI政策对比.xlsx", format: "XLSX", size: "1.5 MB", matchCategories: ["政策法规"] },
    ],
  },
  {
    id: "folder-3",
    name: "技术文档",
    files: [
      { id: "f9", name: "LLM评测基准体系_2024.pdf", format: "PDF", size: "3.4 MB", matchCategories: ["技术参考"] },
      { id: "f10", name: "MMLU评测结果汇总.xlsx", format: "XLSX", size: "0.6 MB", matchCategories: ["技术参考"] },
      { id: "f11", name: "GPT4_技术报告_2023.pdf", format: "PDF", size: "8.2 MB", matchCategories: ["技术参考"] },
      { id: "f12", name: "主流大模型性能对比.pptx", format: "PPTX", size: "5.9 MB", matchCategories: ["技术参考"] },
    ],
  },
  {
    id: "folder-4",
    name: "投融资数据",
    files: [
      { id: "f13", name: "AI投融资趋势报告_2024.pdf", format: "PDF", size: "5.1 MB", matchCategories: [] },
      { id: "f14", name: "估值数据库_Q4_2024.xlsx", format: "XLSX", size: "1.8 MB", matchCategories: [] },
      { id: "f15", name: "VC投资案例汇总.docx", format: "DOCX", size: "2.3 MB", matchCategories: [] },
    ],
  },
  {
    id: "folder-5",
    name: "人员简历",
    files: [
      { id: "f16", name: "闫俊杰_CV.pdf", format: "PDF", size: "0.4 MB", matchCategories: ["人员简历"] },
      { id: "f17", name: "张伟_CV.pdf", format: "PDF", size: "0.3 MB", matchCategories: ["人员简历"] },
      { id: "f18", name: "李四_CV.pdf", format: "PDF", size: "0.3 MB", matchCategories: ["人员简历"] },
    ],
  },
]

// Export for reuse in other components (e.g. create project dialog)
export { mockLocalFolders }
export type { MockFile, MockFolder }

// Category → folder mapping for pre-selection
const categoryFolderMap: Record<string, string> = {
  "行业报告": "folder-1",
  "政策法规": "folder-2",
  "技术参考": "folder-3",
}

function getMatchingFileIds(category: string): string[] {
  const folder = mockLocalFolders.find((f) => f.id === categoryFolderMap[category])
  if (!folder) return []
  const match = folder.files.find((f) => f.matchCategories.includes(category))
  return match ? [match.id] : []
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function getFormatIcon(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
    case "DOCX":
      return FileText
    case "XLSX":
      return FileSpreadsheet
    case "PNG":
    case "JPG":
    case "SVG":
      return FileImage
    default:
      return File
  }
}

export function getFormatColor(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
      return "bg-red-50 text-red-700 border-red-200"
    case "XLSX":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "DOCX":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "PPTX":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "MP4":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "ZIP":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectMaterialsProps {
  isNewProject?: boolean
  project?: { name?: string; strategyName?: string }
  strategyType?: "主题策略" | "赛道策略"
  parentStrategyName?: string
  strategyId?: string
  strategyMaterials?: StrategyMaterial[]
  onCreatePendingMaterial?: (pending: PendingMaterial) => void
  materialPrefill?: { title: string; category: string; content: string }
  onMaterialPrefillUsed?: () => void
}

export function ProjectMaterials({
  isNewProject = false,
  project,
  strategyType,
  parentStrategyName,
  strategyId,
  strategyMaterials,
  onCreatePendingMaterial,
  materialPrefill,
  onMaterialPrefillUsed,
}: ProjectMaterialsProps) {
  const isTrackStrategy = strategyType === "赛道策略"
  const inheritedFromParent = isTrackStrategy && isNewProject && parentStrategyName
  const [showInheritBanner, setShowInheritBanner] = useState(true)
  const [showTemplateBanner, setShowTemplateBanner] = useState(true)

  // ── Upload dialog state ──────────────────────────────────────────────────
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [formDescription, setFormDescription] = useState("")
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadState, setUploadState] = useState<"idle" | "uploading">("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [dialogMaterialTitle, setDialogMaterialTitle] = useState("")
  const [dialogMaterialCategory, setDialogMaterialCategory] = useState("")

  // ── Handle prefill from overview recommendation ──────────────────────────
  // Reset guard when prefill is cleared by parent
  if (!materialPrefill && prefillApplied) {
    setPrefillApplied(false)
  }
  // Apply new prefill: open dialog with pre-filled values
  if (materialPrefill && !prefillApplied) {
    const folderId = categoryFolderMap[materialPrefill.category] || null
    setFormDescription(materialPrefill.content)
    setDialogMaterialTitle(materialPrefill.title)
    setDialogMaterialCategory(materialPrefill.category)
    setCurrentFolderId(folderId)
    setSelectedFiles(new Set(getMatchingFileIds(materialPrefill.category)))
    setUploadState("idle")
    setUploadProgress(0)
    setIsUploadOpen(true)
    setPrefillApplied(true)
    onMaterialPrefillUsed?.()
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openEmptyDialog() {
    setFormDescription("")
    setDialogMaterialTitle("")
    setDialogMaterialCategory("")
    setCurrentFolderId(null)
    setSelectedFiles(new Set())
    setUploadState("idle")
    setUploadProgress(0)
    setIsUploadOpen(true)
  }

  function handleDialogClose() {
    if (uploadState === "uploading") return
    setIsUploadOpen(false)
    setUploadState("idle")
    setUploadProgress(0)
  }

  function handleToggleFile(fileId: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  function handleUpload() {
    if (selectedFiles.size === 0 || uploadState === "uploading") return
    setUploadState("uploading")
    setUploadProgress(0)
    // Trigger CSS transition in next tick
    setTimeout(() => setUploadProgress(100), 50)
    // After animation completes, create the pending material and navigate
    setTimeout(() => {
      const allFiles = mockLocalFolders.flatMap((f) => f.files)
      const selectedFileData = allFiles.filter((f) => selectedFiles.has(f.id))
      const primaryName = dialogMaterialTitle || selectedFileData[0]?.name || "上传材料"

      const pendingMaterial: PendingMaterial = {
        id: `pending-material-${Date.now()}`,
        strategyId: strategyId || "",
        name: primaryName,
        category: dialogMaterialCategory,
        description: formDescription,
        files: selectedFileData.map((f) => ({
          id: f.id,
          name: f.name,
          format: f.format,
          size: f.size,
        })),
        changeId: `CR-${Date.now().toString().slice(-6)}`,
        changeName: `上传材料: ${primaryName}`,
        initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
        initiatedAt: new Date().toISOString().split("T")[0],
        reviewers: [
          { id: "zhangwei", name: "张伟", initials: "张伟" },
          { id: "lisi", name: "李四", initials: "李四" },
        ],
      }

      onCreatePendingMaterial?.(pendingMaterial)
      setIsUploadOpen(false)
      setUploadState("idle")
      setUploadProgress(0)
      setSelectedFiles(new Set())
    }, 1600)
  }

  // ── Build display items ───────────────────────────────────────────────────
  const approvedItems = (strategyMaterials || []).map((m) => ({
    id: m.id,
    name: m.name,
    format: m.format,
    size: m.size,
    description: m.description,
  }))

  // For inherited/existing strategies show mock data; for plain new strategies only show approved
  const usesMockData = !isNewProject || !!inheritedFromParent
  const displayItems = [...approvedItems, ...(usesMockData ? materials : [])]
  const isEmpty = displayItems.length === 0

  // File browser: current folder data
  const currentFolder = mockLocalFolders.find((f) => f.id === currentFolderId) ?? null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main content ────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
          <div className="text-center max-w-md px-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
              <FolderOpen className="h-8 w-8 text-[#2563EB]" />
            </div>
            <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无通用材料</h3>
            <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
              {project?.name ? `「${project.name}」` : "该策略"}还没有上传任何材料。点击下方按钮开始上传您的第一份材料。
            </p>
            <button
              onClick={openEmptyDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <Plus className="h-4 w-4" />
              上传材料
            </button>
          </div>
        </div>
      ) : (
        <ScrollArea className="h-full">
          <div className="p-8">
            {/* 策略模板继承提示 */}
            {isNewProject && project?.strategyName && showTemplateBanner && (
              <div className="mb-4 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] p-4 relative">
                <button
                  onClick={() => setShowTemplateBanner(false)}
                  className="absolute top-3 right-3 p-1 rounded-md text-[#3B82F6] hover:bg-[#DBEAFE] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 pr-8">
                  <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1E40AF]">
                      基于「{project.strategyName}」策略模板创建
                    </p>
                    <p className="text-xs text-[#3B82F6]">
                      以下项目材料继承自所选策略模板，您可以根据项目实际情况进行调整
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 赛道策略继承提示 */}
            {inheritedFromParent && showInheritBanner && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <p className="flex-1 text-sm text-emerald-700">
                  当前赛道策略的通用材料已从主题策略「{parentStrategyName}」继承，您可以在此基础上进行调整
                </p>
                <button
                  onClick={() => setShowInheritBanner(false)}
                  className="ml-2 shrink-0 rounded p-0.5 text-emerald-400 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                  aria-label="关闭提示"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-[#111827]">通用材料</h1>
              <button
                onClick={openEmptyDialog}
                className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
              >
                <Upload className="h-3.5 w-3.5" />
                上传材料
              </button>
            </div>
            <p className="mt-1 text-sm text-[#6B7280] mb-6">
              {project?.name ? `${project.name} - ` : ""}行业通用材料与文件管理
            </p>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {/* Table Header */}
              <div className="grid grid-cols-[minmax(240px,2fr)_90px_80px_minmax(200px,3fr)_160px] items-center gap-4 border-b border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">文件名称</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">格式</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">大小</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">简介</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">操作</span>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-[#F3F4F6]">
                {displayItems.map((item) => {
                  const FormatIcon = getFormatIcon(item.format)
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(240px,2fr)_90px_80px_minmax(200px,3fr)_160px] items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F9FAFB]"
                    >
                      {/* File Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
                          <FormatIcon className="h-4.5 w-4.5 text-[#6B7280]" />
                        </div>
                        <span className="truncate text-sm font-medium text-[#111827]">{item.name}</span>
                      </div>
                      {/* Format */}
                      <div>
                        <Badge variant="outline" className={`text-xs font-medium ${getFormatColor(item.format)}`}>
                          {item.format}
                        </Badge>
                      </div>
                      {/* Size */}
                      <span className="text-sm text-[#6B7280]">{item.size}</span>
                      {/* Description */}
                      <p className="truncate text-sm text-[#6B7280]">{item.description}</p>
                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                          <Download className="h-3.5 w-3.5" />
                          下载
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          详情
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* ── Upload Dialog ────────────────────────────────────────────────── */}
      <Dialog open={isUploadOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">上传通用材料</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              为该策略上传通用材料文件
            </DialogDescription>
          </DialogHeader>

          {uploadState === "uploading" ? (
            /* ── Upload animation ── */
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <Loader2 className="h-10 w-10 animate-spin text-[#2563EB]" />
              <p className="text-sm font-medium text-[#374151]">
                正在上传 {selectedFiles.size} 个文件...
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
            /* ── Form ── */
            <div className="space-y-5 py-2">
              {/* Material description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">材料简介</Label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="输入材料简介..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              {/* File browser */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">选择文件</Label>

                {/* Breadcrumb path */}
                <div className="flex items-center gap-1.5 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280]">
                  <Folder className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
                  <span>本机文档</span>
                  {currentFolder && (
                    <>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="text-[#374151] font-medium">{currentFolder.name}</span>
                    </>
                  )}
                </div>

                {/* Browser pane */}
                <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
                  {/* Back button when inside a folder */}
                  {currentFolder && (
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      返回上一层
                    </button>
                  )}

                  <div className="max-h-[220px] overflow-y-auto divide-y divide-[#F3F4F6]">
                    {currentFolder ? (
                      /* File list inside a folder */
                      currentFolder.files.map((file) => {
                        const isSelected = selectedFiles.has(file.id)
                        const FormatIcon = getFormatIcon(file.format)
                        return (
                          <button
                            key={file.id}
                            onClick={() => handleToggleFile(file.id)}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors",
                              isSelected ? "bg-blue-50" : "hover:bg-[#F9FAFB]"
                            )}
                          >
                            {/* Checkbox */}
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                                isSelected
                                  ? "bg-[#2563EB] border-[#2563EB]"
                                  : "border-[#D1D5DB]"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            {/* File icon */}
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                              <FormatIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                            </div>
                            {/* Name */}
                            <span className="flex-1 truncate text-sm text-[#374151]">{file.name}</span>
                            {/* Format badge */}
                            <Badge
                              variant="outline"
                              className={`text-[10px] shrink-0 ${getFormatColor(file.format)}`}
                            >
                              {file.format}
                            </Badge>
                            {/* Size */}
                            <span className="text-xs text-[#9CA3AF] shrink-0 w-14 text-right">{file.size}</span>
                          </button>
                        )
                      })
                    ) : (
                      /* Folder list at root */
                      mockLocalFolders.map((folder) => {
                        const selectedInFolder = folder.files.filter((f) => selectedFiles.has(f.id)).length
                        return (
                          <button
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-[#F9FAFB] transition-colors"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-50">
                              <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
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

                {/* Selection count */}
                {selectedFiles.size > 0 && (
                  <p className="text-xs text-[#2563EB]">已选择 {selectedFiles.size} 个文件</p>
                )}
              </div>
            </div>
          )}

          {/* Footer buttons (hidden while uploading) */}
          {uploadState === "idle" && (
            <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB] mt-2">
              <button
                type="button"
                onClick={handleDialogClose}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={selectedFiles.size === 0}
                className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                上传 {selectedFiles.size > 0 ? `${selectedFiles.size} 个` : ""}文件
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
