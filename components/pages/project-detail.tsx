"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  GitBranch,
  BarChart3,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HypothesisChecklist } from "@/components/pages/hypothesis-checklist"
import { ProjectOverview } from "@/components/pages/project-overview"
import { TermSheet } from "@/components/pages/term-sheet"
import { Workflow } from "@/components/pages/workflow"
import { DataAnalytics } from "@/components/pages/data-analytics"
import { ProjectMaterials } from "@/components/pages/project-materials"
import { type Project } from "@/components/pages/projects-grid"

type SubPageKey =
  | "overview"
  | "hypotheses"
  | "terms"
  | "workflow"
  | "analytics"
  | "materials"

interface SubNavItem {
  key: SubPageKey
  label: string
  icon: React.ElementType
}

const subNavItems: SubNavItem[] = [
  { key: "overview", label: "项目概览", icon: LayoutDashboard },
  { key: "hypotheses", label: "假设清单", icon: ListChecks },
  { key: "terms", label: "条款清单", icon: FileText },
  { key: "materials", label: "项目材料", icon: FolderOpen },
  { key: "workflow", label: "工作流", icon: GitBranch },
  { key: "analytics", label: "数据分析", icon: BarChart3 },
]

const subPageComponents: Record<SubPageKey, React.ComponentType> = {
  overview: ProjectOverview,
  hypotheses: HypothesisChecklist,
  terms: TermSheet,
  workflow: Workflow,
  analytics: DataAnalytics,
  materials: ProjectMaterials,
}

interface ProjectDetailProps {
  projectId: string
  project?: Project
}

export function ProjectDetail({ projectId, project }: ProjectDetailProps) {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>("overview")
  const [collapsed, setCollapsed] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string>("")

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={cn(
          "flex h-full flex-col bg-[#0F172A] text-[#94A3B8] shrink-0 transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[200px]"
        )}
      >
        {/* Collapse Header */}
        <div className="flex items-center justify-end px-3 pt-4 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center justify-center rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#CBD5E1]",
              collapsed && "mx-auto"
            )}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Phase Label */}
        {currentPhase && !collapsed && (
          <div className="px-3 pb-2">
            <div className="rounded-lg bg-[#1E293B] px-3 py-2">
              <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">{"\u5F53\u524D\u9636\u6BB5"}</p>
              <p className="text-xs font-semibold text-[#E2E8F0] mt-0.5">{currentPhase}</p>
            </div>
          </div>
        )}
        {currentPhase && collapsed && (
          <div className="px-2 pb-2">
            <div className="flex items-center justify-center rounded-lg bg-[#1E293B] p-1.5" title={currentPhase}>
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {subNavItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSubPage === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActiveSubPage(item.key)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeSubPage === "workflow" ? (
          <Workflow onSelectPhase={setCurrentPhase} />
        ) : activeSubPage === "hypotheses" ? (
          <HypothesisChecklist isNewProject={projectId.startsWith("new-project-")} project={project} />
        ) : activeSubPage === "terms" ? (
          <TermSheet isNewProject={projectId.startsWith("new-project-")} project={project} />
        ) : activeSubPage === "overview" ? (
          <ProjectOverview project={project} />
        ) : (
          (() => {
            const ActiveComponent = subPageComponents[activeSubPage]
            return <ActiveComponent />
          })()
        )}
      </div>
    </div>
  )
}
