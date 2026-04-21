"use client"

import { useState, useRef, useEffect } from "react"
import FileUpload from "@/src/components/FileUpload"
import {
  Search,
  Lightbulb,
  Plus,
  ArrowLeft,
  Eye,
  Trash2,
  User,
  X,
  FileText,
  Link2,
  FolderOpen,
  Sheet,
  File,
  Send,
  CheckCircle,
  Shield,
} from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Badge } from "@/src/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/trpc/react"

// 通用材料数据（与 project-materials 共享）
const availableMaterials = [
  { id: "m1", name: "GPU_AI芯片行业全景报告_2024", format: "PDF" },
  { id: "m2", name: "全球算力基础设施市场规模分析", format: "PDF" },
  { id: "m3", name: "主流AI训练框架技术对比", format: "DOCX" },
  { id: "m4", name: "云服务商GPU算力价格对比表", format: "XLSX" },
  { id: "m5", name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
  { id: "m7", name: "大模型训练成本结构分析", format: "XLSX" },
  { id: "m10", name: "国内外AI基础软件生态图谱", format: "PDF" },
]

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
interface HypothesisTableItem {
  id: string
  direction: string
  category: string
  name: string
  owner: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
}

interface CommitteeDecisionData {
  conclusion: "成立" | "不成立"
  content: string
  status: "approved" | "rejected" | "pending"
  creatorName: string
  creatorRole: string
  createdAt: string
}

interface VerificationData {
  conclusion: "符合预期" | "偏离"
  content: string
  status: "confirmed" | "invalidated" | "pending"
  creatorName: string
  creatorRole: string
  createdAt: string
}

interface HypothesisDetail {
  id: string
  title: string
  description: string
  owner: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
  recommendation: string
  relatedMaterials: string[]
  committeeDecision: CommitteeDecisionData
  verification: VerificationData
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig = {
  verified: { label: "成立", color: "bg-[#DCFCE7] text-[#166534]" },
  pending: { label: "待验证", color: "bg-[#FEF3C7] text-[#92400E]" },
  risky: { label: "不成立", color: "bg-[#FEE2E2] text-[#991B1B]" },
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const hypothesisTableData: HypothesisTableItem[] = [
  {
    id: "h1",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "国产AI芯片在推理场景下可替代英伟达方案",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    status: "verified",
  },
  {
    id: "h2",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "云端AI芯片市场将在3年内达到500亿美元规模",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    status: "pending",
  },
  {
    id: "h3",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "开源大模型训练框架将成为主流技术路线",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "pending",
  },
  {
    id: "h4",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "分布式训练效率提升是大模型竞争关键",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "risky",
  },
  {
    id: "h5",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "AI编译器将成为新的基础软件投资赛道",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "pending",
  },
  {
    id: "h6",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "MLOps平台市场需求将快速增长",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
    status: "pending",
  },
]

const emptyCommitteeDecision: CommitteeDecisionData = {
  conclusion: "成立",
  content: "",
  status: "pending",
  creatorName: "",
  creatorRole: "",
  createdAt: "",
}

const emptyVerification: VerificationData = {
  conclusion: "符合预期",
  content: "",
  status: "pending",
  creatorName: "",
  creatorRole: "",
  createdAt: "",
}

const hypothesisDetails: Record<string, HypothesisDetail> = {
  "h1": {
    id: "h1",
    title: "国产AI芯片在推理场景下可替代英伟达方案",
    description: "随着国产AI芯片技术的持续进步，在特定推理场景下，国产芯片的性价比和能效比已接近或达到英伟达方案的水平。目前国产芯片在INT8推理性能上已达到A100的80%，能效比在特定场景下甚至优于英伟达方案，价格约为进口方案的60%，成本优势显著。主要短板在于软件生态尚不完善，但随着国产化生态建设提速，整体替代可行性正在持续提升。",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    status: "verified",
    recommendation: "国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，下游采购意愿持续提升。当前市场窗口期是布局核心标的的关键时机，该假设若得到验证，将为策略在算力芯片赛道的选标逻辑提供重要支撑，建议重点关注推理芯片性价比领先的国内厂商。",
    relatedMaterials: ["m1", "m4", "m5"],
    committeeDecision: {
      conclusion: "成立",
      content: "经投委会审议，国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，该假设成立。",
      status: "approved",
      creatorName: "王总",
      creatorRole: "投委会主席",
      createdAt: "2024-02-10",
    },
    verification: {
      conclusion: "符合预期",
      content: "投资后6个月跟踪显示，国产芯片在推理场景的性价比持续提升，与预期一致。",
      status: "confirmed",
      creatorName: "张伟",
      creatorRole: "投资经理",
      createdAt: "2024-03-15",
    },
  },
  "h2": {
    id: "h2",
    title: "云端AI芯片市场将在3年内达到500亿美元规模",
    description: "基于大模型训练和推理需求的爆发式增长，预计全球云端AI芯片市场将在2027年达到500亿美元规模。ChatGPT的成功带动大模型需求全面爆发，各大云厂商持续加大AI算力资本开支，训练芯片需求年增长率已超过50%，推理芯片市场增速更为显著，整体市场规模扩张路径清晰可见。",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    status: "pending",
    recommendation: "云端AI算力的结构性增长已获头部科技公司资本开支数据的明确印证，市场规模上限清晰。该假设已验证，可作为策略整体投资逻辑的宏观需求锚点，为算力赛道的标的估值提供市场容量背书，增强投资决策的确定性。",
    relatedMaterials: ["m2", "m5", "m7"],
    committeeDecision: { ...emptyCommitteeDecision },
    verification: { ...emptyVerification },
  },
  "h4": {
    id: "h4",
    title: "分布式训练效率提升是大模型竞争关键",
    description: "随着模型规模持续扩大，分布式训练效率将成为大模型竞争的关键因素。",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "risky",
    recommendation: "该假设过于绝对，分布式训练效率虽重要，但并非唯一关键因素。",
    relatedMaterials: [],
    committeeDecision: {
      conclusion: "不成立",
      content: "经投委会审议，分布式训练效率虽重要，但并非唯一关键因素，数据质量和模型架构同样重要，该假设过于绝对。",
      status: "rejected",
      creatorName: "王总",
      creatorRole: "投委会主席",
      createdAt: "2024-02-20",
    },
    verification: { ...emptyVerification },
  },
}

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回赛道策略的假设模板数据，供创建项目时继承 */
export function getTrackStrategyHypothesisTemplate(): Array<{
  id: string
  direction: string
  category: string
  name: string
  owner: string
  createdAt: string
  updatedAt: string
}> {
  return hypothesisTableData
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisPrefillData {
  title: string
  direction: string
  category: string
  content: string
  reason: string
  relatedMaterials: string[]
}

interface StrategyHypothesesProps {
  strategyId: string
  isNewStrategy?: boolean
  prefillData?: HypothesisPrefillData
  onPrefillUsed?: () => void
  strategyType?: "主题策略" | "赛道策略"
  parentStrategyName?: string
  hypotheses: import("./strategies-grid").StrategyHypothesis[]
  onCreatePendingHypothesis: (pending: import("./strategies-grid").PendingHypothesis) => void
}

export function StrategyHypotheses({
  strategyId,
  isNewStrategy = false,
  prefillData,
  onPrefillUsed,
  strategyType,
  parentStrategyName,
  hypotheses,
  onCreatePendingHypothesis,
}: StrategyHypothesesProps) {
  const utils = api.useUtils()

  // 赛道策略从主题策略继承数据
  const isTrackStrategy = strategyType === "赛道策略"
  const inheritedFromParent = isTrackStrategy && isNewStrategy && parentStrategyName
  const [showInheritBanner, setShowInheritBanner] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // 弹窗创建表单状态
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formTitle, setFormTitle] = useState("")

  // 新增的数据结构用于保存多个价值点和风险点
  const [valuePoints, setValuePoints] = useState<
    Array<{ id: string; support: string; analysis: string; attachments: Array<{ name: string; url: string }> }>
  >([{ id: "vp1", support: "", analysis: "", attachments: [] }])
  
  const [riskPoints, setRiskPoints] = useState<
    Array<{ id: string; support: string; analysis: string; attachments: Array<{ name: string; url: string }> }>
  >([{ id: "rp1", support: "", analysis: "", attachments: [] }])

  const [formDirection, setFormDirection] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formReason, setFormReason] = useState("")
  const [formMaterials, setFormMaterials] = useState<string[]>([])

  // 投委会审议结果弹窗状态
  const [showCDDialog, setShowCDDialog] = useState(false)
  const [cdConclusion, setCdConclusion] = useState<"成立" | "不成立">("成立")
  const [cdContent, setCdContent] = useState("")

  // 验证情况弹窗状态
  const [showVFDialog, setShowVFDialog] = useState(false)
  const [vfConclusion, setVfConclusion] = useState<"符合预期" | "偏离">("符合预期")
  const [vfContent, setVfContent] = useState("")

  // 本地状态：记录已更新的假设详情（投委会/验证结果）
  const [localDetailUpdates, setLocalDetailUpdates] = useState<Record<string, Partial<HypothesisDetail>>>({})

  // tRPC mutations
  const updateCommitteeMutation = api.hypothesis.updateCommitteeDecision.useMutation({
    onSuccess: () => {
      utils.hypothesis.getByStrategy.invalidate({ strategyId })
    },
  })

  const updateVerificationMutation = api.hypothesis.updateVerification.useMutation({
    onSuccess: () => {
      utils.hypothesis.getByStrategy.invalidate({ strategyId })
    },
  })

  const createMutation = api.hypothesis.create.useMutation({
    onSuccess: (data) => {
      // 这里如果需要可将新的假设加入待创建的项目队列中
      onCreatePendingHypothesis({
        id: data.id,
        direction: "",
        category: "",
        name: data.title,
        owner: "当前用户", // 实际应从session获取
      })

      // 也可以清空表单并关闭弹窗
      setShowCreateDialog(false)
      setFormTitle("")
      setValuePoints([{ id: "vp1", support: "", analysis: "", attachments: [] }])
      setRiskPoints([{ id: "rp1", support: "", analysis: "", attachments: [] }])
      utils.hypothesis.getByStrategy.invalidate({ strategyId })
    },
  })

  // 处理预填数据 - 使用 useEffect 避免在渲染期间更新状态
  useEffect(() => {
    if (prefillData && !showCreateDialog) {
      setFormTitle(prefillData.title)
      setFormDirection(prefillData.direction)
      setFormCategory(prefillData.category)
      setFormContent(prefillData.content)
      setFormReason(prefillData.reason)
      setFormMaterials(prefillData.relatedMaterials)
      setShowCreateDialog(true)
      onPrefillUsed?.()
    }
  }, [prefillData, showCreateDialog, onPrefillUsed])

  const handleUploadSuccess = (pointId: string, url: string, name: string) => {
    const newAttachment = { name, url }
    if (pointId.startsWith("vp")) {
      setValuePoints(prev => prev.map(vp => 
        vp.id === pointId ? { ...vp, attachments: [...vp.attachments, newAttachment] } : vp
      ))
    } else {
      setRiskPoints(prev => prev.map(rp => 
        rp.id === pointId ? { ...rp, attachments: [...rp.attachments, newAttachment] } : rp
      ))
    }
  }

  const removeAttachment = (pointId: string, urlToRemove: string) => {
    if (pointId.startsWith("vp")) {
      setValuePoints(prev => prev.map(vp => 
        vp.id === pointId ? { ...vp, attachments: vp.attachments.filter(a => a.url !== urlToRemove) } : vp
      ))
    } else {
      setRiskPoints(prev => prev.map(rp => 
        rp.id === pointId ? { ...rp, attachments: rp.attachments.filter(a => a.url !== urlToRemove) } : rp
      ))
    }
  }

  // 合并初始数据和从 page.tsx 传来的持久化数据
  const allHypotheses: HypothesisTableItem[] = [
    // 转换持久化的假设数据为表格格式
    ...hypotheses.map((h) => ({
      id: h.id,
      direction: h.direction,
      category: h.category,
      name: h.name,
      owner: h.owner,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      status: (localDetailUpdates[h.id]?.status || "pending") as HypothesisTableItem["status"],
    })),
    // 如果是继承场景或已有数据，加上初始数据
    ...(inheritedFromParent || !isNewStrategy ? hypothesisTableData : []),
  ]

  const filteredData = allHypotheses.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  // 获取假设详情（从 mock 数据或按名称匹配已审批假设）
  function getHypothesisDetail(id: string): HypothesisDetail | null {
    // 先检查本地更新
    const localUpdate = localDetailUpdates[id]

    if (hypothesisDetails[id]) {
      return localUpdate ? { ...hypothesisDetails[id], ...localUpdate } : hypothesisDetails[id]
    }
    // 根据名称匹配 — 新策略的假设 ID 与 mock 不同，但名称一致
    const item = allHypotheses.find((h) => h.id === id)
    if (item) {
      const detailByName = Object.values(hypothesisDetails).find((d) => d.title === item.name)
      if (detailByName) {
        const base = { ...detailByName, id }
        return localUpdate ? { ...base, ...localUpdate } : base
      }
    }
    // 从 approved 假设构建基本详情
    const approved = hypotheses.find((h) => h.id === id)
    if (approved) {
      const base: HypothesisDetail = {
        id: approved.id,
        title: approved.name,
        description: approved.content || `${approved.name}。该假设描述了在当前技术和市场环境下的核心判断，需要通过多维度数据和调研来验证其有效性。`,
        owner: approved.owner,
        createdAt: approved.createdAt,
        updatedAt: approved.updatedAt,
        status: (localUpdate?.status || "pending") as HypothesisDetail["status"],
        recommendation: approved.reason || "基于当前市场环境和技术发展趋势，该假设具有较高的验证价值，建议重点关注相关赛道的核心标的和技术突破进展。",
        relatedMaterials: [],
        committeeDecision: localUpdate?.committeeDecision || { ...emptyCommitteeDecision },
        verification: localUpdate?.verification || { ...emptyVerification },
      }
      return base
    }
    return null
  }

  const selectedDetail = selectedId ? getHypothesisDetail(selectedId) : null

  function handleViewDetail(id: string) {
    setSelectedId(id)
    setShowDetail(true)
  }

  function handleBackToList() {
    setShowDetail(false)
    setSelectedId(null)
  }

  function handleDelete(id: string) {
    console.log("[v0] Delete strategy hypothesis:", id)
  }

  function resetForm() {
    setFormTitle("")
    setFormDirection("")
    setFormCategory("")
    setFormContent("")
    setFormReason("")
    setFormMaterials([])
    setValuePoints([{ id: "vp1", support: "", analysis: "", attachments: [] }])
    setRiskPoints([{ id: "rp1", support: "", analysis: "", attachments: [] }])
  }

  function handleCreateSubmit() {
    if (!formTitle) return
    createMutation.mutate({
      strategyId,
      title: formTitle,
      valuePoints: valuePoints.map(vp => ({ support: vp.support, analysis: vp.analysis, attachments: vp.attachments })),
      riskPoints: riskPoints.map(rp => ({ support: rp.support, analysis: rp.analysis, attachments: rp.attachments })),
    })
  }

  function toggleMaterial(materialId: string) {
    setFormMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    )
  }

  // 提交投委会审议结果
  function handleSubmitCommitteeDecision() {
    if (!selectedId || !cdContent.trim()) return

    const today = new Date().toISOString().split("T")[0]
    const newStatus = cdConclusion === "成立" ? "verified" as const : "risky" as const
    const committeeStatus = cdConclusion === "成立" ? "approved" as const : "rejected" as const

    // 本地状态立即更新（含假设状态自动更新）
    setLocalDetailUpdates((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        status: newStatus,
        committeeDecision: {
          conclusion: cdConclusion,
          content: cdContent,
          status: committeeStatus,
          creatorName: "张伟",
          creatorRole: "投资经理",
          createdAt: today,
        },
      },
    }))

    // 尝试调用后端 API（如果假设在数据库中存在则更新，否则静默失败）
    updateCommitteeMutation.mutate({
      hypothesisId: selectedId,
      conclusion: cdConclusion,
      content: cdContent,
      creatorName: "张伟",
      creatorRole: "投资经理",
    })

    setCdContent("")
    setCdConclusion("成立")
    setShowCDDialog(false)
  }

  // 提交验证情况
  function handleSubmitVerification() {
    if (!selectedId || !vfContent.trim()) return

    const today = new Date().toISOString().split("T")[0]
    const verificationStatus = vfConclusion === "符合预期" ? "confirmed" as const : "invalidated" as const

    // 本地状态立即更新
    setLocalDetailUpdates((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        verification: {
          conclusion: vfConclusion,
          content: vfContent,
          status: verificationStatus,
          creatorName: "张伟",
          creatorRole: "投资经理",
          createdAt: today,
        },
      },
    }))

    // 尝试调用后端 API
    updateVerificationMutation.mutate({
      hypothesisId: selectedId,
      conclusion: vfConclusion,
      content: vfContent,
      creatorName: "张伟",
      creatorRole: "投资经理",
    })

    setVfContent("")
    setVfConclusion("符合预期")
    setShowVFDialog(false)
  }

  // 新建的主题策略且没有已审批的假设时显示空状态
  if (isNewStrategy && !inheritedFromParent && hypotheses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <Lightbulb className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的策略，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <Plus className="h-4 w-4" />
            创建第一个假设
          </button>
        </div>
      </div>
    )
  }

  if (showDetail && selectedDetail) {
    const linkedMaterials = availableMaterials.filter((m) =>
      selectedDetail.relatedMaterials.includes(m.id)
    )

    const formatIcon = (fmt: string) => {
      if (fmt === "XLSX") return <Sheet className="h-4 w-4 text-emerald-600" />
      if (fmt === "DOCX") return <FileText className="h-4 w-4 text-blue-600" />
      return <File className="h-4 w-4 text-rose-500" />
    }
    const formatBadgeClass = (fmt: string) => {
      if (fmt === "XLSX") return "bg-emerald-50 text-emerald-700 border-emerald-200"
      if (fmt === "DOCX") return "bg-blue-50 text-blue-700 border-blue-200"
      return "bg-rose-50 text-rose-700 border-rose-200"
    }

    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <button
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回假设清单
          </button>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              <Badge className={cn("text-xs", statusConfig[selectedDetail.status].color)}>
                {statusConfig[selectedDetail.status].label}
              </Badge>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">{selectedDetail.description}</p>
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <span>负责人: {selectedDetail.owner}</span>
              <span>创建时间: {selectedDetail.createdAt}</span>
              <span>更新时间: {selectedDetail.updatedAt}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
            </div>
            <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.recommendation}</p>
          </div>

          {/* 投委会审议结果 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-base font-semibold text-[#2563EB]">投委会审议结果</h2>
              </div>
              <button
                onClick={() => setShowCDDialog(true)}
                className="flex items-center gap-1 rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {selectedDetail.committeeDecision.content ? "修改审议结果" : "新增审议结果"}
              </button>
            </div>
            <div className="border-l-4 border-[#2563EB] pl-4">
              {selectedDetail.committeeDecision.content ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-[#111827]">审议结论:</span>
                    <Badge className={cn(
                      "text-xs",
                      selectedDetail.committeeDecision.conclusion === "成立"
                        ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                        : "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                    )}>
                      {selectedDetail.committeeDecision.conclusion}
                    </Badge>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-3">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.committeeDecision.content}</p>
                  </div>
                  {selectedDetail.committeeDecision.creatorName && (
                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                          <span className="text-[8px] text-white">{selectedDetail.committeeDecision.creatorName.slice(0, 1)}</span>
                        </div>
                        <span>{selectedDetail.committeeDecision.creatorName} ({selectedDetail.committeeDecision.creatorRole})</span>
                      </div>
                      <span>{selectedDetail.committeeDecision.createdAt}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-sm text-[#9CA3AF]">暂无审议结果，点击上方按钮新增</div>
              )}
            </div>
          </div>

          {/* 验证情况 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
                <h2 className="text-base font-semibold text-[#8B5CF6]">验证情况</h2>
              </div>
              <button
                onClick={() => setShowVFDialog(true)}
                className="flex items-center gap-1 rounded-lg bg-[#F5F3FF] px-3 py-1.5 text-xs font-medium text-[#8B5CF6] hover:bg-[#EDE9FE] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {selectedDetail.verification.content ? "修改验证情况" : "新增验证情况"}
              </button>
            </div>
            <div className="border-l-4 border-[#8B5CF6] pl-4">
              {selectedDetail.verification.content ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-[#111827]">验证结论:</span>
                    <Badge className={cn(
                      "text-xs",
                      selectedDetail.verification.conclusion === "符合预期"
                        ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                        : "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                    )}>
                      {selectedDetail.verification.conclusion}
                    </Badge>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-3">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.verification.content}</p>
                  </div>
                  {selectedDetail.verification.creatorName && (
                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                          <span className="text-[8px] text-white">{selectedDetail.verification.creatorName.slice(0, 1)}</span>
                        </div>
                        <span>{selectedDetail.verification.creatorName} ({selectedDetail.verification.creatorRole})</span>
                      </div>
                      <span>{selectedDetail.verification.createdAt}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-sm text-[#9CA3AF]">暂无验证情况，点击上方按钮新增</div>
              )}
            </div>
          </div>

          {/* 支撑材料卡片 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <FolderOpen className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">支撑材料</h2>
              <span className="ml-auto text-xs text-[#9CA3AF]">
                {linkedMaterials.length} 个关联材料
              </span>
            </div>

            {linkedMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#9CA3AF]">
                <FolderOpen className="h-8 w-8 mb-2 text-[#D1D5DB]" />
                <p className="text-sm">暂无关联材料</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 transition-colors hover:bg-[#F3F4F6]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E5E7EB]">
                      {formatIcon(material.format)}
                    </div>
                    <span className="flex-1 text-sm text-[#374151] truncate">{material.name}</span>
                    <Badge className={`${formatBadgeClass(material.format)} text-[10px] px-1.5 py-0 shrink-0`}>
                      {material.format}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 投委会审议结果弹窗 */}
        <Dialog open={showCDDialog} onOpenChange={setShowCDDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">
                {selectedDetail?.committeeDecision.content ? "修改审议结果" : "新增审议结果"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">审议结论 <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCdConclusion("成立")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      cdConclusion === "成立"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    成立
                  </button>
                  <button
                    onClick={() => setCdConclusion("不成立")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      cdConclusion === "不成立"
                        ? "border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    不成立
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">审议说明 <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="请输入审议说明..."
                  value={cdContent}
                  onChange={(e) => setCdContent(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
                />
              </div>
              {cdConclusion && (
                <div className="rounded-lg bg-[#FEF3C7] border border-[#FDE68A] p-3">
                  <p className="text-xs text-[#92400E]">
                    💡 提示：审议结论为「{cdConclusion}」时，假设状态将自动更新为「{cdConclusion === "成立" ? "成立" : "不成立"}」
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowCDDialog(false); setCdContent(""); setCdConclusion("成立") }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitCommitteeDecision}
                disabled={!cdContent.trim()}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 验证情况弹窗 */}
        <Dialog open={showVFDialog} onOpenChange={setShowVFDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">
                {selectedDetail?.verification.content ? "修改验证情况" : "新增验证情况"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">验证结论 <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setVfConclusion("符合预期")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      vfConclusion === "符合预期"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    符合预期
                  </button>
                  <button
                    onClick={() => setVfConclusion("偏离")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      vfConclusion === "偏离"
                        ? "border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    偏离
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">验证说明 <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="请输入验证说明..."
                  value={vfContent}
                  onChange={(e) => setVfContent(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowVFDialog(false); setVfContent(""); setVfConclusion("符合预期") }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitVerification}
                disabled={!vfContent.trim()}
                className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="px-6 py-6">
        {/* 赛道策略继承提示 */}
        {inheritedFromParent && showInheritBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="flex-1 text-sm text-blue-700">
              当前赛道策略的假设清单已从主题策略「{parentStrategyName}」继承，您可以在此基础上进行调整
            </p>
            <button
              onClick={() => setShowInheritBanner(false)}
              className="ml-2 shrink-0 rounded p-0.5 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
              aria-label="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">假设清单</h1>
            <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪策略投资假设</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                type="text"
                placeholder="搜索假设..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 bg-white border-[#E5E7EB]"
              />
            </div>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建假设
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E3A5F] text-white">
                <th className="px-4 py-3 text-left text-sm font-medium">假设方向</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设类别</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">负责人</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">更改时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors",
                    index % 2 === 1 && "bg-[#F9FAFB]"
                  )}
                >
                  <td className="px-4 py-3 text-sm text-[#374151]">{item.direction}</td>
                  <td className="px-4 py-3 text-sm text-[#374151]">{item.category}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#111827]">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                        <User className="h-3 w-3 text-[#6B7280]" />
                      </div>
                      <span className="text-sm text-[#374151]">{item.owner}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-[10px]", statusConfig[item.status].color)}>
                      {statusConfig[item.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{item.createdAt}</td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{item.updatedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] rounded transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        详情
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#EF4444] hover:bg-[#FEF2F2] rounded transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="py-12 text-center">
              <Lightbulb className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的假设</p>
            </div>
          )}
        </div>
      </div>

      {/* 创建假设弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#111827]">创建投资假设</div>
                <p className="text-sm font-normal text-[#6B7280]">AI已为您预填了推荐内容，您可以根据需要进行修改</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">假设方向</label>
                <Input
                  value={formDirection}
                  onChange={(e) => setFormDirection(e.target.value)}
                  placeholder="如：技术攻关、市场判断"
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">假设类别</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="如：算力与芯片、市场规模"
                  className="h-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">假设名称</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="输入假设名称"
                className="h-10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">假设简介</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="输入假设详细内容"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* 这里插入价值点和风险点 */}
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">价值点</h3>
              {valuePoints.map((vp, index) => (
                <div key={vp.id} className="p-4 border rounded-lg space-y-4 relative">
                  {valuePoints.length > 1 && (
                    <button 
                      onClick={() => setValuePoints(prev => prev.filter(p => p.id !== vp.id))}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">论据支持</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm rounded-lg border focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none"
                      placeholder="请输入论据支持内容..."
                      value={vp.support}
                      onChange={(e) => setValuePoints(prev => prev.map(p => p.id === vp.id ? { ...p, support: e.target.value } : p))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">论证分析</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm rounded-lg border focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none"
                      placeholder="请输入论证分析内容..."
                      value={vp.analysis}
                      onChange={(e) => setValuePoints(prev => prev.map(p => p.id === vp.id ? { ...p, analysis: e.target.value } : p))}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">附件</label>
                      {/* 使用独立文件上传组件替换之前的输入框触发 */}
                      <FileUpload 
                        onUploadSuccess={(url, name) => handleUploadSuccess(vp.id, url, name)} 
                      />
                    </div>
                    {vp.attachments.length > 0 && (
                      <div className="space-y-2">
                        {vp.attachments.map((att, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                            <a href={att.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                              {att.name}
                            </a>
                            <button onClick={() => removeAttachment(vp.id, att.url)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setValuePoints(prev => [...prev, { id: `vp${Date.now()}`, support: "", analysis: "", attachments: [] }])}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> 添加价值点
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">风险点</h3>
              {riskPoints.map((rp, index) => (
                <div key={rp.id} className="p-4 border border-red-100 bg-red-50/30 rounded-lg space-y-4 relative">
                  {riskPoints.length > 1 && (
                    <button 
                      onClick={() => setRiskPoints(prev => prev.filter(p => p.id !== rp.id))}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block text-red-900">论据支持</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm rounded-lg border-red-200 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="请输入风险论据支持..."
                      value={rp.support}
                      onChange={(e) => setRiskPoints(prev => prev.map(p => p.id === rp.id ? { ...p, support: e.target.value } : p))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block text-red-900">论证分析</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm rounded-lg border-red-200 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="请输入风险论证分析..."
                      value={rp.analysis}
                      onChange={(e) => setRiskPoints(prev => prev.map(p => p.id === rp.id ? { ...p, analysis: e.target.value } : p))}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-red-900">附件</label>
                      {/* 使用独立文件上传组件替换 */}
                      <FileUpload 
                        onUploadSuccess={(url, name) => handleUploadSuccess(rp.id, url, name)} 
                      />
                    </div>
                    {rp.attachments.length > 0 && (
                      <div className="space-y-2">
                        {rp.attachments.map((att, i) => (
                          <div key={i} className="flex items-center justify-between bg-white p-2 rounded border border-red-100 text-sm">
                            <a href={att.url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline truncate max-w-[200px]">
                              {att.name}
                            </a>
                            <button onClick={() => removeAttachment(rp.id, att.url)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setRiskPoints(prev => [...prev, { id: `rp${Date.now()}`, support: "", analysis: "", attachments: [] }])}
                className="w-full py-2 border-2 border-dashed border-red-200 rounded-lg text-sm text-red-400 hover:border-red-300 hover:text-red-500 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> 添加风险点
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">推荐理由</label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="说明为什么推荐这个假设"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#6B7280]" />
                  关联通用材料
                </div>
              </label>
              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {availableMaterials.map((material) => (
                    <label
                      key={material.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        formMaterials.includes(material.id)
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-white border border-transparent"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formMaterials.includes(material.id)}
                        onChange={() => toggleMaterial(material.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <FileText className="h-4 w-4 text-[#6B7280] shrink-0" />
                      <span className="text-sm text-[#374151] truncate flex-1">{material.name}</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] shrink-0">
                        {material.format}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
              {formMaterials.length > 0 && (
                <p className="mt-2 text-xs text-[#6B7280]">
                  已选择 {formMaterials.length} 个材料
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={handleCreateSubmit}
                disabled={!formTitle.trim() || !formDirection.trim()}
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
