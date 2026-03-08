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
  X,
  Check,
  FileText,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// 通用材料数据（与 project-materials 共享）
const availableMaterials = [
  { id: "m1", name: "GPU_AI芯片行业全景报告_2024", format: "PDF" },
  { id: "m2", name: "全球算力基础设施市场规模分析", format: "PDF" },
  { id: "m3", name: "主流AI训练框架技术对比", format: "DOCX" },
  { id: "m4", name: "云服务商GPU算力价格对比表", format: "XLSX" },
  { id: "m5", name: "AI基础设施投融资趋势报告_2023-2024", format: "PDF" },
  { id: "m7", name: "大模型训练成本结构分析", format: "XLSX" },
  { id: "m10", name: "国内外AI基础软件生态图谱", format: "PDF" },
]

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
}

interface HypothesisDetail {
  id: string
  title: string
  description: string
  owner: string
  createdAt: string
  updatedAt: string
  recommendation: string
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const hypothesisTableData: HypothesisTableItem[] = [
  {
    id: "h1",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "国产AI芯片在推理场景下可替代英伟达方案",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
  },
  {
    id: "h2",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "云端AI芯片市场将在3年内达到500亿美元规模",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
  },
  {
    id: "h3",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "开源大模型训练框架将成为主流技术路线",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
  },
  {
    id: "h4",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "分布式训练效率提升是大模型竞争关键",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
  },
  {
    id: "h5",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "AI编译器将成为新的基础软件投资赛道",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
  },
  {
    id: "h6",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "MLOps平台市场需求将快速增长",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
  },
]

const hypothesisDetails: Record<string, HypothesisDetail> = {
  "h1": {
    id: "h1",
    title: "国产AI芯片在推理场景下可替代英伟达方案",
    description: "随着国产AI芯片技术的持续进步，在特定推理场景下，国产芯片的性价比和能效比已接近或达到英伟达方案的水平。目前国产芯片在INT8推理性能上已达到A100的80%，能效比在特定场景下甚至优于英伟达方案，价格约为进口方案的60%，成本优势显著。主要短板在于软件生态尚不完善，但随着国产化生态建设提速，整体替代可行性正在持续提升。",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    recommendation: "国产芯片替代路径正在加速验证，叠加国产化政策红利与供应链安全诉求，下游采购意愿持续提升。当前市场窗口期是布局核心标的的关键时机，该假设若得到验证，将为策略在算力芯片赛道的选标逻辑提供重要支撑，建议重点关注推理芯片性价比领先的国内厂商。",
  },
  "h2": {
    id: "h2",
    title: "云端AI芯片市场将在3年内达到500亿美元规模",
    description: "基于大模型训练和推理需求的爆发式增长，预计全球云端AI芯片市场将在2027年达到500亿美元规模。ChatGPT的成功带动大模型需求全面爆发，各大云厂商持续加大AI算力资本开支，训练芯片需求年增长率已超过50%，推理芯片市场增速更为显著，整体市场规模扩张路径清晰可见。",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    recommendation: "云端AI算力的结构性增长已获头部科技公司资本开支数据的明确印证，市场规模上限清晰。该假设已验证，可作为策略整体投资逻辑的宏观需求锚点，为算力赛道的标的估值提供市场容量背书，增强投资决策的确定性。",
  },
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisPrefillData {
  title: string
  direction: string
  category: string
  content: string
  reason: string
  relatedMaterials: string[]
}

interface StrategyHypothesesProps {
  isNewStrategy?: boolean
  prefillData?: HypothesisPrefillData
  onPrefillUsed?: () => void
  strategyType?: "主题策略" | "赛道策略"
  parentStrategyName?: string
}

export function StrategyHypotheses({ 
  isNewStrategy = false, 
  prefillData, 
  onPrefillUsed,
  strategyType,
  parentStrategyName,
}: StrategyHypothesesProps) {
  // 赛道策略从主题策略继承数据
  const isTrackStrategy = strategyType === "赛道策略"
  const inheritedFromParent = isTrackStrategy && isNewStrategy && parentStrategyName
  const [showInheritBanner, setShowInheritBanner] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  
  // 弹窗创建表单状态
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formDirection, setFormDirection] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formReason, setFormReason] = useState("")
  const [formMaterials, setFormMaterials] = useState<string[]>([])
  
  // 变更请求状态
  const [showChangeRequest, setShowChangeRequest] = useState(false)
  const [pendingHypothesis, setPendingHypothesis] = useState<HypothesisTableItem | null>(null)
  
  // 假设列表数据（本地状态）
  const [hypothesesList, setHypothesesList] = useState<HypothesisTableItem[]>(hypothesisTableData)

