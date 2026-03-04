"use client"

import { useState } from "react"
import {
  Search,
  Lightbulb,
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
interface HypothesisTableItem {
  id: string
  direction: string
  category: string
  name: string
  owner: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
}

interface HypothesisDetail {
  id: string
  title: string
  description: string
  status: "verified" | "pending" | "risky"
  owner: string
  createdAt: string
  updatedAt: string
  keyPoints: string[]
  relatedProjects: { id: string; name: string; status: string }[]
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const hypothesisTableData: HypothesisTableItem[] = [
  {
    id: "h1",
    direction: "AI基础设施",
    category: "算力与芯片",
    name: "国产AI芯片在推理场景下可替代英伟达方案",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    status: "pending",
  },
  {
    id: "h2",
    direction: "AI基础设施",
    category: "算力与芯片",
    name: "云端AI芯片市场将在3年内达到500亿美元规模",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    status: "verified",
  },
  {
    id: "h3",
    direction: "AI基础设施",
    category: "模型训练框架",
    name: "开源大模型训练框架将成为主流技术路线",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "verified",
  },
  {
    id: "h4",
    direction: "AI基础设施",
    category: "模型训练框架",
    name: "分布式训练效率提升是大模型竞争关键",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "pending",
  },
  {
    id: "h5",
    direction: "AI基础设施",
    category: "基础软件生态",
    name: "AI编译器将成为新的基础软件投资赛道",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "risky",
  },
  {
    id: "h6",
    direction: "AI基础设施",
    category: "基础软件生态",
    name: "MLOps平台市场需求将快速增长",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
    status: "pending",
  },
]

const hypothesisDetails: Record<string, HypothesisDetail> = {
  "h1": {
    id: "h1",
    title: "国产AI芯片在推理场景下可替代英伟达方案",
    description: "随着国产AI芯片技术的进步，在特定的推理场景下，国产芯片的性价比和能效比已经接近或达到英伟达方案的水平，具备替代可能性。",
    status: "pending",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    keyPoints: [
      "国产芯片在INT8推理性能上已达到A100的80%",
      "能效比在特定场景下优于英伟达方案",
      "软件生态仍是主要短板",
      "价格优势明显，约为进口方案的60%",
    ],
    relatedProjects: [
      { id: "p1", name: "寒武纪科技", status: "已投资" },
      { id: "p2", name: "燧原科技", status: "尽调中" },
    ],
  },
  "h2": {
    id: "h2",
    title: "云端AI芯片市场将在3年内达到500亿美元规模",
    description: "基于大模型训练和推理需求的爆发式增长，预计全球云端AI芯片市场将在2027年达到500亿美元的规模。",
    status: "verified",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    keyPoints: [
      "ChatGPT带动大模型需求爆发",
      "各大云厂商加大AI算力投入",
      "训练芯片需求年增长率超过50%",
      "推理芯片市场增速更快",
    ],
    relatedProjects: [
      { id: "p3", name: "英伟达生态项目", status: "已投资" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */
const statusConfig = {
  verified: { label: "已验证", color: "bg-[#DCFCE7] text-[#166534]" },
  pending: { label: "待验证", color: "bg-[#FEF3C7] text-[#92400E]" },
  risky: { label: "有风险", color: "bg-[#FEE2E2] text-[#991B1B]" },
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface StrategyHypothesesProps {
  isNewStrategy?: boolean
}

export function StrategyHypotheses({ isNewStrategy = false }: StrategyHypothesesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const filteredData = hypothesisTableData.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.direction.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query)
    )
  })

  const selectedDetail = selectedId ? hypothesisDetails[selectedId] : null

  function handleViewDetail(id: string) {
    setSelectedId(id)
    setShowDetail(true)
  }

  function handleBackToList() {
    setShowDetail(false)
    setSelectedId(null)
  }

  function handleDelete(id: string) {
    console.log("[v0] Delete strategy hypothesis:", id)
  }

  if (isNewStrategy) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <Lightbulb className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的策略，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个假设
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
            返回假设清单
          </button>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={cn("text-xs", statusConfig[selectedDetail.status].color)}>
                    {statusConfig[selectedDetail.status].label}
                  </Badge>
                </div>
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
            <h2 className="text-lg font-semibold text-[#111827] mb-4">关联项目</h2>
            <div className="space-y-2">
              {selectedDetail.relatedProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#111827]">{project.name}</span>
                  <Badge className="text-xs bg-[#EFF6FF] text-[#2563EB]">{project.status}</Badge>
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
            <h1 className="text-2xl font-bold text-[#111827]">假设清单</h1>
            <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪策略投资假设</p>
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
              <Lightbulb className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的假设</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
