"use client"

import { useState } from "react"
import {
  Search,
  Upload,
  FileText,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// --- Data types ---
interface HypothesisNode {
  id: string
  label: string
  status: "verified" | "pending" | "risky"
  children?: HypothesisNode[]
}

interface HypothesisDetail {
  id: string
  title: string
  qaId: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
  files: { name: string; size: string; date: string; status: "on" | "off" }[]
  analysis: string
  riskLevel: string
  confidence: string
}

// --- Mock data ---
const hypothesisTree: { category: string; id: string; items: HypothesisNode[] }[] = [
  {
    category: "团队与组织能力",
    id: "team",
    items: [
      {
        id: "founder",
        label: "创始人闫俊杰",
        status: "verified",
        children: [
          { id: "tech-bg", label: "技术背景", status: "verified" },
          { id: "biz-exp", label: "商业经验", status: "pending" },
          { id: "leadership", label: "领导力", status: "pending" },
        ],
      },
      {
        id: "core-team",
        label: "核心团队",
        status: "pending",
        children: [
          { id: "tech-team", label: "技术团队", status: "pending" },
          { id: "market-team", label: "市场团队", status: "pending" },
        ],
      },
    ],
  },
  {
    category: "市场机会",
    id: "market",
    items: [],
  },
  {
    category: "商业模式",
    id: "business",
    items: [],
  },
]

const detailsMap: Record<string, HypothesisDetail> = {
  "tech-bg": {
    id: "tech-bg",
    title: "创始人闫俊杰具有扎实的人工智能学术背景",
    qaId: "QA-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
    status: "verified",
    files: [
      { name: "闫俊杰_CV.pdf", size: "2.4 MB", date: "2024-01-18", status: "on" },
      {
        name: "Google Scholar 引用数据.xlsx",
        size: "1.8 MB",
        date: "2024-01-19",
        status: "on",
      },
    ],
    analysis:
      "创始人拥有博士学位，为该领域高学历人才。在人工智能领域发表过15篇高质量学术论文，其中5篇发表在顶级期刊上。曾获得国家自然科学基金青年项目资助，具备扎实的理论基础和研究能力。在Google Scholar上的H指数为8，总引用次数超过500次，证明其研究成果具有较高的学术影响力。曾在知名科技公司担任技术专家职位，具备将学术成果转化为实际应用的能力。",
    riskLevel: "无风险",
    confidence: "95%",
  },
}

// --- Status helpers ---
function statusDot(status: "verified" | "pending" | "risky") {
  const colors = {
    verified: "bg-emerald-500",
    pending: "bg-gray-300",
    risky: "bg-amber-500",
  }
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", colors[status])} />
}

// --- Tree Node ---
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: HypothesisNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          onSelect(node.id)
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isSelected
            ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
            : "text-[#374151] hover:bg-[#F3F4F6]"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {statusDot(node.status)}
        <span className="truncate">{node.label}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Detail Panel ---
function DetailPanel({ detail }: { detail: HypothesisDetail }) {
  return (
    <div className="flex-1 overflow-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 px-8 py-4 text-sm text-[#6B7280]">
        <span className="hover:text-[#374151] cursor-pointer">项目库</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="hover:text-[#374151] cursor-pointer">MiniMax</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[#374151] font-medium">假设清单</span>
      </div>

      <div className="px-8 pb-8 space-y-6">
        {/* Header Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">{detail.title}</h2>
              <p className="mt-1.5 text-sm text-[#6B7280]">
                {"ID: "}
                {detail.qaId}
                {" | "}
                {"创建时间: "}
                {detail.createdAt}
                {" | "}
                {"更新时间: "}
                {detail.updatedAt}
              </p>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              已验证
            </Badge>
          </div>
        </div>

        {/* Evidence Support */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-4">论据支持</h3>

          {/* Upload area */}
          <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#D1D5DB] py-8 transition-colors hover:border-[#2563EB] hover:bg-[#F8FAFC] cursor-pointer">
            <Upload className="h-8 w-8 text-[#9CA3AF] mb-2" />
            <p className="text-sm text-[#6B7280]">拖拽文件到此处或点击上传</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {"支持 PDF, Excel, Word 等格式"}
            </p>
          </div>

          {/* File list */}
          <div className="space-y-3">
            {detail.files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-4 py-3"
              >
                <span
                  className={cn(
                    "text-xs font-bold rounded px-1.5 py-0.5",
                    file.status === "on"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {file.status}
                </span>
                <FileText className="h-4 w-4 text-[#6B7280]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111827] truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    {file.size}
                    {" \u00b7 "}
                    {file.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-4">论证分析</h3>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-sm leading-relaxed text-[#374151]">{detail.analysis}</p>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-4">风险评估</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-[#6B7280]">风险等级</label>
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#374151]">
                {detail.riskLevel}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[#6B7280]">验证置信度</label>
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#374151]">
                {detail.confidence}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" className="gap-2 text-[#374151] border-[#D1D5DB]">
              <MessageSquare className="h-4 w-4" />
              添加评论
            </Button>
            <Button variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              标记存疑
            </Button>
            <Button className="gap-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8]">
              <CheckCircle2 className="h-4 w-4" />
              通过验证
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Empty Detail ---
function EmptyDetail() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center text-[#9CA3AF]">
        <ListChecks className="mx-auto h-12 w-12 mb-3 text-[#D1D5DB]" />
        <p className="text-sm">选择左侧假设以查看详情</p>
      </div>
    </div>
  )
}

// --- Main Component ---
export function HypothesisChecklist() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>("tech-bg")

  const detail = selectedId ? detailsMap[selectedId] : null

  return (
    <div className="flex h-full">
      {/* Hypothesis Tree Panel */}
      <div className="w-[280px] shrink-0 border-r border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] p-4">
          <h2 className="mb-3 text-base font-semibold text-[#111827]">假设清单</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              placeholder="搜索假设..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm h-9 border-[#E5E7EB]"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-130px)]">
          <div className="p-3 space-y-4">
            {hypothesisTree.map((group, gIdx) => (
              <div key={group.id}>
                <p className="mb-2 px-2 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  {gIdx + 1}. {group.category}
                </p>
                {group.items.length > 0 ? (
                  <div className="space-y-0.5">
                    {group.items.map((node) => (
                      <TreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-2 text-xs text-[#9CA3AF] italic">暂无假设</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 bg-[#F3F4F6] overflow-auto">
        {detail ? <DetailPanel detail={detail} /> : <EmptyDetail />}
      </div>
    </div>
  )
}
