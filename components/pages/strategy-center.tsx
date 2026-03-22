"use client"

import { useState } from "react"
import { Briefcase, BookOpen, FileSearch } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  StrategiesGrid,
  type Strategy,
  type PendingStrategy,
} from "@/components/pages/strategies-grid"
import { ConsultationCenter } from "@/components/pages/consultation-center"
import { ResearchCenter } from "@/components/pages/research-center"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubPage = "consultation" | "research" | "strategies"

interface StrategyCenterProps {
  strategies: Strategy[]
  onStrategiesChange: (strategies: Strategy[]) => void
  onSelectStrategy?: (strategyId: string) => void
  onCreatePending?: (pending: PendingStrategy) => void
  initialSubPage?: SubPage
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

const tabs: { key: SubPage; label: string; icon: React.ReactNode }[] = [
  {
    key: "consultation",
    label: "资讯中心",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    key: "research",
    label: "研报中心",
    icon: <FileSearch className="h-4 w-4" />,
  },
  {
    key: "strategies",
    label: "策略列表",
    icon: <Briefcase className="h-4 w-4" />,
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function StrategyCenter({
  strategies,
  onStrategiesChange,
  onSelectStrategy,
  onCreatePending,
  initialSubPage = "consultation",
}: StrategyCenterProps) {
  const [subPage, setSubPage] = useState<SubPage>(initialSubPage)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Secondary navigation bar ── */}
      <div className="shrink-0 border-b border-border bg-white px-6">
        <nav className="flex items-center gap-0" role="tablist">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={subPage === key}
              onClick={() => setSubPage(key)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors select-none",
                subPage === key
                  ? "text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              {label}
              {subPage === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Page content ── */}
      <div className="flex-1 overflow-hidden">
        {subPage === "consultation" && <ConsultationCenter />}
        {subPage === "research" && <ResearchCenter />}
        {subPage === "strategies" && (
          <StrategiesGrid
            strategies={strategies}
            onStrategiesChange={onStrategiesChange}
            onSelectStrategy={onSelectStrategy}
            onCreatePending={onCreatePending}
          />
        )}
      </div>
    </div>
  )
}
