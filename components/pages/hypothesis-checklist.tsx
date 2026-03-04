"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  ListChecks,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Plus,
  Link2,
  FileCheck,
  ArrowLeft,
  Eye,
  Trash2,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
interface HypothesisTableItem {
  id: string
  direction: string  // 假设方向 (一级类目)
  category: string   // 假设类别 (二级类目)
  name: string       // 假设名称
  owner: string      // 负责人
  createdAt: string  // 创建时间
  updatedAt: string  // 更改时间
  status: "verified" | "pending" | "risky"
}

interface PersonInfo {
  name: string
  role: string
  avatar?: string
}

interface ValuePoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface RiskPoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface CommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface Verification {
  conclusion: string
  status: "confirmed" | "invalidated" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface LinkedTerm {
  id: string
  title: string
  termId: string
  status: "approved" | "pending" | "rejected"
}

interface HypothesisDetail {
  id: string
  title: string
  qaId: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
  creator: PersonInfo
  valuePoints: ValuePoint[]
  riskPoints: RiskPoint[]
  committeeDecision: CommitteeDecision
  verification: Verification
  linkedTerms: LinkedTerm[]
}

/* ------------------------------------------------------------------ */
/*  Mock people                                                        */
/* ------------------------------------------------------------------ */
const PEOPLE: Record<string, PersonInfo> = {
  zhangwei: { name: "张伟", role: "投资经理" },
  lisi: { name: "李四", role: "高级分析师" },
  wangwu: { name: "王五", role: "合伙人" },
  wangzong: { name: "王总", role: "投委会主席" },
  chenzong: { name: "陈总", role: "风控总监" },
  zhaoliu: { name: "赵六", role: "法务顾问" },
}

/* ------------------------------------------------------------------ */
/*  Mock data - table items                                            */
/* ------------------------------------------------------------------ */
const hypothesisTableData: HypothesisTableItem[] = [
  {
    id: "tech-bg",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人闫俊杰具有扎实的人工智能学术背景",
    owner: "张伟",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "verified",
  },
  {
    id: "biz-exp",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人具备丰富的AI产品商业化经验",
    owner: "李四",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-18",
    status: "pending",
  },
  {
    id: "leadership",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人展现出强大的团队凝聚力和战略规划能力",
    owner: "张伟",
    createdAt: "2024-01-16",
    updatedAt: "2024-02-19",
    status: "pending",
  },
  {
    id: "tech-team",
    direction: "团队与组织能力",
    category: "核心团队",
    name: "技术团队在大模型训练和推理优化方面具备业界领先水平",
    owner: "王五",
    createdAt: "2024-01-17",
    updatedAt: "2024-02-21",
    status: "pending",
  },
  {
    id: "market-team",
    direction: "团队与组织能力",
    category: "核心团队",
    name: "市场团队拥有深厚的企业客户资源和渠道网络",
    owner: "李四",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "pending",
  },
  {
    id: "tam",
    direction: "市场机会",
    category: "市场规模",
    name: "中国大模型市场总规模在2025年将达到500亿元",
    owner: "张伟",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "pending",
  },
  {
    id: "sam",
    direction: "市场机会",
    category: "市场规模",
    name: "企业级AI应用市场可服务规模达到200亿元",
    owner: "李四",
    createdAt: "2024-01-21",
    updatedAt: "2024-02-26",
    status: "risky",
  },
  {
    id: "som",
    direction: "市场机会",
    category: "市场规模",
    name: "MiniMax可触达市场规模约50亿元",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-27",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - detail                                                 */
/* ------------------------------------------------------------------ */
const hypothesisDetails: Record<string, HypothesisDetail> = {
  "tech-bg": {
    id: "tech-bg",
    title: "创始人闫俊杰具有扎实的人工智能学术背景",
    qaId: "H-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "verified",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "vp1",
        title: "清华大学计算机系博士学位",
        evidence: {
          description: "创始人毕业于清华大学计算机系,获得博士学位,专注于自然语言处理研究方向。",
          files: [
            { name: "学历证明.pdf", size: "1.2MB", date: "2024-01-10" },
            { name: "学术论文列表.xlsx", size: "156KB", date: "2024-01-10" },
          ],
        },
        analysis: {
          content: "闫俊杰博士的学术背景为公司的技术研发提供了坚实的理论基础。他在NLP领域发表的多篇顶会论文证明了其学术造诣。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
          createdAt: "2024-01-15",
        },
        comments: [
          { author: "李四", content: "建议补充博士期间的具体研究成果", time: "2024-01-16 10:30" },
          { author: "张伟", content: "已添加论文列表作为支撑材料", time: "2024-01-16 14:20" },
        ],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "学术背景向商业转化的不确定性",
        evidence: {
          description: "创始人此前主要在学术界工作,直接商业化经验有限。",
          files: [
            { name: "职业经历调查.pdf", size: "890KB", date: "2024-01-12" },
          ],
        },
        analysis: {
          content: "虽然学术背景扎实,但需要关注其商业化执行能力。建议通过后续的商业化经验假设进行补充验证。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-01-16",
        },
        comments: [
          { author: "王五", content: "同意,商业化能力需要单独评估", time: "2024-01-17 09:15" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "假设成立",
      status: "approved",
      content: "经投委会讨论,一致认可创始人的学术背景,该假设可作为投资决策的正向支撑因素。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhaoliu],
      createdAt: "2024-02-01",
      comments: [
        { author: "陈总", content: "风控角度无异议", time: "2024-02-01 16:00" },
      ],
    },
    verification: {
      conclusion: "已验证",
      status: "confirmed",
      content: "通过背景调查和第三方核实,确认创始人学历真实有效,学术成果获得业界认可。",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi],
      createdAt: "2024-02-20",
      comments: [],
    },
    linkedTerms: [
      { id: "lt1", title: "创始人锁定条款", termId: "founder-lock", status: "approved" },
      { id: "lt2", title: "关键人条款", termId: "key-man", status: "pending" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig = {
  verified: { label: "已验证", color: "bg-[#DCFCE7] text-[#166534]" },
  pending: { label: "待验证", color: "bg-[#FEF3C7] text-[#92400E]" },
  risky: { label: "有风险", color: "bg-[#FEE2E2] text-[#991B1B]" },
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisChecklistProps {
  isNewProject?: boolean
  project?: { strategyId?: string; strategyName?: string }
}

export function HypothesisChecklist({ isNewProject = false, project }: HypothesisChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Filter data
  const filteredData = hypothesisTableData.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  // Get detail for selected item
  const selectedDetail = selectedId ? hypothesisDetails[selectedId] : null

  // Handle view detail
  function handleViewDetail(id: string) {
    setSelectedId(id)
    setShowDetail(true)
  }

  // Handle back to list
  function handleBackToList() {
    setShowDetail(false)
    setSelectedId(null)
  }

  // Handle delete
  function handleDelete(id: string) {
    // In real app, this would call an API
    console.log("[v0] Delete hypothesis:", id)
  }

  // For new projects without AI基础设施 strategy, show empty state
  if (isNewProject && project?.strategyId !== "1") {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <ListChecks className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            {project?.strategyName 
              ? `该项目基于「${project.strategyName}」策略模板创建，假设清单将从策略模板中继承。`
              : "这是一个新创建的项目，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。"
            }
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个假设
          </button>
        </div>
      </div>
    )
  }

  // Detail view
  if (showDetail && selectedDetail) {
    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Back button */}
          <button
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回假设清单
          </button>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={cn("text-xs", statusConfig[selectedDetail.status].color)}>
                    {statusConfig[selectedDetail.status].label}
                  </Badge>
                  <span className="text-xs text-[#6B7280]">{selectedDetail.qaId}</span>
                </div>
                <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <span>创建人: {selectedDetail.creator.name}</span>
              <span>创建时间: {selectedDetail.createdAt}</span>
              <span>更新时间: {selectedDetail.updatedAt}</span>
            </div>
          </div>

          {/* Value points */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">价值点</h2>
            {selectedDetail.valuePoints.map((vp) => (
              <div key={vp.id} className="border-l-4 border-[#22C55E] pl-4 py-3 mb-4 last:mb-0">
                <h3 className="font-medium text-[#111827] mb-2">{vp.title}</h3>
                <p className="text-sm text-[#6B7280] mb-3">{vp.evidence.description}</p>
                <div className="text-sm text-[#6B7280]">
                  <span>分析: {vp.analysis.content}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Risk points */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">风险点</h2>
            {selectedDetail.riskPoints.map((rp) => (
              <div key={rp.id} className="border-l-4 border-[#EF4444] pl-4 py-3 mb-4 last:mb-0">
                <h3 className="font-medium text-[#111827] mb-2">{rp.title}</h3>
                <p className="text-sm text-[#6B7280] mb-3">{rp.evidence.description}</p>
                <div className="text-sm text-[#6B7280]">
                  <span>分析: {rp.analysis.content}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Committee decision */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">投委会决策</h2>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={cn(
                "text-xs",
                selectedDetail.committeeDecision.status === "approved" 
                  ? "bg-[#DCFCE7] text-[#166534]"
                  : selectedDetail.committeeDecision.status === "rejected"
                    ? "bg-[#FEE2E2] text-[#991B1B]"
                    : "bg-[#FEF3C7] text-[#92400E]"
              )}>
                {selectedDetail.committeeDecision.conclusion}
              </Badge>
            </div>
            <p className="text-sm text-[#6B7280]">{selectedDetail.committeeDecision.content}</p>
          </div>

          {/* Verification */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">验证结论</h2>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={cn(
                "text-xs",
                selectedDetail.verification.status === "confirmed" 
                  ? "bg-[#DCFCE7] text-[#166534]"
                  : selectedDetail.verification.status === "invalidated"
                    ? "bg-[#FEE2E2] text-[#991B1B]"
                    : "bg-[#FEF3C7] text-[#92400E]"
              )}>
                {selectedDetail.verification.conclusion}
              </Badge>
            </div>
            <p className="text-sm text-[#6B7280]">{selectedDetail.verification.content}</p>
          </div>

          {/* Linked terms */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">关联条款</h2>
            <div className="space-y-2">
              {selectedDetail.linkedTerms.map((term) => (
                <div key={term.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-[#6B7280]" />
                    <span className="text-sm text-[#111827]">{term.title}</span>
                  </div>
                  <Badge className={cn(
                    "text-xs",
                    term.status === "approved" 
                      ? "bg-[#DCFCE7] text-[#166534]"
                      : term.status === "rejected"
                        ? "bg-[#FEE2E2] text-[#991B1B]"
                        : "bg-[#FEF3C7] text-[#92400E]"
                  )}>
                    {term.status === "approved" ? "已批准" : term.status === "rejected" ? "已拒绝" : "待审批"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Table view
  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">假设清单</h1>
            <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪项目投资假设</p>
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
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4 mr-2" />
              新建假设
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E3A5F] text-white">
                <th className="px-4 py-3 text-left text-sm font-medium">假设方向</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设类别</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设名称</th>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#111827]">{item.name}</span>
                      <Badge className={cn("text-[10px]", statusConfig[item.status].color)}>
                        {statusConfig[item.status].label}
                      </Badge>
                    </div>
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
              <ListChecks className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的假设</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
