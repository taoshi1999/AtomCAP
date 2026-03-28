"use client"

import { useState } from "react"
import {
  Search,
  LayoutGrid,
  Cpu,
  TrendingUp,
  Sprout,
  Shield,
  GitMerge,
  ArrowLeft,
  Calendar,
  User,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Target,
  Briefcase,
  Sparkles,
  Grid3X3,
  CheckCircle2,
  ArrowRight,
  Upload,
  FileText,
  X,
  MoreHorizontal,
  Check,
  Info,
  Trash2,
  Pencil,
  Square,
  CheckSquare,
  AlertTriangle,
  Folder,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
export interface AnalysisFramework {
  id: string
  name: string
  description: string
  dimensions: string[]
  owner: { name: string; initials: string }
  updatedAt: string
  icon: React.ElementType
  iconBg: string
  dimensionCount: number
  usedByStrategies: number
}

interface DimensionDetail {
  name: string
  priority: "high" | "medium" | "low"
  description: string
  indicators: string[]
  experience: string | null
  dependency: string | null
}

interface JudgmentRule {
  name: string
  description: string
  condition: string
  weight: number
  output: string
}

interface GeneratedStrategy {
  id: string
  name: string
  type: string
  projectCount: number
  createdAt: string
  status: "active" | "paused"
}

/* ------------------------------------------------------------------ */
/*  Mock data — Framework list                                         */
/* ------------------------------------------------------------------ */
const FRAMEWORKS: AnalysisFramework[] = [
  {
    id: "af-1",
    name: "科技成长型框架",
    description: "适用于高成长性科技赛道的投资分析",
    dimensions: ["产业阶段判断", "技术成熟度", "竞争格局", "商业模式", "团队评估"],
    owner: { name: "张伟", initials: "张" },
    updatedAt: "2026-03-20",
    icon: Cpu,
    iconBg: "bg-blue-100 text-blue-600",
    dimensionCount: 5,
    usedByStrategies: 3,
  },
  {
    id: "af-2",
    name: "价值投资评估框架",
    description: "基于基本面和内在价值的深度评估体系",
    dimensions: ["财务健康度", "护城河分析", "管理层质量", "估值合理性", "现金流预测"],
    owner: { name: "王芳", initials: "王" },
    updatedAt: "2026-03-18",
    icon: TrendingUp,
    iconBg: "bg-emerald-100 text-emerald-600",
    dimensionCount: 5,
    usedByStrategies: 2,
  },
  {
    id: "af-3",
    name: "早期项目筛选框架",
    description: "针对Pre-A至A轮早期项目的快速评估方法",
    dimensions: ["创始人背景", "市场空间", "产品PMF验证", "增长潜力"],
    owner: { name: "李四", initials: "李" },
    updatedAt: "2026-03-15",
    icon: Sprout,
    iconBg: "bg-amber-100 text-amber-600",
    dimensionCount: 4,
    usedByStrategies: 4,
  },
  {
    id: "af-4",
    name: "ESG合规审查框架",
    description: "环境、社会和公司治理三维度的合规评估",
    dimensions: ["环境影响", "社会责任", "公司治理", "政策合规", "信息披露"],
    owner: { name: "赵强", initials: "赵" },
    updatedAt: "2026-03-12",
    icon: Shield,
    iconBg: "bg-violet-100 text-violet-600",
    dimensionCount: 5,
    usedByStrategies: 1,
  },
  {
    id: "af-5",
    name: "并购整合分析框架",
    description: "用于评估并购标的及整合可行性的分析工具",
    dimensions: ["协同效应", "文化兼容性", "财务整合", "客户留存", "技术整合", "监管审批"],
    owner: { name: "陈总", initials: "陈" },
    updatedAt: "2026-03-08",
    icon: GitMerge,
    iconBg: "bg-rose-100 text-rose-600",
    dimensionCount: 6,
    usedByStrategies: 2,
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data — Detail for 科技成长型框架                                */
/* ------------------------------------------------------------------ */
const DETAIL_DIMENSIONS: DimensionDetail[] = [
  {
    name: "产业阶段判断",
    priority: "high",
    description: "判断目标赛道当前处于产业周期的哪个阶段，以此决定投资时机和核心风险点",
    indicators: ["头部公司盈利状况", "技术标准收敛程度", "新进入者资本门槛"],
    experience: "在技术赛道，产业阶段判断容易偏乐观。建议同时看\"死亡率\"——过去12个月同类公司倒闭比例。",
    dependency: null,
  },
  {
    name: "技术成熟度评估",
    priority: "high",
    description: "评估核心技术的成熟程度及未来演进方向",
    indicators: ["技术路线收敛度", "工程化落地难度", "替代技术威胁程度"],
    experience: "关注技术从实验室到量产的gap，很多技术demo效果好但工程化成本极高。",
    dependency: null,
  },
  {
    name: "竞争格局分析",
    priority: "medium",
    description: "分析赛道内的竞争态势和市场集中度趋势",
    indicators: ["CR5市场份额", "融资竞争烈度", "差异化壁垒强度", "跨界威胁评估"],
    experience: "注意区分存量竞争和增量竞争，高增长赛道的竞争格局变化极快。",
    dependency: "产业阶段判断",
  },
  {
    name: "商业模式可行性",
    priority: "medium",
    description: "评估赛道内主流商业模式的可持续性和盈利空间",
    indicators: ["单位经济模型验证", "客户留存与LTV", "规模效应拐点"],
    experience: null,
    dependency: null,
  },
  {
    name: "团队评估",
    priority: "low",
    description: "评估赛道内典型创始团队应具备的核心能力",
    indicators: ["技术背景匹配度", "商业化经验", "团队完整度"],
    experience: "科技赛道创始人技术背景权重应高于商业背景，但需要有互补的商业合伙人。",
    dependency: null,
  },
]

const JUDGMENT_RULES: JudgmentRule[] = [
  {
    name: "赛道成熟度综合判定",
    description: "根据产业阶段和技术成熟度综合判断赛道投资时机",
    condition: "产业阶段 ≥ 成长期 且 技术成熟度 ≥ 工程化阶段",
    weight: 30,
    output: "适合大规模投资布局",
  },
  {
    name: "竞争窗口期判定",
    description: "判断当前是否处于有利的竞争窗口期",
    condition: "CR5 < 60% 且 近12月融资事件 ≥ 10起",
    weight: 25,
    output: "窗口期开放，建议加速决策",
  },
  {
    name: "商业化验证判定",
    description: "评估赛道内商业模式是否已得到初步验证",
    condition: "头部公司 ARR > 1亿 或 毛利率 > 50%",
    weight: 25,
    output: "商业模式已验证，可重点关注",
  },
  {
    name: "团队风险判定",
    description: "评估团队能力是否满足赛道要求的最低门槛",
    condition: "创始人行业经验 ≥ 5年 且 核心团队完整度 ≥ 80%",
    weight: 20,
    output: "团队达标，通过基础筛选",
  },
]

const GENERATED_STRATEGIES: GeneratedStrategy[] = [
  { id: "gs-1", name: "AI基础设施", type: "主题策略", projectCount: 12, createdAt: "2026-01-15", status: "active" },
  { id: "gs-2", name: "大模型应用", type: "赛道策略", projectCount: 8, createdAt: "2026-02-20", status: "active" },
  { id: "gs-3", name: "企业数字化", type: "主题策略", projectCount: 15, createdAt: "2025-11-08", status: "paused" },
]

/* ------------------------------------------------------------------ */
/*  Priority helpers                                                   */
/* ------------------------------------------------------------------ */
function getPriorityStyle(p: "high" | "medium" | "low") {
  if (p === "high") return { label: "高优先级", color: "bg-red-50 text-red-700 border-red-200" }
  if (p === "medium") return { label: "中优先级", color: "bg-amber-50 text-amber-700 border-amber-200" }
  return { label: "低优先级", color: "bg-gray-100 text-gray-600 border-gray-200" }
}

/* ------------------------------------------------------------------ */
/*  Detail Page Data                                                   */
/* ------------------------------------------------------------------ */
interface FrameworkDetailData {
  name: string
  description: string
  icon: React.ElementType
  iconBg: string
  owner: { name: string; initials: string }
  createdAt: string
  updatedAt: string
  dimensions: DimensionDetail[]
  rules: JudgmentRule[]
  strategies: GeneratedStrategy[]
}

/* ------------------------------------------------------------------ */
/*  Detail Page Component                                              */
/* ------------------------------------------------------------------ */
function FrameworkDetail({ onBack, data }: { onBack: () => void; data?: FrameworkDetailData }) {
  const detail = data || ORIGINAL_FRAMEWORK_DETAIL
  const [expandedDimensions, setExpandedDimensions] = useState<Set<number>>(new Set([0]))
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set([0]))

  function toggleDimension(idx: number) {
    setExpandedDimensions((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleRule(idx: number) {
    setExpandedRules((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8 space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] hover:bg-white hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回框架列表
          </button>
          <div className="h-5 w-px bg-[#E5E7EB]" />
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${detail.iconBg}`}>
              <detail.icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#111827]">{detail.name}</h1>
              <p className="text-xs text-[#6B7280]">{detail.description}</p>
            </div>
          </div>
        </div>

        {/* ─── Section 1: 基本信息 ─── */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-base font-semibold text-[#111827] mb-4">基本信息</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutGrid className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <p className="text-[11px] text-[#9CA3AF]">框架名称</p>
              </div>
              <p className="text-sm font-semibold text-[#111827]">{detail.name}</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <p className="text-[11px] text-[#9CA3AF]">创建时间</p>
              </div>
              <p className="text-sm font-semibold text-[#111827]">{detail.createdAt}</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <p className="text-[11px] text-[#9CA3AF]">更新时间</p>
              </div>
              <p className="text-sm font-semibold text-[#111827]">{detail.updatedAt}</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <p className="text-[11px] text-[#9CA3AF]">负责人</p>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-blue-100 text-[9px] text-blue-600">{detail.owner.initials}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-[#111827]">{detail.owner.name}</p>
              </div>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <p className="text-[11px] text-[#9CA3AF]">生成策略数</p>
              </div>
              <p className="text-sm font-semibold text-[#2563EB]">{detail.strategies.length}</p>
            </div>
          </div>
        </div>

        {/* ─── Section 2: 分析维度 ─── */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-[#111827]">
              分析维度 <span className="text-[#9CA3AF] font-normal">({detail.dimensions.length})</span>
            </h2>
            <button className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
              <Plus className="h-3.5 w-3.5" />
              添加维度
            </button>
          </div>

          <div className="space-y-3">
            {detail.dimensions.map((dim, idx) => {
              const expanded = expandedDimensions.has(idx)
              const ps = getPriorityStyle(dim.priority)
              return (
                <div key={idx} className="rounded-xl border border-[#E5E7EB] transition-all hover:border-[#D1D5DB]">
                  {/* Header */}
                  <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h3 className="text-[15px] font-semibold text-[#111827]">{dim.name}</h3>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${ps.color}`}>
                          {ps.label}
                        </span>
                      </div>
                      <p className="text-sm text-[#6B7280] leading-relaxed">{dim.description}</p>
                      {!expanded && (
                        <p className="mt-2 text-xs text-[#9CA3AF]">
                          {dim.indicators.length} 个判断指标
                          {dim.experience ? " · 有机构经验备注" : " · 无经验备注"}
                          {dim.dependency ? ` · 依赖: ${dim.dependency}` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDimension(idx)}
                      className="ml-4 shrink-0 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                    >
                      {expanded ? "收起详情" : "展开详情"}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <div className="border-t border-[#F3F4F6] px-5 py-4 space-y-4">
                      {/* Indicators */}
                      <div>
                        <p className="text-xs font-medium text-[#6B7280] mb-2">判断指标</p>
                        <ul className="space-y-1.5">
                          {dim.indicators.map((ind, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-[#374151]">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#374151]" />
                              {ind}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Experience */}
                      {dim.experience && (
                        <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">机构经验</p>
                          <p className="text-sm text-amber-900 leading-relaxed">{dim.experience}</p>
                        </div>
                      )}

                      {/* Dependency */}
                      {dim.dependency && (
                        <p className="text-xs text-[#9CA3AF]">
                          前置依赖: <span className="font-medium text-[#6B7280]">{dim.dependency}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Section 3: 综合研判规则 ─── */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-[#111827]">
              综合研判规则 <span className="text-[#9CA3AF] font-normal">({detail.rules.length})</span>
            </h2>
            <button className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
              <Plus className="h-3.5 w-3.5" />
              添加规则
            </button>
          </div>

          <div className="space-y-3">
            {detail.rules.map((rule, idx) => {
              const expanded = expandedRules.has(idx)
              return (
                <div key={idx} className="rounded-xl border border-[#E5E7EB] transition-all hover:border-[#D1D5DB]">
                  {/* Header */}
                  <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h3 className="text-[15px] font-semibold text-[#111827]">{rule.name}</h3>
                        <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          权重 {rule.weight}%
                        </span>
                      </div>
                      <p className="text-sm text-[#6B7280] leading-relaxed">{rule.description}</p>
                      {!expanded && (
                        <p className="mt-2 text-xs text-[#9CA3AF]">
                          触发条件: {rule.condition.substring(0, 30)}...
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleRule(idx)}
                      className="ml-4 shrink-0 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                    >
                      {expanded ? "收起详情" : "展开详情"}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <div className="border-t border-[#F3F4F6] px-5 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-[#6B7280] mb-2">触发条件</p>
                        <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3">
                          <code className="text-sm text-[#374151] font-mono">{rule.condition}</code>
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-4 py-3">
                        <p className="text-xs font-semibold text-emerald-800 mb-1">研判结论</p>
                        <p className="text-sm text-emerald-900 leading-relaxed">{rule.output}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Section 4: 已生成策略 ─── */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-[#111827]">
              已生成策略 <span className="text-[#9CA3AF] font-normal">({detail.strategies.length})</span>
            </h2>
          </div>

          {detail.strategies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] py-10 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-[#D1D5DB] mb-3" />
              <p className="text-sm text-[#6B7280]">尚未基于此框架生成策略</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">保存框架后即可在策略列表中生成新策略</p>
            </div>
          ) : (
            <div className="space-y-3">
              {detail.strategies.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-5 py-4 transition-all hover:border-[#D1D5DB] hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6]">
                      <Briefcase className="h-4.5 w-4.5 text-[#6B7280]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-[#111827]">{s.name}</h3>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${s.type === "主题策略"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-violet-50 text-violet-700 border-violet-200"
                          }`}>
                          {s.type}
                        </span>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${s.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}>
                          {s.status === "active" ? "运行中" : "已暂停"}
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF]">
                        {s.projectCount} 个项目 · 创建于 {s.createdAt}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create Framework — method picker                                   */
/* ------------------------------------------------------------------ */
function CreateFrameworkPicker({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [selected, setSelected] = useState<"ai" | "manual">("ai")

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#9CA3AF] mb-10">
          <button onClick={onBack} className="hover:text-[#6B7280] transition-colors">策略中心</button>
          <span>/</span>
          <button onClick={onBack} className="hover:text-[#6B7280] transition-colors">分析框架</button>
          <span>/</span>
          <span className="text-[#111827] font-medium">新建框架</span>
        </nav>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">新建分析框架</h1>
          <p className="text-sm text-[#6B7280]">选择一种方式开始构建你的投资方法论</p>
        </div>

        {/* Cards */}
        <div className="mx-auto max-w-3xl grid grid-cols-2 gap-6 mb-8">
          {/* AI 辅助创建 */}
          <button
            onClick={() => setSelected("ai")}
            className={`relative flex flex-col rounded-xl border-2 bg-white p-6 text-left transition-all ${selected === "ai"
                ? "border-[#2563EB] shadow-lg shadow-blue-100/50"
                : "border-[#E5E7EB] hover:border-[#D1D5DB]"
              }`}
          >
            {/* Selection indicator */}
            {selected === "ai" && (
              <div className="absolute top-4 right-4">
                <CheckCircle2 className="h-5 w-5 text-[#2563EB]" />
              </div>
            )}
            {/* Recommended badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <Sparkles className="h-5 w-5 text-[#2563EB]" />
              </div>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#2563EB]">推荐</span>
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">AI 辅助创建</h3>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
              ���自然语言描述你的投资方法论，AI 自动拆解为结构化的分析维度、判断指标和输出规范，你再逐一审核修改。
            </p>
            <p className="mt-auto text-xs text-[#9CA3AF]">适合：心里有方法论但不想从零填表的用户</p>
          </button>

          {/* 手动创建 */}
          <button
            onClick={() => setSelected("manual")}
            className={`relative flex flex-col rounded-xl border-2 bg-white p-6 text-left transition-all ${selected === "manual"
                ? "border-[#2563EB] shadow-lg shadow-blue-100/50"
                : "border-[#E5E7EB] hover:border-[#D1D5DB]"
              }`}
          >
            {selected === "manual" && (
              <div className="absolute top-4 right-4">
                <CheckCircle2 className="h-5 w-5 text-[#2563EB]" />
              </div>
            )}
            <div className="mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F4F6]">
                <Grid3X3 className="h-5 w-5 text-[#6B7280]" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">手动创建</h3>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
              从平台提供的维度库中选取分析维度，或从零开始自定义每个维度的指标、标准和经验备注。
            </p>
            <p className="mt-auto text-xs text-[#9CA3AF]">适合：已有清晰的结构化方法论的用户</p>
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-center text-sm text-[#9CA3AF] mb-8">
          无论选择哪种方式，后续都可以自由编辑所有内容
        </p>

        {/* Action button */}
        {selected === "ai" && (
          <div className="flex justify-center">
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-medium text-white shadow-sm shadow-blue-200/50 transition-colors hover:bg-[#1D4ED8]"
            >
              描述方法论
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Describe Methodology (AI-assisted)                        */
/* ------------------------------------------------------------------ */
const STEPS = [
  { num: 1, label: "起点选择" },
  { num: 2, label: "描述方法论" },
  { num: 3, label: "配置维度" },
  { num: 4, label: "研判规则" },
  { num: 5, label: "确认保存" },
]

const SAMPLE_DESCRIPTION = `我们投科技项目主要看这几个方面：

首先看赛道处于什么阶段，主要判断依据是头部公司有没有开始盈利、技术路线有没有收敛、新玩家进入的门槛高不高。我们的经验是技术赛道容易过度乐观，所以会额外看过去一年同赛道公司的倒闭率。

然后看技术本身成不成熟，关注核心技术的性能瓶颈、迭代速度、以及开源社区的活跃程度。

竞争格局方面，我们主要看CR5和近期融资密度，判断是红海还是蓝海。经验上，高增长赛道的竞争格局变化很快，不能只看静态数据。

商业模式要验证单位经济模型是否跑通，重点关注客户留存和LTV。

最后看团队，科技赛道对创始人的技术背景要求高，但也需要有商业化能力的合伙人。`

// Mock files for "科技成长型框架材料" directory
const FRAMEWORK_MOCK_FILES = [
  { id: "fm1", name: "科技投资方法论手册_v2.pdf", size: "5.2 MB", type: "PDF", description: "内部科技赛道投资方法论总结，涵盖产业阶段判断、技术成熟度评估等核心维度" },
  { id: "fm2", name: "产业阶段判断标准与案例集.pdf", size: "3.8 MB", type: "PDF", description: "科技赛道产业阶段判断的量化标准和历史投资案例分析，含盈利拐点识别方法" },
  { id: "fm3", name: "技术成熟度评估模型.xlsx", size: "1.2 MB", type: "XLSX", description: "基于TRL框架的技术成熟度评估量表，含性能瓶颈、迭代速度等关键指标" },
  { id: "fm4", name: "竞争格局分析框架.docx", size: "2.4 MB", type: "DOCX", description: "CR5计算方法、融资密度分析及竞争态势判断指南，附红海蓝海判定标准" },
  { id: "fm5", name: "单位经济模型验证清单.xlsx", size: "0.9 MB", type: "XLSX", description: "商业模式验证的关键指标清单：客户获取成本、留存率、LTV等核心公式" },
  { id: "fm6", name: "创始团队评估矩阵.pdf", size: "2.1 MB", type: "PDF", description: "��技赛道创始人评估框架：技术背景、商业化能力、团队完整度评分表" },
  { id: "fm7", name: "科技投资IC流程标准.pdf", size: "4.5 MB", type: "PDF", description: "投委会上会标准流程、材料要求及决策机制，含否决条件清单" },
  { id: "fm8", name: "历史项目复盘报告汇编.pdf", size: "8.3 MB", type: "PDF", description: "���三年科技赛道投资���目复���：成功案例、失败教训及经验提炼" },
]

function DescribeMethodology({ onBack, onBackToList, onNext }: { onBack: () => void; onBackToList: () => void; onNext: () => void }) {
  const [frameworkName, setFrameworkName] = useState("")
  const [description, setDescription] = useState(SAMPLE_DESCRIPTION)
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string; description: string }[]>([])
  
  // File browser modal state
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [selectedBrowserFiles, setSelectedBrowserFiles] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  
  // AI analysis animation state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  
  const AI_ANALYSIS_STEPS = [
    { label: "解析方法论描述", icon: "parse" },
    { label: "提取核心概念", icon: "extract" },
    { label: "匹配分析模式", icon: "match" },
    { label: "生成维度结构", icon: "generate" },
  ]
  
  function handleStartAnalysis() {
    setIsAnalyzing(true)
    setAnalysisStep(0)
    
    // Animate through steps
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      if (currentStep < AI_ANALYSIS_STEPS.length) {
        setAnalysisStep(currentStep)
      } else {
        clearInterval(interval)
        setTimeout(() => {
          setIsAnalyzing(false)
          onNext()
        }, 400)
      }
    }, 700)
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSelectAllFiles() {
    if (selectedBrowserFiles.length === FRAMEWORK_MOCK_FILES.length) {
      setSelectedBrowserFiles([])
    } else {
      setSelectedBrowserFiles(FRAMEWORK_MOCK_FILES.map((f) => f.id))
    }
  }

  function handleConfirmUpload() {
    if (selectedBrowserFiles.length === 0) return
    setIsUploading(true)
    // Simulate upload animation
    setTimeout(() => {
      const newFiles = FRAMEWORK_MOCK_FILES.filter((f) => selectedBrowserFiles.includes(f.id)).map((f) => ({
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Top bar: breadcrumb + menu */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <nav className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">策略中心</button>
            <span>/</span>
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">分析框架</button>
            <span>/</span>
            <span className="text-[#111827] font-medium">新建框架</span>
          </nav>
          <button className="rounded-lg p-2 text-[#6B7280] hover:bg-white transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((step, idx) => {
            const isCompleted = step.num < 2
            const isActive = step.num === 2
            return (
              <div key={step.num} className="flex items-center">
                {idx > 0 && <div className={`mx-2 h-px w-10 ${step.num <= 2 ? "bg-[#2563EB]" : "bg-[#D1D5DB]"}`} />}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isCompleted
                        ? "bg-[#2563EB] text-white"
                        : isActive
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                      }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="flex gap-8">
          {/* Left: form */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#111827] mb-2">描述你的投资方法论</h1>
            <p className="text-sm text-[#6B7280] mb-8">
              用自然语言说明你分析投资项目时的思考框架，AI 会将其拆解为结构化的分析维度
            </p>

            {/* 框架名称 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#374151] mb-2">框架名称</label>
              <Input
                placeholder="科技成长型框架"
                value={frameworkName}
                onChange={(e) => setFrameworkName(e.target.value)}
                className="bg-white border-[#E5E7EB]"
              />
            </div>

            {/* 方法论描述 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#374151] mb-2">方法论描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] leading-relaxed placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
                placeholder="描述你的投资方法论..."
              />
            </div>

            {/* 参考文档 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#374151]">参考文档（可选）</label>
                {uploadedFiles.length > 0 && (
                  <span className="text-xs text-[#6B7280]">已上传 {uploadedFiles.length} 个文件</span>
                )}
              </div>
              
              {/* Upload card - always visible */}
              <button
                onClick={() => setShowFileBrowser(true)}
                className="w-full rounded-xl border-2 border-dashed border-[#D1D5DB] bg-white px-6 py-6 text-center hover:border-[#2563EB] hover:bg-blue-50/30 transition-all group cursor-pointer"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] group-hover:bg-blue-100 transition-colors">
                    <Upload className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#2563EB] transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#374151] group-hover:text-[#2563EB] transition-colors">
                      {uploadedFiles.length === 0 ? "拖拽文件到此处或点击上传" : "点击上传更多文件"}
                    </p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      支持 PDF、Word、PPT 格式，如内部投资手册、IC 流程文档等
                    </p>
                  </div>
                </div>
              </button>

              {/* Horizontally scrollable uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <div className="relative">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#E5E7EB] scrollbar-track-transparent">
                      {uploadedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex-shrink-0 w-64 rounded-xl border border-[#E5E7EB] bg-white p-3 hover:border-[#D1D5DB] transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                              file.type === "PDF" ? "bg-red-50 text-red-600" :
                              file.type === "DOCX" ? "bg-blue-50 text-blue-600" :
                              file.type === "XLSX" ? "bg-emerald-50 text-emerald-600" :
                              file.type === "PPTX" ? "bg-orange-50 text-orange-600" :
                              "bg-gray-50 text-gray-600"
                            }`}>
                              {file.type}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#111827] truncate pr-6">{file.name}</p>
                              {file.description && (
                                <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-0.5 leading-relaxed">{file.description}</p>
                              )}
                              <p className="text-[10px] text-[#9CA3AF] mt-1">{file.size}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-all"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Fade hint for scroll */}
                    {uploadedFiles.length > 2 && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#F3F4F6] to-transparent" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* File Browser Modal */}
            {showFileBrowser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[#111827]">选择参考文档</h2>
                      <p className="text-xs text-[#6B7280] mt-0.5">从框架材料库中选择相关文件</p>
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
                      <span className="text-sm font-medium text-[#111827]">科技成长型框架材料</span>
                      <span className="text-xs text-[#9CA3AF]">({FRAMEWORK_MOCK_FILES.length} 个文件)</span>
                    </div>

                    {/* Select All */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E5E7EB]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBrowserFiles.length === FRAMEWORK_MOCK_FILES.length}
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
                      {FRAMEWORK_MOCK_FILES.map((file) => {
                        const isSelected = selectedBrowserFiles.includes(file.id)
                        return (
                          <label
                            key={file.id}
                            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                              isSelected
                                ? "border-[#2563EB] bg-blue-50/50"
                                : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                            }`}
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
                              className="mt-1 h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                            />
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                              file.type === "PDF" ? "bg-red-50 text-red-600" :
                              file.type === "DOCX" ? "bg-blue-50 text-blue-600" :
                              file.type === "XLSX" ? "bg-emerald-50 text-emerald-600" :
                              "bg-gray-50 text-gray-600"
                            }`}>
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

          {/* Right: writing tips */}
          <div className="w-72 shrink-0">
            <div className="sticky top-0 rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#111827] mb-4">写作建议</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#374151] mb-1">说清分析顺序</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    &quot;先看 A，再根据 A 的结论决定怎么看 B&quot;
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#374151] mb-1">写出具体判断标准</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    &quot;如果超过 3 家盈利说明进入成熟期&quot;比&quot;看盈利情况&quot;更好
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#374151] mb-1">加入你的经验</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    &quot;我们发现 XX 指标容易误判&quot;这类踩坑经验很有价值
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#374151] mb-1">标明否决条件</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    &quot;遇到 XX 情况直接放弃&quot;帮 AI 识别红线
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
          >
            返回上一步
          </button>
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" />
            下一步：AI生成分析维度
          </button>
        </div>
      </div>
      
      {/* AI Analysis Animation Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            {/* Animated AI Icon */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-blue-300/40">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border-2 border-[#2563EB]/30 animate-ping" />
                <div className="absolute -inset-5 rounded-3xl border border-[#7C3AED]/20 animate-pulse" />
              </div>
              <h2 className="text-lg font-semibold text-[#111827]">AI 正在分析</h2>
              <p className="text-sm text-[#6B7280] mt-1">基于方法论生成分析维度结构</p>
            </div>
            
            {/* Analysis Steps */}
            <div className="space-y-3">
              {AI_ANALYSIS_STEPS.map((step, idx) => (
                <div
                  key={step.label}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 ${
                    idx < analysisStep ? "border-[#10B981] bg-emerald-50" :
                    idx === analysisStep ? "border-[#2563EB] bg-blue-50" :
                    "border-[#E5E7EB] bg-white opacity-50"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    idx < analysisStep ? "bg-[#10B981] text-white" :
                    idx === analysisStep ? "bg-[#2563EB] text-white" :
                    "bg-[#F3F4F6] text-[#9CA3AF]"
                  }`}>
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
                  <span className={`text-sm font-medium ${
                    idx <= analysisStep ? "text-[#111827]" : "text-[#9CA3AF]"
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Progress bar */}
            <div className="mt-6">
              <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((analysisStep + 1) / AI_ANALYSIS_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Configure Dimensions                                      */
/* ------------------------------------------------------------------ */
interface DimensionIndicator {
  id: string
  name: string
  description: string
  criteria: string
}

interface ConfigDimension {
  id: string
  name: string
  description: string
  priority: "high" | "medium" | "low"
  indicators: DimensionIndicator[]
  experience: string
  outputs: { label: string; checked: boolean }[]
  relations: string[]
  status: "configured" | "pending"
  aiGenerated: boolean
}

const INITIAL_DIMENSIONS: ConfigDimension[] = [
  {
    id: "d1",
    name: "产业阶段判断",
    description: "判断目标赛道当前处于产业周期的哪个阶段，以此决定投资时机和核心风险点",
    priority: "high",
    indicators: [
      {
        id: "i1",
        name: "头部公司盈利状况",
        description: "考察赛道内前 5 家公司是否实现规模化盈利",
        criteria: "超过 3 家盈利 → 成熟期；1-2 家 → 成长期；无盈利 → 早期",
      },
      {
        id: "i2",
        name: "技术标准收敛程度",
        description: "是否出现主导技术路线或行业标准",
        criteria: "标准明确 → 成熟期；2-3 条路线并存 → 成长期；百花齐放 → 早期",
      },
      {
        id: "i3",
        name: "同赛道公司倒闭率",
        description: "过去 12 个月同类公司倒闭比例，用于矫正过度乐观",
        criteria: "超过 30% → 仍在洗牌期，阶段判断需下调一级",
      },
    ],
    experience:
      "在技术赛道，产业阶段判断容易偏乐观。建议同时看\"死亡率\"——过去12个月同类公司倒闭比例超过30%说明仍在洗牌期。此指标已纳入上方判断指标。",
    outputs: [
      { label: "阶段判断结论 + 置信度（高/中/低）", checked: true },
      { label: "该阶段对应的 2-3 个核心假设", checked: true },
      { label: "需要补充的材料清单", checked: true },
    ],
    relations: ["无前置依赖（可独立分析）", "影响 → 竞争格局分析"],
    status: "configured",
    aiGenerated: true,
  },
  {
    id: "d2",
    name: "技术成熟度评估",
    description: "评估核心技术的成熟程度和演进趋势，判断技术风险",
    priority: "high",
    indicators: [
      {
        id: "i4",
        name: "核心技术性能瓶颈",
        description: "是否存在关键技术指标未达商用标准",
        criteria: "无瓶颈 → 成熟；有明确路径 → 成长；基础研究阶段 → 早期",
      },
      {
        id: "i5",
        name: "技术迭代速度",
        description: "核心产品/技术版本更新频率和改进幅度",
        criteria: "季度级更新 → 快速迭代；半年以上 → 稳定/停滞",
      },
      {
        id: "i6",
        name: "开源社区活跃度",
        description: "相关开源项目的贡献者数量和活跃度",
        criteria: "月活贡献者 > 100 → 活跃；10-100 → 一般；< 10 → 冷门",
      },
    ],
    experience:
      "技术成熟度判断不能只看论文和PPT，要关注实际部署案例。建议要求项目方提供至少3个生产环境的部署案例作为验证。",
    outputs: [
      { label: "技术成熟度评级（成熟/成长/早期）", checked: true },
      { label: "关键技术风险清单", checked: true },
      { label: "技术演进路线预判", checked: true },
    ],
    relations: ["依赖 → 产业阶段判断", "影响 → 商业模式可行性"],
    status: "pending",
    aiGenerated: true,
  },
  {
    id: "d3",
    name: "竞争格局分析",
    description: "分析市场竞争态势、市���集中度和融资热度，判断竞争风险",
    priority: "medium",
    indicators: [
      {
        id: "i7",
        name: "市场集中度 CR5",
        description: "前五名企业的市场份额合计",
        criteria: "CR5 > 60% → 寡头格局；30-60% → 竞争期；< 30% → 分散",
      },
      {
        id: "i8",
        name: "近期融资密度",
        description: "过去6个月同赛道融资事件数量和金额",
        criteria: "月均 > 5 起 → 热门赛道；1-5 起 → 温和；< 1 起 → 冷门",
      },
      {
        id: "i9",
        name: "新进入者数量",
        description: "过去12个月新成立的同赛道公司数量",
        criteria: "月均 > 10 家 → 过热；3-10 家 → 活跃；< 3 家 → 冷静",
      },
      {
        id: "i10",
        name: "头部企业护城河",
        description: "头部企业的竞争壁垒类型和强度",
        criteria: "技术+数据双壁垒 → 强；单一壁垒 → 中；无明显壁垒 → 弱",
      },
    ],
    experience:
      "高增长赛道的竞争格局变化很快，不能只看静态数据。建议对比半年前和当前的CR5变化趋势，关注是否在快速集中。",
    outputs: [
      { label: "竞争格局判断（红海/蓝海/蓝转红）", checked: true },
      { label: "主要竞争对手分析", checked: true },
      { label: "目标公司竞争优势评估", checked: true },
    ],
    relations: ["依赖 → 产业阶段判断", "影响 → 商业模式可行性"],
    status: "pending",
    aiGenerated: true,
  },
  {
    id: "d4",
    name: "商业模式可行性",
    description: "验证商业模式的可持续性，重点关注单位经济模型和客户留存",
    priority: "medium",
    indicators: [
      {
        id: "i11",
        name: "单位经济模型",
        description: "LTV/CAC 比值和回收周期",
        criteria: "LTV/CAC > 3 → 健康；1-3 → 待优化；< 1 → 不可持续",
      },
      {
        id: "i12",
        name: "客户留存率",
        description: "月度/年度客户留存率",
        criteria: "年留存 > 80% → 优秀；60-80% → 一般；< 60% → 需关注",
      },
      {
        id: "i13",
        name: "收入增长质量",
        description: "净收入留存率（NDR）和增长来源构成",
        criteria: "NDR > 120% → 优秀；100-120% → 健康；< 100% → 收缩",
      },
    ],
    experience:
      "很多早期项目的单位经济模型是基于补贴后数据，要特别关注去除补贴后的真实LTV/CAC。同时注意区分一次性收入和经常性收入。",
    outputs: [
      { label: "商业模式可持续性评级", checked: true },
      { label: "单位经济模型详细拆解", checked: true },
      { label: "盈利路径和时间预判", checked: true },
    ],
    relations: ["依赖 → 竞争格局分析", "依赖 → 技术成熟度评估"],
    status: "pending",
    aiGenerated: true,
  },
]

function ConfigureDimensions({ onBack, onBackToList, onNext }: { onBack: () => void; onBackToList: () => void; onNext: () => void }) {
  const [dimensions, setDimensions] = useState<ConfigDimension[]>(INITIAL_DIMENSIONS)
  const [activeDimId, setActiveDimId] = useState("d1")

  const activeDim = dimensions.find((d) => d.id === activeDimId) || dimensions[0]

  function updateActiveDim(patch: Partial<ConfigDimension>) {
    setDimensions((prev) =>
      prev.map((d) => (d.id === activeDimId ? { ...d, ...patch } : d))
    )
  }

  function toggleOutput(index: number) {
    const newOutputs = [...activeDim.outputs]
    newOutputs[index] = { ...newOutputs[index], checked: !newOutputs[index].checked }
    updateActiveDim({ outputs: newOutputs })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Top bar */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <nav className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">策略中心</button>
            <span>/</span>
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">分析框架</button>
            <span>/</span>
            <span className="text-[#111827] font-medium">新建框架</span>
          </nav>
          <button className="rounded-lg p-2 text-[#6B7280] hover:bg-white transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-0 mb-6">
          {STEPS.map((step, idx) => {
            const isCompleted = step.num < 3
            const isActive = step.num === 3
            return (
              <div key={step.num} className="flex items-center">
                {idx > 0 && <div className={`mx-2 h-px w-10 ${step.num <= 3 ? "bg-[#2563EB]" : "bg-[#D1D5DB]"}`} />}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isCompleted
                        ? "bg-[#2563EB] text-white"
                        : isActive
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                      }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-6">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
          <p className="text-sm text-[#1E40AF]">
            AI 已根据你的方法论描述和上传文档，生成了 <span className="font-semibold">{dimensions.length} 个分析维度</span>。请逐一审核并编辑。
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left sidebar — dimension list */}
        <div className="w-56 shrink-0 overflow-auto border-r border-[#E5E7EB] bg-white px-4 py-4">
          <p className="mb-3 text-xs font-medium text-[#6B7280] tracking-wide">维度列表</p>
          <div className="space-y-1.5">
            {dimensions.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDimId(d.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${d.id === activeDimId
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#F9FAFB] text-[#374151] hover:bg-[#F3F4F6]"
                  }`}
              >
                <p className={`text-sm font-medium ${d.id === activeDimId ? "text-white" : "text-[#111827]"}`}>
                  {d.name}
                </p>
                <p className={`mt-0.5 text-xs ${d.id === activeDimId ? "text-blue-100" : "text-[#9CA3AF]"}`}>
                  {d.indicators.length} 指标 · {d.status === "configured" ? "已配置" : "待审核"}
                </p>
              </button>
            ))}
          </div>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D1D5DB] py-2.5 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#2563EB] hover:text-[#2563EB]">
            <Plus className="h-3.5 w-3.5" />
            添加维度
          </button>
        </div>

        {/* Right — dimension detail editor */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[#111827]">{activeDim.name}</h2>
              {activeDim.aiGenerated && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">
                  AI 生成
                </span>
              )}
            </div>
            <button className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
              删除此维度
            </button>
          </div>

          {/* 分析目标 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">分析目标</label>
            <textarea
              value={activeDim.description}
              onChange={(e) => updateActiveDim({ description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] leading-relaxed placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
            />
          </div>

          {/* 优先级 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">优先级</label>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as const).map((p) => {
                const labels = { high: "高", medium: "中", low: "低" }
                const isSelected = activeDim.priority === p
                const colors = {
                  high: isSelected ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]",
                  medium: isSelected ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]",
                  low: isSelected ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]",
                }
                return (
                  <button
                    key={p}
                    onClick={() => updateActiveDim({ priority: p })}
                    className={`rounded-lg border px-5 py-1.5 text-sm font-medium transition-colors ${colors[p]}`}
                  >
                    {labels[p]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 判断指标 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#374151]">判断指标</label>
              <button className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                <Plus className="h-3.5 w-3.5" />
                添加指标
              </button>
            </div>
            <div className="space-y-3">
              {activeDim.indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#111827]">{ind.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <button className="hover:text-[#2563EB] transition-colors">编辑</button>
                      <span className="text-[#E5E7EB]">|</span>
                      <button className="hover:text-red-600 transition-colors">删除</button>
                    </div>
                  </div>
                  <p className="text-sm text-[#6B7280] mb-3">{ind.description}</p>
                  <div className="rounded-lg bg-[#F3F4F6] px-3 py-2">
                    <p className="text-xs text-[#6B7280]">
                      <span className="font-medium text-[#374151]">判断标准：</span>
                      {ind.criteria}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 机构经验备注 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">机构经验备注</label>
            <textarea
              value={activeDim.experience}
              onChange={(e) => updateActiveDim({ experience: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#92400E] leading-relaxed placeholder:text-amber-300 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-y"
            />
          </div>

          {/* 输出规范 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#374151] mb-3">
              输出规范（AI 生成策略时必须输出的内容）
            </label>
            <div className="space-y-2">
              {activeDim.outputs.map((o, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleOutput(idx)}
                  className="flex items-center gap-2.5 text-sm text-[#374151] hover:text-[#111827] transition-colors"
                >
                  {o.checked ? (
                    <CheckSquare className="h-4.5 w-4.5 text-[#2563EB] shrink-0" />
                  ) : (
                    <Square className="h-4.5 w-4.5 text-[#D1D5DB] shrink-0" />
                  )}
                  {o.label}
                </button>
              ))}
            </div>
            <button className="mt-2 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              + 添加输出项
            </button>
          </div>

          {/* 与其他维度的关系 */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-[#374151] mb-2">与其他维度的关系</label>
            <div className="flex flex-wrap gap-2">
              {activeDim.relations.map((r, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#374151]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
          >
            返回上一步
          </button>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]">
              保存草稿
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
            >
              下一步: 设定研判规则
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Judgment Rules                                            */
/* ------------------------------------------------------------------ */
interface ExecutionOrder {
  name: string
  level: number
  dependency: string | null
}

interface ConflictRule {
  id: string
  title: string
  description: string
}

interface VetoCondition {
  id: string
  num: number
  description: string
}

const EXECUTION_ORDER: ExecutionOrder[] = [
  { name: "产业阶段判断", level: 1, dependency: null },
  { name: "技术成熟度评估", level: 1, dependency: null },
  { name: "竞争格局分析", level: 2, dependency: "产业阶段判断" },
  { name: "商业模式可行性", level: 2, dependency: null },
]

const CONFLICT_RULES: ConflictRule[] = [
  {
    id: "c1",
    title: "产业阶段 vs 技术成熟度矛盾",
    description:
      "当产业阶段判断为\"早期\"但技术成熟度显示\"已成熟\"时，说明赛道可能处于\"技术成熟但商业化早期\"的特殊阶段。此时应额外关注商业模式风险，增加商业模式相关假设的权重。",
  },
  {
    id: "c2",
    title: "竞争格局 vs 商业模式矛盾",
    description:
      "当竞争格局显示高度集中但商业模式评估为正面时，需验证目标是否为头部公司。非头部公司在集中市场中的商业模式优势不可持续。",
  },
]

const VETO_CONDITIONS: VetoCondition[] = [
  { id: "v1", num: 1, description: "产业阶段判断为衰退期且置信度为高" },
  { id: "v2", num: 2, description: "竞争格局已形成垄断且目标公司非龙头" },
]

const STRATEGY_GUIDE_TEXT = `综合所有维度的判断结果：
1. 假设清单：每个维度产生的假设 + 跨维度冲突产生的额外假设
2. 条款建议：基于各维度识别的风险点，反推需要的保护性条款
3. 材料需求：汇总所有维度标记的"需要补充的材料"，按紧迫程度排序`

/* Build detail data for the newly created framework from step data */
const NEW_FRAMEWORK_DETAIL: FrameworkDetailData = {
  name: "科技成长型框架",
  description: "适用于高成长性科技赛道的投资分析",
  icon: Cpu,
  iconBg: "bg-blue-100 text-blue-600",
  owner: { name: "张伟", initials: "张" },
  createdAt: "2026-03-26",
  updatedAt: "2026-03-26",
  dimensions: INITIAL_DIMENSIONS.map((d) => ({
    name: d.name,
    priority: d.priority,
    description: d.description,
    indicators: d.indicators.map((ind) => ind.name),
    experience: d.experience || null,
    dependency: d.relations.find((r) => r.startsWith("依赖"))?.replace("依赖 → ", "") || null,
  })),
  rules: INITIAL_DIMENSIONS.map((d, idx) => ({
    name: `${d.name}综合判定`,
    description: d.description,
    condition: d.indicators.map((ind) => ind.criteria.split("→")[0].trim()).join(" 且 "),
    weight: idx === 0 ? 30 : idx === 1 ? 25 : idx === 2 ? 25 : 20,
    output: d.outputs[0]?.label || "输出判断结论",
  })),
  strategies: [],
}

const ORIGINAL_FRAMEWORK_DETAIL: FrameworkDetailData = {
  name: "科技成长型框架",
  description: "适用于高成长性科技赛道的投资分析",
  icon: Cpu,
  iconBg: "bg-blue-100 text-blue-600",
  owner: { name: "张伟", initials: "张" },
  createdAt: "2025-12-10",
  updatedAt: "2026-03-20",
  dimensions: DETAIL_DIMENSIONS,
  rules: JUDGMENT_RULES,
  strategies: GENERATED_STRATEGIES,
}

function JudgmentRules({ onBack, onBackToList, onNext }: { onBack: () => void; onBackToList: () => void; onNext: () => void }) {
  const [conflictRules, setConflictRules] = useState(CONFLICT_RULES)
  const [vetoConditions, setVetoConditions] = useState(VETO_CONDITIONS)
  const [strategyGuide, setStrategyGuide] = useState(STRATEGY_GUIDE_TEXT)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Top bar */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <nav className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">策略中心</button>
            <span>/</span>
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">分析框架</button>
            <span>/</span>
            <span className="text-[#111827] font-medium">新建框架</span>
          </nav>
          <button className="rounded-lg p-2 text-[#6B7280] hover:bg-white transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((step, idx) => {
            const isCompleted = step.num < 4
            const isActive = step.num === 4
            return (
              <div key={step.num} className="flex items-center">
                {idx > 0 && <div className={`mx-2 h-px w-10 ${step.num <= 4 ? "bg-[#2563EB]" : "bg-[#D1D5DB]"}`} />}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isCompleted
                        ? "bg-[#2563EB] text-white"
                        : isActive
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                      }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Page title */}
          <h1 className="text-xl font-bold text-[#111827] mb-2">设定综合研判规则</h1>
          <p className="text-sm text-[#6B7280] mb-8">
            定义各维度分析完成后如何综合判断，包括分析顺序、冲突处理和否决条件
          </p>

          {/* Section 1: 分析执行顺序 */}
          <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-[#111827]">分析执行顺序</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">AI 生成</span>
            </div>
            <p className="text-sm text-[#6B7280] mb-5">
              拖拽调整维度的分析顺序，有依赖关系的维度会自动排在被依赖维度之后
            </p>
            <div className="space-y-2">
              {EXECUTION_ORDER.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-xs font-semibold text-[#374151]">
                      {item.level}
                    </span>
                    <span className="text-sm font-medium text-[#111827]">{item.name}</span>
                  </div>
                  <span className={`text-xs ${item.dependency ? "font-medium text-emerald-600" : "text-[#9CA3AF]"}`}>
                    {item.dependency ? `依赖: ${item.dependency}` : "无依赖，可并行"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: 维度冲突处理 */}
          <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[#111827]">维度冲突处理</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">AI 生成</span>
              </div>
              <button className="flex items-center gap-1 text-xs font-medium text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F9FAFB] transition-colors">
                <Plus className="h-3.5 w-3.5" />
                添加规则
              </button>
            </div>
            <div className="space-y-4">
              {conflictRules.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#111827]">{rule.title}</h4>
                    <button className="shrink-0 text-xs text-[#6B7280] hover:text-[#2563EB] transition-colors">编辑</button>
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: 否决条件 */}
          <div className="mb-6 rounded-xl border border-red-200 bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[#111827]">否决条件</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">AI 生成</span>
              </div>
              <button className="flex items-center gap-1 text-xs font-medium text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F9FAFB] transition-colors">
                <Plus className="h-3.5 w-3.5" />
                添加条件
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">
              满足以下任一条件时，AI 将直接建议不投资
            </p>
            <div className="space-y-2">
              {vetoConditions.map((vc) => (
                <div
                  key={vc.id}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-5 py-3.5"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                      {vc.num}
                    </span>
                    <span className="text-sm text-[#374151]">{vc.description}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                    <button className="hover:text-[#2563EB] transition-colors">编辑</button>
                    <span className="text-[#E5E7EB]">|</span>
                    <button className="hover:text-red-600 transition-colors">删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: 策略生成指引 */}
          <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-base font-bold text-[#111827] mb-2">策略生成指引</h2>
            <p className="text-sm text-[#6B7280] mb-4">
              指导 AI 如何将各维度的分析结果转化为最终的三清单
            </p>
            <textarea
              value={strategyGuide}
              onChange={(e) => setStrategyGuide(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111827] leading-relaxed placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
          >
            返回上一步
          </button>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]">
              保存草稿
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
            >
              下一步: 确认并保存
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Confirm & Save                                            */
/* ------------------------------------------------------------------ */
function ConfirmSave({ onBack, onBackToList, onSave }: { onBack: () => void; onBackToList: () => void; onSave: () => void }) {
  // Summary stats from the configured dimensions
  const totalDimensions = INITIAL_DIMENSIONS.length
  const totalIndicators = INITIAL_DIMENSIONS.reduce((sum, d) => sum + d.indicators.length, 0)
  const totalConflictRules = CONFLICT_RULES.length
  const totalVetoConditions = VETO_CONDITIONS.length

  const dimensions = INITIAL_DIMENSIONS

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Top bar */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <nav className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">策略中心</button>
            <span>/</span>
            <button onClick={onBackToList} className="hover:text-[#6B7280] transition-colors">分析框架</button>
            <span>/</span>
            <span className="text-[#111827] font-medium">新建框架</span>
          </nav>
          <button className="rounded-lg p-2 text-[#6B7280] hover:bg-white transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((step, idx) => {
            const isCompleted = step.num < 5
            const isActive = step.num === 5
            return (
              <div key={step.num} className="flex items-center">
                {idx > 0 && <div className="mx-2 h-px w-10 bg-[#2563EB]" />}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isCompleted
                        ? "bg-[#2563EB] text-white"
                        : isActive
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#D1D5DB] bg-white text-[#9CA3AF]"
                      }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Page title */}
          <h1 className="text-xl font-bold text-[#111827] mb-2">确认分析框架</h1>
          <p className="text-sm text-[#6B7280] mb-8">
            请确认以下内容无误后保存，保存后仍可随时编辑
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "分析维度", value: totalDimensions },
              { label: "判断指标", value: totalIndicators },
              { label: "冲突规则", value: totalConflictRules },
              { label: "否决条件", value: totalVetoConditions },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4">
                <p className="text-xs text-[#6B7280] mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Section 1: 基本信息 */}
          <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-bold text-[#111827]">科技成长型框架</h2>
              <button className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">编辑基本信息</button>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">适用于高成长性科技赛道的投资分析</p>
            <div className="flex gap-2">
              {["科技", "成长期", "PE"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#374151]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Section 2: 分析维度总览 */}
          <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#111827]">分析维度总览</h2>
              <button className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">返回编辑</button>
            </div>
            <div className="space-y-2">
              {dimensions.map((d) => {
                const priorityLabels = { high: "高", medium: "中", low: "低" }
                const priorityColors = {
                  high: "text-red-600 bg-red-50 border-red-200",
                  medium: "text-amber-600 bg-amber-50 border-amber-200",
                  low: "text-green-600 bg-green-50 border-green-200",
                }
                const dep = d.relations.find((r) => r.startsWith("依赖"))
                const depName = dep ? dep.replace("依赖 → ", "") : null
                const level = depName ? 2 : 1
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-xs font-semibold text-[#374151]">
                        {level}
                      </span>
                      <span className="text-sm font-bold text-[#111827]">{d.name}</span>
                      {depName && (
                        <span className="text-xs font-medium text-emerald-600">
                          依赖: {depName.replace("分析", "").replace("评估", "")}
                        </span>
                      )}
                      <span className="text-xs text-[#9CA3AF]">{d.indicators.length} 指标</span>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityColors[d.priority]}`}>
                      {priorityLabels[d.priority]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 3: 研判规则与否决条件 */}
          <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#111827]">研判规则与否决条件</h2>
              <button className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">返回编辑</button>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">
              {totalConflictRules} 条冲突处理规则 · {totalVetoConditions} 条否决条件 · 已配置策略生成指引
            </p>
            <div className="flex flex-wrap gap-2">
              {VETO_CONDITIONS.map((vc) => (
                <span
                  key={vc.id}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600"
                >
                  否决: {vc.description.length > 12 ? vc.description.substring(0, 12).replace(/且$/, "") : vc.description}
                </span>
              ))}
            </div>
          </div>

          {/* AI Completeness Check */}
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-sm font-bold text-[#92400E] mb-3">AI 完整性检查</h3>
            <div className="space-y-2">
              {[
                { ok: true, text: "所有维度都配置了判断指标" },
                { ok: true, text: "维度依赖关系无循环" },
                { ok: true, text: "否决条件引用的维度均已配置" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-[#374151]">{item.text}</span>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-[#374151]">
                  &quot;商业模式可行性&quot;维度未添加机构经验备注（建议补充）
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]"
          >
            返回上一步
          </button>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]">
              保存为草稿
            </button>
            <button
              onClick={onSave}
              className="rounded-lg bg-[#1F2937] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#111827]"
            >
              确认保存框架
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
type FrameworkView = "list" | "detail" | "create" | "describe" | "configure" | "judgment" | "confirm"

const NEW_FRAMEWORK: AnalysisFramework = {
  id: "af-new",
  name: "科技成长型框架",
  description: "适用于高成长性科技赛道的投资分析",
  dimensions: ["产业阶段判断", "技术成熟度评估", "竞争格局分析", "商业模式可行性"],
  owner: { name: "张伟", initials: "张" },
  updatedAt: "2026-03-26",
  icon: Cpu,
  iconBg: "bg-blue-100 text-blue-600",
  dimensionCount: 4,
  usedByStrategies: 0,
}

export function AnalysisFrameworks({
  createdFrameworks = [],
  onCreatedFrameworksChange,
}: {
  createdFrameworks?: AnalysisFramework[]
  onCreatedFrameworksChange?: (frameworks: AnalysisFramework[]) => void
}) {
  const [search, setSearch] = useState("")
  const [view, setView] = useState<FrameworkView>("list")
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string | null>(null)

  function handleSaveFramework() {
    const already = createdFrameworks.some((f) => f.id === NEW_FRAMEWORK.id)
    if (!already) {
      onCreatedFrameworksChange?.([NEW_FRAMEWORK, ...createdFrameworks])
    }
    setView("list")
  }

  function handleOpenDetail(frameworkId: string) {
    setSelectedFrameworkId(frameworkId)
    setView("detail")
  }

  const allFrameworks = [...createdFrameworks, ...FRAMEWORKS]
  const filtered = allFrameworks.filter(
    (f) => f.name.includes(search) || f.description.includes(search)
  )

  if (view === "detail") {
    const detailData = selectedFrameworkId === "af-new" ? NEW_FRAMEWORK_DETAIL : ORIGINAL_FRAMEWORK_DETAIL
    return <FrameworkDetail onBack={() => setView("list")} data={detailData} />
  }

  if (view === "confirm") {
    return <ConfirmSave onBack={() => setView("judgment")} onBackToList={() => setView("list")} onSave={handleSaveFramework} />
  }

  if (view === "judgment") {
    return <JudgmentRules onBack={() => setView("configure")} onBackToList={() => setView("list")} onNext={() => setView("confirm")} />
  }

  if (view === "configure") {
    return <ConfigureDimensions onBack={() => setView("describe")} onBackToList={() => setView("list")} onNext={() => setView("judgment")} />
  }

  if (view === "describe") {
    return <DescribeMethodology onBack={() => setView("create")} onBackToList={() => setView("list")} onNext={() => setView("configure")} />
  }

  if (view === "create") {
    return <CreateFrameworkPicker onBack={() => setView("list")} onNext={() => setView("describe")} />
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] shadow-lg shadow-blue-200/50">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827]">分析框架</h1>
              <p className="mt-0.5 text-sm text-[#6B7280]">
                定义你的投资方法论，用于驱动 AI 生成投资策略
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                placeholder="搜索框架..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9 bg-white border-[#E5E7EB]"
              />
            </div>
            <span className="text-sm text-[#6B7280]">
              共 <span className="font-medium text-[#111827]">{filtered.length}</span> 个框架
            </span>
            <button
              onClick={() => setView("create")}
              className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200/50 transition-colors hover:bg-[#1D4ED8]"
            >
              <Plus className="h-4 w-4" />
              新建框架
            </button>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((framework) => {
            const Icon = framework.icon
            return (
              <button
                key={framework.id}
                onClick={() => handleOpenDetail(framework.id)}
                className="group flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-6 text-left transition-all hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-[#2563EB]/5"
              >
                {/* Icon */}
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${framework.iconBg} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {createdFrameworks.some((f) => f.id === framework.id) && (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 border border-emerald-200">新建</span>
                  )}
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-semibold text-[#111827] mb-1">
                  {framework.name}
                </h3>
                <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
                  {framework.description}
                </p>

                {/* Dimensions */}
                <div className="mb-4">
                  <p className="text-[11px] font-medium text-[#9CA3AF] mb-2">分析维度</p>
                  <div className="flex flex-wrap gap-1.5">
                    {framework.dimensions.map((dim) => (
                      <span
                        key={dim}
                        className="inline-flex rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-xs text-[#374151]"
                      >
                        {dim}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2 mb-4">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-[#E5E7EB] text-[9px] text-[#374151]">
                      {framework.owner.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-[#6B7280]">负责人: {framework.owner.name}</span>
                </div>

                {/* Stats Row */}
                <div className="mt-auto grid grid-cols-3 gap-3 rounded-lg bg-[#F9FAFB] p-3">
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">维度数</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {framework.dimensionCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">关联策略</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {framework.usedByStrategies}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9CA3AF]">更新时间</p>
                    <p className="text-sm font-semibold text-[#111827]">
                      {framework.updatedAt.slice(5)}
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
