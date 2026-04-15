"use client"

import { useState } from "react"
import { Briefcase, Search, Plus, Target, TrendingUp, Building2, Cpu, Zap, Leaf, X, Check, MoreHorizontal, ChevronRight, ArrowLeft, Upload, Folder, Eye, Pencil, Trash2, Sparkles, Lightbulb, FolderOpen, FileText, Sheet, File } from "lucide-react"
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
  uploadedMaterials?: { name: string; size: string; type: string; description: string }[]
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
    frameworkName: "早期项目筛选框架",
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
    frameworkName: "早期项目筛选框架",
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
    description: "聚焦跨境贸���、全球供应链和国际化业务拓展",
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
    description: "跨境电商平台���品牌出海和供应链服务生态",
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
  { id: "1", name: "AI基础设施", framework: "早期项目筛选框架", hypothesisCount: 12, termCount: 8 },
  { id: "2", name: "大模型应用", framework: "早期项目筛选框架", hypothesisCount: 8, termCount: 6 },
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
  tags, setTags, tagInput, setTagInput,
  selectedRefStrategies, setSelectedRefStrategies,
  selectedFramework, setSelectedFramework,
  onCancel, onNext,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  tags: string[]; setTags: (v: string[]) => void
  tagInput: string; setTagInput: (v: string) => void
  selectedRefStrategies: string[]; setSelectedRefStrategies: (v: string[]) => void
  selectedFramework: string; setSelectedFramework: (v: string) => void
  onCancel: () => void; onNext: () => void
}) {
  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput("")
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

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

      {/* 标签 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-2">标签</label>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-sm text-[#374151]"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-[#9CA3AF] hover:text-[#374151]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              const t = tagInput.trim()
              if (t) { addTag() } else { setTagInput(" ") }
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#D1D5DB] px-3 py-1 text-sm text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >
            <Plus className="h-3 w-3" />
            添加
          </button>
        </div>
        {tagInput !== "" && (
          <div className="mt-2">
            <Input
              value={tagInput.trim()}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
              placeholder="输入标签后按回车"
              className="w-48 h-8 text-sm bg-white border-[#E5E7EB]"
              autoFocus
              onBlur={() => { addTag(); setTagInput("") }}
            />
          </div>
        )}
      </div>

      {/* 参考已有策略 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-2">参考已有策略（可选）</label>
        <div className="space-y-3">
          {EXISTING_STRATEGIES_REF.map((ref) => {
            const isSelected = selectedRefStrategies.includes(ref.id)
            return (
              <label
                key={ref.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all",
                  isSelected
                    ? "border-[#2563EB] bg-blue-50/30"
                    : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    if (isSelected) {
                      setSelectedRefStrategies(selectedRefStrategies.filter((id) => id !== ref.id))
                    } else {
                      setSelectedRefStrategies([...selectedRefStrategies, ref.id])
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      {ref.name}（{ref.framework}）
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                      {ref.hypothesisCount} 个假设 · {ref.termCount} 个条款
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    选中后，AI 生成时会参考此策略的三清单，避免重复分析已有的判断
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* 所用分析框架 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-2">所用分析框架</label>
        <div className="space-y-3">
          {AVAILABLE_FRAMEWORKS.map((fw) => (
            <button
              key={fw.name}
              onClick={() => setSelectedFramework(fw.name)}
              className={cn(
                "w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all",
                selectedFramework === fw.name
                  ? "border-[#2563EB] bg-blue-50/30 shadow-sm"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div>
                <h4 className="text-sm font-semibold text-[#111827]">{fw.name}</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fw.dimensions.map((d) => (
                    <span key={d} className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#6B7280]">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-xs text-[#2563EB] font-medium">
                {fw.dimensionCount} 个分析维度
              </span>
            </button>
          ))}
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
          className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
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
  uploadedMaterials: { name: string; size: string; type: string; description: string }[]
}

function CreateStrategy({ onCancel, onSave, strategies }: { onCancel: () => void; onSave: (result: CreateStrategyResult) => void; strategies: Strategy[] }) {
  const [step, setStep] = useState(1)

  // Step 1 state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>(["AI", "基础设施", "大模型"])
  const [tagInput, setTagInput] = useState("")
  const [selectedRefStrategies, setSelectedRefStrategies] = useState<string[]>(["1"])
  const [selectedFramework, setSelectedFramework] = useState("科技成长型框架")

  // Step 2 state
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string; description: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [aiAutoResearch, setAiAutoResearch] = useState(true)
  const [selectedBrowserFiles, setSelectedBrowserFiles] = useState<string[]>([])

  // Mock directory files - matches AI基础设施 strategy's 通用材料 (10 files)
  const MOCK_DIRECTORY_FILES = [
    { id: "f1", name: "GPU_AI芯片行业全景报告_2024.pdf", size: "6.8 MB", type: "PDF", description: "涵盖英伟达、AMD、华为昇腾等主要厂商的AI芯片市场份额、技术路线及竞争格局分析" },
    { id: "f2", name: "全球算力基础设施市场规模分析.pdf", size: "4.3 MB", type: "PDF", description: "IDC发布的全球AI算力基础设施市场规模预测，含数据中心、云算力及边缘算力细分数据" },
    { id: "f3", name: "主流AI训练框架技术对比.docx", size: "2.1 MB", type: "DOCX", description: "PyTorch、TensorFlow、JAX等主流训练框架的性能基准、生态成熟度及企业采用情况对比" },
    { id: "f4", name: "云服务商GPU算力价格对比表.xlsx", size: "0.8 MB", type: "XLSX", description: "AWS、Azure、GCP、阿里云等主流云厂商A100/H100算力租赁价格及性价比横向对比" },
    { id: "f5", name: "AI基础设施投融资趋势报告_2023-2024.pdf", size: "5.6 MB", type: "PDF", description: "全球AI基础设施领域融资事件、投资机构偏好及典型案例汇总，含估值倍数参考区间" },
    { id: "f6", name: "数据中心能耗与可持续发展白皮书.pdf", size: "3.2 MB", type: "PDF", description: "大模型训练能耗数据、PUE标准及主要云厂商碳中和路线图，用于评估ESG合规风险" },
    { id: "f7", name: "大模型训练成本结构分析.xlsx", size: "1.4 MB", type: "XLSX", description: "主流大模型（GPT-4、Llama、文心等）训练成本拆解：算力、数据、人力占比及趋势" },
    { id: "f8", name: "AI芯片技术路线图_GPU_TPU_NPU.pptx", size: "9.7 MB", type: "PPTX", description: "英伟达Blackwell、谷歌TPU v5、华为昇腾910C等新一代AI芯片架构与性能演进路线图" },
    { id: "f9", name: "AI监管合规政策汇编.pdf", size: "2.9 MB", type: "PDF", description: "中国《生成式AI管理办法》、欧盟EU AI Act、美国AI行政令等主要市场监管政策要点摘编" },
    { id: "f10", name: "国内外AI基础软件生态图谱.pdf", size: "7.1 MB", type: "PDF", description: "MLOps工具链、向量数据库、推理优化框架等AI基础软件全栈生态图谱及主要玩家分布" },
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
        description: f.description,
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
  
  // Detail view state
  const [viewingHypothesisDetail, setViewingHypothesisDetail] = useState<string | null>(null)
  const [viewingTermDetail, setViewingTermDetail] = useState<string | null>(null)

  // Generated hypotheses and terms (mirrors AI基础设施 preset)
  const [generatedHypotheses] = useState([
    { id: "gen-h1", direction: "技术攻关", category: "算力与芯片", name: "国产AI芯片在推理场景下可替代英伟达方案", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h2", direction: "技术攻关", category: "算力与芯片", name: "云端AI芯片市场将在3年内达到500亿美元规模", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h3", direction: "技术攻关", category: "模型训练框架", name: "开源大模型训练框架将成为主流技术路线", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h4", direction: "技术攻关", category: "模型训练框架", name: "分布式训练效率提升是大模型竞争关键", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h5", direction: "技术攻关", category: "基础软件生态", name: "AI编译器将成为新的基础软件投资赛道", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h6", direction: "技术攻关", category: "基础软件生态", name: "MLOps平台市场需求将快速增长", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-h7", direction: "团队能力", category: "创始人", name: "创始人具备丰富的AI产品商业化经验", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
  ])

  const [generatedTerms] = useState([
    { id: "gen-t1", direction: "控制权条款", category: "董事会席位", name: "投资方有权委派一名董事进入公司董事会", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t2", direction: "投资保护条款", category: "信息权", name: "投资方有权获取被投企业月度财务报告", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t3", direction: "投资保护条款", category: "信息权", name: "投资方有权对重大技术决策进行知情和建议", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t4", direction: "投资保护条款", category: "反稀释条款", name: "采用完全棘轮反稀释条款保护投资方权益", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t5", direction: "控制权条款", category: "重大事项否决权", name: "对核心技术IP转让和授权享有一票否决权", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
    { id: "gen-t6", direction: "退出条款", category: "回购条款", name: "若公司未能在5年内实现IPO，投资方有权要求回购", owner: "张伟", createdAt: new Date().toISOString().split("T")[0], status: "pending" },
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
              tags={tags} setTags={setTags}
              tagInput={tagInput} setTagInput={setTagInput}
              selectedRefStrategies={selectedRefStrategies} setSelectedRefStrategies={setSelectedRefStrategies}
              selectedFramework={selectedFramework} setSelectedFramework={setSelectedFramework}
              onCancel={onCancel} onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <div>
              <h1 className="text-xl font-bold text-[#111827] mb-2">配置数据来源</h1>
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
                          <div className="flex-1 min-w-0 max-w-sm">
                            <p className="text-sm font-medium text-[#111827] truncate">{file.name}</p>
                            {file.description && (
                              <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">{file.description}</p>
                            )}
                            <p className="text-[10px] text-[#9CA3AF] mt-0.5">{file.size}</p>
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
                  className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
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
                                      file.type === "PPTX" ? "bg-orange-50 text-orange-600" :
                                        "bg-gray-50 text-gray-600"
                              )}>
                                {file.type}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#111827] truncate">{file.name}</p>
                                <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">{file.description}</p>
                                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{file.size}</p>
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
              {/* AI Analysis Animation - Full screen overlay with dark theme */}
              {isAnalyzing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0F1E]/80 backdrop-blur-md">
                  {/* Animated background */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                    <div className="absolute top-1/3 left-1/3 h-64 w-64 rounded-full bg-[#7C3AED]/10 blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/3 right-1/3 h-48 w-48 rounded-full bg-[#2563EB]/10 blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#06B6D4]/5 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                  </div>

                  <div className="relative w-full max-w-lg">
                    {/* Central AI icon */}
                    <div className="flex flex-col items-center mb-10">
                      <div className="relative mb-6">
                        <div className="absolute -inset-8 rounded-full border border-[#7C3AED]/20 animate-spin" style={{ animationDuration: "8s" }}>
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#7C3AED]/60" />
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#2563EB]/60" />
                        </div>
                        <div className="absolute -inset-5 rounded-full border border-[#2563EB]/20 animate-spin" style={{ animationDuration: "5s", animationDirection: "reverse" }}>
                          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#06B6D4]/80" />
                        </div>
                        <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-[#7C3AED]/20 via-[#2563EB]/20 to-[#06B6D4]/20 animate-pulse blur-sm" />
                        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#4F46E5] to-[#2563EB] flex items-center justify-center shadow-2xl shadow-[#7C3AED]/30">
                          <Sparkles className="h-10 w-10 text-white animate-pulse" />
                        </div>
                      </div>
                      <h2 className="text-xl font-bold text-white mb-1.5 tracking-wide">AI 正在生成策略</h2>
                      <p className="text-sm text-[#94A3B8]">基于分析框架和数据来源自动生成假设与条款</p>
                    </div>

                    {/* Analysis steps */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                      <div className="space-y-3">
                        {ANALYSIS_STEPS.map((s, idx) => {
                          const isComplete = idx < analysisStep
                          const isCurrent = idx === analysisStep
                          return (
                            <div
                              key={s.label}
                              className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-500 ${isComplete
                                ? "border-emerald-500/30 bg-emerald-500/10"
                                : isCurrent
                                  ? "border-[#7C3AED]/50 bg-[#7C3AED]/10 shadow-lg shadow-[#7C3AED]/10"
                                  : "border-white/5 bg-white/[0.02] opacity-40"
                                }`}
                            >
                              <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-500 ${isComplete
                                ? "bg-emerald-500 shadow-md shadow-emerald-500/30"
                                : isCurrent
                                  ? "bg-gradient-to-br from-[#7C3AED] to-[#2563EB] shadow-md shadow-[#7C3AED]/30"
                                  : "bg-white/10"
                                }`}>
                                {isComplete ? (
                                  <Check className="h-4.5 w-4.5 text-white" />
                                ) : isCurrent ? (
                                  <svg className="h-4.5 w-4.5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <span className="text-xs font-medium text-white/40">{idx + 1}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium transition-colors duration-300 ${isComplete ? "text-emerald-300" : isCurrent ? "text-white" : "text-white/40"
                                  }`}>
                                  {s.label}
                                </span>
                                {isCurrent && (
                                  <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB] animate-pulse" style={{ width: "70%" }} />
                                  </div>
                                )}
                              </div>
                              {isComplete && (
                                <span className="text-[10px] font-medium text-emerald-400/80">完成</span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Overall progress */}
                      <div className="mt-5 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[#94A3B8]">总体进度</span>
                          <span className="text-xs font-mono text-[#7C3AED]">
                            {Math.round(((analysisStep + 1) / ANALYSIS_STEPS.length) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#2563EB] to-[#06B6D4] transition-all duration-700 ease-out"
                            style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Interface */}
              {analysisComplete && !isAnalyzing && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-xl font-bold text-[#111827]">策略审核</h1>
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
                              <button 
                                onClick={() => setViewingHypothesisDetail(h.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2563EB] transition-colors" 
                                title="查看详情"
                              >
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
                              <button 
                                onClick={() => setViewingTermDetail(t.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2563EB] transition-colors" 
                                title="查看详情"
                              >
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
                                      file.type === "PPTX" ? "bg-orange-50 text-orange-600" :
                                        "bg-gray-50 text-gray-600"
                              )}>
                                {file.type}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#111827] truncate">{file.name}</p>
                                {file.description && (
                                  <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">{file.description}</p>
                                )}
                                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{file.size}</p>
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

      {/* Hypothesis Detail Modal */}
      {viewingHypothesisDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 bg-gradient-to-r from-blue-50 to-violet-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">假设详情</h2>
                  <p className="text-xs text-[#6B7280]">查看假设的完整信息</p>
                </div>
              </div>
              <button
                onClick={() => setViewingHypothesisDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white/80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-6 space-y-4">
              {(() => {
                const h = generatedHypotheses.find(h => h.id === viewingHypothesisDetail)
                if (!h) return null

                const HYPOTHESIS_DETAILS: Record<string, { description: string; recommendation: string; materials: { name: string; format: string }[] }> = {
                  "国产AI芯片在推理场景下可替代英伟达方案": {
                    description: "随着国产AI芯片技术的持续进步，在特定推理场景下，国产芯片的性价比和能效比已接近或达到英伟达方案的水平。目前国产芯片在INT8推理性能上已达到A100的80%，能效比在特定场景下甚至优于英伟达方案，价格约为进口方案的60%，成本优势显著。主要短板在于软件生态尚不完善，但随着国产化生态建设提速，整体替代可行性正在持续提升。",
                    recommendation: "国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，下游采购意愿持续提升。当前市场窗口期是布局核心标的的关键时机，该假设若得到验证，将为策略在算力芯片赛道的选标逻辑提供重要支撑，建议重点关注推理芯片性价比领先的国内厂商。",
                    materials: [
                      { name: "GPU_AI芯片行业全景报告_2024", format: "PDF" },
                      { name: "云服务商GPU算力价格对比表", format: "XLSX" },
                      { name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
                    ],
                  },
                  "云端AI芯片市场将在3年内达到500亿美元规模": {
                    description: "基于大模型训练和推理需求的爆发式增长，预计全球云端AI芯片市场将在2027年达到500亿美元规模。ChatGPT的成功带动大模型需求全面爆发，各大云厂商持续加大AI算力资本开支，训练芯片需求年增长率已超过50%，推理芯片市场增速更为显著，整体市场规模扩张路径清晰可见。",
                    recommendation: "云端AI算力的结构性增长已获头部科技公司资本开支数据的明确印证，市场规模上限清晰。该假设已验证，可作为策略整体投资逻辑的宏观需求锚点，为算力赛道的标的估值提供市场容量背书，增强投资决策的确定性。",
                    materials: [
                      { name: "全球算力基础设施市场规模分析", format: "PDF" },
                      { name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
                      { name: "大模型训练成本结构分析", format: "XLSX" },
                    ],
                  },
                }

                const detail = HYPOTHESIS_DETAILS[h.name]
                const description = detail?.description || "该假设描述了在当前技术和市场环境下的核心判断，需要通过多维度数据和调研来验证其有效性，为投资决策提供关键依据。"
                const recommendation = detail?.recommendation || "基于当前市场环境和技术发展趋势，该假设具有较高的验证价值，建议重点关注相关赛道的核心标的和技术突破进展。"
                const materials = detail?.materials || [{ name: "行业分析报告", format: "PDF" }]

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
                  <>
                    {/* Title + Description + Meta */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <h1 className="text-xl font-bold text-[#111827] mb-4">{h.name}</h1>
                      <p className="text-sm text-[#6B7280] mb-4 leading-relaxed">{description}</p>
                      <div className="flex items-center gap-6 text-sm text-[#6B7280]">
                        <span>负责人: {h.owner}</span>
                        <span>创建时间: {h.createdAt}</span>
                        <span>更新时间: {h.createdAt}</span>
                      </div>
                    </div>

                    {/* 推荐理由 */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                          <Lightbulb className="h-4 w-4 text-amber-600" />
                        </div>
                        <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
                      </div>
                      <p className="text-sm text-[#374151] leading-relaxed">{recommendation}</p>
                    </div>

                    {/* 支撑材料 */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                          <FolderOpen className="h-4 w-4 text-emerald-600" />
                        </div>
                        <h2 className="text-base font-semibold text-[#111827]">支撑材料</h2>
                        <span className="ml-auto text-xs text-[#9CA3AF]">{materials.length} 个关联材料</span>
                      </div>
                      <div className="space-y-2">
                        {materials.map((material, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 transition-colors hover:bg-[#F3F4F6]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E5E7EB]">
                              {formatIcon(material.format)}
                            </div>
                            <span className="flex-1 text-sm text-[#374151] truncate">{material.name}</span>
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${formatBadgeClass(material.format)}`}>
                              {material.format}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4 bg-[#F9FAFB]">
              <button
                onClick={() => setViewingHypothesisDetail(null)}
                className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Term Detail Modal */}
      {viewingTermDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 bg-gradient-to-r from-emerald-50 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">条款详情</h2>
                  <p className="text-xs text-[#6B7280]">查看条款的完整信息</p>
                </div>
              </div>
              <button
                onClick={() => setViewingTermDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white/80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-6 space-y-4">
              {(() => {
                const t = generatedTerms.find(t => t.id === viewingTermDetail)
                if (!t) return null

                const TERM_DETAILS: Record<string, { description: string; recommendation: string; materials: { name: string; format: string }[]; relatedHypotheses: { direction: string; category: string; name: string }[] }> = {
                  "投资方有权委派一名董事进入公司董事会": {
                    description: "该条款规定投资方有权向公司董事会委派一名董事代表，参与公司重大决策，保护投资方的权益。核心要点包括：确保投资方在重大决策中的话语权，有助于监督公司运营和财务状况，是投资方保护性条款的核心之一，同时需明确董事的任职资格和更换流程，以保障条款的有效执行。",
                    recommendation: "AI芯片赛道的技术路线迭代迅速，董事席位条款可确保投资方第一时间掌握被投企业的技术进展与战略调整，有效降低信息不对称风险。结合该赛道国产替代政策敏感性，建议明确董事对重大政策合规事项的知情权，增强条款的实际保护效力。",
                    materials: [
                      { name: "GPU_AI芯片行业全景报告_2024", format: "PDF" },
                      { name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
                    ],
                    relatedHypotheses: [
                      { direction: "技术攻关", category: "算力与芯片", name: "国产AI芯片在推理场景下可替代英伟达方案" },
                      { direction: "技术攻关", category: "模型训练框架", name: "开源大模型训练框架将成为主流技术路线" },
                    ],
                  },
                }

                const detail = TERM_DETAILS[t.name]
                const description = detail?.description || "该条款旨在保护投资方的核心权益，确保在重大决策中拥有适当的话语权和知情权，是投资保护条款体系的重要组成部分。"
                const recommendation = detail?.recommendation || "基于当前投资赛道的特点和市场环境，该条款的设置有助于降低投资风险，建议在具体执行层面进一步细化相关流程和标准。"
                const materials = detail?.materials || [{ name: "投资条款标准模板", format: "PDF" }]
                const relatedHypotheses = detail?.relatedHypotheses || []

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
                  <>
                    {/* Title + Description + Meta */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <h1 className="text-xl font-bold text-[#111827] mb-4">{t.name}</h1>
                      <p className="text-sm text-[#6B7280] mb-4 leading-relaxed">{description}</p>
                      <div className="flex items-center gap-6 text-sm text-[#6B7280]">
                        <span>负责人: {t.owner}</span>
                        <span>创建时间: {t.createdAt}</span>
                        <span>更新时间: {t.createdAt}</span>
                      </div>
                    </div>

                    {/* 推荐理由 */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                          <FileText className="h-4 w-4 text-amber-600" />
                        </div>
                        <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
                      </div>
                      <p className="text-sm text-[#374151] leading-relaxed">{recommendation}</p>
                    </div>

                    {/* 支撑材料 */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                          <FolderOpen className="h-4 w-4 text-emerald-600" />
                        </div>
                        <h2 className="text-base font-semibold text-[#111827]">支撑材料</h2>
                        <span className="ml-auto text-xs text-[#9CA3AF]">{materials.length} 个关联材料</span>
                      </div>
                      <div className="space-y-2">
                        {materials.map((material, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 transition-colors hover:bg-[#F3F4F6]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E5E7EB]">
                              {formatIcon(material.format)}
                            </div>
                            <span className="flex-1 text-sm text-[#374151] truncate">{material.name}</span>
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${formatBadgeClass(material.format)}`}>
                              {material.format}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 关联假设 */}
                    {relatedHypotheses.length > 0 && (
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                            <Lightbulb className="h-4 w-4 text-amber-600" />
                          </div>
                          <h2 className="text-base font-semibold text-[#111827]">关联假设</h2>
                          <span className="ml-auto text-xs text-[#9CA3AF]">{relatedHypotheses.length} 个关联假设</span>
                        </div>
                        <div className="space-y-2">
                          {relatedHypotheses.map((hyp, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                <Lightbulb className="h-4 w-4 text-amber-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#374151] truncate">{hyp.name}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{hyp.direction}</span>
                                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{hyp.category}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4 bg-[#F9FAFB]">
              <button
                onClick={() => setViewingTermDetail(null)}
                className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
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
