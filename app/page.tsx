"use client"

import { useState } from "react"
import { AppTopbar, type TopNavKey } from "@/components/app-topbar"
import { Dashboard } from "@/components/pages/dashboard"
import { ProjectsGrid, type Project, type PendingProject, initialProjects } from "@/components/pages/projects-grid"
import { StrategiesGrid, type Strategy, type PendingStrategy, type StrategyHypothesis, type PendingHypothesis, type StrategyTerm, type PendingTerm, type StrategyMaterial, type PendingMaterial, initialStrategies } from "@/components/pages/strategies-grid"
import { ProjectDetail } from "@/components/pages/project-detail"
import { StrategyDetail } from "@/components/pages/strategy-detail"
import { ChangeRequests } from "@/components/pages/change-requests"
import { Login } from "@/components/pages/login"
import type { Phase, PendingPhase, PendingProjectHypothesis, ProjectHypothesisFormData, GeneratedSuggestion } from "@/components/pages/workflow"
import { type HypothesisTableItem, type HypothesisDetail, getTemplateHypothesesForStrategy } from "@/components/pages/hypothesis-checklist"
import { type TermTableItem, getTemplateTermsForStrategy } from "@/components/pages/term-sheet"
import { getTemplateMaterialsForStrategy } from "@/components/pages/project-materials"

type ViewState =
  | { type: "login" }
  | { type: "dashboard" }
  | { type: "projects" }
  | { type: "strategies" }
  | { type: "change-requests" }
  | { type: "project-detail"; projectId: string }
  | { type: "strategy-detail"; strategyId: string; initialSubPage?: "overview" | "hypotheses" | "terms" | "materials" }

