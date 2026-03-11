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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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

// Generated hypothesis suggestion with linked items
interface GeneratedSuggestion {
  id: string
  title: string
  content: string
  linkedHypotheses: { id: string; name: string }[]
  linkedTerms: { id: string; name: string }[]
  linkedMaterials: { id: string; name: string }[]
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
    assignee: "王芳",
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
  hypothesesCount?: number
  termsCount?: number
  materialsCount?: number
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
  hypothesesCount,
  termsCount,
  materialsCount,
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
  const [generationComplete, setGenerationComplete] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
  const [generatedSuggestions, setGeneratedSuggestions] = useState<GeneratedSuggestion[]>([])

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
      setGenerationComplete(false)
      setThinkingSteps([])
      setGeneratedSuggestions([])
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
        
        // Generate mock suggestions with linked items
        setTimeout(() => {
          setGeneratedSuggestions([
            {
              id: "gs1",
              title: "补充技术壁垒假设",
              content: "当前假设清单缺少对核心技术壁垒的系统性论证。建议增加关于专利布局、技术团队稳定性、技术迭代能力等方面的假设，以更全面评估投资标的的技术竞争力。特别是在AI大模型领域，需要关注模型训练数据的独特性、推理效率优化能力、以及多模态扩展潜力。",
              linkedHypotheses: [
                { id: "h1", name: "大模型推理成本下降假设" },
                { id: "h2", name: "技术团队核心成员稳定性假设" },
              ],
              linkedTerms: [
                { id: "t1", name: "知识产权归属条款" },
                { id: "t2", name: "核心团队锁定条款" },
              ],
              linkedMaterials: [
                { id: "m1", name: "专利清单及技术白皮书" },
                { id: "m2", name: "核心团队履历及期权安排" },
              ],
            },
            {
              id: "gs2",
              title: "细化市场规模假设",
              content: "现有TAM/SAM/SOM假设过于笼统，建议从地区维度（国内/海外）、行业维度（金融/医疗/制造等）、客户规模维度（大企业/SMB）进行拆分，形成更精细的市场规模假设矩阵。同时需要补充市场增速假设和份额假设。",
              linkedHypotheses: [
                { id: "h3", name: "多模态融合市场假设" },
              ],
              linkedTerms: [
                { id: "t3", name: "市场拓展里程碑条款" },
              ],
              linkedMaterials: [
                { id: "m3", name: "行业研究报告_2024Q4" },
                { id: "m4", name: "竞品市场份额分析" },
              ],
            },
            {
              id: "gs3",
              title: "添加商业模式可持续性假设",
              content: "建议增加关于商业模式可持续性的假设，包括：客户获取成本(CAC)与客户生命周期价值(LTV)的比值假设、毛利率演变假设、规模效应假设等。这些假设对于评估公司长期盈利能力至关重要。",
              linkedHypotheses: [
                { id: "h4", name: "开源模型生态竞争假设" },
              ],
              linkedTerms: [
                { id: "t4", name: "财务信息披露条款" },
                { id: "t5", name: "反稀释保护条款" },
              ],
              linkedMaterials: [
                { id: "m5", name: "财务预测模型" },
                { id: "m6", name: "单位经济模型分析" },
              ],
            },
          ])
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
                        {/* Linked Hypotheses */}
                        {suggestion.linkedHypotheses.length > 0 && (
                          <div className="flex items-start gap-2">
                            <div className="flex items-center gap-1.5 shrink-0 text-xs text-[#6B7280]">
                              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                              <span>关联假设:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestion.linkedHypotheses.map((h) => (
                                <Badge key={h.id} className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-normal cursor-pointer hover:bg-amber-100">
                                  {h.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
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
