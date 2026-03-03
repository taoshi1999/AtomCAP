"use client"

import { useState } from "react"
import { AppTopbar, type TopNavKey } from "@/components/app-topbar"
import { ProjectsGrid } from "@/components/pages/projects-grid"
import { StrategiesGrid, type Strategy, initialStrategies } from "@/components/pages/strategies-grid"
import { ProjectDetail } from "@/components/pages/project-detail"
import { StrategyDetail } from "@/components/pages/strategy-detail"
import { Login } from "@/components/pages/login"

type ViewState =
  | { type: "login" }
  | { type: "projects" }
  | { type: "strategies" }
  | { type: "project-detail"; projectId: string }
  | { type: "strategy-detail"; strategyId: string }

export default function Page() {
  const [view, setView] = useState<ViewState>({ type: "login" })
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)

  const activeNav: TopNavKey | null =
    view.type === "projects" || view.type === "project-detail"
      ? "projects"
      : view.type === "strategies" || view.type === "strategy-detail"
        ? "strategies"
        : null

  function handleLogin() {
    setView({ type: "projects" })
  }

  function handleTopNav(nav: TopNavKey) {
    if (nav === "projects") {
      setView({ type: "projects" })
    } else {
      setView({ type: "strategies" })
    }
  }

  function handleSelectProject(projectId: string) {
    setView({ type: "project-detail", projectId })
  }

  function handleSelectStrategy(strategyId: string) {
    setView({ type: "strategy-detail", strategyId })
  }

  if (view.type === "login") {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav={activeNav} onNavigate={handleTopNav} />
      <main className="flex-1 overflow-hidden">
        {view.type === "projects" && (
          <ProjectsGrid onSelectProject={handleSelectProject} />
        )}
        {view.type === "strategies" && (
          <StrategiesGrid 
            strategies={strategies}
            onStrategiesChange={setStrategies}
            onSelectStrategy={handleSelectStrategy} 
          />
        )}
        {view.type === "project-detail" && (
          <ProjectDetail projectId={view.projectId} />
        )}
        {view.type === "strategy-detail" && (
          <StrategyDetail strategyId={view.strategyId} />
        )}
      </main>
    </div>
  )
}
