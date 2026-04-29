"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  Plus,
  ArrowLeft,
  Eye,
  Trash2,
  User,
  X,
  Lightbulb,
  FolderOpen,
  Sheet,
  File,
  Link2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { cn } from "@/src/lib/utils"
import type { PendingTerm, StrategyTerm } from "@/src/components/pages/strategies-grid"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
interface TermTableItem {
  id: string
  direction: string
  category: string
  name: string
  owner: string
  createdAt: string
  updatedAt: string
}

interface TermDetail {
  id: string
  title: string
  description: string
  owner: string
  createdAt: string
  updatedAt: string
  recommendation: string
  relatedMaterials: string[]
  relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
}

// 通用材料（与 strategy-hypotheses 保持一致）
const availableMaterials = [
  { id: "m1", name: "GPU_AI芯片行业全景报告_2024", format: "PDF" },
  { id: "m2", name: "全球算力基础设施市场规模分析", format: "PDF" },
  { id: "m3", name: "主流AI训练框架技术对比", format: "DOCX" },
  { id: "m4", name: "云服务商GPU算力价格对比表", format: "XLSX" },
  { id: "m5", name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
  { id: "m7", name: "大模型训练成本结构分析", format: "XLSX" },
  { id: "m10", name: "国内外AI基础软件生态图谱", format: "PDF" },
]

// 可选假设列表
const availableHypotheses = [
  { id: "h1", direction: "技术攻关", category: "算力与芯片", name: "国产AI芯片在推理场景下可替代英伟达方案" },
  { id: "h2", direction: "技术攻关", category: "算力与芯片", name: "云端AI芯片市场将在3年内达到500亿美元规模" },
  { id: "h3", direction: "技术攻关", category: "模型训练框架", name: "开源大模型训练框架将成为主流技术路线" },
  { id: "h4", direction: "技术攻关", category: "模型训练框架", name: "分布式训练效率提升是大模型竞争关键" },
  { id: "h5", direction: "技术攻关", category: "基础软件生态", name: "AI编译器将成为新的基础软件投资赛道" },
  { id: "h6", direction: "技术攻关", category: "基础软件生态", name: "MLOps平台市场需求将快速增长" },
]

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const termTableData: TermTableItem[] = [
  {
    id: "t1",
    direction: "控制权条款",
    category: "董事会席位",
    name: "投资方有权委派一名董事进入公司董事会",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
  },
  {
    id: "t2",
    direction: "控制权条款",
    category: "董事会席位",
    name: "投资方有权委派一名观察员列席董事会会议",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
  },
  {
    id: "t3",
    direction: "控制权条款",
    category: "否决权",
    name: "对公司章程修改、增减注册资本等重大事项享有一票否决权",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
  },
  {
    id: "t4",
    direction: "经济条款",
    category: "清算优先权",
    name: "投资方有权优先于普通股股东获得投资金额1.5倍的回报",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
  },
  {
    id: "t5",
    direction: "经济条款",
    category: "反稀释保护",
    name: "采用加权平均反稀释公式保护投资方股权比例",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
  },
  {
    id: "t6",
    direction: "退出条款",
    category: "领售权",
    name: "在特定条件下投资方有权要求创始人一同出售股份",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
  },
]

const termDetails: Record<string, TermDetail> = {
  "t1": {
    id: "t1",
    title: "投资方有权委派一名董事进入公司董事会",
    description: "该条款规定投资方有权向公司董事会委派一名董事代表，参与公司重大决策，保护投资方的权益。核心要点包括：确保投资方在重大决策中的话语权，有助于监督公司运营和财务状况，是投资方保护性条款的核心之一，同时需明确董事的任职资格和更换流程，以保障条款的有效执行。",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    recommendation: "AI芯片赛道的技术路线迭代迅速，董事席位条款可确保投资方第一时间掌握被投企业的技术进展与战略调整，有效降低信息不对称风险。结合该赛道国产替代政策敏感性，建议明确董事对重大政策合规事项的知情权，增强条款的实际保护效力。",
    relatedMaterials: ["m1", "m5"],
    relatedHypotheses: [
      { id: "h1", direction: "技术攻关", category: "算力与芯片", name: "国产AI芯片在推理场景下可替代英伟达方案" },
      { id: "h3", direction: "技术攻关", category: "模型训练框架", name: "开源大模型训练框架将成为主流技术路线" },
    ],
  },
  "t4": {
    id: "t4",
    title: "投资方有权优先于普通股股东获得投资金额1.5倍的回报",
    description: "在公司发生清算或出售等退出事件时，投资方有权优先于普通股股东获得相当于其投资金额1.5倍的回报。1.5倍倍数在当前市场属于中等保护水平，需重点关注参与分配权的设置方式，建议与反稀释条款配合使用以构建完整的下行保护体系，同时在条款设计中预留对赌触发时的估值调整机制。",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    recommendation: "云端AI芯片市场高速扩张背景下，被投企业估值波动较大，清算优先权是应对估值回调风险的核心保护手段。1.5倍倍数结合参与分配权设计，可在保障基本回报的同时分享上行收益，对于当前阶段的算力赛道投资具有较强的适配性。",
    relatedMaterials: ["m2", "m4", "m7"],
    relatedHypotheses: [
      { id: "h2", direction: "技术攻关", category: "算力与芯片", name: "云端AI芯片市场将在3年内达到500亿美元规模" },
      { id: "h4", direction: "技术攻关", category: "模型训练框架", name: "分布式训练效率提升是大模型竞争关键" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回赛道策略的条款模板数据，供创建项目时继承 */
export function getTrackStrategyTermTemplate(): Array<{
  id: string
  direction: string
  category: string
  name: string
  owner: string
  createdAt: string
  updatedAt: string
}> {
  return termTableData
}

/* ------------------------------------------------------------------ */
/*  Component props                                                    */
/* ------------------------------------------------------------------ */
interface StrategyTermsProps {
  strategyId: string
  isNewStrategy?: boolean
  prefillData?: {
    title: string
    direction: string
    category: string
    content: string
    relatedMaterials: string[]
    relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
  }
  onPrefillUsed?: () => void
  strategyType?: "主题策略" | "赛道策略"
  parentStrategyName?: string
  strategyTerms?: StrategyTerm[]
  onCreatePendingTerm?: (pending: PendingTerm) => void
}

export function StrategyTerms({
  strategyId,
  isNewStrategy = false,
  prefillData,
  onPrefillUsed,
  strategyType,
  parentStrategyName,
  strategyTerms = [],
  onCreatePendingTerm,
}: StrategyTermsProps) {
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
  const [formDirection, setFormDirection] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formMaterials, setFormMaterials] = useState<string[]>([])
  const [formHypotheses, setFormHypotheses] = useState<string[]>([])

  // 处理预填数据
  if (prefillData && !showCreateDialog) {
    setFormTitle(prefillData.title)
    setFormDirection(prefillData.direction)
    setFormCategory(prefillData.category)
    setFormContent(prefillData.content)
    setFormMaterials(prefillData.relatedMaterials)
    setFormHypotheses(prefillData.relatedHypotheses.map((h) => h.id))
    setShowCreateDialog(true)
    onPrefillUsed?.()
  }

  // 合并已审批条款和初始数据
  const allTerms: TermTableItem[] = [
    ...strategyTerms.map((t) => ({
      id: t.id,
      direction: t.direction,
      category: t.category,
      name: t.name,
      owner: t.owner,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    ...(inheritedFromParent || !isNewStrategy ? termTableData : []),
  ]

  const filteredData = allTerms.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  // 获取条款详情（从 mock 数据、按名称匹配或已审批条款）
  function getTermDetail(id: string): TermDetail | null {
    if (termDetails[id]) return termDetails[id]
    // 根据名称匹配 — 新策略的条款 ID 与 mock 不同，但名称一致
    const item = allTerms.find((t) => t.id === id)
    if (item) {
      const detailByName = Object.values(termDetails).find((d) => d.title === item.name)
      if (detailByName) return { ...detailByName, id }
    }
    // 从 approved 条款构建基本详情
    const approved = strategyTerms.find((t) => t.id === id)
    if (approved) {
      return {
        id: approved.id,
        title: approved.name,
        description: approved.content || `${approved.name}。该条款旨在保护投资方的核心权益，是投资保护条款体系的重要组成部分。`,
        owner: approved.owner,
        createdAt: approved.createdAt,
        updatedAt: approved.updatedAt,
        recommendation: approved.recommendation || "基于当前投资赛道的特点和市场环境，该条款的设置有助于降低投资风险。",
        relatedMaterials: approved.relatedMaterials || [],
        relatedHypotheses: approved.relatedHypotheses || [],
      }
    }
    return null
  }

  const selectedDetail = selectedId ? getTermDetail(selectedId) : null

  function handleViewDetail(id: string) {
    setSelectedId(id)
    setShowDetail(true)
  }

  function handleBackToList() {
    setShowDetail(false)
    setSelectedId(null)
  }

  function handleDelete(id: string) {
    console.log("[v0] Delete strategy term:", id)
  }

  function resetForm() {
    setFormTitle("")
    setFormDirection("")
    setFormCategory("")
    setFormContent("")
    setFormMaterials([])
    setFormHypotheses([])
  }

  function handleCreateSubmit() {
    if (!formTitle.trim() || !formDirection.trim()) return

    const selectedHypObjects = availableHypotheses.filter((h) => formHypotheses.includes(h.id))

    const pending: PendingTerm = {
      id: `pending-term-${Date.now()}`,
      term: {
        strategyId,
        direction: formDirection,
        category: formCategory,
        name: formTitle.trim(),
        content: formContent,
        recommendation: "",
        relatedMaterials: formMaterials,
        relatedHypotheses: selectedHypObjects,
        owner: "张伟",
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      },
      changeId: `CHG-${Date.now().toString().slice(-6)}`,
      changeName: `新建条款: ${formTitle.trim()}`,
      initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
      initiatedAt: new Date().toISOString().split("T")[0],
      reviewers: [{ id: "lisi", name: "李四", initials: "李四" }],
    }

    setShowCreateDialog(false)
    resetForm()
    onCreatePendingTerm?.(pending)
  }

  function toggleMaterial(id: string) {
    setFormMaterials((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  function toggleHypothesis(id: string) {
    setFormHypotheses((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    )
  }

  // 详情视图
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
            返回条款清单
          </button>

          {/* 基本信息 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <h1 className="text-xl font-bold text-[#111827] mb-4">{selectedDetail.title}</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-4">{selectedDetail.description}</p>
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <span>负责人: {selectedDetail.owner}</span>
              <span>创建时间: {selectedDetail.createdAt}</span>
              <span>更新时间: {selectedDetail.updatedAt}</span>
            </div>
          </div>

          {/* 推荐理由 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <FileText className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
            </div>
            <p className="text-sm text-[#374151] leading-relaxed">
              {selectedDetail.recommendation || <span className="text-[#9CA3AF]">暂无推荐理由</span>}
            </p>
          </div>

          {/* 支撑材料 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <FolderOpen className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">支撑材料</h2>
              <span className="ml-auto text-xs text-[#9CA3AF]">{linkedMaterials.length} 个关联材料</span>
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

          {/* 关联假设 */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">关联假设</h2>
              <span className="ml-auto text-xs text-[#9CA3AF]">{selectedDetail.relatedHypotheses.length} 个关联假设</span>
            </div>
            {selectedDetail.relatedHypotheses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#9CA3AF]">
                <Lightbulb className="h-8 w-8 mb-2 text-[#D1D5DB]" />
                <p className="text-sm">暂无关联假设</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDetail.relatedHypotheses.map((hyp) => (
                  <div
                    key={hyp.id}
                    className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 transition-colors hover:bg-[#F3F4F6]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-100">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827] mb-1.5">{hyp.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                          {hyp.direction}
                        </Badge>
                        <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">
                          {hyp.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="px-6 py-6">
        {/* 赛道策略继承提示 */}
        {inheritedFromParent && showInheritBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
              <FileText className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <p className="flex-1 text-sm text-violet-700">
              当前赛道策略的条款清单已从主题策略「{parentStrategyName}」继承，您可以在此基础上进行调整
            </p>
            <button
              onClick={() => setShowInheritBanner(false)}
              className="ml-2 shrink-0 rounded p-0.5 text-violet-400 transition-colors hover:bg-violet-100 hover:text-violet-700"
              aria-label="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 空状态 */}
        {isNewStrategy && !inheritedFromParent && strategyTerms.length === 0 ? (
          <div className="flex h-[calc(100vh-200px)] items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
                <FileText className="h-8 w-8 text-[#2563EB]" />
              </div>
              <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无条款清单</h3>
              <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
                这是一个新创建的策略，还没有添加任何条款。点击下方按钮开始创建您的第一个投资条款。
              </p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4" />
                创建第一个条款
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#111827]">条款清单</h1>
                <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪策略投资条款</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    type="text"
                    placeholder="搜索条款..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 pl-9 bg-white border-[#E5E7EB]"
                  />
                </div>
                <Button
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新建条款
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1E3A5F] text-white">
                    <th className="px-4 py-3 text-left text-sm font-medium">条款方向</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">条款类别</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">条款名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">负责人</th>
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
                  <FileText className="mx-auto h-12 w-12 text-[#D1D5DB]" />
                  <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的条款</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 创建条款弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); resetForm() }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#111827]">创建投资条款</div>
                <p className="text-sm font-normal text-[#6B7280]">AI已为您预填了推荐内容，您可以根据需要进行修改</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 条款名称 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">条款名称</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="输入条款名称"
                className="h-10"
              />
            </div>

            {/* 条款方向 & 条款类别 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款方向</label>
                <Input
                  value={formDirection}
                  onChange={(e) => setFormDirection(e.target.value)}
                  placeholder="如：控制权条款、经济条款"
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款类别</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="如：董事会席位、里程碑"
                  className="h-10"
                />
              </div>
            </div>

            {/* 条款简介 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">条款简介</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="输入条款详细内容"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* 支撑材料 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-[#6B7280]" />
                  支撑材料
                </div>
              </label>
              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] max-h-44 overflow-y-auto">
                <div className="space-y-2">
                  {availableMaterials.map((material) => (
                    <label
                      key={material.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        formMaterials.includes(material.id)
                          ? "bg-emerald-50 border border-emerald-200"
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
                <p className="mt-2 text-xs text-[#6B7280]">已选择 {formMaterials.length} 个材料</p>
              )}
            </div>

            {/* 关联假设 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#6B7280]" />
                  关联假设
                </div>
              </label>
              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {availableHypotheses.map((hyp) => (
                    <label
                      key={hyp.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        formHypotheses.includes(hyp.id)
                          ? "bg-amber-50 border border-amber-200"
                          : "hover:bg-white border border-transparent"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formHypotheses.includes(hyp.id)}
                        onChange={() => toggleHypothesis(hyp.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#374151] leading-snug">{hyp.name}</p>
                        <div className="flex gap-1.5 mt-1">
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                            {hyp.direction}
                          </Badge>
                          <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">
                            {hyp.category}
                          </Badge>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {formHypotheses.length > 0 && (
                <p className="mt-2 text-xs text-[#6B7280]">已选择 {formHypotheses.length} 个假设</p>
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
                创建条款
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
