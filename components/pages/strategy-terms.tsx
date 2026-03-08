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
  keyPoints: string[]
  relatedHypotheses: { id: string; name: string; status: string }[]
}

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
    description: "该条款规定投资方有权向公司董事会委派一名董事代表，参与公司重大决策，保护投资方的权益。",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    keyPoints: [
      "确保投资方在重大决策中的话语权",
      "有助于监督公司运营和财务状况",
      "是投资方保护性条款的核心之一",
      "需明确董事的任职资格和更换流程",
    ],
    relatedHypotheses: [
      { id: "h1", name: "公司治理结构完善", status: "已验证" },
      { id: "h2", name: "创始团队配合度高", status: "待验证" },
    ],
  },
  "t4": {
    id: "t4",
    title: "投资方有权优先于普通股股东获得投资金额1.5倍的回报",
    description: "在公司发生清算或出售等退出事件时，投资方有权优先于普通股股东获得相当于其投资金额1.5倍的回报。",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    keyPoints: [
      "保护投资方的下行风险",
      "1.5倍倍数在当前市场属于中等水平",
      "需关注参与分配权的设置",
      "与反稀释条款配合使用效果更佳",
    ],
    relatedHypotheses: [
      { id: "h3", name: "退出渠道畅通", status: "待验证" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */
// const statusConfig = {
//   approved: { label: "已批准", color: "bg-[#DCFCE7] text-[#166534]" },
//   pending: { label: "待审批", color: "bg-[#FEF3C7] text-[#92400E]" },
//   rejected: { label: "已拒绝", color: "bg-[#FEE2E2] text-[#991B1B]" },
// }

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface StrategyTermsProps {
  isNewStrategy?: boolean
  prefillData?: { title: string; content: string; category: string }
  onPrefillUsed?: () => void
}

export function StrategyTerms({ isNewStrategy = false, prefillData, onPrefillUsed }: StrategyTermsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCategory, setFormCategory] = useState("")

  // 处理预填数据
  if (prefillData && !showCreateForm) {
    setFormTitle(prefillData.title)
    setFormContent(prefillData.content)
    setFormCategory(prefillData.category)
    setShowCreateForm(true)
    onPrefillUsed?.()
  }

  const filteredData = termTableData.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  const selectedDetail = selectedId ? termDetails[selectedId] : null

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

  // 创建条款表单
  if (showCreateForm) {
    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <button
            onClick={() => {
              setShowCreateForm(false)
              setFormTitle("")
              setFormContent("")
              setFormCategory("")
            }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回条款清单
          </button>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#111827]">创建投资条款</h1>
                <p className="text-sm text-[#6B7280]">AI已为您预填了推荐内容，您可以根据需要进行修改</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款名称</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="输入条款名称"
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款类别</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="输入条款类别"
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">条款内容</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="输入条款详细内容"
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormTitle("")
                    setFormContent("")
                    setFormCategory("")
                  }}
                >
                  取消
                </Button>
                <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                  创建条款
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isNewStrategy) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FileText className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无条款清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的策略，还没有添加任何条款。点击下方按钮开始创建您的第一个投资条款。
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <Plus className="h-4 w-4" />
            创建第一个条款
          </button>
        </div>
      </div>
    )
  }

  if (showDetail && selectedDetail) {
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

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              </div>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">{selectedDetail.description}</p>
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <span>负责人: {selectedDetail.owner}</span>
              <span>创建时间: {selectedDetail.createdAt}</span>
              <span>更新时间: {selectedDetail.updatedAt}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">核心要点</h2>
            <ul className="space-y-2">
              {selectedDetail.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-[#374151]">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB] shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">关联假设</h2>
            <div className="space-y-2">
              {selectedDetail.relatedHypotheses.map((hypothesis) => (
                <div key={hypothesis.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#111827]">{hypothesis.name}</span>
                  <Badge className="text-xs bg-[#EFF6FF] text-[#2563EB]">{hypothesis.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="mx-auto max-w-7xl px-6 py-6">
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
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]">
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
