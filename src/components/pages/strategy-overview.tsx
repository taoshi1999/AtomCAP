"use client"

import { useState } from "react"
import {
  Cpu,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  ArrowUpRight,
  Inbox,
  Plus,
  Sparkles,
  Loader2,
  Lightbulb,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/src/components/ui/badge"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import { type Strategy } from "@/src/components/pages/strategies-grid"

// AI推荐内容 - 围绕AI基础大模型
const aiRecommendedHypotheses = [
  {
    id: "h1",
    title: "大模型推理成本下降假设",
    direction: "技术攻关",
    category: "算力与芯片",
    content: "假设未来18个月内，大模型推理成本将下降60%以上，主要驱动因素包括：模型量化技术成熟、推理芯片性能提升、以及MoE架构普及带来的计算效率提升。",
    reason: "推理成本是当前大模型商业化的核心瓶颈，成本下降将直接扩大TAM并提升被投企业的盈利空间。建议重点关注具备推理优化技术能力的团队。",
    relatedMaterials: ["m1", "m7"],
  },
  {
    id: "h2", 
    title: "多模态融合市场假设",
    direction: "市场判断",
    category: "市场规模",
    content: "假设多模态大模型（文本+图像+视频+音频）将在2025年成为主流，预计占据AI应用市场60%以上份额，核心驱动力来自企业对统一AI能力的需求。",
    reason: "多模态能力是下一代AI产品的核心差异化点，具备多模态技术储备的公司将在产品竞争中占据优势。该假设对赛道筛选有重要指导意义。",
    relatedMaterials: ["m2", "m10"],
  },
  {
    id: "h3",
    title: "开源模型生态竞争假设",
    direction: "竞争格局",
    category: "生态竞争",
    content: "假设开源大模型将持续缩小与闭源模型的性能差距，在特定垂直领域甚至实现超越，这将重塑行业竞争格局并降低企业AI部署门槛。",
    reason: "开源生态的发展将影响大模型创业公司的竞争壁垒构建策略，需关注被投企业是否具备差异化的数据或场景优势。",
    relatedMaterials: ["m3", "m5"],
  },
]

const aiRecommendedTerms = [
  {
    id: "t1",
    title: "技术里程碑对赌条款",
    direction: "里程碑条款",
    category: "技术里程碑",
    content: "约定目标公司需在投资后12个月内完成自研大模型发布，模型参数规模不低于100B，在公开评测集上达到行业前三水平，否则触发估值调整机制。",
    relatedMaterials: ["m1", "m5"],
    relatedHypotheses: [
      { id: "h1", direction: "技术攻关", category: "算力与芯片", name: "大模型推理成本下降假设" },
    ],
  },
  {
    id: "t2",
    title: "算力成本锁定条款",
    direction: "经济条款",
    category: "成本控制",
    content: "要求目标公司与主要云服务商签订不少于24个月的算力采购协议，锁定GPU租赁价格，确保训练成本可控，并在条款中约定成本超支时的处理机制。",
    relatedMaterials: ["m2", "m7"],
    relatedHypotheses: [
      { id: "h2", direction: "市场判断", category: "市场规模", name: "多模态融合市场假设" },
    ],
  },
  {
    id: "t3",
    title: "核心团队绑定条款",
    direction: "控制权条款",
    category: "团队稳定",
    content: "关键技术人员（CTO、首席科学家、核心算法负责人）需签订不少于4年的服务协议，离职需提前6个月通知并完成知识交接，违约金不低于年薪的200%。",
    relatedMaterials: ["m3"],
    relatedHypotheses: [
      { id: "h3", direction: "竞争格局", category: "生态竞争", name: "开源模型生态竞争假设" },
    ],
  },
]

const aiRecommendedMaterials = [
  {
    id: "m1",
    title: "大模型行业研究报告",
    content: "Gartner 发布的2024年度生成式AI与大模型行业研究报告，涵盖全球市场规模预测、主要玩家格局分析、技术成熟度曲线及应用落地趋势，可作为策略市场规模假设的权威数据支撑依据。",
    category: "行业报告",
  },
  {
    id: "m2",
    title: "AI监管政策与合规文件",
    content: "欧盟2024年正式生效的《人工智能法案》（EU AI Act）全文，系统规定了高风险AI系统的合规要求、禁止性应用范围及义务主体责任，可用于评估被投企业在欧洲市场的合规风险敞口。",
    category: "政策法规",
  },
  {
    id: "m3",
    title: "大模型能力评测基准体系",
    content: "2024年发布的LLM能力评测基准体系综述，系统梳理MMLU、C-Eval、HumanEval、GSM8K等主流评测框架的适用场景与评分标准，可作为策略层面统一的技术评估标尺，用于横向比较赛道内被投候选企业的模型实力。",
    category: "技术参考",
  },
]

// Default strategy info for existing strategies (fallback)
const defaultStrategyInfo = {
  name: "AI基础设施",
  description:
    "聚焦AI算力、模型训练框架和基础软件生态投资。本策略围绕人工智能产业的底层基础设施进行布局，涵盖GPU/TPU算力芯片、分布式训练框架、模型推理优化、数据标注平台、MLOps工具链等核心领域，旨在捕捉AI产业爆发期的底层价值。",
  createdAt: "2023-06-15",
  updatedAt: "2024-01-20",
  manager: "张伟",
  status: "活跃",
  projectCount: 12,
  totalInvest: "8.5亿",
  returnRate: "+32%",
  avgValuation: "15亿",
}

const appliedProjects = [
  {
    id: "1",
    name: "MiniMax",
    logo: "M",
    logoBg: "bg-[#1F2937]",
    round: "B轮",
    status: "尽调中",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "10亿 USD",
    investAmount: "5000万 USD",
  },
  {
    id: "2",
    name: "智谱AI",
    logo: "智",
    logoBg: "bg-violet-600",
    round: "A轮",
    status: "已投资",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "8亿 USD",
    investAmount: "3000万 USD",
  },
  {
    id: "3",
    name: "壁仞科技",
    logo: "壁",
    logoBg: "bg-rose-600",
    round: "C轮",
    status: "已投资",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "25亿 USD",
    investAmount: "1亿 USD",
  },
  {
    id: "4",
    name: "摩尔线程",
    logo: "摩",
    logoBg: "bg-amber-600",
    round: "B轮",
    status: "观察中",
    statusColor: "bg-gray-50 text-gray-600 border-gray-200",
    valuation: "12亿 USD",
    investAmount: "-",
  },
  {
    id: "5",
    name: "烧原科技",
    logo: "烧",
    logoBg: "bg-cyan-600",
    round: "C轮",
    status: "已投资",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "18亿 USD",
    investAmount: "8000万 USD",
  },
]

const investFocus = [
  { label: "GPU/TPU算力芯片", weight: "高" },
  { label: "分布式训练框架", weight: "高" },
  { label: "模型推理优化", weight: "中" },
  { label: "数据标注平台", weight: "中" },
  { label: "MLOps工具链", weight: "低" },
]

export interface HypothesisPrefillData {
  title: string
  direction: string
  category: string
  content: string
  reason: string
  relatedMaterials: string[]
}

export interface TermPrefillData {
  title: string
  direction: string
  category: string
  content: string
  relatedMaterials: string[]
  relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
}

export interface MaterialPrefillData {
  title: string
  category: string
  content: string
}

interface StrategyOverviewProps {
  strategy?: Strategy
  onNavigateToHypotheses?: (prefillData?: HypothesisPrefillData) => void
  onNavigateToTerms?: (prefillData?: TermPrefillData) => void
  onNavigateToMaterials?: (prefillData?: MaterialPrefillData) => void
  hypothesesGenerated: boolean
  onSetHypothesesGenerated: (v: boolean) => void
  termsGenerated: boolean
  onSetTermsGenerated: (v: boolean) => void
  materialsGenerated: boolean
  onSetMaterialsGenerated: (v: boolean) => void
}

export function StrategyOverview({
  strategy,
  onNavigateToHypotheses,
  onNavigateToTerms,
  onNavigateToMaterials,
  hypothesesGenerated,
  onSetHypothesesGenerated,
  termsGenerated,
  onSetTermsGenerated,
  materialsGenerated,
  onSetMaterialsGenerated,
}: StrategyOverviewProps) {
  // 加载状态保持本地（瞬态，无需持久化）
  const [hypothesesLoading, setHypothesesLoading] = useState(false)
  const [termsLoading, setTermsLoading] = useState(false)
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())

  const toggleMaterial = (id: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // 生成推荐假设
  const handleGenerateHypotheses = () => {
    setHypothesesLoading(true)
    onSetHypothesesGenerated(false)
    setTimeout(() => {
      setHypothesesLoading(false)
      onSetHypothesesGenerated(true)
    }, 1500)
  }

  // 生成推荐条款
  const handleGenerateTerms = () => {
    setTermsLoading(true)
    onSetTermsGenerated(false)
    setTimeout(() => {
      setTermsLoading(false)
      onSetTermsGenerated(true)
    }, 1500)
  }

  // 生成推荐材料
  const handleGenerateMaterials = () => {
    setMaterialsLoading(true)
    onSetMaterialsGenerated(false)
    setTimeout(() => {
      setMaterialsLoading(false)
      onSetMaterialsGenerated(true)
    }, 1500)
  }
  // If strategy is provided (new strategy), use its data
  // Otherwise use default strategy info
  const isNewStrategy = strategy && strategy.id.startsWith("new-")
  
  const info = strategy ? {
    name: strategy.name,
    description: strategy.description,
    createdAt: strategy.createdAt,
    updatedAt: strategy.createdAt, // Same as createdAt for new strategies
    manager: "\u5f20\u4f1f",
    status: isNewStrategy ? "新建" : "活跃",
    projectCount: strategy.projectCount,
    totalInvest: strategy.totalInvest,
    returnRate: strategy.returnRate,
    avgValuation: isNewStrategy ? "-" : "15\u4EBF",
    iconBg: strategy.iconBg,
    Icon: strategy.icon,
  } : {
    ...defaultStrategyInfo,
    iconBg: "bg-blue-100 text-blue-600",
    Icon: Cpu,
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-5xl px-8 py-8 space-y-6">
        {/* Strategy Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${info.iconBg}`}>
              <info.Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#111827]">
                  {info.name}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                {info.description}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#9CA3AF]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  创建: {info.createdAt}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  更新: {info.updatedAt}
                </span>
                <span className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                      {info.manager.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  负责人: {info.manager}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u9879\u76EE\u6570"}</span>
              <Target className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.projectCount}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{"\u4E2A\u5DF2\u5173\u8054\u9879\u76EE"}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u603B\u6295\u8D44\u989D"}</span>
              <DollarSign className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.totalInvest}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">USD</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u6536\u76CA\u7387"}</span>
              <TrendingUp className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className={`text-2xl font-bold ${info.returnRate === "+0%" ? "text-[#9CA3AF]" : "text-emerald-600"}`}>
              {info.returnRate}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{"\u7EFC\u5408\u56DE\u62A5"}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#6B7280]">{"\u5E73\u5747\u4F30\u503C"}</span>
              <ArrowUpRight className="h-4 w-4 text-[#9CA3AF]" />
            </div>
            <p className="text-2xl font-bold text-[#111827]">
              {info.avgValuation}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">USD</p>
          </div>
        </div>

        {/* Investment Focus */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#111827]">投资重点领域</h3>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]">
              <Plus className="h-3.5 w-3.5" />
              添加领域
            </button>
          </div>
          {isNewStrategy ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9CA3AF]">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">暂无投资重点领域</p>
              <p className="text-xs mt-1">请在假设清单中添加投资重点</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investFocus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
                >
                  <span className="text-sm text-[#374151]">{item.label}</span>
                  <Badge
                    className={
                      item.weight === "高"
                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50"
                        : item.weight === "中"
                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50"
                    }
                  >
                    优先级: {item.weight}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI推荐卡片区域 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 推荐假设 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">推荐假设</h3>
              {hypothesesGenerated && !hypothesesLoading && (
                <button
                  onClick={handleGenerateHypotheses}
                  className="ml-auto flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新生成
                </button>
              )}
            </div>
            
            {!hypothesesGenerated && !hypothesesLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#9CA3AF]">
                <Sparkles className="h-8 w-8 mb-2 text-[#D1D5DB]" />
                <p className="text-xs text-center mb-3">AI将基于策略特点生成投资假设建议</p>
                <button
                  onClick={handleGenerateHypotheses}
                  className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  生成推荐
                </button>
              </div>
            ) : hypothesesLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
                <p className="text-xs text-[#6B7280]">AI正在分析策略特点...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] bg-blue-50 rounded-lg p-2 border border-blue-100">
                  基于AI基础大模型赛道分析，建议关注以下投资假设：
                </p>
                {aiRecommendedHypotheses.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-[#111827]">{item.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                        {item.direction}
                      </Badge>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed line-clamp-2 mb-2">{item.content}</p>
                    <button
                      onClick={() => onNavigateToHypotheses?.({ 
                        title: item.title, 
                        direction: item.direction,
                        category: item.category,
                        content: item.content, 
                        reason: item.reason,
                        relatedMaterials: item.relatedMaterials,
                      })}
                      className="flex items-center gap-1 text-[11px] text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                    >
                      创建此假设
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 推荐条款 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <FileText className="h-4 w-4 text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">推荐条款</h3>
              {termsGenerated && !termsLoading && (
                <button
                  onClick={handleGenerateTerms}
                  className="ml-auto flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新生成
                </button>
              )}
            </div>
            
            {!termsGenerated && !termsLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#9CA3AF]">
                <Sparkles className="h-8 w-8 mb-2 text-[#D1D5DB]" />
                <p className="text-xs text-center mb-3">AI将基于策略特点生成条款建议</p>
                <button
                  onClick={handleGenerateTerms}
                  className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  生成推荐
                </button>
              </div>
            ) : termsLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
                <p className="text-xs text-[#6B7280]">AI正在分析投资条款...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] bg-violet-50 rounded-lg p-2 border border-violet-100">
                  针对大模型投资的特殊风险，建议设置以下条款：
                </p>
                {aiRecommendedTerms.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-[#111827]">{item.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0">
                        {item.direction}
                      </Badge>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed line-clamp-2 mb-2">{item.content}</p>
                    <button
                      onClick={() => onNavigateToTerms?.({
                        title: item.title,
                        direction: item.direction,
                        category: item.category,
                        content: item.content,
                        relatedMaterials: item.relatedMaterials,
                        relatedHypotheses: item.relatedHypotheses,
                      })}
                      className="flex items-center gap-1 text-[11px] text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                    >
                      创建此条款
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 推荐项目材料 */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <FolderOpen className="h-4 w-4 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">推荐通用材料</h3>
              {materialsGenerated && !materialsLoading && (
                <button
                  onClick={handleGenerateMaterials}
                  className="ml-auto flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新生成
                </button>
              )}
            </div>
            
            {!materialsGenerated && !materialsLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#9CA3AF]">
                <Sparkles className="h-8 w-8 mb-2 text-[#D1D5DB]" />
                <p className="text-xs text-center mb-3">AI将推荐需收集的策略通用材料</p>
                <button
                  onClick={handleGenerateMaterials}
                  className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  生成推荐
                </button>
              </div>
            ) : materialsLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
                <p className="text-xs text-[#6B7280]">AI正在分析尽调需求...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                  大模型项目尽调建议重点收集以下材料：
                </p>
                {aiRecommendedMaterials.map((item) => {
                  const isExpanded = expandedMaterials.has(item.id)
                  return (
                    <div key={item.id} className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB]">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-[#111827]">{item.title}</span>
                        <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0 shrink-0">
                          {item.category}
                        </Badge>
                      </div>
                      <p className={`text-[11px] text-[#6B7280] leading-relaxed mb-1 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {item.content}
                      </p>
                      <button
                        onClick={() => toggleMaterial(item.id)}
                        className="flex items-center gap-0.5 text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors mb-2"
                      >
                        {isExpanded ? (
                          <>收起<ChevronUp className="h-3 w-3" /></>
                        ) : (
                          <>详情<ChevronDown className="h-3 w-3" /></>
                        )}
                      </button>
                      <button
                        onClick={() => onNavigateToMaterials?.({
                          title: item.title,
                          category: item.category,
                          content: item.content,
                        })}
                        className="flex items-center gap-1 text-[11px] text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                      >
                        上传此通用材料
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Applied Projects */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#111827]">已应用项目</h3>
            <span className="text-xs text-[#9CA3AF]">共 {isNewStrategy ? 0 : appliedProjects.length} 个项目</span>
          </div>
          {isNewStrategy ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9CA3AF]">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">暂无关联项目</p>
              <p className="text-xs mt-1">待将策略应用到项目中</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appliedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E5E7EB] px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${project.logoBg}`}
                  >
                    {project.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111827]">
                      {project.name}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      {"\u4F30\u503C: "}
                      {project.valuation}
                    </p>
                  </div>
                  <Badge className="bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50 text-xs">
                    {project.round}
                  </Badge>
                  <Badge className={`${project.statusColor} text-xs`}>
                    {project.status}
                  </Badge>
                  <span className="text-sm text-[#374151] w-28 text-right">
                    {project.investAmount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
