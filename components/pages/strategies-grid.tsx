"use client"

import { useState } from "react"
import { Briefcase, Search, Plus, Target, TrendingUp, Building2, Cpu, Zap, Leaf, X, Check, MoreHorizontal, ChevronRight, ArrowLeft } from "lucide-react"
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
  tags?: string[]
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
    tags: ["AI", "基础设施"],
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
    tags: ["大模型", "应用"],
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
    tags: ["企业", "数字化"],
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
  },
  {
    name: "价值投资评估框架",
    dimensionCount: 4,
    dimensions: ["财务健康度", "内在价值", "安全边际", "催化剂"],
  },
]

const EXISTING_STRATEGIES_REF = [
  { name: "AI 基础设施", framework: "科技成长型框架", hypothesisCount: 12, termCount: 8 },
]

const CREATE_STEPS = [
  { num: 1, label: "基本信息" },
  { num: 2, label: "数据来源" },
  { num: 3, label: "生成与审核" },
]

/* ------------------------------------------------------------------ */
/*  Step 1 — 基本信息                                                   */
/* ------------------------------------------------------------------ */
function CreateStrategyStep1({
  name, setName, description, setDescription,
  tags, setTags, tagInput, setTagInput,
  refStrategyChecked, setRefStrategyChecked,
  selectedFramework, setSelectedFramework,
  onCancel, onNext,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  tags: string[]; setTags: (v: string[]) => void
  tagInput: string; setTagInput: (v: string) => void
  refStrategyChecked: boolean; setRefStrategyChecked: (v: boolean) => void
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
        {EXISTING_STRATEGIES_REF.map((ref) => (
          <label
            key={ref.name}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all",
              refStrategyChecked
                ? "border-[#2563EB] bg-blue-50/30"
                : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
            )}
          >
            <input
              type="checkbox"
              checked={refStrategyChecked}
              onChange={(e) => setRefStrategyChecked(e.target.checked)}
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
        ))}
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
function CreateStrategy({ onCancel, onSave, strategies }: { onCancel: () => void; onSave: (s: Omit<Strategy, "id">) => void; strategies: Strategy[] }) {
  const [step, setStep] = useState(1)

  // Step 1 state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>(["AI", "基础设施", "大模型"])
  const [tagInput, setTagInput] = useState("")
  const [refStrategyChecked, setRefStrategyChecked] = useState(true)
  const [selectedFramework, setSelectedFramework] = useState("科技成长型框架")

  function handleSave() {
    onSave({
      name: name.trim(),
      icon: Cpu,
      iconBg: "bg-blue-100 text-blue-600",
      description: description.trim() || "暂无策略简介",
      projectCount: 0,
      totalInvest: "0",
      returnRate: "+0%",
      owner: { id: "zhangwei", name: "张伟", initials: "张伟" },
      createdAt: new Date().toISOString().split("T")[0],
      tags,
      frameworkName: selectedFramework,
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
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isCompleted
                        ? "bg-[#2563EB] text-white"
                        : isActive
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
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
              refStrategyChecked={refStrategyChecked} setRefStrategyChecked={setRefStrategyChecked}
              selectedFramework={selectedFramework} setSelectedFramework={setSelectedFramework}
              onCancel={onCancel} onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <div>
              <h1 className="text-xl font-bold text-[#111827] mb-2">配置数据来源</h1>
              <p className="text-sm text-[#6B7280] mb-8">
                选择 AI 生成策略时需要参考的数据来源
              </p>

              <div className="space-y-4 mb-8">
                {["项目材料库", "研报中心", "行业数据库", "公开市场数据"].map((source) => (
                  <label
                    key={source}
                    className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 cursor-pointer hover:border-[#D1D5DB] transition-colors"
                  >
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]" />
                    <span className="text-sm font-medium text-[#374151]">{source}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
                >
                  返回上一步
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
                >
                  下一步: 生成与审核
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-xl font-bold text-[#111827] mb-2">生成与审核</h1>
              <p className="text-sm text-[#6B7280] mb-8">
                确认策略信息后，AI 将基于分析框架和数据来源自动生成策略内容
              </p>

              {/* Summary card */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 mb-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">策略名称</p>
                    <p className="text-sm font-semibold text-[#111827]">{name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">分析框架</p>
                    <p className="text-sm font-semibold text-[#111827]">{selectedFramework || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">标签</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span key={t} className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#6B7280]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">参考策略</p>
                    <p className="text-sm font-semibold text-[#111827]">{refStrategyChecked ? "AI 基础设施" : "无"}</p>
                  </div>
                </div>
                {description && (
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">策略描述</p>
                    <p className="text-sm text-[#374151] leading-relaxed">{description}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setStep(2)}
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

  function handleSaveStrategy(data: Omit<Strategy, "id">) {
    const newStrategy: Strategy = {
      ...data,
      id: `s-${Date.now()}`,
    }
    onStrategiesChange([newStrategy, ...strategies])
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
              <h1 className="text-xl font-bold text-[#111827]">策略中心</h1>
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
                  {strategy.tags && strategy.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      {strategy.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="inline-flex rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                          {tag}
                        </span>
                      ))}
                      {strategy.tags.length > 2 && (
                        <span className="text-[10px] text-[#9CA3AF]">+{strategy.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="text-base font-semibold text-[#111827] mb-2">
                  {strategy.name}
                </h3>
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    {strategy.frameworkName || "暂无框架"}
                  </span>
                </div>
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
