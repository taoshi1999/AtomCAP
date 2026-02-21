"use client"

import { FolderKanban, Search, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const mockProjects = [
  {
    id: "1",
    name: "MiniMax",
    logo: "M",
    description: "\u901A\u7528\u4EBA\u5DE5\u667A\u80FD\u79D1\u6280\u516C\u53F8\uFF0C\u4E13\u6CE8\u4E8E\u5927\u6A21\u578B\u7814\u53D1",
    tags: ["AI", "B\u8F6E"],
    status: "\u5C3D\u8C03\u4E2D",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "10\u4EBF USD",
    round: "B\u8F6E",
  },
  {
    id: "2",
    name: "\u6708\u4E4B\u6697\u9762",
    logo: "\u6708",
    description: "\u65B0\u4E00\u4EE3AI\u641C\u7D22\u4E0E\u5BF9\u8BDD\u5E73\u53F0",
    tags: ["AI", "A\u8F6E"],
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "25\u4EBF USD",
    round: "A\u8F6E",
  },
  {
    id: "3",
    name: "\u667A\u8C31AI",
    logo: "\u667A",
    description: "\u8BA4\u77E5\u5927\u6A21\u578B\u6280\u672F\u4E0E\u5E94\u7528\u5F00\u53D1",
    tags: ["AI", "C\u8F6E"],
    status: "\u8BC4\u4F30\u4E2D",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    valuation: "30\u4EBF USD",
    round: "C\u8F6E",
  },
  {
    id: "4",
    name: "\u767E\u5DDD\u667A\u80FD",
    logo: "\u767E",
    description: "\u5927\u8BED\u8A00\u6A21\u578B\u7814\u53D1\u4E0E\u5E94\u7528",
    tags: ["AI", "B\u8F6E"],
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "12\u4EBF USD",
    round: "B\u8F6E",
  },
  {
    id: "5",
    name: "\u96F6\u4E00\u4E07\u7269",
    logo: "\u96F6",
    description: "\u901A\u7528AI\u52A9\u7406\u4E0E\u591A\u6A21\u6001\u6A21\u578B",
    tags: ["AI", "A\u8F6E"],
    status: "\u5C3D\u8C03\u4E2D",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valuation: "8\u4EBF USD",
    round: "A\u8F6E",
  },
  {
    id: "6",
    name: "\u9636\u8DC3\u661F\u8FB0",
    logo: "\u9636",
    description: "\u591A\u6A21\u6001\u5927\u6A21\u578B\u4E0E\u667A\u80FD\u4F53\u5E73\u53F0",
    tags: ["AI", "Pre-A"],
    status: "\u8BC4\u4F30\u4E2D",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    valuation: "5\u4EBF USD",
    round: "Pre-A",
  },
  {
    id: "7",
    name: "\u6DF1\u52BF\u79D1\u6280",
    logo: "\u6DF1",
    description: "AI for Science\uFF0C\u5206\u5B50\u6A21\u62DF\u4E0E\u836F\u7269\u8BBE\u8BA1",
    tags: ["AI+\u79D1\u5B66", "B\u8F6E"],
    status: "\u5DF2\u6295\u8D44",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    valuation: "15\u4EBF USD",
    round: "B\u8F6E",
  },
  {
    id: "8",
    name: "\u886C\u8FDC\u79D1\u6280",
    logo: "\u886C",
    description: "AI\u9A71\u52A8\u7684\u7535\u5546\u4E0E\u6D88\u8D39\u54C1\u521B\u65B0",
    tags: ["AI+\u6D88\u8D39", "A\u8F6E"],
    status: "\u8BC4\u4F30\u4E2D",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    valuation: "3\u4EBF USD",
    round: "A\u8F6E",
  },
]

interface ProjectsGridProps {
  onSelectProject: (projectId: string) => void
}

export function ProjectsGrid({ onSelectProject }: ProjectsGridProps) {
  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-7xl px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">
                {"\u9879\u76EE\u5217\u8868"}
              </h1>
              <p className="text-sm text-[#6B7280]">
                {"\u5171 "}{mockProjects.length}{" \u4E2A\u6295\u8D44\u9879\u76EE"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder={"\u641C\u7D22\u9879\u76EE..."}
                className="w-48 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4" />
              {"\u65B0\u5EFA\u9879\u76EE"}
            </button>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-4 gap-5">
          {mockProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 text-left transition-all hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-[#2563EB]/5"
            >
              {/* Logo & Status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111827] text-lg font-bold text-white transition-transform group-hover:scale-105">
                  {project.logo}
                </div>
                <Badge
                  className={`${project.statusColor} hover:${project.statusColor} text-xs`}
                >
                  {project.status}
                </Badge>
              </div>

              {/* Info */}
              <h3 className="text-base font-semibold text-[#111827] mb-1">
                {project.name}
              </h3>
              <p className="text-xs text-[#6B7280] mb-4 line-clamp-2 leading-relaxed">
                {project.description}
              </p>

              {/* Footer: Tags & Valuation */}
              <div className="mt-auto flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-medium text-[#374151]">
                  {project.valuation}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
