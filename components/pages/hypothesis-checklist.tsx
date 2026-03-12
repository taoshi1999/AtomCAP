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
  X,
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
export interface HypothesisTableItem {
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
    qaId: "QA-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "verified",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "vp1",
        title: "价值点1",
        evidence: {
          description: "创始人拥有博士学位，在AI领域发表过15篇高质量学术论文",
          files: [
            { name: "闫俊杰_CV.pdf", size: "2.4 MB", date: "2024-01-18" },
            { name: "Google Scholar 引用数据.xlsx", size: "1.8 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "创始人拥有博士学位，为该领域高学历人才。在人工智能领域发表过15篇高质量学术论文，其中5篇发表在顶级期刊上。曾获得国家自然科学基金青年项目资助，具备扎实的理论基础和研究能力。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu, PEOPLE.chenzong],
          createdAt: "2024-01-18",
        },
        comments: [
          { author: "王五", content: "建议补充创始人在工业界的实际项目经验资料", time: "2024-01-19 14:30" },
        ],
      },
      {
        id: "vp2",
        title: "价值点2",
        evidence: {
          description: "在Google Scholar上的H指数为8，总引用次数超过500次，证明其研究成果具有较高的学术影响力",
          files: [
            { name: "学术影响力报告.pdf", size: "3.1 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "H指数达到8，在同龄学者中处于较高水平。其研究成果被多家知名企业引用并应用于实际产品中，证明其学术研究具有很高的实用价值。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.zhaoliu],
          createdAt: "2024-01-19",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "风险点1",
        evidence: {
          description: "学术背景较强但商业转化经验相对有限，需关注从学术到产业的过渡能力",
          files: [
            { name: "行业对标分析.pdf", size: "1.5 MB", date: "2024-01-20" },
          ],
        },
        analysis: {
          content: "创始人在商业化方面的经验主要集中在技术转让和专利授权领域，尚未有过完整的产品商业化经历。建议关注其团队中是否有强有力的商业运营搭档补足这一短板。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu],
          createdAt: "2024-01-20",
        },
        comments: [
          { author: "张伟", content: "同意这一风险评估，COO张鹏的加入在一定程度上弥补了这一缺陷", time: "2024-01-20 16:00" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "假设成立",
      status: "approved",
      content: "经投委会审议，创始人的学术背景得到充分验证，其在AI领域的研究深度和影响力均达到行业领先水平。虽然商业化经验存在一定风险，但团队整体配置可以弥补。建议持续跟踪其商业化进展。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2024-01-22",
      comments: [
        { author: "张伟", content: "同意投委结论，建议在条款中加入创始人竞业禁止条款", time: "2024-01-22 15:00" },
      ],
    },
    verification: {
      conclusion: "假设已验证",
      status: "confirmed",
      content: "投资后6个月跟踪显示，创始人的学术背景为公司招募顶级人才提供了重要背书，已成功吸引多名顶级学者加入。技术团队在大模型训练优化方面取得突破性进展，与创始人的学术积累密切相关。",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-07-15",
      comments: [],
    },
    linkedTerms: [
      { id: "lt1", title: "投资方有权委派一名董事进入公司董事会", termId: "TM-2024-001", status: "approved" },
      { id: "lt2", title: "投资方有权委派一名观察员列席董事会会议", termId: "TM-2024-002", status: "approved" },
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
/*  AI基础设施策略模板假设数据                                          */
/* ------------------------------------------------------------------ */
const aiInfrastructureHypotheses: HypothesisTableItem[] = [
  {
    id: "ai-h1",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "国产AI芯片在推理场景下可替代英伟达方案",
    owner: "张伟",
    createdAt: "2026-01-10",
    updatedAt: "2026-02-15",
    status: "pending",
  },
  {
    id: "ai-h2",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "云端AI芯片市场将在3年内达到500亿美元规模",
    owner: "李四",
    createdAt: "2026-01-12",
    updatedAt: "2026-02-18",
    status: "pending",
  },
  {
    id: "ai-h3",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "开源大模型训练框架将成为主流技术路线",
    owner: "王五",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    status: "pending",
  },
  {
    id: "ai-h4",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "分布式训练效率提升是大模型竞争关键",
    owner: "张伟",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-22",
    status: "pending",
  },
  {
    id: "ai-h5",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "AI编译器将成为新的基础软件投资赛道",
    owner: "李四",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-25",
    status: "pending",
  },
  {
    id: "ai-h6",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "MLOps平台市场需求将快速增长",
    owner: "王五",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
  },
  {
    id: "ai-h7",
    direction: "团队能力",
    category: "创始人",
    name: "创始人具备丰富的AI产品商业化经验。",
    owner: "王五",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回指定策略模板的假设列表，全部状态重置为"待验证" */
export function getTemplateHypothesesForStrategy(strategyId: string): HypothesisTableItem[] {
  if (strategyId === "1") {
    return aiInfrastructureHypotheses.map((h) => ({ ...h, status: "pending" as const }))
  }
  return []
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisChecklistProps {
  isNewProject?: boolean
  project?: { strategyId?: string; strategyName?: string }
  inheritedHypotheses?: HypothesisTableItem[]
}

export function HypothesisChecklist({ isNewProject = false, project, inheritedHypotheses }: HypothesisChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showTemplateBanner, setShowTemplateBanner] = useState(true)

  // Priority: inherited (from approved project) > template > existing mock data
  const sourceData = inheritedHypotheses
    ? inheritedHypotheses
    : isNewProject && project?.strategyId === "1"
      ? aiInfrastructureHypotheses
      : hypothesisTableData

  // Filter data
  const filteredData = sourceData.filter((item) => {
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

  // For new projects without a strategy template, show empty state
  if (isNewProject && !project?.strategyId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <ListChecks className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的项目，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个假设
          </button>
        </div>
      </div>
    )
  }

  // Detail view - shows hypothesis details when a row is selected
  if (showDetail && selectedDetail) {
    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-sm text-[#6B7280]">
            <button onClick={handleBackToList} className="hover:text-[#2563EB] transition-colors">
              项目库
            </button>
            <ChevronRight className="h-4 w-4" />
            <button onClick={handleBackToList} className="hover:text-[#2563EB] transition-colors">
              MiniMax
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-[#111827]">假设清单</span>
          </div>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              <Badge className="bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]">成立</Badge>
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              ID: {selectedDetail.qaId} | 创建时间: {selectedDetail.createdAt} | 更新时间: {selectedDetail.updatedAt}
            </p>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-[#2563EB] flex items-center justify-center">
                <span className="text-[10px] text-white font-medium">
                  {selectedDetail.creator.name.slice(0, 1)}
                </span>
              </div>
              <span className="text-sm text-[#6B7280]">创建者: {selectedDetail.creator.name}</span>
            </div>
          </div>

          {/* Value points section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#22C55E]" />
              <h2 className="text-base font-semibold text-[#22C55E]">价值点</h2>
            </div>
            {selectedDetail.valuePoints.map((vp) => (
              <div key={vp.id} className="bg-white rounded-xl border border-[#E5E7EB] mb-4 overflow-hidden">
                <div className="border-l-4 border-[#22C55E] p-5">
                  <h3 className="font-semibold text-[#22C55E] mb-3">{vp.title}</h3>

                  {/* Evidence */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论据支持</p>
                    <p className="text-sm text-[#111827] mb-3">{vp.evidence.description}</p>
                    {vp.evidence.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                        <FileText className="h-4 w-4 text-[#2563EB]" />
                        <span className="text-sm text-[#2563EB]">{file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Analysis */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论证分析</p>
                    <div className="p-3 bg-[#F9FAFB] rounded-lg">
                      <p className="text-sm text-[#374151] leading-relaxed">{vp.analysis.content}</p>
                    </div>
                  </div>

                  {/* Creator & Reviewers */}
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{vp.analysis.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {vp.analysis.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {vp.analysis.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{vp.analysis.createdAt}</span>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {vp.comments.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-[#6B7280]">{c.author.slice(0, 1)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#111827]">{c.author}</span>
                            <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                          </div>
                          <p className="text-sm text-[#374151]">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="添加评论..."
                        className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      />
                      <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Risk points section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#EF4444]" />
              <h2 className="text-base font-semibold text-[#EF4444]">风险点</h2>
            </div>
            {selectedDetail.riskPoints.map((rp) => (
              <div key={rp.id} className="bg-white rounded-xl border border-[#E5E7EB] mb-4 overflow-hidden">
                <div className="border-l-4 border-[#EF4444] p-5">
                  <h3 className="font-semibold text-[#EF4444] mb-3">{rp.title}</h3>

                  {/* Evidence */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论据支持</p>
                    <p className="text-sm text-[#111827] mb-3">{rp.evidence.description}</p>
                    {rp.evidence.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                        <FileText className="h-4 w-4 text-[#2563EB]" />
                        <span className="text-sm text-[#2563EB]">{file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Analysis */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论证分析</p>
                    <div className="p-3 bg-[#F9FAFB] rounded-lg">
                      <p className="text-sm text-[#374151] leading-relaxed">{rp.analysis.content}</p>
                    </div>
                  </div>

                  {/* Creator & Reviewers */}
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{rp.analysis.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {rp.analysis.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {rp.analysis.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{rp.analysis.createdAt}</span>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {rp.comments.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-[#6B7280]">{c.author.slice(0, 1)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#111827]">{c.author}</span>
                            <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                          </div>
                          <p className="text-sm text-[#374151]">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="添加评论..."
                        className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      />
                      <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Committee decision section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#2563EB]" />
              <h2 className="text-base font-semibold text-[#2563EB]">投委决议</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="border-l-4 border-[#2563EB] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[#111827]">投委会审议结果</h3>
                  <Badge className="bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]">
                    {selectedDetail.committeeDecision.conclusion}
                  </Badge>
                </div>

                <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                  <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.committeeDecision.content}</p>
                </div>

                {/* Creator & Reviewers */}
                <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                  <div className="flex items-center gap-1">
                    <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                      <span className="text-[8px] text-white">{selectedDetail.committeeDecision.creator.name.slice(0, 1)}</span>
                    </div>
                    <span>创建: {selectedDetail.committeeDecision.creator.name}</span>
                  </div>
                  <span>审批:</span>
                  {selectedDetail.committeeDecision.reviewers.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                        <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                      </div>
                      <span>{r.name}</span>
                    </div>
                  ))}
                  <span>{selectedDetail.committeeDecision.createdAt}</span>
                </div>

                {/* Comments */}
                <div>
                  <p className="text-xs text-[#6B7280] mb-2">评论</p>
                  {selectedDetail.committeeDecision.comments.map((c, idx) => (
                    <div key={idx} className="flex items-start gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-[#6B7280]">{c.author.slice(0, 1)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#111827]">{c.author}</span>
                          <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                        </div>
                        <p className="text-sm text-[#374151]">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="添加评论..."
                      className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    />
                    <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#8B5CF6]" />
              <h2 className="text-base font-semibold text-[#8B5CF6]">验证情况</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="border-l-4 border-[#8B5CF6] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[#111827]">投后验证评估</h3>
                  <Badge className="bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]">
                    {selectedDetail.verification.conclusion}
                  </Badge>
                </div>

                <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                  <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.verification.content}</p>
                </div>

                {/* Creator & Reviewers */}
                <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                  <div className="flex items-center gap-1">
                    <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                      <span className="text-[8px] text-white">{selectedDetail.verification.creator.name.slice(0, 1)}</span>
                    </div>
                    <span>创建: {selectedDetail.verification.creator.name}</span>
                  </div>
                  <span>审批:</span>
                  {selectedDetail.verification.reviewers.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                        <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                      </div>
                      <span>{r.name}</span>
                    </div>
                  ))}
                  <span>{selectedDetail.verification.createdAt}</span>
                </div>

                {/* Comments */}
                <div>
                  <p className="text-xs text-[#6B7280] mb-2">评论</p>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="添加评论..."
                      className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    />
                    <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linked terms section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#6B7280]" />
              <h2 className="text-base font-semibold text-[#111827]">该假设所支持的条款</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="space-y-3">
                {selectedDetail.linkedTerms.map((term) => (
                  <div key={term.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-4 w-4 text-[#6B7280]" />
                      <div>
                        <span className="text-sm text-[#111827]">{term.title}</span>
                        <p className="text-xs text-[#9CA3AF]">ID: {term.termId}</p>
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-xs",
                      term.status === "approved"
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : term.status === "rejected"
                          ? "bg-[#FEE2E2] text-[#991B1B]"
                          : "bg-[#FEF3C7] text-[#92400E]"
                    )}>
                      {term.status === "approved" ? "通过" : term.status === "rejected" ? "拒绝" : "待审"}
                    </Badge>
                  </div>
                ))}
              </div>
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
        {/* Strategy template banner for new projects */}
        {isNewProject && project?.strategyName && showTemplateBanner && (
          <div className="mb-4 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] p-4 relative">
            <button
              onClick={() => setShowTemplateBanner(false)}
              className="absolute top-3 right-3 p-1 rounded-md text-[#3B82F6] hover:bg-[#DBEAFE] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 pr-8">
              <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
                <ListChecks className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1E40AF]">
                  基于「{project.strategyName}」策略模板
                </p>
                <p className="text-xs text-[#3B82F6]">
                  以下假设清单继承自所选策略模板，您可以根据项目实际情况进行调整
                </p>
              </div>
            </div>
          </div>
        )}

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
