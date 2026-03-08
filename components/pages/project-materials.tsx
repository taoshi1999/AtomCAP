"use client"

import { Download, Eye, FileText, FileSpreadsheet, FileImage, File, FolderOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MaterialItem {
  id: string
  name: string
  format: string
  size: string
  description: string
}

const materials: MaterialItem[] = [
  {
    id: "m1",
    name: "GPU_AI芯片行业全景报告_2024",
    format: "PDF",
    size: "6.8 MB",
    description: "涵盖英伟达、AMD、华为昇腾等主要厂商的AI芯片市场份额、技术路线及竞争格局分析",
  },
  {
    id: "m2",
    name: "全球算力基础设施市场规模分析",
    format: "PDF",
    size: "4.3 MB",
    description: "IDC发布的全球AI算力基础设施市场规模预测，含数据中心、云算力及边缘算力细分数据",
  },
  {
    id: "m3",
    name: "主流AI训练框架技术对比",
    format: "DOCX",
    size: "2.1 MB",
    description: "PyTorch、TensorFlow、JAX等主流训练框架的性能基准、生态成熟度及企业采用情况对比",
  },
  {
    id: "m4",
    name: "云服务商GPU算力价格对比表",
    format: "XLSX",
    size: "0.8 MB",
    description: "AWS、Azure、GCP、阿里云等主流云厂商A100/H100算力租赁价格及性价比横向对比",
  },
  {
    id: "m5",
    name: "AI基础设施投融资趋势报告_2023-2024",
    format: "PDF",
    size: "5.6 MB",
    description: "全球AI基础设施领域融资事件、投资机构偏好及典型案例汇总，含估值倍数参考区间",
  },
  {
    id: "m6",
    name: "数据中心能耗与可持续发展白皮书",
    format: "PDF",
    size: "3.2 MB",
    description: "大模型训练能耗数据、PUE标准及主要云厂商碳中和路线图，用于评估ESG合规风险",
  },
  {
    id: "m7",
    name: "大模型训练成本结构分析",
    format: "XLSX",
    size: "1.4 MB",
    description: "主流大模型（GPT-4、Llama、文心等）训练成本拆解：算力、数据、人力占比及趋势",
  },
  {
    id: "m8",
    name: "AI芯片技术路线图_GPU_TPU_NPU",
    format: "PPTX",
    size: "9.7 MB",
    description: "英伟达Blackwell、谷歌TPU v5、华为昇腾910C等新一代AI芯片架构与性能演进路线图",
  },
  {
    id: "m9",
    name: "AI监管合规政策汇编",
    format: "PDF",
    size: "2.9 MB",
    description: "中国《生成式AI管理办法》、欧盟EU AI Act、美国AI行政令等主要市场监管政策要点摘编",
  },
  {
    id: "m10",
    name: "国内外AI基础软件生态图谱",
    format: "PDF",
    size: "7.1 MB",
    description: "MLOps工具链、向量数据库、推理优化框架等AI基础软件全栈生态图谱及主要玩家分布",
  },
]

function getFormatIcon(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
    case "DOCX":
      return FileText
    case "XLSX":
      return FileSpreadsheet
    case "PNG":
    case "JPG":
    case "SVG":
      return FileImage
    default:
      return File
  }
}

function getFormatColor(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
      return "bg-red-50 text-red-700 border-red-200"
    case "XLSX":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "DOCX":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "PPTX":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "MP4":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "ZIP":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

interface ProjectMaterialsProps {
  isNewProject?: boolean
  project?: {
    name?: string
  }
}

export function ProjectMaterials({ isNewProject = false, project }: ProjectMaterialsProps) {
  // Show empty state for new projects
  if (isNewProject) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FolderOpen className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无项目材料</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            {project?.name ? `「${project.name}」` : "该项目"}还没有上传任何材料。点击下方按钮开始上传您的第一份项目材料。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            上传材料
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#111827]">通用材料</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {project?.name ? `${project.name} - ` : ""}行业通用材料与文件管理
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(240px,2fr)_90px_80px_minmax(200px,3fr)_160px] items-center gap-4 border-b border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              文件名称
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              格式
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              大小
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              简介
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">
              操作
            </span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[#F3F4F6]">
            {materials.map((item) => {
              const FormatIcon = getFormatIcon(item.format)
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(240px,2fr)_90px_80px_minmax(200px,3fr)_160px] items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F9FAFB]"
                >
                  {/* File Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
                      <FormatIcon className="h-4.5 w-4.5 text-[#6B7280]" />
                    </div>
                    <span className="truncate text-sm font-medium text-[#111827]">
                      {item.name}
                    </span>
                  </div>

                  {/* Format */}
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${getFormatColor(item.format)}`}
                    >
                      {item.format}
                    </Badge>
                  </div>

                  {/* Size */}
                  <span className="text-sm text-[#6B7280]">{item.size}</span>

                  {/* Description */}
                  <p className="truncate text-sm text-[#6B7280]">
                    {item.description}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      详情
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
