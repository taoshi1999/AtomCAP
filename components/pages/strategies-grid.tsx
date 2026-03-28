"use client"

import { useState } from "react"
import { Briefcase, Search, Plus, Target, TrendingUp, Building2, Cpu, Zap, Leaf, X, Check, MoreHorizontal, ChevronRight, ArrowLeft, Upload, Folder, Eye, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
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
  icon: typeof Cpu
  iconBg: string
  description: string
  projectCount: number
  totalInvest: string
  returnRate: string
  owner: { id: string; name: string; initials: string }
  createdAt: string
  frameworkName?: string
  parentStrategyId?: string
  parentStrategyName?: string
}

export interface PendingStrategy {
  id: string
  strategy: Omit<Strategy, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
  // Generated content from AI during creation
  generatedHypotheses?: { direction: string; category: string; name: string }[]
  generatedTerms?: { direction: string; category: string; name: string }[]
  uploadedMaterials?: { name: string; size: string; type: string }[]
}

export interface StrategyHypothesis {
  id: string
  strategyId: string
  direction: string
  category: string
  name: string
  content: string
  reason: string
  relatedMaterials: string[]
  owner: string
  createdAt: string
  updatedAt: string
}

export interface PendingHypothesis {
  id: string
  hypothesis: Omit<StrategyHypothesis, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

export interface StrategyTerm {
  id: string
  strategyId: string
  direction: string
  category: string
  name: string
  content: string
  recommendation: string
  relatedMaterials: string[]
  relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
  owner: string
  createdAt: string
  updatedAt: string
}

export interface PendingTerm {
  id: string
  term: Omit<StrategyTerm, "id">
  changeId: string
  changeName: string
  initiator: { id: string; name: string; initials: string }
  initiatedAt: string
  reviewers: { id: string; name: string; initials: string }[]
}

export interface StrategyMaterial {
  id: string
  strategyId: string
  name: string      // file name
  format: string    // PDF, XLSX, etc.
  size: string      // e.g., "6.8 MB"
  description: string
  category: string
  owner: string
  createdAt: string
}

export interface PendingMaterial {
  id: string
  strategyId: string
  name: string         // recommendation title / display name
  category: string
  description: string  // editable description from upload form
  files: { id: string; name: string; format: string; size: string }[]
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
    icon: Cpu,
    iconBg: "bg-blue-100 text-blue-600",
    description: "聚焦AI算力、模型训练框架和基础软件生态投资",
    projectCount: 12,
    totalInvest: "8.5亿",
    returnRate: "+32%",
    owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
    createdAt: "2023-06-15",
    frameworkName: "科技成长型框架",
  },
  {
    id: "2",
    name: "大模型应用",
    icon: Target,
    iconBg: "bg-violet-100 text-violet-600",
    description: "关注大语言模型的企业级和消费级应用落地场景",
    projectCount: 8,
    totalInvest: "5.2亿",
    returnRate: "+18%",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    createdAt: "2023-07-20",
    frameworkName: "科技成长型框架",
    parentStrategyId: "1",
    parentStrategyName: "AI基础设施",
  },
  {
    id: "7",
    name: "企业数字化",
    icon: Building2,
    iconBg: "bg-emerald-100 text-emerald-600",
    description: "聚焦企业数字化转型、智能化升级和业务流程优化",
    projectCount: 15,
    totalInvest: "12亿",
    returnRate: "+25%",
    owner: { id: "wangfang", name: "王芳", initials: "王芳" },
    createdAt: "2023-02-20",
    frameworkName: "价值投资评估框架",
  },
  {
    id: "3",
    name: "企业服务SaaS",
    icon: Target,
    iconBg: "bg-emerald-100 text-emerald-600",
    description: "覆盖CRM、ERP、协同办公等企业数字化转型赛道",
    projectCount: 15,
    totalInvest: "12亿",
    returnRate: "+25%",
    owner: { id: "wangfang", name: "王芳", initials: "王芳" },
    createdAt: "2023-03-10",
    frameworkName: "早期项目筛选框架",
    parentStrategyId: "7",
    parentStrategyName: "企业数字化",
  },
  {
    id: "4",
    name: "生物科技",
    icon: Zap,
    iconBg: "bg-rose-100 text-rose-600",
    description: "布局AI制药、基因治疗和精准医疗等前沿领域",
    projectCount: 6,
    totalInvest: "4.8亿",
    returnRate: "+12%",
    owner: { id: "zhaoqiang", name: "赵强", initials: "赵强" },
    createdAt: "2023-09-05",
    frameworkName: "早期项目筛选框架",
  },
  {
    id: "8",
    name: "清洁能源",
    icon: Leaf,
    iconBg: "bg-lime-100 text-lime-600",
    description: "聚焦新能源、储能技术和绿色低碳产业投资",
    projectCount: 10,
    totalInvest: "18亿",
    returnRate: "+28%",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    createdAt: "2023-04-10",
    frameworkName: "ESG合规审查框架",
  },
  {
    id: "5",
    name: "新能源汽车",
    icon: Zap,
    iconBg: "bg-lime-100 text-lime-600",
    description: "智能驾驶、动力电池和充电基础设施全产业链投资",
    projectCount: 10,
    totalInvest: "18亿",
    returnRate: "+28%",
    owner: { id: "lisi", name: "李四", initials: "李四" },
    createdAt: "2023-05-18",
    frameworkName: "ESG合规审查框架",
    parentStrategyId: "8",
    parentStrategyName: "清洁能源",
  },
  {
    id: "9",
    name: "国际贸易",
    icon: TrendingUp,
    iconBg: "bg-amber-100 text-amber-600",
    description: "聚焦跨境贸易、全球供应链和国际化业务拓展",
    projectCount: 9,
    totalInvest: "6.3亿",
    returnRate: "+22%",
    owner: { id: "chenzong", name: "陈总", initials: "陈总" },
    createdAt: "2023-07-15",
    frameworkName: "并购整合分析框架",
  },
  {
    id: "6",
    name: "出海电商",
    icon: Target,
    iconBg: "bg-amber-100 text-amber-600",
    description: "跨境电商平台、品牌出海和供应链服务生态",
    projectCount: 9,
    totalInvest: "6.3亿",
    returnRate: "+22%",
    owner: { id: "chenzong", name: "陈总", initials: "陈总" },
    createdAt: "2023-08-25",
    frameworkName: "并购整合分析框架",
    parentStrategyId: "9",
    parentStrategyName: "国际贸易",
  },
]

