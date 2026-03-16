"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  Plus,
  Link2,
  Eye,
  Trash2,
  User,
  X,
  ChevronRight,
  Send,
  Target,
  FileCheck,
  AlertTriangle,
  Shield,
  Handshake,
  CheckCircle,
  ClipboardCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
export interface TermTableItem {
  id: string
  direction: string  // 条款方向 (一级类目)
  category: string   // 条款类别 (二级类目)
  name: string       // 条款名称
  owner: string      // 负责人
  createdAt: string  // 创建时间
  updatedAt: string  // 更改时间
  status: "approved" | "pending" | "rejected"
}

interface PersonInfo {
  name: string
  role: string
}

interface LinkedHypothesis {
  id: string
  title: string
  status: "verified" | "pending" | "risky"
}

interface SectionContent {
  content: string
  files?: { name: string; size: string; date: string }[]
  linkedHypotheses?: LinkedHypothesis[]
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface NegotiationResult {
  conclusion: string
  status: "agreed" | "partial" | "rejected"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface ImplementationStatus {
  status: "implemented" | "in-progress" | "not-started"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

export interface TermDetail {
  id: string
  title: string
  termId: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
  creator: PersonInfo
  ourDemand: SectionContent           // 我方诉求
  ourBasis: SectionContent            // 我方依据
  bilateralConflict: SectionContent   // 双方冲突
  ourBottomLine: SectionContent       // 我方底线
  compromiseSpace: SectionContent     // 妥协空间
  negotiationResult: NegotiationResult // 谈判结果
  implementationStatus: ImplementationStatus // 落实情况
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
const termTableData: TermTableItem[] = [
  {
    id: "board-seat",
    direction: "控制权条款",
    category: "董事会条款",
    name: "投资方有权委派一名董事进入公司董事会",
    owner: "张伟",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "approved",
  },
  {
    id: "observer-right",
    direction: "控制权条款",
    category: "董事会条款",
    name: "投资方有权委派一名观察员列席董事会会议",
    owner: "李四",
    createdAt: "2024-01-16",
    updatedAt: "2024-02-21",
    status: "approved",
  },
  {
    id: "major-veto",
    direction: "控制权条款",
    category: "否决权条款",
    name: "对公司章程修改、增减注册资本等重大事项享有一票否决权",
    owner: "王五",
    createdAt: "2024-01-17",
    updatedAt: "2024-02-22",
    status: "pending",
  },
  {
    id: "related-party-veto",
    direction: "控制权条款",
    category: "否决权条款",
    name: "对超过100万元的关联交易享有否决权",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-23",
    status: "pending",
  },
  {
    id: "liquidation-pref",
    direction: "经济条款",
    category: "清算优先权",
    name: "投资方有权优先于普通股股东获得投资金额1.5倍的回报",
    owner: "李四",
    createdAt: "2024-01-19",
    updatedAt: "2024-02-24",
    status: "approved",
  },
  {
    id: "participation",
    direction: "经济条款",
    category: "清算优先权",
    name: "投资方在获得优先清算后可参与剩余资产的按比例分配",
    owner: "王五",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "approved",
  },
  {
    id: "weighted-average",
    direction: "经济条款",
    category: "反稀释保护",
    name: "采用加权平均反稀释公式保护投资方股权比例",
    owner: "张伟",
    createdAt: "2024-01-21",
    updatedAt: "2024-02-26",
    status: "pending",
  },
  {
    id: "drag-along",
    direction: "退出条款",
    category: "领售权",
    name: "在特定条件下投资方有权要求创始人一同出售股份",
    owner: "李四",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-27",
    status: "rejected",
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - detail                                                 */
/* ------------------------------------------------------------------ */
const termDetails: Record<string, TermDetail> = {
  "board-seat": {
    id: "board-seat",
    title: "投资方有权委派一名董事进入公司董事会",
    termId: "TM-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "approved",
    creator: PEOPLE.zhangwei,
    ourDemand: {
      content: "投资方要求在公司董事会中获得一个正式董事席位，该董事享有与其他董事同等的表决权和知情权，参与公司所有重大经营决策的审议和表决。",
      files: [
        { name: "投资条款清单_v1.pdf", size: "2.1 MB", date: "2024-01-10" },
        { name: "董事会席位要求说明.docx", size: "156 KB", date: "2024-01-12" },
      ],
      linkedHypotheses: [
        { id: "h1", title: "创始人闫俊杰具有扎实的人工智能学术背景", status: "verified" },
      ],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-01-15",
      comments: [
        { author: "王五", content: "建议同时要求列席技术委员会的权利", time: "2024-01-15 14:30" },
      ],
    },
    ourBasis: {
      content: "基于本轮投资金额（5000万美元）及持股比例（15%），按照行业惯例，该投资规模的股东通常可获得董事会席位。参考同类型投资案例，如红杉资本在字节跳动B轮的类似安排。此外，作为战略投资方，我们的行业资源和技术能力可为公司发展提供重要支持，董事席位有助于更好地发挥协同效应。",
      files: [
        { name: "行业对标分析报告.pdf", size: "3.2 MB", date: "2024-01-14" },
        { name: "投资权益条款对比表.xlsx", size: "890 KB", date: "2024-01-14" },
      ],
      linkedHypotheses: [
        { id: "h2", title: "公司治理结构需要外部监督", status: "verified" },
      ],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi],
      createdAt: "2024-01-16",
      comments: [],
    },
    bilateralConflict: {
      content: "创始团队担忧：1）外部董事可能干预公司日常运营决策，影响管理层独立性；2）涉及核心技术和商业机密的讨论可能因外部董事参与而存在信息泄露风险；3）董事会决策效率可能因新增成员而降低。公司律师建议限制投资方董事的表决事项范围。",
      files: [
        { name: "公司方反馈意见.pdf", size: "1.1 MB", date: "2024-01-18" },
      ],
      linkedHypotheses: [],
      creator: PEOPLE.lisi,
      reviewers: [PEOPLE.zhangwei, PEOPLE.zhaoliu],
      createdAt: "2024-01-18",
      comments: [
        { author: "赵六", content: "法务角度看，信息泄露风险可通过保密协议约束", time: "2024-01-18 16:00" },
      ],
    },
    ourBottomLine: {
      content: "必须获得至少一个董事会席位，且该席位必须是正式董事而非观察员。董事必须有权参与所有重大事项的表决，包括但不限于：年度预算审批、重大投资决策、核心高管任免、关联交易审批等。不接受仅限于特定事项的表决权限制。",
      files: [],
      linkedHypotheses: [],
      creator: PEOPLE.wangwu,
      reviewers: [PEOPLE.zhangwei, PEOPLE.chenzong],
      createdAt: "2024-01-19",
      comments: [],
    },
    compromiseSpace: {
      content: "可接受的妥协方案：1）同意签署严格的保密协议，明确信息使用范围和泄露责任；2）同意在涉及创始人个人利益的事项上回避表决；3）同意首年仅以观察员身份参与，但需在协议中明确一年后自动转为正式董事；4）可考虑将部分敏感技术讨论单独安排，投资方董事不参与该部分会议。",
      files: [
        { name: "妥协方案备选.docx", size: "456 KB", date: "2024-01-20" },
      ],
      linkedHypotheses: [],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-01-20",
      comments: [
        { author: "李四", content: "方案3可作为最后的谈判筹码", time: "2024-01-20 10:30" },
      ],
    },
    negotiationResult: {
      conclusion: "谈判达成",
      status: "agreed",
      content: "经过三轮谈判，双方达成一致：投资方获得一个正式董事席位，享有完整表决权。作为交换条件：1）投资方董事签署保密协议，承诺不向竞争对手披露任何公司信息；2）在涉及创始团队个人薪酬和股权激励的事项上，投资方董事回避表决；3）公司承诺每月向投资方提供经营简报，确保信息透明。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2024-01-25",
      comments: [
        { author: "陈总", content: "风控角度认可该方案，保密条款保护到位", time: "2024-01-25 15:00" },
        { author: "张伟", content: "已将谈判结果更新至投资协议草案", time: "2024-01-25 17:30" },
      ],
    },
    implementationStatus: {
      status: "implemented",
      content: "该条款已在投资协议正式条款中体现（第5.2条），并于2024年2月15日完成签署。张伟已正式被任命为公司董事，参加了2024年3月的首次董事会会议。保密协议已于2024年2月20日签署完毕，相关备案手续已完成。",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.zhaoliu],
      createdAt: "2024-03-01",
      comments: [],
    },
  },
}

/* ------------------------------------------------------------------ */
/*  AI基础设施策略模板条款数据                                          */
/* ------------------------------------------------------------------ */
const aiInfrastructureTerms: TermTableItem[] = [
  {
    id: "ai-t1",
    direction: "投资保护条款",
    category: "信息权",
    name: "投资方有权获取被投企业月度财务报告",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    status: "approved",
  },
  {
    id: "ai-t2",
    direction: "投资保护条款",
    category: "信息权",
    name: "投资方有权对重大技术决策进行知情和建议",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    status: "approved",
  },
  {
    id: "ai-t3",
    direction: "投资保护条款",
    category: "反稀释条款",
    name: "采用完全棘轮反稀释条款保护投资方权益",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "pending",
  },
  {
    id: "ai-t4",
    direction: "控制权条款",
    category: "董事会席位",
    name: "投资方有权委派一名董事参与公司董事会",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "approved",
  },
  {
    id: "ai-t5",
    direction: "控制权条款",
    category: "重大事项否决权",
    name: "对核心技术IP转让和授权享有一票否决权",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "pending",
  },
  {
    id: "ai-t6",
    direction: "退出条款",
    category: "回购条款",
    name: "若公司未能在5年内实现IPO，投资方有权要求回购",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
    status: "rejected",
  },
]

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回指定策略模板的条款列表，全部状态重置为"待审批" */
export function getTemplateTermsForStrategy(strategyId: string): TermTableItem[] {
  if (strategyId === "1") {
    return aiInfrastructureTerms.map((t) => ({ ...t, status: "pending" as const }))
  }
  return []
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig = {
  approved: { label: "已批准", color: "bg-[#DCFCE7] text-[#166534]" },
  pending: { label: "待审批", color: "bg-[#FEF3C7] text-[#92400E]" },
  rejected: { label: "已拒绝", color: "bg-[#FEE2E2] text-[#991B1B]" },
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface TermSheetProps {
  isNewProject?: boolean
  project?: { strategyId?: string; strategyName?: string }
  inheritedTerms?: TermTableItem[]
  extraDetails?: Record<string, TermDetail>
}

export function TermSheet({ isNewProject = false, project, inheritedTerms, extraDetails }: TermSheetProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showTemplateBanner, setShowTemplateBanner] = useState(true)

  // Priority: inherited (from approved project) > template > existing mock data
  const sourceData = inheritedTerms
    ? inheritedTerms
    : isNewProject && project?.strategyId === "1"
      ? aiInfrastructureTerms
      : termTableData

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

  // Get detail for selected item — extraDetails takes priority over built-in mock data
  const selectedDetail = selectedId
    ? (extraDetails?.[selectedId] ?? termDetails[selectedId] ?? null)
    : null

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
    console.log("[v0] Delete term:", id)
  }

  // For new projects without a strategy template, show empty state
  if (isNewProject && !project?.strategyId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FileText className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无条款清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的项目，还没有添加任何条款。点击下方按钮开始创建您的第一个投资条款。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个���款
          </button>
        </div>
      </div>
    )
  }

  // Reusable section component for term detail
  const renderSection = (
    title: string,
    icon: React.ReactNode,
    borderColor: string,
    titleColor: string,
    section: SectionContent
  ) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("h-1 w-1 rounded-full", borderColor.replace("border-", "bg-"))} />
        <h2 className={cn("text-base font-semibold", titleColor)}>{title}</h2>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className={cn("border-l-4 p-5", borderColor)}>
          {/* Content */}
          <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
            <p className="text-sm text-[#374151] leading-relaxed">{section.content}</p>
          </div>

          {/* Files */}
          {section.files && section.files.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[#6B7280] mb-2">附件</p>
              {section.files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  <span className="text-sm text-[#2563EB]">{file.name}</span>
                  <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* Linked Hypotheses */}
          {section.linkedHypotheses && section.linkedHypotheses.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[#6B7280] mb-2">关联假设</p>
              <div className="flex flex-wrap gap-2">
                {section.linkedHypotheses.map((h) => (
                  <span key={h.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EFF6FF] rounded text-xs text-[#2563EB]">
                    <Link2 className="h-3 w-3" />
                    {h.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Creator & Reviewers */}
          <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
            <div className="flex items-center gap-1">
              <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                <span className="text-[8px] text-white">{section.creator.name.slice(0, 1)}</span>
              </div>
              <span>创建: {section.creator.name}</span>
            </div>
            <span>���批:</span>
            {section.reviewers.map((r, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                  <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                </div>
                <span>{r.name}</span>
              </div>
            ))}
            <span>{section.createdAt}</span>
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs text-[#6B7280] mb-2">评论</p>
            {section.comments.map((c, idx) => (
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
  )

  // Detail view
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
            <span className="text-[#111827]">条款清单</span>
          </div>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              <Badge className={cn("text-xs", statusConfig[selectedDetail.status].color)}>
                {statusConfig[selectedDetail.status].label}
              </Badge>
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              ID: {selectedDetail.termId} | 创建时间: {selectedDetail.createdAt} | 更新时间: {selectedDetail.updatedAt}
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

          {/* 我方诉求 */}
          {renderSection(
            "我方诉求",
            <Target className="h-4 w-4" />,
            "border-[#2563EB]",
            "text-[#2563EB]",
            selectedDetail.ourDemand
          )}

          {/* 我方依据 */}
          {renderSection(
            "我方依据",
            <FileCheck className="h-4 w-4" />,
            "border-[#22C55E]",
            "text-[#22C55E]",
            selectedDetail.ourBasis
          )}

          {/* 双方冲突 */}
          {renderSection(
            "双方冲突",
            <AlertTriangle className="h-4 w-4" />,
            "border-[#EF4444]",
            "text-[#EF4444]",
            selectedDetail.bilateralConflict
          )}

          {/* 我方底线 */}
          {renderSection(
            "我方底线",
            <Shield className="h-4 w-4" />,
            "border-[#F59E0B]",
            "text-[#F59E0B]",
            selectedDetail.ourBottomLine
          )}

          {/* 妥协空间 */}
          {renderSection(
            "妥协空间",
            <Handshake className="h-4 w-4" />,
            "border-[#8B5CF6]",
            "text-[#8B5CF6]",
            selectedDetail.compromiseSpace
          )}

          {/* 谈判结果 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#0EA5E9]" />
              <h2 className="text-base font-semibold text-[#0EA5E9]">谈判结果</h2>
            </div>
            {selectedDetail.negotiationResult.content ? (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#0EA5E9] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#111827]">最终结论</h3>
                    <Badge className={cn(
                      "text-xs",
                      selectedDetail.negotiationResult.status === "agreed"
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : selectedDetail.negotiationResult.status === "partial"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#991B1B]"
                    )}>
                      {selectedDetail.negotiationResult.conclusion}
                    </Badge>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.negotiationResult.content}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.negotiationResult.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.negotiationResult.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.negotiationResult.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.negotiationResult.createdAt}</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {selectedDetail.negotiationResult.comments.map((c, idx) => (
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
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                      <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-8 text-center text-sm text-[#9CA3AF]">
                暂无
              </div>
            )}
          </div>

          {/* 落实情况 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#10B981]" />
              <h2 className="text-base font-semibold text-[#10B981]">落实情况</h2>
            </div>
            {selectedDetail.implementationStatus.content ? (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#10B981] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#111827]">执行状态</h3>
                    <Badge className={cn(
                      "text-xs",
                      selectedDetail.implementationStatus.status === "implemented"
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : selectedDetail.implementationStatus.status === "in-progress"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#F3F4F6] text-[#6B7280]"
                    )}>
                      {selectedDetail.implementationStatus.status === "implemented" ? "已落实"
                        : selectedDetail.implementationStatus.status === "in-progress" ? "执行中"
                        : "未开始"}
                    </Badge>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.implementationStatus.content}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.implementationStatus.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.implementationStatus.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.implementationStatus.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.implementationStatus.createdAt}</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                      <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-8 text-center text-sm text-[#9CA3AF]">
                暂无
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Table view
  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="px-6 py-6">
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
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1E40AF]">
                  基于「{project.strategyName}」策略模板
                </p>
                <p className="text-xs text-[#3B82F6]">
                  以下条款清单继承自所选策略模板，您可以根据项目实际情况进行调整
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">条款清单</h1>
            <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪项目投资条款</p>
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
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4 mr-2" />
              新建条款
            </Button>
          </div>
        </div>

        {/* Table */}
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
              <FileText className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的条款</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
