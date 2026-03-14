"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  GitBranch,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HypothesisChecklist, type HypothesisTableItem, type HypothesisDetail } from "@/components/pages/hypothesis-checklist"
import { ProjectOverview } from "@/components/pages/project-overview"
import { TermSheet, type TermTableItem, type TermDetail } from "@/components/pages/term-sheet"
import { Workflow, type Phase, type PendingPhase, type PendingProjectHypothesis, type PendingProjectTerm, type GeneratedSuggestion, type GeneratedTermSuggestion, type PendingProjectMaterial, type GeneratedMaterialSuggestion, type GeneratedAiResearchGroup } from "@/components/pages/workflow"
import { ProjectMaterials } from "@/components/pages/project-materials"
import { type Project } from "@/components/pages/projects-grid"
import { type StrategyMaterial } from "@/components/pages/strategies-grid"

type SubPageKey =
  | "overview"
  | "hypotheses"
  | "terms"
  | "workflow"
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
]

const subPageComponents: Record<SubPageKey, React.ComponentType> = {
  overview: ProjectOverview,
  hypotheses: HypothesisChecklist,
  terms: TermSheet,
  workflow: Workflow,
  materials: ProjectMaterials,
}

interface ProjectDetailProps {
  projectId: string
  project?: Project
  phases?: Phase[]
  onPhasesChange?: (phases: Phase[]) => void
  onCreatePendingPhase?: (pending: PendingPhase) => void
  onCreatePendingProjectHypothesis?: (pending: PendingProjectHypothesis) => void
  projectHypotheses?: HypothesisTableItem[]
  projectHypothesisDetails?: Record<string, HypothesisDetail>
  projectTerms?: TermTableItem[]
  projectMaterials?: StrategyMaterial[]
  savedGeneratedSuggestions?: GeneratedSuggestion[]
  onSaveSuggestions?: (suggestions: GeneratedSuggestion[]) => void
  savedGeneratedTermSuggestions?: GeneratedTermSuggestion[]
  onSaveTermSuggestions?: (suggestions: GeneratedTermSuggestion[]) => void
  onCreatePendingProjectTerm?: (pending: PendingProjectTerm) => void
  projectTermDetails?: Record<string, TermDetail>
  onCreatePendingProjectMaterial?: (pending: PendingProjectMaterial) => void
  savedGeneratedMaterialSuggestions?: GeneratedMaterialSuggestion[]
  onSaveMaterialSuggestions?: (suggestions: GeneratedMaterialSuggestion[]) => void
  savedGeneratedAiResearchGroups?: GeneratedAiResearchGroup[]
  onSaveAiResearchGroups?: (groups: GeneratedAiResearchGroup[]) => void
}

export function ProjectDetail({ projectId, project, phases, onPhasesChange, onCreatePendingPhase, onCreatePendingProjectHypothesis, projectHypotheses, projectHypothesisDetails, projectTerms, projectMaterials, savedGeneratedSuggestions, onSaveSuggestions, savedGeneratedTermSuggestions, onSaveTermSuggestions, onCreatePendingProjectTerm, projectTermDetails, onCreatePendingProjectMaterial, savedGeneratedMaterialSuggestions, onSaveMaterialSuggestions, savedGeneratedAiResearchGroups, onSaveAiResearchGroups }: ProjectDetailProps) {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>("overview")
  const [collapsed, setCollapsed] = useState(false)
  const isNewProject = projectId.startsWith("new-project-")
  const [currentPhase, setCurrentPhase] = useState<string>(isNewProject ? "无" : "")

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
        {!collapsed && (
          <div className="px-3 pb-2">
            <div className="rounded-lg bg-[#1E293B] px-3 py-2">
              <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">当前阶段</p>
              <p className="text-xs font-semibold text-[#E2E8F0] mt-0.5">{currentPhase || "无"}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="px-2 pb-2">
            <div className="flex items-center justify-center rounded-lg bg-[#1E293B] p-1.5" title={currentPhase || "无"}>
              <span className={cn("h-2 w-2 rounded-full", currentPhase && currentPhase !== "无" ? "bg-[#2563EB]" : "bg-[#64748B]")} />
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
          <Workflow
            onSelectPhase={setCurrentPhase}
            isNewProject={isNewProject}
            projectId={projectId}
            projectName={project?.name || ""}
            phases={phases}
            onPhasesChange={onPhasesChange}
            onCreatePendingPhase={onCreatePendingPhase}
            onCreatePendingProjectHypothesis={onCreatePendingProjectHypothesis}
            hypothesesCount={projectHypotheses?.length}
            termsCount={projectTerms?.length}
            materialsCount={projectMaterials?.length}
            savedGeneratedSuggestions={savedGeneratedSuggestions}
            onSaveSuggestions={onSaveSuggestions}
            savedGeneratedTermSuggestions={savedGeneratedTermSuggestions}
            onSaveTermSuggestions={onSaveTermSuggestions}
            onCreatePendingProjectTerm={onCreatePendingProjectTerm}
            savedGeneratedMaterialSuggestions={savedGeneratedMaterialSuggestions}
            onSaveMaterialSuggestions={onSaveMaterialSuggestions}
            onCreatePendingProjectMaterial={onCreatePendingProjectMaterial}
            savedGeneratedAiResearchGroups={savedGeneratedAiResearchGroups}
            onSaveAiResearchGroups={onSaveAiResearchGroups}
          />
        ) : activeSubPage === "hypotheses" ? (
          <HypothesisChecklist
            isNewProject={isNewProject}
            project={project}
            inheritedHypotheses={projectHypotheses}
            extraDetails={projectHypothesisDetails}
          />
        ) : activeSubPage === "terms" ? (
          <TermSheet
            isNewProject={isNewProject}
            project={project}
            inheritedTerms={projectTerms}
            extraDetails={projectTermDetails}
          />
        ) : activeSubPage === "overview" ? (
          <ProjectOverview project={project} isNewProject={isNewProject} />
        ) : activeSubPage === "materials" ? (
          <ProjectMaterials
            isNewProject={isNewProject}
            project={project}
            strategyMaterials={projectMaterials}
          />
        ) : null}
      </div>
    </div>
  )
}
