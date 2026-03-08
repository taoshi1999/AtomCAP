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
import { cn } from "@/lib/utils"
import { StrategyOverview } from "@/components/pages/strategy-overview"
import { StrategyHypotheses } from "@/components/pages/strategy-hypotheses"
import { StrategyTerms } from "@/components/pages/strategy-terms"
import { ProjectMaterials } from "@/components/pages/project-materials"
import { type Strategy } from "@/components/pages/strategies-grid"

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
}

export function StrategyDetail({ strategyId, strategy }: StrategyDetailProps) {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>("overview")
  const [collapsed, setCollapsed] = useState(false)
  const [hypothesesPrefill, setHypothesesPrefill] = useState<{
    title: string
    direction: string
    category: string
    content: string
    reason: string
    relatedMaterials: string[]
  } | undefined>()
  const [termsPrefill, setTermsPrefill] = useState<{ title: string; content: string; category: string } | undefined>()

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
  const handleNavigateToTerms = (prefillData?: { title: string; content: string; category: string }) => {
    setTermsPrefill(prefillData)
    setActiveSubPage("terms")
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
          />
        ) : activeSubPage === "hypotheses" ? (
          <StrategyHypotheses
            isNewStrategy={strategyId.startsWith("new-")}
            prefillData={hypothesesPrefill}
            onPrefillUsed={() => setHypothesesPrefill(undefined)}
            strategyType={strategy?.type}
            parentStrategyName={strategy?.parentStrategyName}
          />
        ) : activeSubPage === "terms" ? (
          <StrategyTerms
            isNewStrategy={strategyId.startsWith("new-")}
            prefillData={termsPrefill}
            onPrefillUsed={() => setTermsPrefill(undefined)}
            strategyType={strategy?.type}
            parentStrategyName={strategy?.parentStrategyName}
          />
        ) : (
          <ProjectMaterials
            isNewProject={strategyId.startsWith("new-")}
            project={{ name: strategy?.name }}
            strategyType={strategy?.type}
            parentStrategyName={strategy?.parentStrategyName}
          />
        )}
      </div>
    </div>
  )
}
