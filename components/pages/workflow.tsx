"use client"

import { useState, useRef, useEffect } from "react"
import {
  User,
  ListChecks,
  FileText,
  FolderOpen,
  Clock,
  ChevronRight,
  Plus,
  Check,
  ArrowRight,
  Lightbulb,
  FileSearch,
  FolderSearch,
  Brain,
  MessageSquare,
  X,
  Send,
  Bot,
  ClipboardList,
  GitBranch,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Trash2, Upload, Link2, Pencil, Target, FileCheck, AlertTriangle, Shield, Handshake, CheckCircle, ClipboardCheck } from "lucide-react"

/* ─── Types ──────────────────────────────────── */
export interface PhaseLog {
  action: string
  date: string
  author: string
}

export interface Phase {
  id: string
  groupLabel: string
  name: string
  fullLabel: string
  assignee: string
  assigneeAvatar: string
  hypothesesCount: number
  termsCount: number
  materialsCount: number
  status: "completed" | "active" | "upcoming"
  startDate: string
  endDate?: string
  logs: PhaseLog[]
}

export interface PendingPhase {
  id: string
  projectId: string
  projectName: string
  phase: Omit<Phase, "id">
  changeId: string
  changeName: string
  changeType: "next-setup" | "next-duration" | "enter-duration" | "first-setup"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

type SidebarType =
  | "hypothesis-suggestions"
  | "term-suggestions"
  | "material-suggestions"
  | "ai-research"
  | "tracking-summary"
  | "ai-chat"
  | null

// Full page generation view type (replaces entire workflow view)
type FullPageView =
  | "hypothesis-generation"
  | "term-generation"
  | null

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// Deep thinking animation steps
interface ThinkingStep {
  id: string
  label: string
  status: "waiting" | "active" | "completed"
}

// Specific hypothesis within a suggestion
export interface SuggestionHypothesis {
  id: string
  direction: string
  category: string
  name: string
  isExisting: boolean // true = modify existing, false = create new
  // Pre-filled value points and risk points for creation
  valuePoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
  riskPoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
}

// Generated hypothesis suggestion with linked items
export interface GeneratedSuggestion {
  id: string
  title: string
  content: string
  linkedTerms: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
  // Multiple specific hypotheses under this suggestion
  hypotheses: SuggestionHypothesis[]
}

// Project hypothesis creation form data
export interface ProjectHypothesisFormData {
  direction: string
  category: string
  name: string
  valuePoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
  riskPoints: {
    id: string
    title: string
    evidenceDescription: string
    evidenceMaterialIds: string[]
    analysisContent: string
  }[]
}

// Pending project hypothesis change request
export interface PendingProjectHypothesis {
  id: string
  projectId: string
  projectName: string
  hypothesis: ProjectHypothesisFormData
  materialOptions: { id: string; name: string; format: string; size?: string }[]
  changeId: string
  changeName: string
  changeType: "create"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

// Suggested term with pre-filled content
export interface SuggestionTerm {
  id: string
  direction: string  // 条款方向 (一级类目)
  category: string   // 条款类别 (二级类目)
  name: string       // 条款名称
  isExisting: boolean
  // Pre-filled term sections
  ourDemand: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  ourBasis: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  bilateralConflict: { content: string }
  ourBottomLine: { content: string }
  compromiseSpace: { content: string }
}

// Generated term suggestion with linked items
export interface GeneratedTermSuggestion {
  id: string
  title: string
  content: string
  linkedHypotheses: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
  terms: SuggestionTerm[]
}

// Project term creation form data
export interface ProjectTermFormData {
  direction: string
  category: string
  name: string
  ourDemand: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  ourBasis: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }
  bilateralConflict: { content: string }
  ourBottomLine: { content: string }
  compromiseSpace: { content: string }
}

// Pending project term change request
export interface PendingProjectTerm {
  id: string
  projectId: string
  projectName: string
  term: ProjectTermFormData
  materialOptions: { id: string; name: string; format: string; size?: string }[]
  hypothesisOptions: { id: string; name: string }[]
  changeId: string
  changeName: string
  changeType: "create"
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

// Available project materials for selection
interface ProjectMaterialOption {
  id: string
  name: string
  format: string
}

const PHASES: Phase[] = [
  {
    id: "setup-1",
    groupLabel: "设立期",
    name: "设立期 - 阶段1",
    fullLabel: "设立期 - 阶段1",
    assignee: "张伟",
    assigneeAvatar: "张",
    hypothesesCount: 5,
    termsCount: 3,
    materialsCount: 8,
    status: "completed",
    startDate: "2024-01-05",
    endDate: "2024-01-20",
    logs: [
      { action: "上传竞品分析报告", date: "2024-01-12", author: "李四" },
      { action: "完成阶段审核", date: "2024-01-20", author: "王五" },
    ],
  },
  {
    id: "setup-2",
    groupLabel: "设立期",
    name: "设立期 - 阶段2",
    fullLabel: "设立期 - 阶段2",
    assignee: "李四",
    assigneeAvatar: "李",
    hypothesesCount: 8,
    termsCount: 5,
    materialsCount: 12,
    status: "completed",
    startDate: "2024-01-21",
    endDate: "2024-02-15",
    logs: [
      { action: "更新假设验证状态", date: "2024-02-10", author: "张伟" },
      { action: "完成阶段审核", date: "2024-02-15", author: "王五" },
    ],
  },
  {
    id: "setup-3",
    groupLabel: "设立期",
    name: "设立期 - 阶段3",
    fullLabel: "设立期 - 阶段3",
    assignee: "张伟",
    assigneeAvatar: "张",
    hypothesesCount: 10,
    termsCount: 8,
    materialsCount: 15,
    status: "completed",
    startDate: "2024-02-16",
    endDate: "2024-03-10",
    logs: [
      { action: "提交IC审核材料", date: "2024-03-01", author: "李四" },
      { action: "完成设立期最终审核", date: "2024-03-10", author: "陈总" },
    ],
  },
  {
    id: "duration-1",
    groupLabel: "存续期",
    name: "存续期 - 阶段1",
    fullLabel: "存续期 - 阶段1",
    assignee: "王芳",
    assigneeAvatar: "王",
    hypothesesCount: 10,
    termsCount: 8,
    materialsCount: 18,
    status: "completed",
    startDate: "2024-03-11",
    endDate: "2024-04-15",
    logs: [
      { action: "第一次投后跟踪报告", date: "2024-04-01", author: "王芳" },
      { action: "完成阶段审核", date: "2024-04-15", author: "张伟" },
    ],
  },
  {
    id: "duration-2",
    groupLabel: "存续期",
    name: "存续期 - 阶段2",
    fullLabel: "存续期 - 阶段2",
    assignee: "李四",
    assigneeAvatar: "李",
    hypothesesCount: 12,
    termsCount: 8,
    materialsCount: 22,
    status: "completed",
    startDate: "2024-04-16",
    endDate: "2024-06-20",
    logs: [
      { action: "提交Q2运营数据", date: "2024-06-10", author: "王芳" },
      { action: "完成阶段审核", date: "2024-06-20", author: "张伟" },
    ],
  },
  {
    id: "duration-3",
    groupLabel: "存续期",
    name: "存续期 - 阶段3",
    fullLabel: "存续期 - 阶段3",
    assignee: "张伟",
    assigneeAvatar: "张",
    hypothesesCount: 12,
    termsCount: 9,
    materialsCount: 25,
    status: "completed",
    startDate: "2024-06-21",
    endDate: "2024-09-15",
    logs: [
      { action: "提交Q3说体报告", date: "2024-09-05", author: "李四" },
      { action: "完成阶段审核", date: "2024-09-15", author: "陈总" },
    ],
  },
  {
    id: "duration-4",
    groupLabel: "存续期",
    name: "存续期 - 阶段4",
    fullLabel: "存续期 - 阶段4",
    assignee: "��芳",
    assigneeAvatar: "王",
    hypothesesCount: 13,
    termsCount: 9,
    materialsCount: 28,
    status: "active",
    startDate: "2024-09-16",
    logs: [
      { action: "更新条款审议状态", date: "2024-10-05", author: "张伟" },
      { action: "提交运营数据更新", date: "2024-11-01", author: "李四" },
    ],
  },
]

const statusConfig = {
  completed: {
    label: "已完成",
    dotCls: "bg-emerald-500",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderCls: "border-emerald-200",
    bgCls: "bg-emerald-50/30",
  },
  active: {
    label: "进行中",
    dotCls: "bg-[#2563EB]",
    badgeCls: "bg-blue-50 text-blue-700 border-blue-200",
    borderCls: "border-[#2563EB]",
    bgCls: "bg-blue-50/30",
  },
  upcoming: {
    label: "待启动",
    dotCls: "bg-[#D1D5DB]",
    badgeCls: "bg-gray-50 text-gray-500 border-gray-200",
    borderCls: "border-[#E5E7EB]",
    bgCls: "bg-white",
  },
}

// Sidebar content configs
const sidebarConfigs: Record<Exclude<SidebarType, null | "ai-chat">, { title: string; icon: typeof Lightbulb; description: string; items: { title: string; content: string }[] }> = {
  "hypothesis-suggestions": {
    title: "假设改进建议",
    icon: Lightbulb,
    description: "基于当前阶段的假设清单，系统智能生成以下改进建议",
    items: [
      { title: "补充技术壁垒假设", content: "建议增加关于核心技术专利和研发团队稳定性的假设，以更全面评估技术壁垒。" },
      { title: "细化市场规模假设", content: "当前市场TAM假设过于笼统，建议拆分为分地区、分行业的细分市场假设。" },
      { title: "添加竞争格局假设", content: "建议增加关于主要竞争对手及市场份额变化的假设。" },
    ],
  },
  "term-suggestions": {
    title: "条款构建建议",
    icon: FileText,
    description: "基于行业标准和当前阶段特点，系统推荐以下条款构建建议",
    items: [
      { title: "加强反稀释保护", content: "建议采用加权平均反稀释条款，并明确触发条件和调整机制。" },
      { title: "优化清算优先权", content: "建议采用1x Non-Participating结构，平衡投资人保护和创始人激励。" },
      { title: "完善信息权条款", content: "建议增加定期财务报告、重大事项通知等信息权条款。" },
    ],
  },
  "material-suggestions": {
    title: "材料收集建议",
    icon: FolderSearch,
    description: "根据当前阶段需求，系统推荐收集以下材料",
    items: [
      { title: "补充技术文档", content: "建议收集技术架构图、API文档、系统设计说明书等技术资料。" },
      { title: "补充客户案例", content: "建议收集3-5个标杆客户的使用案例和反馈报告。" },
      { title: "补充竞品分析", content: "建议收集主要竞争对手的产品对比分析报告。" },
    ],
  },
  "ai-research": {
    title: "AI调研材料",
    icon: Brain,
    description: "AI智能生成的调研材料和分析报告",
    items: [
      { title: "行业趋势分析报告", content: "基于最新市场数据，AI生成的行业发展趋势分析。" },
      { title: "竞争格局地图", content: "AI绘制的竞争对手分布、市场份额、核心优势对比。" },
      { title: "技术演进路线图", content: "AI分析的技术发展路线和未来趋势预测。" },
    ],
  },
  "tracking-summary": {
    title: "跟踪情况汇总",
    icon: ClipboardList,
    description: "当前阶段的投后跟踪情况汇总",
    items: [
      { title: "运营指标跟踪", content: "MAU同比增长35%，营收同比增长42%，客户留存率保持85%以上。" },
      { title: "假设验证进度", content: "12个假设中，9个已验证成立，2个待决议，1个不成立。" },
      { title: "重大事项记录", content: "本阶段完成B轮融资，估值提升40%，团队扩充30人。" },
    ],
  },
}

/* ─── Props ──────────────────────────────────── */
interface WorkflowProps {
  onSelectPhase?: (phaseName: string) => void
  isNewProject?: boolean
  projectId?: string
  projectName?: string
  phases?: Phase[]
  onPhasesChange?: (phases: Phase[]) => void
  onCreatePendingPhase?: (pending: PendingPhase) => void
  onCreatePendingProjectHypothesis?: (pending: PendingProjectHypothesis) => void
  onCreatePendingProjectTerm?: (pending: PendingProjectTerm) => void
  hypothesesCount?: number
  termsCount?: number
  materialsCount?: number
  // Persisted hypothesis suggestion generation state
  savedGeneratedSuggestions?: GeneratedSuggestion[]
  onSaveSuggestions?: (suggestions: GeneratedSuggestion[]) => void
  // Persisted term suggestion generation state
  savedGeneratedTermSuggestions?: GeneratedTermSuggestion[]
  onSaveTermSuggestions?: (suggestions: GeneratedTermSuggestion[]) => void
}

/* ─── New Project Phase Template ─────────────── */
function createNewPhase(phaseNumber: number, isSetup: boolean): Phase {
  const groupLabel = isSetup ? "设立期" : "存续期"
  const today = new Date().toISOString().split("T")[0]
  return {
    id: `${isSetup ? "setup" : "duration"}-${phaseNumber}`,
    groupLabel,
    name: `${groupLabel} - 阶段${phaseNumber}`,
    fullLabel: `${groupLabel} - 阶段${phaseNumber}`,
    assignee: "张伟",
    assigneeAvatar: "张",
    hypothesesCount: 0,
    termsCount: 0,
    materialsCount: 0,
    status: "active",
    startDate: today,
    logs: [],
  }
}

/* ─── Component ──────────────────────────────── */
export function Workflow({
  onSelectPhase,
  isNewProject = false,
  projectId = "",
  projectName = "",
  phases,
  onPhasesChange,
  onCreatePendingPhase,
  onCreatePendingProjectHypothesis,
  onCreatePendingProjectTerm,
  hypothesesCount,
  termsCount,
  materialsCount,
  savedGeneratedSuggestions,
  onSaveSuggestions,
  savedGeneratedTermSuggestions,
  onSaveTermSuggestions,
}: WorkflowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Use props phases if provided, otherwise use default PHASES for existing projects
  const projectPhases = phases ?? (isNewProject ? [] : PHASES)

  // Calculate current phase numbers from phases
  const currentSetupPhase = projectPhases.filter(p => p.groupLabel === "设立期").length
  const currentDurationPhase = projectPhases.filter(p => p.groupLabel === "存续期").length
  const isInDuration = currentDurationPhase > 0

  // Default to the latest active or last completed phase
  const defaultPhase = (() => {
    if (projectPhases.length === 0) return null
    const active = projectPhases.find((p) => p.status === "active")
    if (active) return active.id
    const completed = projectPhases.filter((p) => p.status === "completed")
    return completed.length > 0 ? completed[completed.length - 1].id : projectPhases[0].id
  })()

  const [selectedPhase, setSelectedPhase] = useState<string | null>(defaultPhase)
  const [activeSidebar, setActiveSidebar] = useState<SidebarType>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")

  // Full page generation view state
  const [fullPageView, setFullPageView] = useState<FullPageView>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationComplete, setGenerationComplete] = useState(savedGeneratedSuggestions ? savedGeneratedSuggestions.length > 0 : false)
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
  const [generatedSuggestions, setGeneratedSuggestions] = useState<GeneratedSuggestion[]>(savedGeneratedSuggestions || [])

