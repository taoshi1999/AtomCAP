"use client"

import { useState, useEffect } from "react"
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
  Sparkles,
  Bot,
  FileDown,
  Pencil,
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
import type { PendingProjectMaterial } from "@/components/pages/workflow"
import type { HypothesisTableItem } from "@/components/pages/hypothesis-checklist"
import type { TermTableItem } from "@/components/pages/term-sheet"

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
      { id: "f19", name: "团队成员资料合集.pdf", format: "PDF", size: "3.2 MB", matchCategories: ["人员简历"] },
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

export function getFormatIcon(format: string | undefined) {
  if (!format) return File
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

export function getFormatColor(format: string | undefined) {
  if (!format) return "bg-gray-50 text-gray-700 border-gray-200"
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

// ─── Generate dialog config ───────────────────────────────────────────────────

type GenStep = "config" | "generating" | "result"

const DOC_TEMPLATES = [
  { id: "dd",       name: "尽职调查报告", desc: "全面评估项目风险与投资价值" },
  { id: "bp",       name: "商业计划书",   desc: "系统梳理商业模式与市场机会" },
  { id: "contract", name: "投资合同",     desc: "规范化投资交易条款文本" },
  { id: "risk",     name: "风险评估报告", desc: "量化分析各维度投资风险" },
  { id: "memo",     name: "投资备忘录",   desc: "决策层简报与核心结论摘要" },
]

const THINKING_STEPS = [
  "正在读取假设清单...",
  "正在分析投资条款...",
  "正在构建文档框架...",
  "正在生成核心内容...",
  "正在深度推理分析...",
  "正在优化格式排版...",
]

// Fallback data when project has no hypotheses/terms yet
const FALLBACK_HYPOTHESES: HypothesisTableItem[] = [
  { id: "fh1", direction: "技术攻关", category: "核心技术", name: "AI芯片国产替代窗口期判断", owner: "张伟", createdAt: "2025-01-10", updatedAt: "2025-02-15", status: "verified" },
  { id: "fh2", direction: "市场判断", category: "规模预测", name: "算力需求持续高速增长假设", owner: "李四", createdAt: "2025-01-12", updatedAt: "2025-02-20", status: "pending" },
  { id: "fh3", direction: "竞争分析", category: "壁垒评估", name: "目标企业技术护城河显著", owner: "王芳", createdAt: "2025-01-15", updatedAt: "2025-03-01", status: "verified" },
  { id: "fh4", direction: "财务预测", category: "盈利能力", name: "项目3年内实现正向EBITDA", owner: "张伟", createdAt: "2025-01-18", updatedAt: "2025-02-28", status: "risky" },
]

const FALLBACK_TERMS: TermTableItem[] = [
  { id: "ft1", direction: "里程碑条款", category: "产品交付", name: "产品量产里程碑对赌条款", owner: "张伟", createdAt: "2025-01-20", updatedAt: "2025-02-15", status: "approved" },
  { id: "ft2", direction: "控制权条款", category: "董事会席位", name: "董事会一票否决权条款", owner: "李四", createdAt: "2025-01-22", updatedAt: "2025-02-20", status: "approved" },
  { id: "ft3", direction: "退出条款", category: "优先清算", name: "1.5x非参与式优先清算权", owner: "王芳", createdAt: "2025-01-25", updatedAt: "2025-03-05", status: "pending" },
  { id: "ft4", direction: "反稀释条款", category: "宽基加权", name: "宽基加权平均反稀释保护", owner: "张伟", createdAt: "2025-01-28", updatedAt: "2025-03-01", status: "approved" },
]

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
  // Project-level material generation
  projectId?: string
  projectHypotheses?: HypothesisTableItem[]
  projectTerms?: TermTableItem[]
  onCreatePendingProjectMaterial?: (pending: PendingProjectMaterial) => void
  isExited?: boolean
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
  projectId,
  projectHypotheses,
  projectTerms,
  onCreatePendingProjectMaterial,
  isExited = false,
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

  // ── Generate dialog state ─────────────────────────────────────────────────
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [genStep, setGenStep] = useState<GenStep>("config")
  const [genSelectedHypotheses, setGenSelectedHypotheses] = useState<Set<string>>(new Set())
  const [genSelectedTerms, setGenSelectedTerms] = useState<Set<string>>(new Set())
  const [genTemplate, setGenTemplate] = useState("尽职调查报告")
  const [genGuide, setGenGuide] = useState("")
  const [genSelectedMaterials, setGenSelectedMaterials] = useState<Set<string>>(new Set())
  const [genDescription, setGenDescription] = useState("")
  const [genThinkingStep, setGenThinkingStep] = useState(0)
  const [genProgress, setGenProgress] = useState(0)

  // ── AI generation animation ───────────────────────────────────────────────
  useEffect(() => {
    if (genStep !== "generating") return
    let idx = 0
    const stepInterval = setInterval(() => {
      idx = (idx + 1) % THINKING_STEPS.length
      setGenThinkingStep(idx)
    }, 550)

    let prog = 0
    const progressInterval = setInterval(() => {
      prog = Math.min(prog + 3, 98)
      setGenProgress(prog)
      if (prog >= 98) clearInterval(progressInterval)
    }, 90)

    const completeTimer = setTimeout(() => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
      setGenProgress(100)
      setGenStep("result")
    }, 3200)

    return () => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
      clearTimeout(completeTimer)
    }
  }, [genStep])

  // ── Handle prefill from overview recommendation ──────────────────────────
  if (!materialPrefill && prefillApplied) {
    setPrefillApplied(false)
  }
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

  // ── Upload handlers ───────────────────────────────────────────────────────

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
    setTimeout(() => setUploadProgress(100), 50)
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

  // ── Generate handlers ─────────────────────────────────────────────────────

  function openGenerateDialog() {
    setGenStep("config")
    setGenSelectedHypotheses(new Set())
    setGenSelectedTerms(new Set())
    setGenSelectedMaterials(new Set())
    setGenDescription("")
    setGenTemplate("尽职调查报告")
    setGenGuide("")
    setGenThinkingStep(0)
    setGenProgress(0)
    setIsGenerateOpen(true)
  }

  function handleStartGenerate() {
    // Pre-fill description based on selections; user can edit it in the result step
    const parts: string[] = []
    if (genSelectedHypotheses.size > 0) parts.push(`${genSelectedHypotheses.size} 个假设`)
    if (genSelectedTerms.size > 0) parts.push(`${genSelectedTerms.size} 个条款`)
    if (genSelectedMaterials.size > 0) parts.push(`${genSelectedMaterials.size} 个参考材料`)
    const basis = parts.length > 0 ? `基于${parts.join("、")}，` : ""
    setGenDescription(
      genGuide ||
      `${basis}由AI深度分析生成的${genTemplate}。涵盖项目技术壁垒、市场空间、竞争格局及财务预测等核心维度，供投委会决策参考。`
    )
    setGenStep("generating")
    setGenThinkingStep(0)
    setGenProgress(0)
  }

  const GEN_SIZES: Record<string, string> = {
    "尽职调查报告": "3.2 MB",
    "商业计划书":   "2.8 MB",
    "投资合同":     "1.5 MB",
    "风险评估报告": "2.4 MB",
    "投资备忘录":   "1.8 MB",
  }

  function handleGenerateUpload() {
    if (!onCreatePendingProjectMaterial) return
    const fileSize = GEN_SIZES[genTemplate] || "2.0 MB"
    const pending: PendingProjectMaterial = {
      id: `pending-mat-gen-${Date.now()}`,
      projectId: projectId || "",
      projectName: project?.name || "当前项目",
      material: {
        name: genTemplate,  // no .docx suffix — extension is tracked via format field
        format: "DOCX",
        size: fileSize,
        category: "AI生成材料",
        description: genDescription || `基于AI深度分析生成的${genTemplate}`,
        collectReason: `选取 ${genSelectedHypotheses.size} 个假设、${genSelectedTerms.size} 个条款、${genSelectedMaterials.size} 个参考材料，通过AI生成${genTemplate}`,
      },
      changeId: `CR-${Date.now().toString().slice(-6)}`,
      changeName: `上传AI生成材料: ${genTemplate}`,
      changeType: "collect",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingProjectMaterial(pending)
    setIsGenerateOpen(false)
  }

  function toggleGenHypothesis(id: string) {
    setGenSelectedHypotheses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGenTerm(id: string) {
    setGenSelectedTerms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGenMaterial(id: string) {
    setGenSelectedMaterials((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllGenHypotheses() {
    const allSelected = dialogHypotheses.length > 0 && dialogHypotheses.every((h) => genSelectedHypotheses.has(h.id))
    setGenSelectedHypotheses(allSelected ? new Set() : new Set(dialogHypotheses.map((h) => h.id)))
  }

  function toggleAllGenTerms() {
    const allSelected = dialogTerms.length > 0 && dialogTerms.every((t) => genSelectedTerms.has(t.id))
    setGenSelectedTerms(allSelected ? new Set() : new Set(dialogTerms.map((t) => t.id)))
  }

  function toggleAllGenMaterials() {
    const allSelected = displayItems.length > 0 && displayItems.every((item) => genSelectedMaterials.has(item.id))
    setGenSelectedMaterials(allSelected ? new Set() : new Set(displayItems.map((item) => item.id)))
  }

  // ── Build display items ───────────────────────────────────────────────────
  const approvedItems = (strategyMaterials || []).map((m) => ({
    id: m.id,
    name: m.name,
    format: m.format,
    size: m.size,
    description: m.description,
  }))

  const usesMockData = !isNewProject || !!inheritedFromParent
  const displayItems = [...approvedItems, ...(usesMockData ? materials : [])]
  const isEmpty = displayItems.length === 0

  const currentFolder = mockLocalFolders.find((f) => f.id === currentFolderId) ?? null

  // Hypotheses & terms to show in generate dialog
  const dialogHypotheses = (projectHypotheses && projectHypotheses.length > 0)
    ? projectHypotheses
    : FALLBACK_HYPOTHESES
  const dialogTerms = (projectTerms && projectTerms.length > 0)
    ? projectTerms
    : FALLBACK_TERMS

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
              {project?.name ? `「${project.name}」` : "该策略"}还没有上传任何材料。点击下方按钮开始上传或生成您的第一份材料。
            </p>
            {!isExited && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={openEmptyDialog}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                >
                  <Upload className="h-4 w-4" />
                  上传材料
                </button>
                {onCreatePendingProjectMaterial && (
                  <button
                    onClick={openGenerateDialog}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Sparkles className="h-4 w-4" />
                    生成材料
                  </button>
                )}
              </div>
            )}
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
              {!isExited && (
                <div className="flex items-center gap-2">
                  {onCreatePendingProjectMaterial && (
                    <button
                      onClick={openGenerateDialog}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      生成材料
                    </button>
                  )}
                  <button
                    onClick={openEmptyDialog}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    上传材料
                  </button>
                </div>
              )}
            </div>
            {isExited ? (
              <p className="mt-1 text-sm text-[#EF4444] font-medium mb-6">项目已退出，所有信息不可更改。</p>
            ) : (
              <p className="mt-1 text-sm text-[#6B7280] mb-6">
                {project?.name ? `${project.name} - ` : ""}行业通用材料与文件管理
              </p>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {/* Table Header */}
              <div className="grid grid-cols-[minmax(240px,2fr)_90px_80px_minmax(200px,3fr)_160px] items-center gap-4 border-b border-[#E5E7EB] bg-[#1E3A5F] px-6 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff]">文件名称</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff]">格式</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff]">大小</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff]">简介</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff] text-right">操作</span>
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
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
                          <FormatIcon className="h-4.5 w-4.5 text-[#6B7280]" />
                        </div>
                        <span className="truncate text-sm font-medium text-[#111827]">{item.name}</span>
                      </div>
                      <div>
                        <Badge variant="outline" className={`text-xs font-medium ${getFormatColor(item.format)}`}>
                          {item.format}
                        </Badge>
                      </div>
                      <span className="text-sm text-[#6B7280]">{item.size}</span>
                      <p className="truncate text-sm text-[#6B7280]">{item.description}</p>
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
            <div className="space-y-5 py-2">
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

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">选择文件</Label>
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

                <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
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
                            <div className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors", isSelected ? "bg-[#2563EB] border-[#2563EB]" : "border-[#D1D5DB]")}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                              <FormatIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                            </div>
                            <span className="flex-1 truncate text-sm text-[#374151]">{file.name}</span>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${getFormatColor(file.format)}`}>{file.format}</Badge>
                            <span className="text-xs text-[#9CA3AF] shrink-0 w-14 text-right">{file.size}</span>
                          </button>
                        )
                      })
                    ) : (
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
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] shrink-0">已选 {selectedInFolder}</Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
                {selectedFiles.size > 0 && (
                  <p className="text-xs text-[#2563EB]">已选择 {selectedFiles.size} 个文件</p>
                )}
              </div>
            </div>
          )}

          {uploadState === "idle" && (
            <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB] mt-2">
              <button type="button" onClick={handleDialogClose} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]">
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

      {/* ── Generate Material Dialog ─────────────────────────────────────── */}
      <Dialog open={isGenerateOpen} onOpenChange={(open) => { if (!open && genStep !== "generating") setIsGenerateOpen(false) }}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <Sparkles className="h-5 w-5 text-violet-600" />
              {genStep === "config" ? "生成材料" : genStep === "generating" ? "AI 深度思考中..." : "材料生成完成"}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              {genStep === "config" && "选择参考内容与文档模板，AI将为您生成专业材料"}
              {genStep === "generating" && "AI 正在基于您的选择深度分析并生成材料，请稍候..."}
              {genStep === "result" && `已成功生成「${genTemplate}.docx」，请确认内容后选择上传或关闭`}
            </DialogDescription>
          </DialogHeader>

          {/* ── Step: config ── */}
          {genStep === "config" && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-5 py-2 pr-2">

                {/* Hypotheses */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-[#111827]">
                      勾选参考假设
                      <span className="ml-1 text-xs font-normal text-[#6B7280]">（{genSelectedHypotheses.size} 项已选）</span>
                    </Label>
                    <button
                      onClick={toggleAllGenHypotheses}
                      className="text-xs text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      {dialogHypotheses.length > 0 && dialogHypotheses.every((h) => genSelectedHypotheses.has(h.id)) ? "取消全选" : "全选"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] overflow-hidden">
                    {dialogHypotheses.map((h) => {
                      const checked = genSelectedHypotheses.has(h.id)
                      return (
                        <button
                          key={h.id}
                          onClick={() => toggleGenHypothesis(h.id)}
                          className={cn("flex items-start gap-3 w-full px-4 py-3 text-left transition-colors", checked ? "bg-violet-50" : "hover:bg-[#F9FAFB]")}
                        >
                          <div className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0 mt-0.5 transition-colors", checked ? "bg-violet-600 border-violet-600" : "border-[#D1D5DB]")}>
                            {checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#111827] leading-snug">{h.name}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">{h.direction} · {h.category}</p>
                          </div>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                            h.status === "verified" ? "bg-emerald-100 text-emerald-700"
                            : h.status === "risky" ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                          )}>
                            {h.status === "verified" ? "已验证" : h.status === "risky" ? "有风险" : "待验证"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Terms */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-[#111827]">
                      勾选参考条款
                      <span className="ml-1 text-xs font-normal text-[#6B7280]">（{genSelectedTerms.size} 项已选）</span>
                    </Label>
                    <button
                      onClick={toggleAllGenTerms}
                      className="text-xs text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      {dialogTerms.length > 0 && dialogTerms.every((t) => genSelectedTerms.has(t.id)) ? "取消全选" : "全选"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] overflow-hidden">
                    {dialogTerms.map((t) => {
                      const checked = genSelectedTerms.has(t.id)
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleGenTerm(t.id)}
                          className={cn("flex items-start gap-3 w-full px-4 py-3 text-left transition-colors", checked ? "bg-violet-50" : "hover:bg-[#F9FAFB]")}
                        >
                          <div className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0 mt-0.5 transition-colors", checked ? "bg-violet-600 border-violet-600" : "border-[#D1D5DB]")}>
                            {checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#111827] leading-snug">{t.name}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">{t.direction} · {t.category}</p>
                          </div>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                            t.status === "approved" ? "bg-emerald-100 text-emerald-700"
                            : t.status === "rejected" ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                          )}>
                            {t.status === "approved" ? "已批准" : t.status === "rejected" ? "已拒绝" : "待审核"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Materials */}
                {displayItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-[#111827]">
                        勾选参考材料
                        <span className="ml-1 text-xs font-normal text-[#6B7280]">（{genSelectedMaterials.size} 项已选）</span>
                      </Label>
                      <button
                        onClick={toggleAllGenMaterials}
                        className="text-xs text-violet-600 hover:text-violet-800 transition-colors"
                      >
                        {displayItems.every((item) => genSelectedMaterials.has(item.id)) ? "取消全选" : "全选"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] overflow-hidden">
                      {displayItems.map((item) => {
                        const checked = genSelectedMaterials.has(item.id)
                        const FormatIcon = getFormatIcon(item.format)
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleGenMaterial(item.id)}
                            className={cn("flex items-center gap-3 w-full px-4 py-3 text-left transition-colors", checked ? "bg-violet-50" : "hover:bg-[#F9FAFB]")}
                          >
                            <div className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors", checked ? "bg-violet-600 border-violet-600" : "border-[#D1D5DB]")}>
                              {checked && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                              <FormatIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#111827] truncate">{item.name}</p>
                              <p className="text-xs text-[#6B7280] truncate mt-0.5">{item.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${getFormatColor(item.format)}`}>{item.format}</Badge>
                              <span className="text-xs text-[#9CA3AF] w-14 text-right">{item.size}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Template selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-[#111827]">选择文档模板</Label>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-[#F5F3FF] px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增文档模板
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {DOC_TEMPLATES.map((tpl) => {
                      const active = genTemplate === tpl.name
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => setGenTemplate(tpl.name)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                            active ? "border-violet-400 bg-violet-50" : "border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                          )}
                        >
                          <div className={cn("h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center", active ? "border-violet-600" : "border-[#D1D5DB]")}>
                            {active && <div className="h-2 w-2 rounded-full bg-violet-600" />}
                          </div>
                          <div>
                            <p className={cn("text-sm font-medium", active ? "text-violet-700" : "text-[#111827]")}>{tpl.name}</p>
                            <p className="text-xs text-[#6B7280]">{tpl.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Guide text */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#111827]">材料生成指引</Label>
                  <textarea
                    value={genGuide}
                    onChange={(e) => setGenGuide(e.target.value)}
                    placeholder="请输入材料生成指引，例如：重点围绕技术壁垒和市场规模进行分析，要求逻辑清晰、数据充分，生成一份适合投委会审阅的尽职调查报告..."
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step: generating ── */}
          {genStep === "generating" && (
            <div className="flex flex-1 flex-col items-center justify-center py-12 gap-6">
              {/* Pulsing AI icon */}
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-60" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg">
                  <Bot className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Thinking step */}
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-[#111827]">
                  {THINKING_STEPS[genThinkingStep]}
                </p>
                <p className="text-sm text-[#6B7280]">
                  正在生成「{genTemplate}.docx」
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#6B7280]">AI 推理进度</span>
                  <span className="text-xs font-medium text-violet-600">{genProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${genProgress}%` }}
                  />
                </div>
              </div>

              {/* Scrolling thought bubbles */}
              <div className="w-full max-w-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 space-y-1">
                {THINKING_STEPS.slice(0, genThinkingStep + 1).reverse().slice(0, 3).map((s, i) => (
                  <div key={s} className={cn("flex items-center gap-2 text-xs transition-all", i === 0 ? "text-violet-700 font-medium" : "text-[#9CA3AF]")}>
                    {i === 0 ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : <Check className="h-3 w-3 shrink-0" />}
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: result ── */}
          {genStep === "result" && (
            <div className="flex flex-1 flex-col items-center justify-center py-8 gap-6">
              {/* Success indicator */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>

              <div className="text-center">
                <p className="text-base font-semibold text-[#111827]">材料生成成功</p>
                <p className="text-sm text-[#6B7280] mt-1">AI 已完成「{genTemplate}」的生成，请确认内容</p>
              </div>

              {/* Generated file card */}
              <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  {/* File icon */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                    <FileText className="h-7 w-7 text-blue-600" />
                  </div>
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">{genTemplate}.docx</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">DOCX</Badge>
                      <span className="text-xs text-[#6B7280]">{GEN_SIZES[genTemplate] || "2.0 MB"}</span>
                      <span className="text-xs text-[#9CA3AF]">·</span>
                      <span className="text-xs text-emerald-600 font-medium">AI 生成</span>
                    </div>
                  </div>
                </div>

                {/* Editable description */}
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-medium text-[#374151]">材料简介</label>
                  <textarea
                    value={genDescription}
                    onChange={(e) => setGenDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-[#F9FAFB] px-3 py-2 text-xs text-[#374151] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#F3F4F6]">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                    <FileDown className="h-3.5 w-3.5" />
                    下载
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                </div>
              </div>

              <p className="text-xs text-[#6B7280] text-center max-w-sm">
                确认材料内容无误后，点击「上传」发起变更请求，审批通过后即可在项目材料中查看
              </p>
            </div>
          )}

          {/* ── Footer ── */}
          {genStep !== "generating" && (
            <div className="shrink-0 flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] mt-2">
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
              >
                {genStep === "result" ? "关闭" : "取消"}
              </button>
              {genStep === "config" && (
                <button
                  type="button"
                  onClick={handleStartGenerate}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                >
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </button>
              )}
              {genStep === "result" && (
                <button
                  type="button"
                  onClick={handleGenerateUpload}
                  className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Upload className="h-4 w-4" />
                  上传
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
