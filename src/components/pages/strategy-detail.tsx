"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { StrategyOverview } from "@/src/components/pages/strategy-overview"
import { StrategyHypotheses } from "@/src/components/pages/strategy-hypotheses"
import { StrategyTerms } from "@/src/components/pages/strategy-terms"
import { ProjectMaterials } from "@/src/components/pages/project-materials"
import { type Strategy, type StrategyHypothesis, type PendingHypothesis, type StrategyTerm, type PendingTerm, type StrategyMaterial, type PendingMaterial } from "@/src/components/pages/strategies-grid"
import type { MaterialPrefillData } from "@/src/components/pages/strategy-overview"

type SubPageKey = "overview" | "hypotheses" | "terms" | "materials"

interface SubNavItem {
  key: SubPageKey
  label: string
  icon: React.ElementType
}

const subNavItems: SubNavItem[] = [
  { key: "overview", label: "策略概览", icon: LayoutDashboard },
  { key: "hypotheses", label: "假设清单", icon: ListChecks },
  { key: "terms", label: "条款清单", icon: FileText },
  { key: "materials", label: "通用材料", icon: FolderOpen },
]

interface StrategyDetailProps {
  strategyId: string
  strategy?: Strategy
  initialSubPage?: SubPageKey
  hypotheses: StrategyHypothesis[]
  onCreatePendingHypothesis: (pending: PendingHypothesis) => void
  strategyTerms: StrategyTerm[]
  onCreatePendingTerm: (pending: PendingTerm) => void
  strategyMaterials: StrategyMaterial[]
  onCreatePendingMaterial: (pending: PendingMaterial) => void
  recommendations: { hypothesesGenerated: boolean; termsGenerated: boolean; materialsGenerated: boolean }
  onSetRecommendation: (update: Partial<{ hypothesesGenerated: boolean; termsGenerated: boolean; materialsGenerated: boolean }>) => void
}

export function StrategyDetail({
  strategyId,
  strategy,
  initialSubPage,
  hypotheses,
  onCreatePendingHypothesis,
  strategyTerms,
  onCreatePendingTerm,
  strategyMaterials,
  onCreatePendingMaterial,
  recommendations,
  onSetRecommendation,
}: StrategyDetailProps) {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>(initialSubPage || "overview")
  const [collapsed, setCollapsed] = useState(false)

  // AI推荐生成状态从 app/page.tsx 通过 props 传入，整个会话中持久化
  const { hypothesesGenerated, termsGenerated, materialsGenerated } = recommendations

  const [hypothesesPrefill, setHypothesesPrefill] = useState<{
    title: string
    direction: string
    category: string
    content: string
    reason: string
    relatedMaterials: string[]
  } | undefined>()
  const [termsPrefill, setTermsPrefill] = useState<{
    title: string
    direction: string
    category: string
    content: string
    relatedMaterials: string[]
    relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
  } | undefined>()

  const [materialsPrefill, setMaterialsPrefill] = useState<MaterialPrefillData | undefined>()

  // 处理从概览页跳转到假设清单
  const handleNavigateToHypotheses = (prefillData?: {
    title: string
    direction: string
    category: string
    content: string
    reason: string
    relatedMaterials: string[]
  }) => {
    setHypothesesPrefill(prefillData)
    setActiveSubPage("hypotheses")
  }

  // 处理从概览页跳转到条款清单
  const handleNavigateToTerms = (prefillData?: {
    title: string
    direction: string
    category: string
    content: string
    relatedMaterials: string[]
    relatedHypotheses: { id: string; direction: string; category: string; name: string }[]
  }) => {
    setTermsPrefill(prefillData)
    setActiveSubPage("terms")
  }

  // 处理从概览页跳转到通用材料
  const handleNavigateToMaterials = (prefillData?: MaterialPrefillData) => {
    setMaterialsPrefill(prefillData)
    setActiveSubPage("materials")
  }

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
        {activeSubPage === "overview" ? (
          <StrategyOverview
            strategy={strategy}
            onNavigateToHypotheses={handleNavigateToHypotheses}
            onNavigateToTerms={handleNavigateToTerms}
            onNavigateToMaterials={handleNavigateToMaterials}
            hypothesesGenerated={hypothesesGenerated}
            onSetHypothesesGenerated={(v) => onSetRecommendation({ hypothesesGenerated: v })}
            termsGenerated={termsGenerated}
            onSetTermsGenerated={(v) => onSetRecommendation({ termsGenerated: v })}
            materialsGenerated={materialsGenerated}
            onSetMaterialsGenerated={(v) => onSetRecommendation({ materialsGenerated: v })}
          />
        ) : activeSubPage === "hypotheses" ? (
          <StrategyHypotheses
            strategyId={strategyId}
            isNewStrategy={strategyId.startsWith("new-")}
            prefillData={hypothesesPrefill}
            onPrefillUsed={() => setHypothesesPrefill(undefined)}
            strategyType={strategy?.parentStrategyId ? "赛道策略" : "主题策略"}
            parentStrategyName={strategy?.parentStrategyName}
            hypotheses={hypotheses}
            onCreatePendingHypothesis={onCreatePendingHypothesis}
          />
        ) : activeSubPage === "terms" ? (
          <StrategyTerms
            strategyId={strategyId}
            isNewStrategy={strategyId.startsWith("new-")}
            prefillData={termsPrefill}
            onPrefillUsed={() => setTermsPrefill(undefined)}
            strategyType={strategy?.parentStrategyId ? "赛道策略" : "主题策略"}
            parentStrategyName={strategy?.parentStrategyName}
            strategyTerms={strategyTerms}
            onCreatePendingTerm={onCreatePendingTerm}
          />
        ) : (
          <ProjectMaterials
            isNewProject={strategyId.startsWith("new-")}
            project={{ name: strategy?.name }}
            strategyType={strategy?.parentStrategyId ? "赛道策略" : "主题策略"}
            parentStrategyName={strategy?.parentStrategyName}
            strategyId={strategyId}
            strategyMaterials={strategyMaterials}
            onCreatePendingMaterial={onCreatePendingMaterial}
            materialPrefill={materialsPrefill}
            onMaterialPrefillUsed={() => setMaterialsPrefill(undefined)}
          />
        )}
      </div>
    </div>
  )
}