  // Hypothesis creation dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formData, setFormData] = useState<ProjectHypothesisFormData>({
    direction: "",
    category: "",
    name: "",
    valuePoints: [],
    riskPoints: [],
  })

  // Term generation state
  const [isTermGenerating, setIsTermGenerating] = useState(false)
  const [termGenerationComplete, setTermGenerationComplete] = useState(savedGeneratedTermSuggestions ? savedGeneratedTermSuggestions.length > 0 : false)
  const [termThinkingSteps, setTermThinkingSteps] = useState<ThinkingStep[]>([])
  const [generatedTermSuggestions, setGeneratedTermSuggestions] = useState<GeneratedTermSuggestion[]>(savedGeneratedTermSuggestions || [])

  // Term creation dialog state
  const [showTermCreateDialog, setShowTermCreateDialog] = useState(false)
  const [termFormData, setTermFormData] = useState<ProjectTermFormData>({
    direction: "",
    category: "",
    name: "",
    ourDemand: { content: "", linkedMaterialIds: [], linkedHypothesisIds: [] },
    ourBasis: { content: "", linkedMaterialIds: [], linkedHypothesisIds: [] },
    bilateralConflict: { content: "" },
    ourBottomLine: { content: "" },
    compromiseSpace: { content: "" },
  })

  // Mock available project materials
  const availableMaterials: ProjectMaterialOption[] = [
    { id: "m1", name: "闫俊杰_CV", format: "PDF" },
    { id: "m2", name: "核心团队履历及期权安排", format: "PDF" },
    { id: "m3", name: "行业研究报告_2024Q4", format: "PDF" },
    { id: "m4", name: "竞品市场份额分析", format: "XLSX" },
    { id: "m5", name: "财务预测模型", format: "XLSX" },
    { id: "m6", name: "单位经济模型分析", format: "PDF" },
    { id: "m7", name: "尽职调查报告", format: "PDF" },
    { id: "m8", name: "商业计划书", format: "PDF" },
  ]

  // Mock available hypotheses for linking
  const availableHypotheses = [
    { id: "h1", name: "创始人具有扎实的人工智能学术背景" },
    { id: "h2", name: "核心技术具备可验证的技术壁垒" },
    { id: "h3", name: "市场规模足够支撑高速增长" },
    { id: "h4", name: "单位经济模型健康，具备规模化盈利基础" },
  ]

  // Handle starting the first phase for new projects - creates pending request
  function handleStartFirstPhase() {
    const newPhase = createNewPhase(1, true)
    const pendingPhase: PendingPhase = {
      id: `pending-phase-${Date.now()}`,
      projectId,
      projectName,
      phase: newPhase,
      changeId: `CR-P-${Date.now().toString().slice(-6)}`,
      changeName: `启动${newPhase.fullLabel}`,
      changeType: "first-setup",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingPhase?.(pendingPhase)
  }

  // Handle starting next setup phase - creates pending request
  function handleStartNextSetupPhase() {
    const nextPhaseNum = currentSetupPhase + 1
    const newPhase = createNewPhase(nextPhaseNum, true)
    const pendingPhase: PendingPhase = {
      id: `pending-phase-${Date.now()}`,
      projectId,
      projectName,
      phase: newPhase,
      changeId: `CR-P-${Date.now().toString().slice(-6)}`,
      changeName: `启动${newPhase.fullLabel}`,
      changeType: "next-setup",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingPhase?.(pendingPhase)
  }

  // Handle entering duration period - creates pending request
  function handleEnterDuration() {
    const newPhase = createNewPhase(1, false)
    const pendingPhase: PendingPhase = {
      id: `pending-phase-${Date.now()}`,
      projectId,
      projectName,
      phase: newPhase,
      changeId: `CR-P-${Date.now().toString().slice(-6)}`,
      changeName: `进入存续期 - ${newPhase.fullLabel}`,
      changeType: "enter-duration",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingPhase?.(pendingPhase)
  }

  // Handle starting next duration phase - creates pending request
  function handleStartNextDurationPhase() {
    const nextPhaseNum = currentDurationPhase + 1
    const newPhase = createNewPhase(nextPhaseNum, false)
    const pendingPhase: PendingPhase = {
      id: `pending-phase-${Date.now()}`,
      projectId,
      projectName,
      phase: newPhase,
      changeId: `CR-P-${Date.now().toString().slice(-6)}`,
      changeName: `启动${newPhase.fullLabel}`,
      changeType: "next-duration",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingPhase?.(pendingPhase)
  }

  // Notify parent of initial phase on mount
  useEffect(() => {
    if (defaultPhase) {
      const phase = projectPhases.find((p) => p.id === defaultPhase)
      if (phase && onSelectPhase) {
        onSelectPhase(phase.fullLabel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to selected phase card on mount
  useEffect(() => {
    if (scrollRef.current && !activeSidebar && defaultPhase) {
      const card = scrollRef.current.querySelector(`[data-phase="${defaultPhase}"]`)
      if (card) {
        card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [defaultPhase, activeSidebar])

  function handleSelectPhase(phaseId: string) {
    setSelectedPhase(phaseId)
    const phase = PHASES.find((p) => p.id === phaseId)
    if (phase && onSelectPhase) {
      onSelectPhase(phase.fullLabel)
    }
  }

  function handleStartNextPhase() {
    const nextPhase = PHASES.find((p) => p.status === "upcoming")
    if (nextPhase) {
      setSelectedPhase(nextPhase.id)
      if (onSelectPhase) {
        onSelectPhase(nextPhase.fullLabel)
      }
    }
  }

  function handleOpenSidebar(type: SidebarType) {
    // For hypothesis-suggestions, open full page view instead of sidebar
    if (type === "hypothesis-suggestions") {
      setFullPageView("hypothesis-generation")
      setIsGenerating(false)
      setThinkingSteps([])
      // Restore saved suggestions if available, otherwise reset
      if (savedGeneratedSuggestions && savedGeneratedSuggestions.length > 0) {
        setGeneratedSuggestions(savedGeneratedSuggestions)
        setGenerationComplete(true)
      } else {
        setGeneratedSuggestions([])
        setGenerationComplete(false)
      }
      return
    }

    // For term-suggestions, open full page view instead of sidebar
    if (type === "term-suggestions") {
      setFullPageView("term-generation")
      setIsTermGenerating(false)
      setTermThinkingSteps([])
      // Restore saved suggestions if available, otherwise reset
      if (savedGeneratedTermSuggestions && savedGeneratedTermSuggestions.length > 0) {
        setGeneratedTermSuggestions(savedGeneratedTermSuggestions)
        setTermGenerationComplete(true)
      } else {
        setGeneratedTermSuggestions([])
        setTermGenerationComplete(false)
      }
      return
    }

    setActiveSidebar(type)
    if (type === "ai-chat") {
      setChatMessages([
        { role: "assistant", content: "您好！我是您的AI智能助手，可以基于当前阶段的信息回答您的问题，帮助您生成所需的材料。请问有什么可以帮您？" }
      ])
    }
  }

  function handleCloseFullPageView() {
    setFullPageView(null)
    setIsGenerating(false)
    setGenerationComplete(false)
    setThinkingSteps([])
    setGeneratedSuggestions([])
    // Also reset term generation state
    setIsTermGenerating(false)
    setTermGenerationComplete(false)
    setTermThinkingSteps([])
    setGeneratedTermSuggestions([])
  }

  function handleCreateFromHypothesis(hypothesis: SuggestionHypothesis) {
    // Pre-fill form with hypothesis data including pre-selected materials
    setFormData({
      direction: hypothesis.direction,
      category: hypothesis.category,
      name: hypothesis.name,
      valuePoints: hypothesis.valuePoints.map((vp) => ({
        ...vp,
        evidenceMaterialIds: vp.evidenceMaterialIds ?? [],
      })),
      riskPoints: hypothesis.riskPoints.map((rp) => ({
        ...rp,
        evidenceMaterialIds: rp.evidenceMaterialIds ?? [],
      })),
    })
    setShowCreateDialog(true)
  }

  function handleAddValuePoint() {
    setFormData((prev) => ({
      ...prev,
      valuePoints: [
        ...prev.valuePoints,
        {
          id: `vp-new-${Date.now()}`,
          title: "",
          evidenceDescription: "",
          evidenceMaterialIds: [],
          analysisContent: "",
        },
      ],
    }))
  }

  function handleRemoveValuePoint(id: string) {
    setFormData((prev) => ({
      ...prev,
      valuePoints: prev.valuePoints.filter((vp) => vp.id !== id),
    }))
  }

  function handleAddRiskPoint() {
    setFormData((prev) => ({
      ...prev,
      riskPoints: [
        ...prev.riskPoints,
        {
          id: `rp-new-${Date.now()}`,
          title: "",
          evidenceDescription: "",
          evidenceMaterialIds: [],
          analysisContent: "",
        },
      ],
    }))
  }

  function handleRemoveRiskPoint(id: string) {
    setFormData((prev) => ({
      ...prev,
      riskPoints: prev.riskPoints.filter((rp) => rp.id !== id),
    }))
  }

  function handleToggleMaterial(pointType: "value" | "risk", pointId: string, materialId: string) {
    setFormData((prev) => {
      const key = pointType === "value" ? "valuePoints" : "riskPoints"
      return {
        ...prev,
        [key]: prev[key].map((point) =>
          point.id === pointId
            ? {
              ...point,
              evidenceMaterialIds: point.evidenceMaterialIds.includes(materialId)
                ? point.evidenceMaterialIds.filter((id) => id !== materialId)
                : [...point.evidenceMaterialIds, materialId],
            }
            : point
        ),
      }
    })
  }

  function handleCloseCreateDialog() {
    setShowCreateDialog(false)
    setFormData({
      direction: "",
      category: "",
      name: "",
      valuePoints: [],
      riskPoints: [],
    })
  }

  function handleSubmitHypothesis() {
    // Create a pending hypothesis change request
    const pendingHypothesis: PendingProjectHypothesis = {
      id: `pending-project-hyp-${Date.now()}`,
      projectId,
      projectName,
      hypothesis: formData,
      materialOptions: availableMaterials,
      changeId: `CR-PH-${Date.now().toString().slice(-6)}`,
      changeName: `创建项目假设: ${formData.name}`,
      changeType: "create",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }

    onCreatePendingProjectHypothesis?.(pendingHypothesis)
    handleCloseCreateDialog()
    handleCloseFullPageView()
  }

  // Term creation handlers
  function handleCreateFromTerm(term: SuggestionTerm) {
    setTermFormData({
      direction: term.direction,
      category: term.category,
      name: term.name,
      ourDemand: { ...term.ourDemand },
      ourBasis: { ...term.ourBasis },
      bilateralConflict: { ...term.bilateralConflict },
      ourBottomLine: { ...term.ourBottomLine },
      compromiseSpace: { ...term.compromiseSpace },
    })
    setShowTermCreateDialog(true)
  }

  function handleCloseTermCreateDialog() {
    setShowTermCreateDialog(false)
    setTermFormData({
      direction: "",
      category: "",
      name: "",
      ourDemand: { content: "", linkedMaterialIds: [], linkedHypothesisIds: [] },
      ourBasis: { content: "", linkedMaterialIds: [], linkedHypothesisIds: [] },
      bilateralConflict: { content: "" },
      ourBottomLine: { content: "" },
      compromiseSpace: { content: "" },
    })
  }

  function handleSubmitTerm() {
    const pendingTerm: PendingProjectTerm = {
      id: `pending-project-term-${Date.now()}`,
      projectId,
      projectName,
      term: termFormData,
      materialOptions: availableMaterials,
      hypothesisOptions: availableHypotheses,
      changeId: `CR-PT-${Date.now().toString().slice(-6)}`,
      changeName: `创建项目条款: ${termFormData.name}`,
      changeType: "create",
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [
        { id: "zhangwei", name: "张伟", initials: "张伟" },
        { id: "lisi", name: "李四", initials: "李四" },
      ],
    }
    onCreatePendingProjectTerm?.(pendingTerm)
    handleCloseTermCreateDialog()
    handleCloseFullPageView()
  }

  function handleStartTermGeneration() {
    setIsTermGenerating(true)
    setTermGenerationComplete(false)

    const steps: ThinkingStep[] = [
      { id: "t1", label: "读取当前阶段条款清单...", status: "waiting" },
      { id: "t2", label: "分析条款完整性与覆盖面...", status: "waiting" },
      { id: "t3", label: "检索关联假设与材料...", status: "waiting" },
      { id: "t4", label: "对比行业标准条款结构...", status: "waiting" },
      { id: "t5", label: "生成条款建议...", status: "waiting" },
    ]
    setTermThinkingSteps(steps)

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setTermThinkingSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx < currentStep ? "completed" : idx === currentStep ? "active" : "waiting",
          }))
        )
        currentStep++
      } else {
        clearInterval(interval)
        setTermThinkingSteps((prev) => prev.map((step) => ({ ...step, status: "completed" })))

        setTimeout(() => {
          const suggestions: GeneratedTermSuggestion[] = [
            {
              id: "gts1",
              title: "加强董事会席位条款",
              content: "建议明确投资方董事会席位安排，包括委派权、参会权、信息知情权等核心权利条款。",
              linkedHypotheses: [
                { id: "h1", name: "创始人具有扎实的人工智能学术背景" },
              ],
              linkedMaterials: [
                { id: "m7", name: "尽职调查报告" },
              ],
              terms: [
                {
                  id: "st1-1",
                  direction: "控制权条款",
                  category: "董事会条款",
                  name: "投资方有权委派一名董事进入公司董事会",
                  isExisting: false,
                  ourDemand: { content: "投资方有权委派一名董事进入公司董事会，享有完整的表决权和知情权。", linkedMaterialIds: ["m7"], linkedHypothesisIds: ["h1"] },
                  ourBasis: { content: "作为战略投资人，需要参与公司重大决策以保护投资人利益；创始人背景优秀，需适度介入治理。", linkedMaterialIds: ["m7"], linkedHypothesisIds: ["h1"] },
                  bilateralConflict: { content: "创始团队希望保持董事会控制权，担心投资方过度干预日常经营。" },
                  ourBottomLine: { content: "至少获得一个董事席位，确保重大事项的知情权和参与权。" },
                  compromiseSpace: { content: "可接受观察员席位作为过渡，但需明确升级为正式董事的条件。" },
                },
              ],
            },
            {
              id: "gts2",
              title: "完善反稀释保护条款",
              content: "建议采用加权平均反稀释条款，明确触发条件、调整机制和豁免情形。",
              linkedHypotheses: [
                { id: "h4", name: "单位经济模型健康，具备规模化盈利基础" },
              ],
              linkedMaterials: [
                { id: "m5", name: "财务预测模型" },
                { id: "m8", name: "商业计划书" },
              ],
              terms: [
                {
                  id: "st2-1",
                  direction: "经济性条款",
                  category: "反稀释条款",
                  name: "采用加权平均反稀释保护机制",
                  isExisting: false,
                  ourDemand: { content: "采用广义加权平均反稀释条款，在公司低价融资时调整投资人持股比例。", linkedMaterialIds: ["m5"], linkedHypothesisIds: ["h4"] },
                  ourBasis: { content: "保护投资人在后续融资中的权益不被不当稀释，基于财务模型显示的估值合理性。", linkedMaterialIds: ["m5", "m8"], linkedHypothesisIds: [] },
                  bilateralConflict: { content: "创始团队倾向于窄基加权平均或设置较高的触发门槛。" },
                  ourBottomLine: { content: "必须有反稀释保护机制，广义加权平均是最低要求。" },
                  compromiseSpace: { content: "可接受设定合理的豁免情形，如员工期权池扩大、战略并购等。" },
                },
              ],
            },
            {
              id: "gts3",
              title: "建立信息权条款",
              content: "建议明确定期财务报告、重大事项通知、现场检查权等信息权条款。",
              linkedHypotheses: [
                { id: "h3", name: "市场规模足够支撑高速增长" },
              ],
              linkedMaterials: [
                { id: "m3", name: "行业研究报告_2024Q4" },
              ],
              terms: [
                {
                  id: "st3-1",
                  direction: "信息权条款",
                  category: "财务信息权",
                  name: "投资方有权获取公司月度/季度/年度财务报告",
                  isExisting: false,
                  ourDemand: { content: "公司应按月提供管理报表，按季提供审计后财务报告，按年提供审计报告。", linkedMaterialIds: ["m3"], linkedHypothesisIds: ["h3"] },
                  ourBasis: { content: "及时掌握公司经营状况，验证市场增长假设，支持投后管理决策。", linkedMaterialIds: ["m3"], linkedHypothesisIds: ["h3"] },
                  bilateralConflict: { content: "公司担心频繁报告增加管理负担，可能泄露商业机密。" },
                  ourBottomLine: { content: "至少季度财务报告和年度审计报告是必须的。" },
                  compromiseSpace: { content: "月报可简化为关键KPI指标，减轻公司负担。" },
                },
              ],
            },
          ]
          setGeneratedTermSuggestions(suggestions)
          onSaveTermSuggestions?.(suggestions)
          setIsTermGenerating(false)
          setTermGenerationComplete(true)
        }, 500)
      }
    }, 800)
  }

  function handleStartGeneration() {
    setIsGenerating(true)
    setGenerationComplete(false)

    const steps: ThinkingStep[] = [
      { id: "s1", label: "读取当前阶段假设清单...", status: "waiting" },
      { id: "s2", label: "分析假设完整性与覆盖面...", status: "waiting" },
      { id: "s3", label: "检索关联条款与材料...", status: "waiting" },
      { id: "s4", label: "对比行业最佳实践...", status: "waiting" },
      { id: "s5", label: "生成改进建议...", status: "waiting" },
    ]
    setThinkingSteps(steps)

    // Animate through steps
    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setThinkingSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx < currentStep ? "completed" : idx === currentStep ? "active" : "waiting",
          }))
        )
        currentStep++
      } else {
        clearInterval(interval)
        // Mark all as completed and show results
        setThinkingSteps((prev) =>
          prev.map((step) => ({ ...step, status: "completed" }))
        )

        // Generate mock suggestions with linked items - 5 suggestions
        setTimeout(() => {
          const suggestions: GeneratedSuggestion[] = [
            {
              id: "gs0",
              title: "补充创始人品质假设",
              content: "当前假设清单缺少对创始人能力与品质的系统性论证与支撑。建议增加关于创始人技术水平和创始人商业经验等方面的假设，以更全面评估投资标的的成功概率。",
              linkedTerms: [
                { id: "t1", name: "创始人股权��配细则" },
                { id: "t2", name: "创始人权限划分" },
              ],
              linkedMaterials: [
                { id: "m1", name: "闫俊杰_CV" },
                { id: "m2", name: "核心团队履历及期权安排" },
              ],
              hypotheses: [
                {
                  id: "sh0-1",
                  direction: "团队能力",
                  category: "创始人",
                  name: "创始人具有扎实的人工智能学术背景",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp0-1", title: "创始人闫俊杰拥有博士学位，在人工智能领域具有较强学术能力。", evidenceDescription: "创始人拥有博士学位，在AI领域发表过15篇高质量学术论文。", evidenceMaterialIds: ["m1"], analysisContent: "创始人拥有博士学位，为该领域高学历人才。在人工智能领域发表过15篇高质量学术论文，其中5篇发表在顶级期刊上。曾获得国家自然科学基金青年项目资助，具备扎实的理论基础和研究能力。" },
                    { id: "vp0-2", title: "创始人的学术成功具有较高影响力。", evidenceDescription: "创始人闫俊杰在Google Scholar上的H指数为8，总引用次数超过500次，证明其研究成果具有较高的学术影响力。", evidenceMaterialIds: ["m1"], analysisContent: "创始人闫俊杰的H指数达到8，在同龄学者中处于较高水平。其研究成果被多家知名企业引用并应用于实际产品中，证明其学术研究具有很高的实用价值。" },
                  ],
                  riskPoints: [
                    { id: "rp0-1", title: "学术能力与商业转化能力有可能脱节", evidenceDescription: "学术背景较强但商业转化经验相对有限，需关注从学术到产业的过渡能力。", evidenceMaterialIds: ["m1"], analysisContent: "需创始人在商业化方面的经验主要集中在技术转让和专利授权领域，尚未有过完整的产品商业化经历。建议关注其团队中是否有强有力的商业运营搭档补足这一短板。" },
                  ],
                },
                {
                  id: "sh0-2",
                  direction: "团队能力",
                  category: "创始人",
                  name: "创始人具备丰富的AI产品商业化经验",
                  isExisting: true,
                  valuePoints: [
                    { id: "vp3", title: "迭代速度快", evidenceDescription: "产品更新周期短于行业平均", evidenceMaterialIds: ["m1", "m3"], analysisContent: "快速迭代能力体现团队执行力和技术实力。" },
                  ],
                  riskPoints: [
                    { id: "rp3", title: "技术迭代风险", evidenceDescription: "AI领域技术更新速度快", evidenceMaterialIds: [], analysisContent: "需持续关注竞品技术动态，评估公司技术迭代能力。" },
                  ],
                },
                {
                  id: "sh0-3",
                  direction: "团队能力",
                  category: "创始人",
                  name: "创始人具备出较强的团队凝聚力",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp3", title: "迭代速度快", evidenceDescription: "产品更新周期短于行业平均", evidenceMaterialIds: ["m1", "m3"], analysisContent: "快速迭代能力体现团队执行力和技术实力。" },
                  ],
                  riskPoints: [
                    { id: "rp3", title: "技术迭代风险", evidenceDescription: "AI领域技术更新速度快", evidenceMaterialIds: [], analysisContent: "需持续关注竞品技术动态，评估公司技术迭代能力。" },
                  ],
                },
              ],
            },
            {
              id: "gs1",
              title: "补充技术壁垒假设",
              content: "当前假设清单缺少对核心技术壁垒的系统性论证。建议增加关于专利布局、技术团队稳定性、技术迭代能力等方面的假设，以更全面评估投资标的的技术竞争力。",
              linkedTerms: [
                { id: "t1", name: "知识产权归属" },
                { id: "t2", name: "核心团队锁定" },
              ],
              linkedMaterials: [
                { id: "m1", name: "专利清单及技术白皮书" },
                { id: "m2", name: "核心团队履历及期权安排" },
              ],
              hypotheses: [
                {
                  id: "sh1-1",
                  direction: "技术攻关",
                  category: "技术壁垒",
                  name: "专利布局完善，能���形成技术壁垒",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp1", title: "专利布局完善，覆盖领域广。", evidenceDescription: "公司在核心技术领域拥有20+项专利", evidenceMaterialIds: ["m1"], analysisContent: "专利覆盖核心算法、模型架构和数据处理流程，形成完整的技术护城河。" },
                  ],
                  riskPoints: [
                    { id: "rp1", title: "专利维护成本较高。", evidenceDescription: "专利维护需要持续投入", evidenceMaterialIds: ["m1"], analysisContent: "需评估专利维护成本对运营的影响。" },
                  ],
                },
                {
                  id: "sh1-2",
                  direction: "技术攻关",
                  category: "团队稳定性",
                  name: "技术团队核心成员稳定性，人才流失少，能够长期支撑高水平研发工作",
                  isExisting: true,
                  valuePoints: [
                    { id: "vp2", title: "技术团队存续时间长。", evidenceDescription: "核心技术人员平均在职时间超过3年。", evidenceMaterialIds: ["m2"], analysisContent: "团队稳定性有助于技术积累和持续高水平研发。" },
                  ],
                  riskPoints: [
                    { id: "rp2", title: "AI行业人才竞争激烈，存在人才流失风险。", evidenceDescription: "AI行业人才竞争激烈，友商可能以各种方式挖墙脚。", evidenceMaterialIds: ["m2"], analysisContent: "需关注核心人员激励机制和竞业限制条款。" },
                  ],
                },
                {
                  id: "sh1-3",
                  direction: "技术攻关",
                  category: "技术迭代",
                  name: "技术迭代能力强，能迅速响应市场变化",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp3", title: "迭代速度快", evidenceDescription: "产品更新周期短于行业平均", evidenceMaterialIds: ["m1", "m3"], analysisContent: "快速迭代能力体现团队执行力和技术实力。" },
                  ],
                  riskPoints: [
                    { id: "rp3", title: "技术迭代风险", evidenceDescription: "AI领域技术更新速度快", evidenceMaterialIds: [], analysisContent: "需持续关注竞品技术动态，评估公司技术迭代能力。" },
                  ],
                },
              ],
            },
            {
              id: "gs2",
              title: "细化市场规模假设",
              content: "现有TAM/SAM/SOM假设过于笼统，建议从地区维度、行业维度、客户规模维度进行拆分，形成更精细的市场规模假设矩阵。",
              linkedTerms: [
                { id: "t3", name: "市场拓展里程碑条款" },
              ],
              linkedMaterials: [
                { id: "m3", name: "行业研究报告_2024Q4" },
                { id: "m4", name: "竞品市场份额分析" },
              ],
              hypotheses: [
                {
                  id: "sh2-1",
                  direction: "市场判断",
                  category: "市场规模",
                  name: "国内市场TAM规模稳步增长，发展前景好",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp4", title: "市场增长潜力大", evidenceDescription: "AI基础设施市场年复合增长率超30%", evidenceMaterialIds: ["m3", "m4"], analysisContent: "市场处于快速增长期，先发优势明显。" },
                  ],
                  riskPoints: [
                    { id: "rp4", title: "市场竞争加剧", evidenceDescription: "行业玩家数量持续增加", evidenceMaterialIds: ["m4"], analysisContent: "需评估公司差异化竞争能力。" },
                  ],
                },
                {
                  id: "sh2-2",
                  direction: "市场判断",
                  category: "市场渗透",
                  name: "多模态大模型市场需求增长",
                  isExisting: true,
                  valuePoints: [
                    { id: "vp5", title: "多模态需求增长", evidenceDescription: "企业对多模态AI解决方案需求上升", evidenceMaterialIds: ["m3"], analysisContent: "多模态融合是行业趋势，市场空间广阔。" },
                  ],
                  riskPoints: [
                    { id: "rp5", title: "技术门槛高", evidenceDescription: "多模态技术整合难度大", evidenceMaterialIds: [], analysisContent: "需评估技术实现能力和竞争格局。" },
                  ],
                },
              ],
            },
            {
              id: "gs3",
              title: "添加商业模式可持续性假设",
              content: "建议增加关于商业模式可持续性的假设，包括CAC/LTV比值假设、毛利率演变假设、规模效应假设等。",
              linkedTerms: [
                { id: "t4", name: "财务信息披露条款" },
                { id: "t5", name: "反稀释保护条款" },
              ],
              linkedMaterials: [
                { id: "m5", name: "财务预测模型" },
                { id: "m6", name: "单位经济模型分析" },
              ],
              hypotheses: [
                {
                  id: "sh3-1",
                  direction: "商业模式",
                  category: "盈利能力",
                  name: "单位经济模型健康，LTV/CAC比值大于3",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp6", title: "单位经济模型健康", evidenceDescription: "LTV/CAC比值大于3", evidenceMaterialIds: ["m5", "m6"], analysisContent: "客户获取成本合理，具备规模化盈利基础。" },
                  ],
                  riskPoints: [
                    { id: "rp6", title: "获客成本上升", evidenceDescription: "市场竞争导致获客成本上升", evidenceMaterialIds: ["m5"], analysisContent: "需关注获客成本变化趋势。" },
                  ],
                },
                {
                  id: "sh3-2",
                  direction: "商业模式",
                  category: "成本结构",
                  name: "毛利率稳步提升，足够支撑公司规模扩张",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp7", title: "规模效应显现", evidenceDescription: "收入增长带动毛利率提升", evidenceMaterialIds: ["m5", "m6"], analysisContent: "规模扩大后边际成本下降。" },
                  ],
                  riskPoints: [
                    { id: "rp7", title: "毛利率承压", evidenceDescription: "算力成本占比高", evidenceMaterialIds: ["m6"], analysisContent: "需关注算力成本下降对毛利率的影响。" },
                  ],
                },
              ],
            },
            {
              id: "gs4",
              title: "补充团队执行力假设",
              content: "建议增加对管理团队执行力的系统性评估假设，包括关键里程碑达成率、战略调整能力、组织扩张能力等维度。",
              linkedTerms: [
                { id: "t6", name: "创始人锁定条款" },
              ],
              linkedMaterials: [
                { id: "m7", name: "尽职调查报告" },
              ],
              hypotheses: [
                {
                  id: "sh4-1",
                  direction: "团队能力",
                  category: "执行力",
                  name: "团队执行力强，里程碑达成率高于80%",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp8", title: "里程碑达成率高", evidenceDescription: "过往融资轮次里程碑达成率超85%", evidenceMaterialIds: ["m7"], analysisContent: "团队具备良好的目标管理和执行能力。" },
                  ],
                  riskPoints: [
                    { id: "rp8", title: "外部环境变化", evidenceDescription: "宏观环境可能影响里程碑达成", evidenceMaterialIds: [], analysisContent: "需评估外部因素对执行的影响。" },
                  ],
                },
                {
                  id: "sh4-2",
                  direction: "团队能力",
                  category: "组织管理",
                  name: "组织扩张能力强，管理经验丰富",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp9", title: "管理经验丰富", evidenceDescription: "核心管理层有大厂背景", evidenceMaterialIds: ["m7"], analysisContent: "具备大规模团队管理经验。" },
                  ],
                  riskPoints: [
                    { id: "rp9", title: "组织扩张风险", evidenceDescription: "团队规模计划快速增长", evidenceMaterialIds: ["m7"], analysisContent: "需评估组织管理能力是否匹配扩张速度。" },
                  ],
                },
              ],
            },
            {
              id: "gs5",
              title: "增加退出路径假设",
              content: "建议补充关于退出路径可行性的假设，包括IPO可能性评估、并购退出场景分析、回购条款触发条件等。",
              linkedTerms: [
                { id: "t7", name: "回购条款" },
                { id: "t8", name: "领售权条款" },
              ],
              linkedMaterials: [
                { id: "m8", name: "商业计划书" },
              ],
              hypotheses: [
                {
                  id: "sh5-1",
                  direction: "退出策略",
                  category: "退出可行性",
                  name: "IPO退出可行性高，具备完善退出机制",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp10", title: "IPO预期明确", evidenceDescription: "公司已��动上市辅导", evidenceMaterialIds: ["m8"], analysisContent: "退出路径清晰，时间节点相对确定。" },
                  ],
                  riskPoints: [
                    { id: "rp10", title: "市场窗口不确定", evidenceDescription: "IPO市场波动较大", evidenceMaterialIds: [], analysisContent: "需关注资本市场环境变化对上市计划的影响。" },
                  ],
                },
                {
                  id: "sh5-2",
                  direction: "退出策略",
                  category: "退出可行性",
                  name: "并��退出可行性高，具备完善退出机制",
                  isExisting: false,
                  valuePoints: [
                    { id: "vp11", title: "战略价值高", evidenceDescription: "技术资产对大厂有吸引力", evidenceMaterialIds: ["m8", "m1"], analysisContent: "具备被并购的战略价值。" },
                  ],
                  riskPoints: [
                    { id: "rp11", title: "估值分歧", evidenceDescription: "并购估值可能低于预期", evidenceMaterialIds: ["m8"], analysisContent: "需评估并购退出的估值合理性。" },
                  ],
                },
              ],
            },
          ]
          setGeneratedSuggestions(suggestions)
          onSaveSuggestions?.(suggestions)
          setIsGenerating(false)
          setGenerationComplete(true)
        }, 500)
      }
    }, 800)
  }

  function handleCloseSidebar() {
    setActiveSidebar(null)
    setChatMessages([])
    setChatInput("")
  }

  function handleSendChat() {
    if (!chatInput.trim()) return
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput("")

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        role: "assistant",
        content: "谢谢您的提问。基于当前阶段的数据，我正在为您生成相关分析...\n\n根据您的需求，我建议您可以从以下几个方面进行考虑：\n1. 完善当前假设的论证支持\n2. 收集更多客户反馈数据\n3. 补充竞品分析材料\n\n如需进一步帮助，请随时告诉我。"
      }
      setChatMessages((prev) => [...prev, aiResponse])
    }, 1000)
  }

  const currentPhase = projectPhases.find((p) => p.id === selectedPhase)
  const isSetupPhase = currentPhase?.groupLabel === "设立期"

  // Group phases for rendering group headers
  let lastGroup = ""

  // Show full page generation view
  if (fullPageView === "hypothesis-generation") {
    return (
      <div className="flex h-full flex-col bg-[#F9FAFB]">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCloseFullPageView}
                className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
                返回工作流
              </button>
              <div className="h-6 w-px bg-[#E5E7EB]" />
              <div>
                <h1 className="text-xl font-bold text-[#111827]">假设改进建议</h1>
                <p className="text-sm text-[#6B7280]">{currentPhase?.fullLabel || "设立期 - 阶段1"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-4xl">
            {!isGenerating && !generationComplete && (
              /* Start Generation State */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-50 ring-8 ring-amber-50/50">
                  <Lightbulb className="h-10 w-10 text-amber-600" />
                </div>
                <h2 className="text-xl font-semibold text-[#111827] mb-2">AI假设改进建议生成</h2>
                <p className="text-sm text-[#6B7280] text-center max-w-md mb-8">
                  基于当前阶段的假设清单、条款文档和项目材料，AI将为您生成针对性的假设改进建议，帮助您完善投资决策框架。
                </p>
                <button
                  onClick={handleStartGeneration}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-xl"
                >
                  <Brain className="h-5 w-5" />
                  开始生成
                </button>
              </div>
            )}

            {isGenerating && (
              /* Thinking Animation */
              <div className="py-12">
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    AI正在深度思考...
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                  <div className="space-y-4">
                    {thinkingSteps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-4">
                        {/* Step indicator */}
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                          step.status === "completed" ? "bg-emerald-100" :
                            step.status === "active" ? "bg-blue-100 animate-pulse" :
                              "bg-gray-100"
                        )}>
                          {step.status === "completed" ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : step.status === "active" ? (
                            <div className="h-3 w-3 rounded-full bg-blue-500 animate-ping" />
                          ) : (
                            <span className="text-xs text-gray-400">{idx + 1}</span>
                          )}
                        </div>

                        {/* Step label */}
                        <span className={cn(
                          "text-sm transition-colors duration-300",
                          step.status === "completed" ? "text-emerald-700 font-medium" :
                            step.status === "active" ? "text-blue-700 font-medium" :
                              "text-gray-400"
                        )}>
                          {step.label}
                        </span>

                        {/* Progress indicator for active step */}
                        {step.status === "active" && (
                          <div className="flex-1">
                            <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full w-1/2 bg-blue-500 animate-pulse rounded-full" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {generationComplete && (
              /* Results */
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">生成完成</h2>
                    <p className="text-sm text-[#6B7280]">共生成 {generatedSuggestions.length} 条改进建议</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {generatedSuggestions.map((suggestion, idx) => (
                    <div
                      key={suggestion.id}
                      className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-semibold text-amber-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-[#111827] mb-2">{suggestion.title}</h3>
                          <p className="text-sm text-[#6B7280] leading-relaxed">{suggestion.content}</p>
                        </div>
                      </div>

                      {/* Linked Items */}
                      <div className="ml-12 space-y-3 pt-4 border-t border-[#F3F4F6]">
                        {/* Linked Terms */}
                        {suggestion.linkedTerms.length > 0 && (
                          <div className="flex items-start gap-2">
                            <div className="flex items-center gap-1.5 shrink-0 text-xs text-[#6B7280]">
                              <FileText className="h-3.5 w-3.5 text-violet-500" />
                              <span>关联条款:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestion.linkedTerms.map((t) => (
                                <Badge key={t.id} className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] font-normal cursor-pointer hover:bg-violet-100">
                                  {t.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked Materials */}
                        {suggestion.linkedMaterials.length > 0 && (
                          <div className="flex items-start gap-2">
                            <div className="flex items-center gap-1.5 shrink-0 text-xs text-[#6B7280]">
                              <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                              <span>关联材料:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestion.linkedMaterials.map((m) => (
                                <Badge key={m.id} className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-normal cursor-pointer hover:bg-blue-100">
                                  {m.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hypotheses List */}
                        <div className="pt-3 border-t border-[#F3F4F6]">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium text-[#374151]">建议假设 ({suggestion.hypotheses.length})</span>
                          </div>
                          <div className="space-y-2">
                            {suggestion.hypotheses.map((hypothesis) => (
                              <div
                                key={hypothesis.id}
                                className="flex items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] shrink-0">
                                    {hypothesis.direction}
                                  </Badge>
                                  <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] shrink-0">
                                    {hypothesis.category}
                                  </Badge>
                                  <span className="text-sm text-[#374151] truncate">{hypothesis.name}</span>
                                </div>
                                {hypothesis.isExisting ? (
                                  <button
                                    onClick={() => {
                                      // TODO: Implement modify existing hypothesis logic
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6] shrink-0"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    修改该假设
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCreateFromHypothesis(hypothesis)}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600 shrink-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                    创建该假设
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-4 pt-6">
                  <button
                    onClick={handleStartGeneration}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                  >
                    <Brain className="h-4 w-4" />
                    重新生成
                  </button>
                  <button
                    onClick={handleCloseFullPageView}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Check className="h-4 w-4" />
                    完成并返回
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hypothesis Creation Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#111827]">创建项目假设</div>
                </div>
              </DialogTitle>
              <DialogDescription className="text-sm text-[#6B7280]">
                基于AI建议创建新的项目假设，包含价值点和风险点分析
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">假设方向</label>
                  <Input
                    value={formData.direction}
                    onChange={(e) => setFormData((prev) => ({ ...prev, direction: e.target.value }))}
                    placeholder="如：技术攻关、市场判断"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">假设类别</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="如：技术壁垒、市场规模"
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">假设名称</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="输入假设名称"
                  className="h-10"
                />
              </div>

              {/* Value Points */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-[#111827]">价值点</span>
                  </div>
                  <button
                    onClick={handleAddValuePoint}
                    className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加价值点
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.valuePoints.map((vp, idx) => (
                    <div key={vp.id} className="rounded-lg border border-[#E5E7EB] p-4 bg-emerald-50/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-emerald-700">价值点 {idx + 1}</span>
                        <button
                          onClick={() => handleRemoveValuePoint(vp.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <Input
                          value={vp.title}
                          onChange={(e) => setFormData((prev) => ({
                            ...prev,
                            valuePoints: prev.valuePoints.map((p) =>
                              p.id === vp.id ? { ...p, title: e.target.value } : p
                            ),
                          }))}
                          placeholder="价值点标题"
                          className="h-9 text-sm"
                        />

                        {/* Evidence Support */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="h-3.5 w-3.5 text-[#6B7280]" />
                            <span className="text-xs font-medium text-[#374151]">论据支持</span>
                          </div>
                          <textarea
                            value={vp.evidenceDescription}
                            onChange={(e) => setFormData((prev) => ({
                              ...prev,
                              valuePoints: prev.valuePoints.map((p) =>
                                p.id === vp.id ? { ...p, evidenceDescription: e.target.value } : p
                              ),
                            }))}
                            placeholder="描述支持该价值点的论据"
                            rows={2}
                            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />

                          {/* Material Selection - checkbox list */}
                          <div className="mt-2">
                            <p className="text-xs text-[#6B7280] mb-1.5">关联项目材料：</p>
                            <div className="rounded-md border border-[#E5E7EB] divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
                              {availableMaterials.map((m) => (
                                <label
                                  key={m.id}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-xs",
                                    vp.evidenceMaterialIds.includes(m.id)
                                      ? "bg-blue-50"
                                      : "bg-white hover:bg-[#F9FAFB]"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={vp.evidenceMaterialIds.includes(m.id)}
                                    onChange={() => handleToggleMaterial("value", vp.id, m.id)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 accent-blue-600"
                                  />
                                  <FileText className={cn("h-3.5 w-3.5 shrink-0", vp.evidenceMaterialIds.includes(m.id) ? "text-blue-500" : "text-[#9CA3AF]")} />
                                  <span className={cn("flex-1 truncate", vp.evidenceMaterialIds.includes(m.id) ? "text-blue-700 font-medium" : "text-[#374151]")}>
                                    {m.name}
                                  </span>
                                  <span className="text-[10px] text-[#9CA3AF] shrink-0">{m.format}</span>
                                </label>
                              ))}
                            </div>
                            <button className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">
                              <Upload className="h-3 w-3" />
                              上传新材料
                            </button>
                          </div>
                        </div>

                        {/* Analysis */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-3.5 w-3.5 text-[#6B7280]" />
                            <span className="text-xs font-medium text-[#374151]">论证分析</span>
                          </div>
                          <textarea
                            value={vp.analysisContent}
                            onChange={(e) => setFormData((prev) => ({
                              ...prev,
                              valuePoints: prev.valuePoints.map((p) =>
                                p.id === vp.id ? { ...p, analysisContent: e.target.value } : p
                              ),
                            }))}
                            placeholder="对该价值点进行���析论证"
                            rows={2}
                            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {formData.valuePoints.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[#E5E7EB] p-6 text-center">
                      <p className="text-sm text-[#6B7280]">暂无价值点，点击上方按钮添加</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Points */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-red-100">
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <span className="text-sm font-semibold text-[#111827]">风险点</span>
                  </div>
                  <button
                    onClick={handleAddRiskPoint}
                    className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加风险点
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.riskPoints.map((rp, idx) => (
                    <div key={rp.id} className="rounded-lg border border-[#E5E7EB] p-4 bg-red-50/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-red-700">风险点 {idx + 1}</span>
                        <button
                          onClick={() => handleRemoveRiskPoint(rp.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <Input
                          value={rp.title}
                          onChange={(e) => setFormData((prev) => ({
                            ...prev,
                            riskPoints: prev.riskPoints.map((p) =>
                              p.id === rp.id ? { ...p, title: e.target.value } : p
                            ),
                          }))}
                          placeholder="风险点标题"
                          className="h-9 text-sm"
                        />

                        {/* Evidence Support */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="h-3.5 w-3.5 text-[#6B7280]" />
                            <span className="text-xs font-medium text-[#374151]">论据支持</span>
                          </div>
                          <textarea
                            value={rp.evidenceDescription}
                            onChange={(e) => setFormData((prev) => ({
                              ...prev,
                              riskPoints: prev.riskPoints.map((p) =>
                                p.id === rp.id ? { ...p, evidenceDescription: e.target.value } : p
                              ),
                            }))}
                            placeholder="描述支持该风险点的论据"
                            rows={2}
                            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />

                          {/* Material Selection - checkbox list */}
                          <div className="mt-2">
                            <p className="text-xs text-[#6B7280] mb-1.5">关联项目材料：</p>
                            <div className="rounded-md border border-[#E5E7EB] divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
                              {availableMaterials.map((m) => (
                                <label
                                  key={m.id}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-xs",
                                    rp.evidenceMaterialIds.includes(m.id)
                                      ? "bg-red-50"
                                      : "bg-white hover:bg-[#F9FAFB]"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={rp.evidenceMaterialIds.includes(m.id)}
                                    onChange={() => handleToggleMaterial("risk", rp.id, m.id)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 accent-red-600"
                                  />
                                  <FileText className={cn("h-3.5 w-3.5 shrink-0", rp.evidenceMaterialIds.includes(m.id) ? "text-red-500" : "text-[#9CA3AF]")} />
                                  <span className={cn("flex-1 truncate", rp.evidenceMaterialIds.includes(m.id) ? "text-red-700 font-medium" : "text-[#374151]")}>
                                    {m.name}
                                  </span>
                                  <span className="text-[10px] text-[#9CA3AF] shrink-0">{m.format}</span>
                                </label>
                              ))}
                            </div>
                            <button className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">
                              <Upload className="h-3 w-3" />
                              上传新材料
                            </button>
                          </div>
                        </div>

                        {/* Analysis */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-3.5 w-3.5 text-[#6B7280]" />
                            <span className="text-xs font-medium text-[#374151]">论证分析</span>
                          </div>
                          <textarea
                            value={rp.analysisContent}
                            onChange={(e) => setFormData((prev) => ({
                              ...prev,
                              riskPoints: prev.riskPoints.map((p) =>
                                p.id === rp.id ? { ...p, analysisContent: e.target.value } : p
                              ),
                            }))}
                            placeholder="对该风险点进行分析论证"
                            rows={2}
                            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {formData.riskPoints.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[#E5E7EB] p-6 text-center">
                      <p className="text-sm text-[#6B7280]">暂无风险点，点击上方按钮添加</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <Button variant="outline" onClick={handleCloseCreateDialog}>
                  取消
                </Button>
                <Button
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                  onClick={handleSubmitHypothesis}
                  disabled={!formData.name.trim() || !formData.direction.trim()}
                >
                  创建假设
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Show full page term generation view
  if (fullPageView === "term-generation") {
    return (
      <div className="flex h-full flex-col bg-[#F9FAFB]">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCloseFullPageView}
                className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
                返回工作流
              </button>
              <div className="h-6 w-px bg-[#E5E7EB]" />
              <div>
                <h1 className="text-xl font-bold text-[#111827]">条款构建建议</h1>
                <p className="text-sm text-[#6B7280]">{currentPhase?.fullLabel || "设立期 - 阶段1"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-4xl">
            {!isTermGenerating && !termGenerationComplete && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 ring-8 ring-emerald-50/50">
                  <FileText className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-[#111827] mb-2">AI条款构建建议生成</h2>
                <p className="text-sm text-[#6B7280] text-center max-w-md mb-8">
                  基于当前阶段的假设清单、行业标准和项目材料，AI将为您生成针对性的条款构建建议，帮助您完善投资协议框架。
                </p>
                <button
                  onClick={handleStartTermGeneration}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl"
                >
                  <Brain className="h-5 w-5" />
                  开始生成
                </button>
              </div>
            )}

            {isTermGenerating && (
              <div className="py-12">
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    AI正在深度思考...
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                  <div className="space-y-4">
                    {termThinkingSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-4">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
                          step.status === "completed" ? "bg-emerald-100" :
                          step.status === "active" ? "bg-emerald-500" : "bg-[#F3F4F6]"
                        )}>
                          {step.status === "completed" ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : step.status === "active" ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
                          )}
                        </div>
                        <span className={cn(
                          "text-sm transition-colors",
                          step.status === "completed" ? "text-emerald-600" :
                          step.status === "active" ? "text-[#111827] font-medium" : "text-[#9CA3AF]"
                        )}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {termGenerationComplete && generatedTermSuggestions.length > 0 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700 mb-4">
                    <Check className="h-4 w-4" />
                    已生成 {generatedTermSuggestions.length} 条条款建议
                  </div>
                </div>

                <div className="space-y-6">
                  {generatedTermSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
                      <div className="border-l-4 border-emerald-500 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                              <FileText className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-[#111827] mb-1">{suggestion.title}</h3>
                              <p className="text-sm text-[#6B7280] leading-relaxed">{suggestion.content}</p>
                            </div>
                          </div>
                        </div>

                        {/* Linked items */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {suggestion.linkedHypotheses.map((h) => (
                            <span key={h.id} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                              <Lightbulb className="h-3 w-3" />
                              {h.name}
                            </span>
                          ))}
                          {suggestion.linkedMaterials.map((m) => (
                            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700">
                              <FileText className="h-3 w-3" />
                              {m.name}
                            </span>
                          ))}
                        </div>

                        {/* Suggested terms */}
                        <div className="border-t border-[#E5E7EB] pt-4 mt-4 space-y-3">
                          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">建议条款</p>
                          {suggestion.terms.map((term) => (
                            <div key={term.id} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-100">
                                  <FileText className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#111827]">{term.name}</p>
                                  <p className="text-xs text-[#6B7280]">{term.direction} · {term.category}</p>
                                </div>
                              </div>
                              {term.isExisting ? (
                                <button className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6] shrink-0">
                                  <Pencil className="h-3 w-3" />
                                  修改该条款
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCreateFromTerm(term)}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 shrink-0"
                                >
                                  <Plus className="h-3 w-3" />
                                  创建该条款
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-4 pt-6">
                  <button
                    onClick={handleStartTermGeneration}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                  >
                    <Brain className="h-4 w-4" />
                    重新生成
                  </button>
                  <button
                    onClick={handleCloseFullPageView}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Check className="h-4 w-4" />
                    完成并返回
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Term Creation Dialog */}
        <Dialog open={showTermCreateDialog} onOpenChange={setShowTermCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#111827]">创建项目条款</div>
                </div>
              </DialogTitle>
              <DialogDescription className="text-sm text-[#6B7280]">
                基于AI建议创建新的项目条款，包含我方诉求、我方依据、双方冲突、我方底线和妥协空间
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">条款方向</label>
                  <Input
                    value={termFormData.direction}
                    onChange={(e) => setTermFormData((prev) => ({ ...prev, direction: e.target.value }))}
                    placeholder="如：控制权条款、经济性条款"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">条款类别</label>
                  <Input
                    value={termFormData.category}
                    onChange={(e) => setTermFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="如：董事会条款、反稀释条款"
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款名称</label>
                <Input
                  value={termFormData.name}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="输入条款名称"
                  className="h-10"
                />
              </div>

              {/* Our Demand - 我方诉求 */}
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-emerald-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-[#111827]">我方诉求</span>
                </div>
                <textarea
                  value={termFormData.ourDemand.content}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, ourDemand: { ...prev.ourDemand, content: e.target.value } }))}
                  placeholder="描述我方在该条款上的核心诉求..."
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  rows={3}
                />
              </div>

              {/* Our Basis - 我方依据 */}
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-blue-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-[#111827]">我方依据</span>
                </div>
                <textarea
                  value={termFormData.ourBasis.content}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, ourBasis: { ...prev.ourBasis, content: e.target.value } }))}
                  placeholder="说明支撑我方诉求的理由和依据..."
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* Bilateral Conflict - 双方冲突 */}
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-amber-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-[#111827]">双方冲突</span>
                </div>
                <textarea
                  value={termFormData.bilateralConflict.content}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, bilateralConflict: { content: e.target.value } }))}
                  placeholder="分析双方在该条款上的潜在冲突点..."
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  rows={3}
                />
              </div>

              {/* Our Bottom Line - 我方底线 */}
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-red-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-[#111827]">我方底线</span>
                </div>
                <textarea
                  value={termFormData.ourBottomLine.content}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, ourBottomLine: { content: e.target.value } }))}
                  placeholder="明确我方在该条款上的最低要求..."
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  rows={3}
                />
              </div>

              {/* Compromise Space - 妥协空间 */}
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-purple-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <Handshake className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-[#111827]">妥协空间</span>
                </div>
                <textarea
                  value={termFormData.compromiseSpace.content}
                  onChange={(e) => setTermFormData((prev) => ({ ...prev, compromiseSpace: { content: e.target.value } }))}
                  placeholder="描述可接受的妥协方案和替代条件..."
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  rows={3}
                />
              </div>

              {/* Negotiation Result & Implementation - Empty States */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-dashed border-[#D1D5DB] p-4 bg-[#F9FAFB]">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-[#9CA3AF]" />
                    <span className="text-sm font-medium text-[#6B7280]">谈判结果</span>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">暂无 - 待谈判后填写</p>
                </div>
                <div className="rounded-lg border border-dashed border-[#D1D5DB] p-4 bg-[#F9FAFB]">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardCheck className="h-4 w-4 text-[#9CA3AF]" />
                    <span className="text-sm font-medium text-[#6B7280]">落实情况</span>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">暂无 - 待落实后填写</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <Button variant="outline" onClick={handleCloseTermCreateDialog}>
                  取消
                </Button>
                <Button
                  onClick={handleSubmitTerm}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={!termFormData.name.trim() || !termFormData.direction.trim()}
                >
                  创建条款
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Show empty state for new projects with no phases started
  if (isNewProject && projectPhases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <GitBranch className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无工作流</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的项目，工作流尚未启动。点击下方按钮启动项目的第一个阶段。
          </p>
          <button
            onClick={handleStartFirstPhase}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <Plus className="h-4 w-4" />
            启动设立期 - 阶段1
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-[#F3F4F6]">
      {/* Main Content Area */}
      <div className={cn("flex flex-col transition-all duration-300", activeSidebar ? "flex-1" : "w-full")}>
        {/* Header */}
        <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">工作流</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                项目生命周期管理 - 点击阶段卡片切换版本
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Show different buttons based on project state - no phase limits */}
              {isNewProject && !isInDuration && currentSetupPhase > 0 && (
                <>
                  <button
                    onClick={handleStartNextSetupPhase}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Plus className="h-4 w-4" />
                    启动下一阶段
                  </button>
                  <button
                    onClick={handleEnterDuration}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-[#10B981] bg-white px-4 py-2.5 text-sm font-medium text-[#10B981] transition-colors hover:bg-[#ECFDF5]"
                  >
                    <ArrowRight className="h-4 w-4" />
                    进入存续期
                  </button>
                </>
              )}
              {isNewProject && isInDuration && (
                <button
                  onClick={handleStartNextDurationPhase}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Plus className="h-4 w-4" />
                  启动下一阶段
                </button>
              )}
              {!isNewProject && (
                <button
                  onClick={handleStartNextPhase}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Plus className="h-4 w-4" />
                  启动下一阶段
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phase Timeline or Compact Card */}
        {activeSidebar ? (
          // Compact view when sidebar is open
          <div className="flex-1 flex items-start justify-center p-6">
            {currentPhase && (
              <CompactPhaseCard phase={currentPhase} />
            )}
          </div>
        ) : (
          // Full timeline view
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex items-start gap-4 p-6 min-w-max h-full">
              {projectPhases.map((phase, idx) => {
                const isSelected = selectedPhase === phase.id
                const sc = statusConfig[phase.status]
                const showGroupHeader = phase.groupLabel !== lastGroup
                lastGroup = phase.groupLabel
                const isLastInGroup = idx < projectPhases.length - 1 ? projectPhases[idx + 1].groupLabel !== phase.groupLabel : true
                const isSetup = phase.groupLabel === "设立期"

                return (
                  <div key={phase.id} className="flex items-start shrink-0">
                    {/* Group header + card */}
                    <div className="flex flex-col">
                      {showGroupHeader && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", isSetup ? "bg-violet-500" : "bg-teal-500")} />
                          <span className="text-sm font-semibold text-[#374151]">{phase.groupLabel}</span>
                        </div>
                      )}
                      {!showGroupHeader && <div className="mb-3 h-[22px]" />}

                      {/* Phase Card */}
                      <button
                        data-phase={phase.id}
                        onClick={() => handleSelectPhase(phase.id)}
                        className={cn(
                          "w-[260px] rounded-xl border-2 p-5 text-left transition-all",
                          isSelected
                            ? "border-[#2563EB] bg-blue-50/40 shadow-lg shadow-blue-100/50 ring-1 ring-[#2563EB]/20"
                            : cn("hover:shadow-md", sc.borderCls, sc.bgCls)
                        )}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-[#111827]">{phase.name}</h3>
                          <Badge className={cn("text-[10px] px-1.5 py-0", sc.badgeCls)}>
                            <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", sc.dotCls)} />
                            {sc.label}
                          </Badge>
                        </div>

                        {/* Assignee */}
                        {phase.assignee && (
                          <div className="flex items-center gap-2 mb-3">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-[#E5E7EB] text-[10px] text-[#374151]">
                                {phase.assigneeAvatar}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-[#6B7280]">{"\u8D1F\u8D23\u4EBA: "}{phase.assignee}</span>
                          </div>
                        )}

                        {/* Stats */}
                        {(() => {
                          const isActive = phase.status === "active"
                          const displayH = isActive && hypothesesCount !== undefined ? hypothesesCount : phase.hypothesesCount
                          const displayT = isActive && termsCount !== undefined ? termsCount : phase.termsCount
                          const displayM = isActive && materialsCount !== undefined ? materialsCount : phase.materialsCount
                          return (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
                                <ListChecks className="h-3 w-3 text-[#2563EB]" />
                                <div>
                                  <p className="text-[10px] text-[#9CA3AF]">{"\u5047\u8BBE"}</p>
                                  <p className="text-xs font-semibold text-[#111827]">{displayH}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
                                <FileText className="h-3 w-3 text-emerald-600" />
                                <div>
                                  <p className="text-[10px] text-[#9CA3AF]">{"\u6761\u6B3E"}</p>
                                  <p className="text-xs font-semibold text-[#111827]">{displayT}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
                                <FolderOpen className="h-3 w-3 text-amber-600" />
                                <div>
                                  <p className="text-[10px] text-[#9CA3AF]">{"\u6750\u6599"}</p>
                                  <p className="text-xs font-semibold text-[#111827]">{displayM}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Date */}
                        {phase.startDate && (
                          <div className="text-[11px] text-[#9CA3AF] mb-3">
                            {phase.startDate}
                            {phase.endDate ? ` \u2192 ${phase.endDate}` : " \u2192 \u8FDB\u884C\u4E2D"}
                          </div>
                        )}

                        {/* Recent Logs */}
                        {phase.logs.length > 0 && (
                          <div className="border-t border-[#E5E7EB] pt-3 space-y-1.5">
                            <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">{"\u66F4\u65B0\u65E5\u5FD7"}</p>
                            {phase.logs.slice(-2).map((log, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <Clock className="h-3 w-3 mt-0.5 text-[#D1D5DB] shrink-0" />
                                <p className="text-[11px] text-[#6B7280] leading-snug">
                                  <span className="text-[#374151] font-medium">{log.author}</span>
                                  {" "}{log.action}
                                  <span className="text-[#9CA3AF]">{" \u00B7 "}{log.date}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upcoming placeholder */}
                        {phase.status === "upcoming" && (
                          <div className="flex items-center justify-center py-4 text-[#D1D5DB]">
                            <p className="text-xs">{"\u5F85\u542F\u52A8"}</p>
                          </div>
                        )}

                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="mt-3 flex items-center gap-1.5 text-[#2563EB]">
                            <Check className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{"\u5F53\u524D\u9009\u4E2D"}</span>
                          </div>
                        )}
                      </button>

                      {/* Action Buttons - Only shown for selected phase */}
                      {isSelected && phase.status !== "upcoming" && (
                        <div className="mt-3 w-[260px] space-y-1.5">
                          {/* Phase-specific buttons - vertical layout */}
                          {isSetup ? (
                            <>
                              <ActionButton icon={Lightbulb} label="假设改进建议" onClick={() => handleOpenSidebar("hypothesis-suggestions")} />
                              <ActionButton icon={FileText} label="条款构建建议" onClick={() => handleOpenSidebar("term-suggestions")} />
                              <ActionButton icon={FolderSearch} label="材料收集建议" onClick={() => handleOpenSidebar("material-suggestions")} />
                              <ActionButton icon={Brain} label="AI调研材料" onClick={() => handleOpenSidebar("ai-research")} />
                            </>
                          ) : (
                            <>
                              <ActionButton icon={ClipboardList} label="跟踪情况汇总" onClick={() => handleOpenSidebar("tracking-summary")} />
                              <ActionButton icon={FolderSearch} label="材料收集建议" onClick={() => handleOpenSidebar("material-suggestions")} />
                              <ActionButton icon={Brain} label="AI调研材料" onClick={() => handleOpenSidebar("ai-research")} />
                            </>
                          )}
                          {/* AI Chat Button */}
                          <button
                            onClick={() => handleOpenSidebar("ai-chat")}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-medium text-white transition-all hover:from-violet-600 hover:to-purple-700"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            AI智能问答
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Connector Arrow (between cards) */}
                    {idx < PHASES.length - 1 && (
                      <div className="flex items-center self-center mt-6 px-1">
                        {isLastInGroup ? (
                          <div className="flex items-center gap-1">
                            <div className="h-px w-4 bg-[#D1D5DB]" />
                            <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                            <div className="h-px w-4 bg-[#D1D5DB]" />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <div className="h-px w-6 bg-[#D1D5DB]" />
                            <ArrowRight className="h-3.5 w-3.5 text-[#D1D5DB]" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      {activeSidebar && (
        <div className="w-[420px] shrink-0 border-l border-[#E5E7EB] bg-white flex flex-col">
          {activeSidebar === "ai-chat" ? (
            // AI Chat Sidebar
            <>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111827]">{"AI\u667A\u80FD\u95EE\u7B54"}</h3>
                    <p className="text-xs text-[#6B7280]">{currentPhase?.fullLabel}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-[#2563EB] text-white"
                          : "bg-[#F3F4F6] text-[#374151]"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="border-t border-[#E5E7EB] p-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                    placeholder={"\u8F93\u5165\u60A8\u7684\u95EE\u9898..."}
                    className="flex-1"
                  />
                  <button
                    onClick={handleSendChat}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Content Sidebar
            <>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = sidebarConfigs[activeSidebar]
                    const IconComponent = config.icon
                    return (
                      <>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF]">
                          <IconComponent className="h-5 w-5 text-[#2563EB]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#111827]">{config.title}</h3>
                          <p className="text-xs text-[#6B7280]">{currentPhase?.fullLabel}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <button
                  onClick={handleCloseSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4">
                  <p className="text-sm text-[#6B7280]">
                    {sidebarConfigs[activeSidebar].description}
                  </p>
                  <div className="space-y-3">
                    {sidebarConfigs[activeSidebar].items.map((item, i) => (
                      <div key={i} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                        <h4 className="text-sm font-semibold text-[#111827] mb-2">{item.title}</h4>
                        <p className="text-sm text-[#6B7280] leading-relaxed">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Helper Components ──────────────────────── */
function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Lightbulb; label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="w-full flex items-center gap-2 rounded-lg bg-white border border-[#E5E7EB] px-3 py-2 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6] hover:border-[#D1D5DB]"
    >
      <Icon className="h-3.5 w-3.5 text-[#6B7280]" />
      {label}
    </button>
  )
}

function CompactPhaseCard({ phase }: { phase: Phase }) {
  const sc = statusConfig[phase.status]

  return (
    <div className="w-[280px] rounded-xl border-2 border-[#2563EB] bg-blue-50/40 p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#111827]">{phase.name}</h3>
        <Badge className={cn("text-[10px] px-1.5 py-0", sc.badgeCls)}>
          <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", sc.dotCls)} />
          {sc.label}
        </Badge>
      </div>

      {/* Assignee */}
      {phase.assignee && (
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-[#E5E7EB] text-[10px] text-[#374151]">
              {phase.assigneeAvatar}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-[#6B7280]">{"\u8D1F\u8D23\u4EBA: "}{phase.assignee}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
          <ListChecks className="h-3 w-3 text-[#2563EB]" />
          <div>
            <p className="text-[10px] text-[#9CA3AF]">{"\u5047\u8BBE"}</p>
            <p className="text-xs font-semibold text-[#111827]">{phase.hypothesesCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
          <FileText className="h-3 w-3 text-emerald-600" />
          <div>
            <p className="text-[10px] text-[#9CA3AF]">{"\u6761\u6B3E"}</p>
            <p className="text-xs font-semibold text-[#111827]">{phase.termsCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 border border-[#E5E7EB]">
          <FolderOpen className="h-3 w-3 text-amber-600" />
          <div>
            <p className="text-[10px] text-[#9CA3AF]">{"\u6750\u6599"}</p>
            <p className="text-xs font-semibold text-[#111827]">{phase.materialsCount}</p>
          </div>
        </div>
      </div>

      {/* Date */}
      {phase.startDate && (
        <div className="text-[11px] text-[#9CA3AF]">
          {phase.startDate}
          {phase.endDate ? ` \u2192 ${phase.endDate}` : " \u2192 \u8FDB\u884C\u4E2D"}
        </div>
      )}
    </div>
  )
}