  // 处理预填数据
  if (prefillData && !showCreateDialog) {
    setFormTitle(prefillData.title)
    setFormDirection(prefillData.direction)
    setFormCategory(prefillData.category)
    setFormContent(prefillData.content)
    setFormReason(prefillData.reason)
    setFormMaterials(prefillData.relatedMaterials)
    setShowCreateDialog(true)
    onPrefillUsed?.()
  }

  const filteredData = hypothesesList.filter((item) => {
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
  
  function resetForm() {
    setFormTitle("")
    setFormDirection("")
    setFormCategory("")
    setFormContent("")
    setFormReason("")
    setFormMaterials([])
  }
  
  function handleCreateSubmit() {
    // 创建新假设对象
    const newHypothesis: HypothesisTableItem = {
      id: `h-new-${Date.now()}`,
      direction: formDirection,
      category: formCategory,
      name: formTitle,
      owner: "张伟", // 当前用户
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    }
    
    // 关闭创建弹窗，显示变更请求
    setShowCreateDialog(false)
    setPendingHypothesis(newHypothesis)
    setShowChangeRequest(true)
  }
  
  function handleAcceptChange() {
    if (pendingHypothesis) {
      // 将新假设添加到列表
      setHypothesesList((prev) => [pendingHypothesis, ...prev])
    }
    setShowChangeRequest(false)
    setPendingHypothesis(null)
    resetForm()
  }
  
  function handleRejectChange() {
    setShowChangeRequest(false)
    setPendingHypothesis(null)
    resetForm()
  }
  
  function toggleMaterial(materialId: string) {
    setFormMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    )
  }

  // 新建的主题策略显示空状态
  if (isNewStrategy && !inheritedFromParent) {
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
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
          >
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
            <h1 className="text-xl font-bold text-[#111827] mb-4">{selectedDetail.title}</h1>
            <p className="text-sm text-[#6B7280] mb-4">{selectedDetail.description}</p>
            <div className="flex items-center gap-6 text-sm text-[#6B7280]">
              <span>负责人: {selectedDetail.owner}</span>
              <span>创建时间: {selectedDetail.createdAt}</span>
              <span>更新时间: {selectedDetail.updatedAt}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
            </div>
            <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.recommendation}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* 赛道策略继承提示 */}
        {inheritedFromParent && showInheritBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="flex-1 text-sm text-blue-700">
              当前赛道策略的假设清单已从主题策略「{parentStrategyName}」继承，您可以在此基础上进行调整
            </p>
            <button
              onClick={() => setShowInheritBanner(false)}
              className="ml-2 shrink-0 rounded p-0.5 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
              aria-label="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
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
                    <span className="text-sm text-[#111827]">{item.name}</span>
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
      
      {/* 创建假设弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Lightbulb className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#111827]">创建投资假设</div>
                <p className="text-sm font-normal text-[#6B7280]">AI已为您预填了推荐内容，您可以根据需要进行修改</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">假设方向</label>
                <Input
                  value={formDirection}
                  onChange={(e) => setFormDirection(e.target.value)}
                  placeholder="如：技术攻关、市场判断"
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">假设类别</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="如：算力与芯片、市场规模"
                  className="h-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">假设名称</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="输入假设名称"
                className="h-10"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">假设简介</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="输入假设详细内容"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">推荐理由</label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="说明为什么推荐这个假设"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#6B7280]" />
                  关联通用材料
                </div>
              </label>
              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {availableMaterials.map((material) => (
                    <label
                      key={material.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        formMaterials.includes(material.id)
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-white border border-transparent"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formMaterials.includes(material.id)}
                        onChange={() => toggleMaterial(material.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <FileText className="h-4 w-4 text-[#6B7280] shrink-0" />
                      <span className="text-sm text-[#374151] truncate flex-1">{material.name}</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] shrink-0">
                        {material.format}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
              {formMaterials.length > 0 && (
                <p className="mt-2 text-xs text-[#6B7280]">
                  已选择 {formMaterials.length} 个材料
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button 
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={handleCreateSubmit}
                disabled={!formTitle.trim() || !formDirection.trim()}
              >
                创建假设
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* 变更请求确认弹窗 */}
      <Dialog open={showChangeRequest} onOpenChange={setShowChangeRequest}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-[#111827]">变更请求</div>
                <p className="text-sm font-normal text-[#6B7280]">新建假设需要您的确认</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {pendingHypothesis && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 shrink-0">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#111827] mb-1">{pendingHypothesis.name}</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                        {pendingHypothesis.direction}
                      </Badge>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px]">
                        {pendingHypothesis.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      创建者: {pendingHypothesis.owner} | 创建时间: {pendingHypothesis.createdAt}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleRejectChange}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  拒绝
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleAcceptChange}
                >
                  <Check className="h-4 w-4 mr-1" />
                  接受
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
