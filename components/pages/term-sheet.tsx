"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  Plus,
  Link2,
  ArrowLeft,
  Eye,
  Trash2,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
interface TermTableItem {
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

interface TermValuePoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
    linkedHypotheses: LinkedHypothesis[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface TermRiskPoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
    linkedHypotheses: LinkedHypothesis[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface TermCommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface TermDetail {
  id: string
  title: string
  termId: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
  creator: PersonInfo
  description: string
  valuePoints: TermValuePoint[]
  riskPoints: TermRiskPoint[]
  committeeDecision: TermCommitteeDecision
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
    termId: "T-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "approved",
    creator: PEOPLE.zhangwei,
    description: "该条款规定投资方有权向公司董事会委派一名董事代表,参与公司重大决策,保护投资方的权益。",
    valuePoints: [
      {
        id: "vp1",
        title: "确保信息透明度",
        evidence: {
          description: "通过董事席位,投资方可以及时获取公司经营信息,确保信息披露的及时性和准确性。",
          files: [
            { name: "董事会议事规则.pdf", size: "1.5MB", date: "2024-01-12" },
          ],
          linkedHypotheses: [
            { id: "h1", title: "公司治理结构完善", status: "verified" },
          ],
        },
        analysis: {
          content: "董事席位是投资方参与公司治理的重要途径,有助于保护投资权益。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi],
          createdAt: "2024-01-16",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "可能影响决策效率",
        evidence: {
          description: "新增董事可能延长决策流程,影响公司运营效率。",
          files: [],
          linkedHypotheses: [],
        },
        analysis: {
          content: "建议在条款中明确董事会议事规则,平衡监督与效率。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-01-17",
        },
        comments: [],
      },
    ],
    committeeDecision: {
      conclusion: "条款通过",
      status: "approved",
      content: "投委会一致同意该条款,认为董事席位对保护投资方权益至关重要。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhaoliu],
      createdAt: "2024-02-01",
      comments: [],
    },
  },
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
}

export function TermSheet({ isNewProject = false, project }: TermSheetProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Filter data
  const filteredData = termTableData.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  // Get detail for selected item
  const selectedDetail = selectedId ? termDetails[selectedId] : null

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

  // For new projects without AI基础设施 strategy, show empty state
  if (isNewProject && project?.strategyId !== "1") {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FileText className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无条款清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            {project?.strategyName 
              ? `该项目基于「${project.strategyName}」策略模板创建，条款清单将从策略模板中继承。`
              : "这是一个新创建的项目，还没有添加任何条款。点击下方按钮开始创建您的第一个投资条款。"
            }
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个条款
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
            返回条款清单
          </button>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={cn("text-xs", statusConfig[selectedDetail.status].color)}>
                    {statusConfig[selectedDetail.status].label}
                  </Badge>
                  <span className="text-xs text-[#6B7280]">{selectedDetail.termId}</span>
                </div>
                <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              </div>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">{selectedDetail.description}</p>
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
                {vp.evidence.linkedHypotheses.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vp.evidence.linkedHypotheses.map((h) => (
                      <span key={h.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F3F4F6] rounded text-xs text-[#6B7280]">
                        <Link2 className="h-3 w-3" />
                        {h.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Risk points */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">风险点</h2>
            {selectedDetail.riskPoints.map((rp) => (
              <div key={rp.id} className="border-l-4 border-[#EF4444] pl-4 py-3 mb-4 last:mb-0">
                <h3 className="font-medium text-[#111827] mb-2">{rp.title}</h3>
                <p className="text-sm text-[#6B7280]">{rp.evidence.description}</p>
              </div>
            ))}
          </div>

          {/* Committee decision */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
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