export default function Page() {
  const [view, setView] = useState<ViewState>({ type: "login" })
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)
  const [pendingStrategies, setPendingStrategies] = useState<PendingStrategy[]>([])
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [pendingProjects, setPendingProjects] = useState<PendingProject[]>([])
  // Workflow phases state per project - keyed by projectId
  const [projectPhases, setProjectPhases] = useState<Record<string, Phase[]>>({})
  const [pendingPhases, setPendingPhases] = useState<PendingPhase[]>([])
  // Strategy hypotheses state - keyed by strategyId
  const [strategyHypotheses, setStrategyHypotheses] = useState<Record<string, StrategyHypothesis[]>>({})
  const [pendingHypotheses, setPendingHypotheses] = useState<PendingHypothesis[]>([])
  // Strategy terms state - keyed by strategyId
  const [strategyTerms, setStrategyTerms] = useState<Record<string, StrategyTerm[]>>({})
  const [pendingTerms, setPendingTerms] = useState<PendingTerm[]>([])
  // Strategy materials state - keyed by strategyId
  const [strategyMaterials, setStrategyMaterials] = useState<Record<string, StrategyMaterial[]>>({})
  const [pendingMaterials, setPendingMaterials] = useState<PendingMaterial[]>([])
  // Project-level inherited data - keyed by projectId, initialized when project is approved
  const [projectHypotheses, setProjectHypotheses] = useState<Record<string, HypothesisTableItem[]>>({})
  const [projectHypothesisDetails, setProjectHypothesisDetails] = useState<Record<string, Record<string, HypothesisDetail>>>({})
  const [projectTerms, setProjectTerms] = useState<Record<string, TermTableItem[]>>({})
  const [projectMaterialsMap, setProjectMaterialsMap] = useState<Record<string, StrategyMaterial[]>>({})
  // Pending project-level hypotheses
  const [pendingProjectHypotheses, setPendingProjectHypotheses] = useState<PendingProjectHypothesis[]>([])
  // Saved generated hypothesis suggestions per project - keyed by projectId, persists for the session
  const [savedProjectSuggestions, setSavedProjectSuggestions] = useState<Record<string, GeneratedSuggestion[]>>({})
  // Strategy AI recommendation generated flags - keyed by strategyId, persists for the session
  const [strategyRecommendations, setStrategyRecommendations] = useState<
    Record<string, { hypothesesGenerated: boolean; termsGenerated: boolean; materialsGenerated: boolean }>
  >({})

  const activeNav: TopNavKey | null =
    view.type === "dashboard"
      ? "dashboard"
      : view.type === "projects" || view.type === "project-detail"
        ? "projects"
        : view.type === "strategies" || view.type === "strategy-detail"
          ? "strategies"
          : view.type === "change-requests"
            ? "change-requests"
            : null

  function handleLogin() {
    setView({ type: "dashboard" })
  }

  function handleTopNav(nav: TopNavKey) {
    if (nav === "dashboard") {
      setView({ type: "dashboard" })
    } else if (nav === "projects") {
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
      const newProjectId = `new-project-${Date.now()}`
      const newProject: Project = {
        id: newProjectId,
        ...pending.project,
      }
      setProjects([newProject, ...projects])
      setPendingProjects(pendingProjects.filter((p) => p.id !== id))

      // Inherit hypotheses from strategy template (all set to "待验证")
      const sid = pending.project.strategyId || ""
      const today = new Date().toISOString().split("T")[0]
      const templateHypotheses = getTemplateHypothesesForStrategy(sid)
      const userHypotheses: HypothesisTableItem[] = (strategyHypotheses[sid] || []).map((h, i) => ({
        id: `proj-h-${Date.now()}-${i}`,
        direction: h.direction,
        category: h.category,
        name: h.name,
        owner: h.owner,
        createdAt: h.createdAt,
        updatedAt: today,
        status: "pending" as const,
      }))
      setProjectHypotheses((prev) => ({
        ...prev,
        [newProjectId]: [...templateHypotheses, ...userHypotheses],
      }))

      // Inherit terms from strategy template (all set to "待审批")
      const templateTerms = getTemplateTermsForStrategy(sid)
      const userTerms: TermTableItem[] = (strategyTerms[sid] || []).map((t, i) => ({
        id: `proj-t-${Date.now()}-${i}`,
        direction: t.direction,
        category: t.category,
        name: t.name,
        owner: t.owner,
        createdAt: t.createdAt,
        updatedAt: today,
        status: "pending" as const,
      }))
      setProjectTerms((prev) => ({
        ...prev,
        [newProjectId]: [...templateTerms, ...userTerms],
      }))

      // Inherit materials: template mock materials + user-approved strategy materials + files uploaded during project creation
      const templateMaterials: StrategyMaterial[] = getTemplateMaterialsForStrategy(sid).map((m) => ({
        ...m,
        strategyId: sid,
        category: "",
        owner: "张伟",
        createdAt: today,
      }))
      const uploadedAtCreation: StrategyMaterial[] = (pending.uploadedFiles || []).map((f) => ({
        id: `uploaded-${f.id}-${Date.now()}`,
        strategyId: sid,
        name: f.name,
        format: f.format,
        size: f.size,
        category: "",
        description: f.description || "",
        owner: "张伟",
        createdAt: today,
      }))
      const inheritedMaterials: StrategyMaterial[] = [
        ...uploadedAtCreation,
        ...(strategyMaterials[sid] || []),
        ...templateMaterials,
      ]
      setProjectMaterialsMap((prev) => ({
        ...prev,
        [newProjectId]: inheritedMaterials,
      }))
    }
  }

  function handleRejectProject(id: string) {
    setPendingProjects(pendingProjects.filter((p) => p.id !== id))
  }

  // Workflow phase change request handlers
  function handleCreatePendingPhase(pending: PendingPhase) {
    setPendingPhases([pending, ...pendingPhases])
    setView({ type: "change-requests" })
  }

  function handleApprovePhase(id: string) {
    const pending = pendingPhases.find((p) => p.id === id)
    if (pending) {
      const { projectId, phase, changeType } = pending
      const currentPhases = projectPhases[projectId] || []
      
      // Mark previous active phase as completed if exists
      const updatedPhases = currentPhases.map((p) =>
        p.status === "active" 
          ? { ...p, status: "completed" as const, endDate: new Date().toISOString().split("T")[0] } 
          : p
      )
      
      // Add new phase with generated id
      const newPhase: Phase = {
        id: `${phase.groupLabel === "设立期" ? "setup" : "duration"}-${Date.now()}`,
        ...phase,
      }
      
      setProjectPhases({
        ...projectPhases,
        [projectId]: [...updatedPhases, newPhase],
      })
      setPendingPhases(pendingPhases.filter((p) => p.id !== id))
      
      // Navigate back to project detail
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectPhase(id: string) {
    setPendingPhases(pendingPhases.filter((p) => p.id !== id))
  }

  // Hypothesis change request handlers
  function handleCreatePendingHypothesis(pending: PendingHypothesis) {
    setPendingHypotheses([pending, ...pendingHypotheses])
    setView({ type: "change-requests" })
  }

  function handleApproveHypothesis(id: string) {
    const pending = pendingHypotheses.find((p) => p.id === id)
    if (pending) {
      const { strategyId } = pending.hypothesis
      const newHypothesis: StrategyHypothesis = {
        id: `hyp-${Date.now()}`,
        ...pending.hypothesis,
      }
      const currentHypotheses = strategyHypotheses[strategyId] || []
      setStrategyHypotheses({
        ...strategyHypotheses,
        [strategyId]: [newHypothesis, ...currentHypotheses],
      })
      setPendingHypotheses(pendingHypotheses.filter((p) => p.id !== id))
    }
  }

  function handleRejectHypothesis(id: string) {
    setPendingHypotheses(pendingHypotheses.filter((p) => p.id !== id))
  }

  // Project-level hypothesis change request handlers
  function handleCreatePendingProjectHypothesis(pending: PendingProjectHypothesis) {
    setPendingProjectHypotheses([pending, ...pendingProjectHypotheses])
    setView({ type: "change-requests" })
  }

  function handleApproveProjectHypothesis(id: string) {
    const pending = pendingProjectHypotheses.find((p) => p.id === id)
    if (pending) {
      const { projectId, hypothesis } = pending
      const today = new Date().toISOString().split("T")[0]
      const newId = `proj-hyp-${Date.now()}`
      const newHypothesis: HypothesisTableItem = {
        id: newId,
        direction: hypothesis.direction,
        category: hypothesis.category,
        name: hypothesis.name,
        owner: "张伟",
        createdAt: today,
        updatedAt: today,
        status: "pending" as const,
      }
      // Build a lookup map from materialId -> material info
      const matMap = new Map((pending.materialOptions || []).map((m) => [m.id, m]))
      const resolveMaterials = (ids: string[]) =>
        ids
          .map((id) => matMap.get(id))
          .filter(Boolean)
          .map((m) => ({ name: `${m!.name}.${m!.format.toLowerCase()}`, size: m!.size || "—", date: today }))

      // Build HypothesisDetail from form data, with empty committee/verification/terms
      const newDetail: HypothesisDetail = {
        id: newId,
        title: hypothesis.name,
        qaId: `QA-${newId}`,
        createdAt: today,
        updatedAt: today,
        status: "pending",
        creator: { name: "张伟", role: "投资经理" },
        valuePoints: hypothesis.valuePoints.map((vp) => ({
          id: vp.id,
          title: vp.title,
          evidence: { description: vp.evidenceDescription, files: resolveMaterials(vp.evidenceMaterialIds) },
          analysis: {
            content: vp.analysisContent,
            creator: { name: "张伟", role: "投资经理" },
            reviewers: [],
            createdAt: today,
          },
          comments: [],
        })),
        riskPoints: hypothesis.riskPoints.map((rp) => ({
          id: rp.id,
          title: rp.title,
          evidence: { description: rp.evidenceDescription, files: resolveMaterials(rp.evidenceMaterialIds) },
          analysis: {
            content: rp.analysisContent,
            creator: { name: "张伟", role: "投资经理" },
            reviewers: [],
            createdAt: today,
          },
          comments: [],
        })),
        committeeDecision: {
          conclusion: "",
          status: "pending",
          content: "",
          creator: { name: "", role: "" },
          reviewers: [],
          createdAt: "",
          comments: [],
        },
        verification: {
          conclusion: "",
          status: "pending",
          content: "",
          creator: { name: "", role: "" },
          reviewers: [],
          createdAt: "",
          comments: [],
        },
        linkedTerms: [],
      }
      const currentHypotheses = projectHypotheses[projectId] || []
      setProjectHypotheses({
        ...projectHypotheses,
        [projectId]: [newHypothesis, ...currentHypotheses],
      })
      setProjectHypothesisDetails((prev) => ({
        ...prev,
        [projectId]: { ...(prev[projectId] || {}), [newId]: newDetail },
      }))
      setPendingProjectHypotheses(pendingProjectHypotheses.filter((p) => p.id !== id))
      // Navigate to project detail to view the new hypothesis
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectProjectHypothesis(id: string) {
    setPendingProjectHypotheses(pendingProjectHypotheses.filter((p) => p.id !== id))
  }

  // Handler to save generated suggestions for a project
  function handleSaveProjectSuggestions(projectId: string, suggestions: GeneratedSuggestion[]) {
    setSavedProjectSuggestions((prev) => ({
      ...prev,
      [projectId]: suggestions,
    }))
  }

  // Term change request handlers
  function handleCreatePendingTerm(pending: PendingTerm) {
    setPendingTerms([pending, ...pendingTerms])
    setView({ type: "change-requests" })
  }

  function handleApproveTerm(id: string) {
    const pending = pendingTerms.find((p) => p.id === id)
    if (pending) {
      const { strategyId } = pending.term
      const newTerm: StrategyTerm = {
        id: `term-${Date.now()}`,
        ...pending.term,
      }
      const currentTerms = strategyTerms[strategyId] || []
      setStrategyTerms({
        ...strategyTerms,
        [strategyId]: [newTerm, ...currentTerms],
      })
      setPendingTerms(pendingTerms.filter((p) => p.id !== id))
    }
  }

  function handleRejectTerm(id: string) {
    setPendingTerms(pendingTerms.filter((p) => p.id !== id))
  }

  // Material change request handlers
  function handleCreatePendingMaterial(pending: PendingMaterial) {
    setPendingMaterials([pending, ...pendingMaterials])
    setView({ type: "change-requests" })
  }

  function handleApproveMaterial(id: string) {
    const pending = pendingMaterials.find((p) => p.id === id)
    if (pending) {
      const newMaterials: StrategyMaterial[] = pending.files.map((file, i) => ({
        id: `material-${Date.now()}-${i}`,
        strategyId: pending.strategyId,
        name: file.name,
        format: file.format,
        size: file.size,
        description: pending.description,
        category: pending.category,
        owner: "张伟",
        createdAt: new Date().toISOString().split("T")[0],
      }))
      const current = strategyMaterials[pending.strategyId] || []
      setStrategyMaterials({
        ...strategyMaterials,
        [pending.strategyId]: [...newMaterials, ...current],
      })
      setPendingMaterials(pendingMaterials.filter((p) => p.id !== id))
      // Navigate back to the strategy's 通用材料 page
      setView({ type: "strategy-detail", strategyId: pending.strategyId, initialSubPage: "materials" })
    }
  }

  function handleRejectMaterial(id: string) {
    setPendingMaterials(pendingMaterials.filter((p) => p.id !== id))
  }

  // Strategy recommendation flag handlers
  function handleSetStrategyRecommendation(
    strategyId: string,
    update: Partial<{ hypothesesGenerated: boolean; termsGenerated: boolean; materialsGenerated: boolean }>
  ) {
    setStrategyRecommendations((prev) => {
      const current = prev[strategyId] ?? { hypothesesGenerated: false, termsGenerated: false, materialsGenerated: false }
      return { ...prev, [strategyId]: { ...current, ...update } }
    })
  }

  // Helper to get hypotheses for a strategy
  function getHypothesesForStrategy(strategyId: string): StrategyHypothesis[] {
    return strategyHypotheses[strategyId] || []
  }

  // Helper to get terms for a strategy
  function getTermsForStrategy(strategyId: string): StrategyTerm[] {
    return strategyTerms[strategyId] || []
  }

  // Helper to get materials for a strategy
  function getMaterialsForStrategy(strategyId: string): StrategyMaterial[] {
    return strategyMaterials[strategyId] || []
  }

  // Helper to get phases for a project
  function getPhasesForProject(projectId: string): Phase[] {
    return projectPhases[projectId] || []
  }

  // Helper to update phases for a project
  function updatePhasesForProject(projectId: string, phases: Phase[]) {
    setProjectPhases({
      ...projectPhases,
      [projectId]: phases,
    })
  }

  if (view.type === "login") {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav={activeNav} onNavigate={handleTopNav} />
      <main className="flex-1 overflow-hidden">
        {view.type === "dashboard" && <Dashboard />}
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
  pendingPhases={pendingPhases}
  pendingHypotheses={pendingHypotheses}
  pendingProjectHypotheses={pendingProjectHypotheses}
  pendingTerms={pendingTerms}
  pendingMaterials={pendingMaterials}
  onApproveStrategy={handleApproveStrategy}
  onRejectStrategy={handleRejectStrategy}
  onApproveProject={handleApproveProject}
  onRejectProject={handleRejectProject}
  onApprovePhase={handleApprovePhase}
  onRejectPhase={handleRejectPhase}
  onApproveHypothesis={handleApproveHypothesis}
  onRejectHypothesis={handleRejectHypothesis}
  onApproveProjectHypothesis={handleApproveProjectHypothesis}
  onRejectProjectHypothesis={handleRejectProjectHypothesis}
  onApproveTerm={handleApproveTerm}
  onRejectTerm={handleRejectTerm}
  onApproveMaterial={handleApproveMaterial}
  onRejectMaterial={handleRejectMaterial}
  />
        )}
        {view.type === "project-detail" && (
<ProjectDetail
  projectId={view.projectId}
  project={projects.find((p) => p.id === view.projectId)}
  phases={getPhasesForProject(view.projectId)}
  onPhasesChange={(phases) => updatePhasesForProject(view.projectId, phases)}
  onCreatePendingPhase={handleCreatePendingPhase}
  onCreatePendingProjectHypothesis={handleCreatePendingProjectHypothesis}
  projectHypotheses={projectHypotheses[view.projectId]}
  projectHypothesisDetails={projectHypothesisDetails[view.projectId]}
  projectTerms={projectTerms[view.projectId]}
  projectMaterials={projectMaterialsMap[view.projectId]}
  savedGeneratedSuggestions={savedProjectSuggestions[view.projectId]}
  onSaveSuggestions={(suggestions) => handleSaveProjectSuggestions(view.projectId, suggestions)}
  />
        )}
        {view.type === "strategy-detail" && (
          <StrategyDetail
            strategyId={view.strategyId}
            strategy={strategies.find((s) => s.id === view.strategyId)}
            initialSubPage={view.initialSubPage}
            hypotheses={getHypothesesForStrategy(view.strategyId)}
            onCreatePendingHypothesis={handleCreatePendingHypothesis}
            strategyTerms={getTermsForStrategy(view.strategyId)}
            onCreatePendingTerm={handleCreatePendingTerm}
            strategyMaterials={getMaterialsForStrategy(view.strategyId)}
            onCreatePendingMaterial={handleCreatePendingMaterial}
            recommendations={strategyRecommendations[view.strategyId] || { hypothesesGenerated: false, termsGenerated: false, materialsGenerated: false }}
            onSetRecommendation={(update) => handleSetStrategyRecommendation(view.strategyId, update)}
          />
        )}
      </main>
    </div>
  )
}
