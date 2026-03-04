"use client"

import { useState } from "react"
import { AppTopbar, type TopNavKey } from "@/components/app-topbar"
import { ProjectsGrid, type Project, type PendingProject, initialProjects } from "@/components/pages/projects-grid"
import { StrategiesGrid, type Strategy, type PendingStrategy, initialStrategies } from "@/components/pages/strategies-grid"
import { ProjectDetail } from "@/components/pages/project-detail"
import { StrategyDetail } from "@/components/pages/strategy-detail"
import { ChangeRequests } from "@/components/pages/change-requests"
import { Login } from "@/components/pages/login"

type ViewState =
  | { type: "login" }
  | { type: "projects" }
  | { type: "strategies" }
  | { type: "change-requests" }
  | { type: "project-detail"; projectId: string }
  | { type: "strategy-detail"; strategyId: string }

export default function Page() {
  const [view, setView] = useState<ViewState>({ type: "login" })
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)
  const [pendingStrategies, setPendingStrategies] = useState<PendingStrategy[]>([])
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [pendingProjects, setPendingProjects] = useState<PendingProject[]>([])

  const activeNav: TopNavKey | null =
    view.type === "projects" || view.type === "project-detail"
      ? "projects"
      : view.type === "strategies" || view.type === "strategy-detail"
        ? "strategies"
        : view.type === "change-requests"
          ? "change-requests"
          : null

  function handleLogin() {
    setView({ type: "projects" })
  }

  function handleTopNav(nav: TopNavKey) {
    if (nav === "projects") {
      setView({ type: "projects" })
    } else if (nav === "strategies") {
      setView({ type: "strategies" })
    } else if (nav === "change-requests") {
      setView({ type: "change-requests" })
    }
  }

  function handleSelectProject(projectId: string) {
    setView({ type: "project-detail", projectId })
  }

  function handleSelectStrategy(strategyId: string) {
    setView({ type: "strategy-detail", strategyId })
  }

  // Strategy change request handlers
  function handleCreatePendingStrategy(pending: PendingStrategy) {
    setPendingStrategies([pending, ...pendingStrategies])
    setView({ type: "change-requests" })
  }

  function handleApproveStrategy(id: string) {
    const pending = pendingStrategies.find((p) => p.id === id)
    if (pending) {
      const newStrategy: Strategy = {
        id: `new-${Date.now()}`,
        ...pending.strategy,
      }
      setStrategies([newStrategy, ...strategies])
      setPendingStrategies(pendingStrategies.filter((p) => p.id !== id))
    }
  }

  function handleRejectStrategy(id: string) {
    setPendingStrategies(pendingStrategies.filter((p) => p.id !== id))
  }

  // Project change request handlers
  function handleCreatePendingProject(pending: PendingProject) {
    setPendingProjects([pending, ...pendingProjects])
    setView({ type: "change-requests" })
  }

  function handleApproveProject(id: string) {
    const pending = pendingProjects.find((p) => p.id === id)
    if (pending) {
      const newProject: Project = {
        id: `new-project-${Date.now()}`,
        ...pending.project,
      }
      setProjects([newProject, ...projects])
      setPendingProjects(pendingProjects.filter((p) => p.id !== id))
    }
  }

  function handleRejectProject(id: string) {
    setPendingProjects(pendingProjects.filter((p) => p.id !== id))
  }

  if (view.type === "login") {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav={activeNav} onNavigate={handleTopNav} />
      <main className="flex-1 overflow-hidden">
        {view.type === "projects" && (
          <ProjectsGrid 
            projects={projects}
            strategies={strategies}
            onProjectsChange={setProjects}
            onSelectProject={handleSelectProject}
            onCreatePending={handleCreatePendingProject}
          />
        )}
        {view.type === "strategies" && (
          <StrategiesGrid 
            strategies={strategies}
            onStrategiesChange={setStrategies}
            onSelectStrategy={handleSelectStrategy}
            onCreatePending={handleCreatePendingStrategy}
          />
        )}
        {view.type === "change-requests" && (
          <ChangeRequests
            pendingStrategies={pendingStrategies}
            pendingProjects={pendingProjects}
            onApproveStrategy={handleApproveStrategy}
            onRejectStrategy={handleRejectStrategy}
            onApproveProject={handleApproveProject}
            onRejectProject={handleRejectProject}
          />
        )}
        {view.type === "project-detail" && (
          <ProjectDetail 
            projectId={view.projectId}
            project={projects.find((p) => p.id === view.projectId)}
          />
        )}
        {view.type === "strategy-detail" && (
          <StrategyDetail 
            strategyId={view.strategyId} 
            strategy={strategies.find((s) => s.id === view.strategyId)}
          />
        )}
      </main>
    </div>
  )
}