interface StrategiesGridProps {
  strategies: Strategy[]
  onStrategiesChange: (strategies: Strategy[]) => void
  onSelectStrategy?: (strategyId: string) => void
  onCreatePending?: (pending: PendingStrategy) => void
}

/* ------------------------------------------------------------------ */
/*  Mock data for create flow                                          */
/* ------------------------------------------------------------------ */
const AVAILABLE_FRAMEWORKS = [
  {
    name: "科技成长型框架",
    dimensionCount: 5,
    dimensions: ["产业阶段判断", "技术成熟度", "竞争格局", "商业模式", "团队评估"],
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    name: "价值投资评估框架",
    dimensionCount: 4,
    dimensions: ["财务健康度", "内在价值", "安全边际", "催化剂"],
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    name: "早期项目筛选框架",
    dimensionCount: 4,
    dimensions: ["创始团队", "市场规模", "产品验证", "竞争壁垒"],
    color: "bg-violet-50 border-violet-200 text-violet-700",
  },
  {
    name: "ESG合规审查框架",
    dimensionCount: 3,
    dimensions: ["环境影响", "社会责任", "治理结构"],
    color: "bg-lime-50 border-lime-200 text-lime-700",
  },
  {
    name: "并购整合分析框架",
    dimensionCount: 4,
    dimensions: ["战略协同", "财务整合", "文化融合", "风险控制"],
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
]

const EXISTING_STRATEGIES_REF = [
  { id: "1", name: "AI基础设施", framework: "科技成长型框架", hypothesisCount: 12, termCount: 8 },
  { id: "2", name: "大模型应用", framework: "科技成长型框架", hypothesisCount: 8, termCount: 6 },
  { id: "7", name: "企业数字化", framework: "价值投资评估框架", hypothesisCount: 15, termCount: 10 },
  { id: "3", name: "企业服务SaaS", framework: "早期项目筛选框架", hypothesisCount: 15, termCount: 12 },
  { id: "4", name: "生物科技", framework: "早期项目筛选框架", hypothesisCount: 6, termCount: 5 },
  { id: "8", name: "清洁能源", framework: "ESG合规审查框架", hypothesisCount: 10, termCount: 7 },
  { id: "5", name: "新能源汽车", framework: "ESG合规审查框架", hypothesisCount: 10, termCount: 9 },
  { id: "9", name: "国际贸易", framework: "并购整合分析框架", hypothesisCount: 9, termCount: 6 },
  { id: "6", name: "出海电商", framework: "并购整合分析框架", hypothesisCount: 9, termCount: 8 },
]

const CREATE_STEPS = [
  { num: 1, label: "基本信息" },
  { num: 2, label: "数据来源" },
  { num: 3, label: "策略审核" },
]

/* ------------------------------------------------------------------ */
/*  Step 1 — 基本信息                                                   */
/* ------------------------------------------------------------------ */
function CreateStrategyStep1({
  name, setName, description, setDescription,
  selectedRefStrategies, setSelectedRefStrategies,
  selectedFramework, setSelectedFramework,
  onCancel, onNext,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  selectedRefStrategies: string[]; setSelectedRefStrategies: (v: string[]) => void
  selectedFramework: string; setSelectedFramework: (v: string) => void
  onCancel: () => void; onNext: () => void
}) {
  return (
    <>
      {/* 策略名称 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-2">策略名称</label>
        <Input
          placeholder="基础大模型"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white border-[#E5E7EB] text-base"
        />
      </div>

      {/* 策略描述 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-2">策略描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="聚焦基础大模型赛道，关注模型训练、推理优化和算力效率方向"
          className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] leading-relaxed placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
        />
      </div>

      {/* 参考已有策略 - 横向滚动多选 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-[#374151]">参考已有策略（可选，支持多选）</label>
          <span className="text-xs text-[#9CA3AF]">
            已选 <span className="font-medium text-[#2563EB]">{selectedRefStrategies.length}</span> 个
          </span>
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          选中后，AI 生成时会参考所选策略的假设和条款，避免重复分析
        </p>
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#E5E7EB] scrollbar-track-transparent">
            {EXISTING_STRATEGIES_REF.map((ref) => {
              const isSelected = selectedRefStrategies.includes(ref.id)
              const fw = AVAILABLE_FRAMEWORKS.find((f) => f.name === ref.framework)
              return (
                <button
                  key={ref.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedRefStrategies(selectedRefStrategies.filter((id) => id !== ref.id))
                    } else {
                      setSelectedRefStrategies([...selectedRefStrategies, ref.id])
                    }
                  }}
                  className={cn(
                    "relative flex-shrink-0 w-56 rounded-xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-[#2563EB] bg-blue-50/50 shadow-sm ring-1 ring-[#2563EB]/20"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-sm"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB]">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <h4 className="text-sm font-semibold text-[#111827] mb-2 pr-6">{ref.name}</h4>
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium mb-2", fw?.color || "bg-gray-50 border-gray-200 text-gray-600")}>
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                    {ref.framework}
                  </span>
                  <p className="text-[11px] text-[#6B7280]">
                    {ref.hypothesisCount} 个假设 · {ref.termCount} 个条款
                  </p>
                </button>
              )
            })}
          </div>
          {/* Fade hints */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#F3F4F6] to-transparent" />
        </div>
      </div>

      {/* 所用分析框架 - 横向滚动单选 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-[#374151]">所用分析框架</label>
          {selectedFramework && (
            <span className="text-xs text-[#6B7280]">
              已选择 <span className="font-medium text-[#2563EB]">{selectedFramework}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          选择一个分析框架，AI 将基于该框架的维度生成假设和条款
        </p>
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#E5E7EB] scrollbar-track-transparent">
            {AVAILABLE_FRAMEWORKS.map((fw) => {
              const isSelected = selectedFramework === fw.name
              return (
                <button
                  key={fw.name}
                  onClick={() => setSelectedFramework(fw.name)}
                  className={cn(
                    "relative flex-shrink-0 w-64 rounded-xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-[#2563EB] bg-blue-50/50 shadow-sm ring-1 ring-[#2563EB]/20"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-sm"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB]">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2 pr-6">
                    <h4 className="text-sm font-semibold text-[#111827]">{fw.name}</h4>
                    <span className="text-[10px] font-medium text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded">
                      {fw.dimensionCount} 维度
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fw.dimensions.map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                          isSelected
                            ? "border-[#BFDBFE] bg-blue-50 text-[#1D4ED8]"
                            : "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]"
                        )}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Fade hint */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#F3F4F6] to-transparent" />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
        <button
          onClick={onCancel}
          className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
        >
          取消
        </button>
        <button
          onClick={onNext}
          disabled={!name.trim() || !selectedFramework}
          className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步: 配置数据来源
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Create Strategy Page (full-page, multi-step)                       */
/* ------------------------------------------------------------------ */
export interface CreateStrategyResult {
  strategy: Omit<Strategy, "id">
  generatedHypotheses: { direction: string; category: string; name: string }[]
  generatedTerms: { direction: string; category: string; name: string }[]
  uploadedMaterials: { name: string; size: string; type: string }[]
}

function CreateStrategy({ onCancel, onSave, strategies }: { onCancel: () => void; onSave: (result: CreateStrategyResult) => void; strategies: Strategy[] }) {
  const [step, setStep] = useState(1)

  // Step 1 state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const [selectedRefStrategies, setSelectedRefStrategies] = useState<string[]>(["1"])
  const [selectedFramework, setSelectedFramework] = useState("科技成长型框架")

  // Step 2 state
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [aiAutoResearch, setAiAutoResearch] = useState(true)
  const [selectedBrowserFiles, setSelectedBrowserFiles] = useState<string[]>([])

  // Mock directory files
  const MOCK_DIRECTORY_FILES = [
    { id: "f1", name: "GPU_AI芯片行业全景报告_2024.pdf", size: "6.8 MB", type: "PDF" },
    { id: "f2", name: "全球算力基础设施市场规模分析.pdf", size: "4.3 MB", type: "PDF" },
    { id: "f3", name: "主流AI训练框架技术对比.docx", size: "2.1 MB", type: "DOCX" },
    { id: "f4", name: "云服务商GPU算力价格对比表.xlsx", size: "0.8 MB", type: "XLSX" },
    { id: "f5", name: "AI基础设施投融资趋势报告_2023-2024.pdf", size: "5.6 MB", type: "PDF" },
    { id: "f6", name: "数据中心能耗与可持续发展白皮书.pdf", size: "3.2 MB", type: "PDF" },
  ]

  function handleSelectAllFiles() {
    if (selectedBrowserFiles.length === MOCK_DIRECTORY_FILES.length) {
      setSelectedBrowserFiles([])
    } else {
      setSelectedBrowserFiles(MOCK_DIRECTORY_FILES.map((f) => f.id))
    }
  }

  function handleConfirmUpload() {
    if (selectedBrowserFiles.length === 0) return
    setIsUploading(true)
    // Simulate upload animation
    setTimeout(() => {
      const newFiles = MOCK_DIRECTORY_FILES.filter((f) => selectedBrowserFiles.includes(f.id)).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }))
      setUploadedFiles((prev) => [...prev, ...newFiles])
      setSelectedBrowserFiles([])
      setIsUploading(false)
      setShowFileBrowser(false)
    }, 1200)
  }

  function handleRemoveFile(fileName: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName))
  }

  // Step 3 state - AI analysis animation and review
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [reviewTab, setReviewTab] = useState<"materials" | "hypotheses" | "terms">("hypotheses")
  const [reviewSearchQuery, setReviewSearchQuery] = useState("")

  // Generated hypotheses and terms (mirrors AI基础设施 preset)
  const [generatedHypotheses] = useState([
    { id: "gen-h1", direction: "技术攻关", category: "算力与芯片", name: "国产AI芯片在推理场景下可替代英伟达方案", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h2", direction: "技术攻关", category: "算力与芯片", name: "云端AI芯片市场将在3年内达到500亿美元规模", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h3", direction: "技术攻关", category: "模型训练框架", name: "开源大模型训练框架将成为主流技术路线", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h4", direction: "技术攻关", category: "模型训练框架", name: "分布式训练效率提升是大模型竞争关键", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h5", direction: "技术攻关", category: "基础软件生态", name: "AI编译器将成为新的基础软件投资赛道", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h6", direction: "技术攻关", category: "基础软件生态", name: "MLOps平台市场需求将快速增长", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h7", direction: "团队能力", category: "创始人", name: "创始人具备丰富的AI产品商业化经验", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
  ])

  const [generatedTerms] = useState([
    { id: "gen-t1", direction: "投资保护条款", category: "信息权", name: "投资方有权获取被投企业月度财务报告", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t2", direction: "投资保护条款", category: "信息权", name: "投资方有权对重大技术决策进行知情和建议", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t3", direction: "投资保护条款", category: "反稀释条款", name: "采用完全棘轮反稀释条款保护投资方权益", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t4", direction: "控制权条款", category: "董事会席位", name: "投资方有权委派一名董事参与公司董事会", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t5", direction: "控制权条款", category: "重大事项否决权", name: "对核心技术IP转让和授权享有一票否决权", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t6", direction: "退出条款", category: "回购条款", name: "若公司未能在5年内实现IPO，投资方有权要求回购", owner: "AI生成", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
  ])

  const ANALYSIS_STEPS = [
    { label: "分析已有策略", icon: "strategy" },
    { label: "解析分析框架", icon: "framework" },
    { label: "处理上传材料", icon: "files" },
    { label: "AI自动调研", icon: "research" },
    { label: "生成假设清单", icon: "hypothesis" },
    { label: "生成条款清单", icon: "terms" },
  ]

  function startAnalysis() {
    setIsAnalyzing(true)
    setAnalysisStep(0)
    setAnalysisComplete(false)
    
    // Animate through steps
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      if (currentStep < ANALYSIS_STEPS.length) {
        setAnalysisStep(currentStep)
      } else {
        clearInterval(interval)
        setTimeout(() => {
          setIsAnalyzing(false)
          setAnalysisComplete(true)
        }, 500)
      }
    }, 800)
  }

  // Navigate to Step 3 triggers analysis
  function handleGoToStep3() {
    setStep(3)
    startAnalysis()
  }

  function handleSave() {
    onSave({
      strategy: {
        name: name.trim(),
        icon: Cpu,
        iconBg: "bg-blue-100 text-blue-600",
        description: description.trim() || "暂无策略简介",
        projectCount: 0,
        totalInvest: "0",
        returnRate: "+0%",
        owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
        createdAt: new Date().toISOString().split("T")[0],
        frameworkName: selectedFramework,
      },
      generatedHypotheses: generatedHypotheses.map((h) => ({
        direction: h.direction,
        category: h.category,
        name: h.name,
      })),
      generatedTerms: generatedTerms.map((t) => ({
        direction: t.direction,
        category: t.category,
        name: t.name,
      })),
      uploadedMaterials: uploadedFiles,
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Steps indicator */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <div className="flex items-center justify-center gap-0 mb-8">
          {CREATE_STEPS.map((s, idx) => {
            const isCompleted = s.num < step
            const isActive = s.num === step
            return (
              <div key={s.num} className="flex items-center">
                {idx > 0 && <div className={`mx-2 h-px w-10 ${s.num <= step ? "bg-[#2563EB]" : "bg-[#D1D5DB]"}`} />}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isCompleted
                      ? "bg-[#2563EB] text-white"
                      : isActive
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                      }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      }`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="mx-auto max-w-3xl">
          {step === 1 && (
            <CreateStrategyStep1
              name={name} setName={setName}
              description={description} setDescription={setDescription}

              selectedRefStrategies={selectedRefStrategies} setSelectedRefStrategies={setSelectedRefStrategies}
              selectedFramework={selectedFramework} setSelectedFramework={setSelectedFramework}
              onCancel={onCancel} onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <div>
              <h1 className="text-xl font-bold text-[#111827] mb-2">配置��据来源</h1>
              <p className="text-sm text-[#6B7280] mb-6">
                上传相关材料，AI 将基于这些数据生成投资策略
              </p>

              {/* Upload Zone */}
              <button
                onClick={() => setShowFileBrowser(true)}
                className="w-full rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-white p-10 text-center transition-all hover:border-[#2563EB] hover:bg-blue-50/30 group mb-6"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6] group-hover:bg-blue-100 transition-colors">
                    <Upload className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#2563EB] transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#374151] group-hover:text-[#2563EB] transition-colors">
                      拖拽文件到此处或点击上传
                    </p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      支持 PDF、Word、PPT 格式，如内部投资手册、IC 流程文档等
                    </p>
                  </div>
                </div>
              </button>

              {/* Uploaded Files Section */}
              {uploadedFiles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#374151]">已上传文件</h3>
                    <span className="text-xs text-[#6B7280]">{uploadedFiles.length} 个文件</span>
                  </div>
                  <div className="space-y-2">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                            file.type === "PDF" ? "bg-red-50 text-red-600" :
                              file.type === "DOCX" ? "bg-blue-50 text-blue-600" :
                                file.type === "XLSX" ? "bg-emerald-50 text-emerald-600" :
                                  file.type === "PPTX" ? "bg-orange-50 text-orange-600" :
                                    "bg-gray-50 text-gray-600"
                          )}>
                            {file.type}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#111827] truncate max-w-xs">{file.name}</p>
                            <p className="text-xs text-[#9CA3AF]">{file.size}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(file.name)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#EF4444] transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Auto Research Checkbox */}
              <label className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 cursor-pointer hover:border-[#D1D5DB] transition-colors mb-8">
                <input
                  type="checkbox"
                  checked={aiAutoResearch}
                  onChange={(e) => setAiAutoResearch(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                />
                <div>
                  <span className="text-sm font-medium text-[#374151]">AI 自动调研</span>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    勾选后，AI 会自动搜索资料以供策略生成
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                >
                  返回上一步
                </button>
                <button
                  onClick={handleGoToStep3}
                  className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
                >
                  下一步: 生成策略并审核
                </button>
              </div>

              {/* File Browser Modal */}
              {showFileBrowser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
                      <div>
                        <h2 className="text-lg font-semibold text-[#111827]">选择文件</h2>
                        <p className="text-xs text-[#6B7280] mt-0.5">从策略材料库中选择相关文件</p>
                      </div>
                      <button
                        onClick={() => { setShowFileBrowser(false); setSelectedBrowserFiles([]) }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Directory */}
                    <div className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Folder className="h-5 w-5 text-[#F59E0B]" />
                        <span className="text-sm font-medium text-[#111827]">基础大模型策略材料</span>
                        <span className="text-xs text-[#9CA3AF]">({MOCK_DIRECTORY_FILES.length} 个文件)</span>
                      </div>

                      {/* Select All */}
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E5E7EB]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBrowserFiles.length === MOCK_DIRECTORY_FILES.length}
                            onChange={handleSelectAllFiles}
                            className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span className="text-sm font-medium text-[#374151]">全选</span>
                        </label>
                        <span className="text-xs text-[#6B7280]">
                          已选 <span className="font-medium text-[#2563EB]">{selectedBrowserFiles.length}</span> 个
                        </span>
                      </div>

                      {/* File List */}
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {MOCK_DIRECTORY_FILES.map((file) => {
                          const isSelected = selectedBrowserFiles.includes(file.id)
                          return (
                            <label
                              key={file.id}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                                isSelected
                                  ? "border-[#2563EB] bg-blue-50/50"
                                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedBrowserFiles(selectedBrowserFiles.filter((id) => id !== file.id))
                                  } else {
                                    setSelectedBrowserFiles([...selectedBrowserFiles, file.id])
                                  }
                                }}
                                className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                              />
                              <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                                file.type === "PDF" ? "bg-red-50 text-red-600" :
                                  file.type === "DOCX" ? "bg-blue-50 text-blue-600" :
                                    file.type === "XLSX" ? "bg-emerald-50 text-emerald-600" :
                                      "bg-gray-50 text-gray-600"
                              )}>
                                {file.type}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#111827] truncate">{file.name}</p>
                                <p className="text-xs text-[#9CA3AF]">{file.size}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4 bg-[#F9FAFB]">
                      <button
                        onClick={() => { setShowFileBrowser(false); setSelectedBrowserFiles([]) }}
                        className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleConfirmUpload}
                        disabled={selectedBrowserFiles.length === 0 || isUploading}
                        className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            确认上传 ({selectedBrowserFiles.length})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="min-h-[500px]">
              {/* AI Analysis Animation */}
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative mb-8">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-blue-200/50">
                      <svg className="h-10 w-10 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div className="absolute -inset-4 rounded-3xl border-2 border-[#2563EB]/30 animate-ping" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111827] mb-2">AI 正在生成策略</h2>
                  <p className="text-sm text-[#6B7280] mb-8">基于分析框架和数据来源自动生成假设与条款</p>
                  
                  <div className="w-full max-w-md space-y-3">
                    {ANALYSIS_STEPS.map((s, idx) => (
                      <div
                        key={s.label}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 transition-all duration-300",
                          idx < analysisStep ? "border-[#10B981] bg-emerald-50" :
                          idx === analysisStep ? "border-[#2563EB] bg-blue-50 animate-pulse" :
                          "border-[#E5E7EB] bg-white opacity-50"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                          idx < analysisStep ? "bg-[#10B981] text-white" :
                          idx === analysisStep ? "bg-[#2563EB] text-white" :
                          "bg-[#F3F4F6] text-[#9CA3AF]"
                        )}>
                          {idx < analysisStep ? (
                            <Check className="h-4 w-4" />
                          ) : idx === analysisStep ? (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <span className="text-xs font-medium">{idx + 1}</span>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium",
                          idx <= analysisStep ? "text-[#111827]" : "text-[#9CA3AF]"
                        )}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Interface */}
              {analysisComplete && !isAnalyzing && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-xl font-bold text-[#111827]">策略审���</h1>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        审核 AI 生成的假设和条款，可进行编辑、删除或新增
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          type="text"
                          placeholder="搜索..."
                          value={reviewSearchQuery}
                          onChange={(e) => setReviewSearchQuery(e.target.value)}
                          className="w-48 rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 py-2 text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 rounded-xl bg-[#F3F4F6] p-1 mb-6">
                    {[
                      { key: "hypotheses", label: "假设清单", count: generatedHypotheses.length },
                      { key: "terms", label: "条款清单", count: generatedTerms.length },
                      { key: "materials", label: "参考材料", count: uploadedFiles.length },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setReviewTab(tab.key as typeof reviewTab)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                          reviewTab === tab.key
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6B7280] hover:text-[#374151]"
                        )}
                      >
                        {tab.label}
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          reviewTab === tab.key ? "bg-[#2563EB] text-white" : "bg-[#E5E7EB] text-[#6B7280]"
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Hypotheses Tab */}
                  {reviewTab === "hypotheses" && (
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-[#6B7280]">
                          共 {generatedHypotheses.filter((h) => h.name.toLowerCase().includes(reviewSearchQuery.toLowerCase()) || h.direction.includes(reviewSearchQuery) || h.category.includes(reviewSearchQuery)).length} 个假设
                        </span>
                        <button className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
                          <Plus className="h-4 w-4" />
                          新增假设
                        </button>
                      </div>
                      {generatedHypotheses
                        .filter((h) => h.name.toLowerCase().includes(reviewSearchQuery.toLowerCase()) || h.direction.includes(reviewSearchQuery) || h.category.includes(reviewSearchQuery))
                        .map((h) => (
                        <div key={h.id} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#D1D5DB] transition-colors">
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">{h.direction}</span>
                              <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-700">{h.category}</span>
                            </div>
                            <p className="text-sm font-medium text-[#111827] truncate">{h.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2563EB] transition-colors" title="查看详情">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#F59E0B] transition-colors" title="编辑">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors" title="删除">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Terms Tab */}
                  {reviewTab === "terms" && (
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-[#6B7280]">
                          共 {generatedTerms.filter((t) => t.name.toLowerCase().includes(reviewSearchQuery.toLowerCase()) || t.direction.includes(reviewSearchQuery) || t.category.includes(reviewSearchQuery)).length} 个条款
                        </span>
                        <button className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
                          <Plus className="h-4 w-4" />
                          新增条款
                        </button>
                      </div>
                      {generatedTerms
                        .filter((t) => t.name.toLowerCase().includes(reviewSearchQuery.toLowerCase()) || t.direction.includes(reviewSearchQuery) || t.category.includes(reviewSearchQuery))
                        .map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#D1D5DB] transition-colors">
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{t.direction}</span>
                              <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">{t.category}</span>
                            </div>
                            <p className="text-sm font-medium text-[#111827] truncate">{t.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2563EB] transition-colors" title="查看详情">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#F59E0B] transition-colors" title="编辑">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors" title="删除">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Materials Tab */}
                  {reviewTab === "materials" && (
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-[#6B7280]">
                          共 {uploadedFiles.length} 个材料
                        </span>
                        <button
                          onClick={() => setShowFileBrowser(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                        >
                          <Plus className="h-4 w-4" />
                          添加材料
                        </button>
                      </div>
                      {uploadedFiles.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-8 text-center">
                          <p className="text-sm text-[#6B7280]">暂无上传材料</p>
                        </div>
                      ) : (
                        uploadedFiles.map((file) => (
                          <div key={file.name} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#D1D5DB] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                file.type === "PDF" ? "bg-red-50 text-red-600" :
                                file.type === "DOCX" ? "bg-blue-50 text-blue-600" :
                                file.type === "XLSX" ? "bg-emerald-50 text-emerald-600" :
                                "bg-gray-50 text-gray-600"
                              )}>
                                {file.type}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#111827]">{file.name}</p>
                                <p className="text-xs text-[#9CA3AF]">{file.size}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2563EB] transition-colors" title="查看">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveFile(file.name)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                    <button
                      onClick={() => { setStep(2); setAnalysisComplete(false) }}
                      className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                    >
                      返回上一步
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!name.trim()}
                      className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      确认创建策略
                    </button>
                  </div>
                </div>
              )}

              {/* Initial state before analysis (fallback) */}
              {!isAnalyzing && !analysisComplete && (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-sm text-[#6B7280]">正在准备...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
type StrategiesView = "list" | "create"

export function StrategiesGrid({ strategies, onStrategiesChange, onSelectStrategy, onCreatePending }: StrategiesGridProps) {
  const [view, setView] = useState<StrategiesView>("list")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStrategies = strategies.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleSaveStrategy(result: CreateStrategyResult) {
    if (onCreatePending) {
      // Create a pending strategy change request with generated content
      const pendingStrategy: PendingStrategy = {
        id: `ps-${Date.now()}`,
        strategy: result.strategy,
        changeId: `CR-${Date.now().toString().slice(-6)}`,
        changeName: `新建策略：${result.strategy.name}`,
        initiator: { id: "zhangwei", name: "张伟", initials: "张伟" },
        initiatedAt: new Date().toISOString().split("T")[0],
        reviewers: [
          { id: "lisi", name: "李四", initials: "李四" },
          { id: "wangwu", name: "王五", initials: "王五" },
        ],
        generatedHypotheses: result.generatedHypotheses,
        generatedTerms: result.generatedTerms,
        uploadedMaterials: result.uploadedMaterials,
      }
      onCreatePending(pendingStrategy)
    } else {
      // Fallback: directly add the strategy
      const newStrategy: Strategy = {
        ...result.strategy,
        id: `s-${Date.now()}`,
      }
      onStrategiesChange([newStrategy, ...strategies])
    }
    setView("list")
  }

  if (view === "create") {
    return <CreateStrategy onCancel={() => setView("list")} onSave={handleSaveStrategy} strategies={strategies} />
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] shadow-lg shadow-blue-200/50">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827]">策略列表</h1>
              <p className="mt-0.5 text-sm text-[#6B7280]">
                构建投资策略，可用于投资项目的初始化
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="搜索策略..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 py-2 text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
            <span className="text-sm text-[#6B7280]">
              共 <span className="font-medium text-[#111827]">{filteredStrategies.length}</span> 个策略
            </span>
            <button
              onClick={() => setView("create")}
              className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200/50 transition-colors hover:bg-[#1D4ED8]"
            >
              <Plus className="h-4 w-4" />
              新建策略
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
                {/* Icon */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${strategy.iconBg} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                </div>

                {/* Info */}
                <h3 className="text-base font-semibold text-[#111827] mb-2">
                  {strategy.name}
                </h3>
                {strategy.frameworkName && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                      依托分析框架：{strategy.frameworkName}
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
    </div>
  )
}
