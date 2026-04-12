"use client"

import { useState, useEffect } from "react"
import { AppTopbar, type TopNavKey } from "@/components/app-topbar"
import { Dashboard } from "@/components/pages/dashboard"
import { ProjectsGrid, type Project, type PendingProject, getStatusColor } from "@/components/pages/projects-grid"
import { type Strategy, type PendingStrategy, type StrategyHypothesis, type PendingHypothesis, type StrategyTerm, type PendingTerm, type StrategyMaterial, type PendingMaterial, initialStrategies } from "@/components/pages/strategies-grid"
import { StrategyCenter } from "@/components/pages/strategy-center"
import type { AnalysisFramework, PendingFramework } from "@/components/pages/analysis-frameworks"
import { ProjectDetail } from "@/components/pages/project-detail"
import { StrategyDetail } from "@/components/pages/strategy-detail"
import { ChangeRequests } from "@/components/pages/change-requests"
import { Login } from "@/components/pages/login"
import type { Phase, PendingPhase, LiXiangRecord, TouJueRecord, HuaKuanRecord, TuiChuRecord, PendingProjectHypothesis, ProjectHypothesisFormData, GeneratedSuggestion, GeneratedTermSuggestion, PendingProjectTerm, PendingProjectMaterial, GeneratedMaterialSuggestion, GeneratedAiResearchGroup, PendingCommitteeDecision, CommitteeDecisionFormData, PendingNegotiationDecision, NegotiationDecisionFormData, PendingVerification, VerificationFormData, PendingImplementationStatus, ImplementationStatusFormData } from "@/components/pages/workflow"
import { type HypothesisTableItem, type HypothesisDetail, type ValuePoint, type RiskPoint, getTemplateHypothesesForStrategy, midInvestmentHypotheses } from "@/components/pages/hypothesis-checklist"
import { type TermTableItem, type TermDetail, getTemplateTermsForStrategy, midInvestmentTerms, postInvestmentTerms } from "@/components/pages/term-sheet"
import { getTemplateMaterialsForStrategy } from "@/components/pages/project-materials"
import { getTrackStrategyHypothesisTemplate } from "@/components/pages/strategy-hypotheses"
import { getTrackStrategyTermTemplate } from "@/components/pages/strategy-terms"

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
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          const mappedProjects: Project[] = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            logo: p.logo || p.name.charAt(0),
            description: p.description || "",
            tags: p.tags || [],
            status: p.status,
            statusColor: getStatusColor(p.status),
            valuation: p.valuation || "待定",
            round: p.round || "",
            owner: { id: p.ownerId || "", name: p.ownerName || "待分配", initials: p.ownerName?.charAt(0) || "待" },
            strategyId: p.strategyId,
            strategyName: p.strategyName,
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          }))
          setProjects(mappedProjects)
        }
      } catch (error) {
        console.error('加载项目失败:', error)
      } finally {
        setIsLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  const [pendingProjects, setPendingProjects] = useState<PendingProject[]>([])
  // Workflow phases state per project - keyed by projectId
  const [projectPhases, setProjectPhases] = useState<Record<string, Phase[]>>({})
  const [pendingPhases, setPendingPhases] = useState<PendingPhase[]>([])
  const [exitedProjects, setExitedProjects] = useState<Record<string, boolean>>({})
  // 立项 record per new project (set when a 立项 pending phase is approved)
  const [liXiangRecords, setLiXiangRecords] = useState<Record<string, LiXiangRecord>>({})
  // 投决 record per new project (set when a 投决 pending phase is approved)
  const [touJueRecords, setTouJueRecords] = useState<Record<string, TouJueRecord>>({})
  // 划款 record per new project (set when a 划款 pending phase is approved)
  const [huaKuanRecords, setHuaKuanRecords] = useState<Record<string, HuaKuanRecord>>({})
  // 退出 record per new project (set when a 退出 pending phase is approved)
  const [tuiChuRecords, setTuiChuRecords] = useState<Record<string, TuiChuRecord>>({})
  // Strategy hypotheses state - keyed by strategyId
  const [strategyHypotheses, setStrategyHypotheses] = useState<Record<string, StrategyHypothesis[]>>({})
  const [pendingHypotheses, setPendingHypotheses] = useState<PendingHypothesis[]>([])
  // Strategy terms state - keyed by strategyId
  const [strategyTerms, setStrategyTerms] = useState<Record<string, StrategyTerm[]>>({})
  const [pendingTerms, setPendingTerms] = useState<PendingTerm[]>([])
  // Strategy materials state - keyed by strategyId
  const [strategyMaterials, setStrategyMaterials] = useState<Record<string, StrategyMaterial[]>>({})
  const [pendingMaterials, setPendingMaterials] = useState<PendingMaterial[]>([])
  // Framework change requests
  const [pendingFrameworks, setPendingFrameworks] = useState<PendingFramework[]>([])
  const [createdFrameworks, setCreatedFrameworks] = useState<AnalysisFramework[]>([])
  // Project-level inherited data - keyed by projectId, initialized when project is approved
  const [projectHypotheses, setProjectHypotheses] = useState<Record<string, HypothesisTableItem[]>>({})
  const [projectHypothesisDetails, setProjectHypothesisDetails] = useState<Record<string, Record<string, HypothesisDetail>>>({})
  const [projectTerms, setProjectTerms] = useState<Record<string, TermTableItem[]>>({})
  const [projectMaterialsMap, setProjectMaterialsMap] = useState<Record<string, StrategyMaterial[]>>({})
  // Pending project-level hypotheses
  const [pendingProjectHypotheses, setPendingProjectHypotheses] = useState<PendingProjectHypothesis[]>([])
  const [pendingCommitteeDecisions, setPendingCommitteeDecisions] = useState<PendingCommitteeDecision[]>([])
  const [pendingNegotiationDecisions, setPendingNegotiationDecisions] = useState<PendingNegotiationDecision[]>([])
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([])
  const [pendingImplementationStatuses, setPendingImplementationStatuses] = useState<PendingImplementationStatus[]>([])
  const [pendingProjectTerms, setPendingProjectTerms] = useState<PendingProjectTerm[]>([])
  const [projectTermDetails, setProjectTermDetails] = useState<Record<string, Record<string, TermDetail>>>({})
  // Saved generated hypothesis suggestions per project - keyed by projectId, persists for the session
  const [savedProjectSuggestions, setSavedProjectSuggestions] = useState<Record<string, GeneratedSuggestion[]>>({})
  const [savedProjectTermSuggestions, setSavedProjectTermSuggestions] = useState<Record<string, GeneratedTermSuggestion[]>>({})
  const [pendingProjectMaterials, setPendingProjectMaterials] = useState<PendingProjectMaterial[]>([])
  const [savedProjectMaterialSuggestions, setSavedProjectMaterialSuggestions] = useState<Record<string, GeneratedMaterialSuggestion[]>>({})
  const [savedProjectAiResearchGroups, setSavedProjectAiResearchGroups] = useState<Record<string, GeneratedAiResearchGroup[]>>({})
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
      const newStrategyId = `new-${Date.now()}`
      const newStrategy: Strategy = {
        id: newStrategyId,
        ...pending.strategy,
      }
      setStrategies([newStrategy, ...strategies])

      // Initialize hypotheses for the new strategy if generated during creation
      if (pending.generatedHypotheses && pending.generatedHypotheses.length > 0) {
        const newHypotheses: StrategyHypothesis[] = pending.generatedHypotheses.map((h, idx) => ({
          id: `sh-${newStrategyId}-${idx}`,
          strategyId: newStrategyId,
          direction: h.direction,
          category: h.category,
          name: h.name,
          content: "",
          reason: "",
          status: "pending" as const,
          owner: "张伟",
          createdAt: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString().split("T")[0],
        }))
        setStrategyHypotheses((prev) => ({ ...prev, [newStrategyId]: newHypotheses }))
      }

      // Initialize terms for the new strategy if generated during creation
      if (pending.generatedTerms && pending.generatedTerms.length > 0) {
        const newTerms: StrategyTerm[] = pending.generatedTerms.map((t, idx) => ({
          id: `st-${newStrategyId}-${idx}`,
          strategyId: newStrategyId,
          direction: t.direction,
          category: t.category,
          name: t.name,
          content: "",
          reason: "",
          status: "pending" as const,
          owner: "张伟",
          createdAt: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString().split("T")[0],
        }))
        setStrategyTerms((prev) => ({ ...prev, [newStrategyId]: newTerms }))
      }

      // Initialize materials for the new strategy from uploaded files during creation
      if (pending.uploadedMaterials && pending.uploadedMaterials.length > 0) {
        const newMaterials: StrategyMaterial[] = pending.uploadedMaterials.map((m, idx) => ({
          id: `sm-${newStrategyId}-${idx}`,
          strategyId: newStrategyId,
          name: m.name.replace(/\.[^.]+$/, ""), // strip file extension
          format: m.type || "PDF", // map type to format, default to PDF if undefined
          size: m.size,
          description: m.description || "",
          category: "通用材料",
          owner: "张伟",
          createdAt: new Date().toISOString().split("T")[0],
        }))
        setStrategyMaterials((prev) => ({ ...prev, [newStrategyId]: newMaterials }))
      }

      setPendingStrategies(pendingStrategies.filter((p) => p.id !== id))
    }
  }

  function handleRejectStrategy(id: string) {
    setPendingStrategies(pendingStrategies.filter((p) => p.id !== id))
  }

  // Framework change request handlers
  function handleCreatePendingFramework(pending: PendingFramework) {
    setPendingFrameworks([pending, ...pendingFrameworks])
    setView({ type: "change-requests" })
  }

  function handleApproveFramework(id: string) {
    const pending = pendingFrameworks.find((p) => p.id === id)
    if (pending) {
      const already = createdFrameworks.some((f) => f.id === pending.framework.id)
      if (!already) {
        setCreatedFrameworks([pending.framework, ...createdFrameworks])
      }
      setPendingFrameworks(pendingFrameworks.filter((p) => p.id !== id))
    }
  }

  function handleRejectFramework(id: string) {
    setPendingFrameworks(pendingFrameworks.filter((p) => p.id !== id))
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
      
      // Call API to save project to database
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pending.project.name,
          logo: pending.project.logo,
          description: pending.project.description,
          tags: pending.project.tags,
          valuation: pending.project.valuation,
          round: pending.project.round,
          ownerId: pending.project.owner.id,
          ownerName: pending.project.owner.name,
          strategyId: pending.project.strategyId,
          strategyName: pending.project.strategyName,
        }),
      })
        .then((res) => res.json())
        .then((savedProject) => {
          // Use the id from database
          const dbProjectId = savedProject.id || newProjectId
          const newProject: Project = {
            id: dbProjectId,
            ...pending.project,
          }
          setProjects((prev) => [newProject, ...prev])
        })
        .catch((err) => {
          console.error('保存项目失败:', err)
          // Still add to local state even if API fails
          const newProject: Project = {
            id: newProjectId,
            ...pending.project,
          }
          setProjects((prev) => [newProject, ...prev])
        })
      
      setPendingProjects(pendingProjects.filter((p) => p.id !== id))

      // Inherit hypotheses from strategy template (all set to "待验证")
      const sid = pending.project.strategyId || ""
      const today = new Date().toISOString().split("T")[0]

      // Detect if strategy is a track strategy (赛道策略) to determine template data source
      const strategy = strategies.find((s) => s.id === sid)
      const isTrackStrategy = strategy?.type === "赛道策略"

      // For track strategies, use the strategy view template data (hypotheses shown in strategy view)
      // For strategy "1" or other theme strategies, use the existing template helper
      const templateHypotheses: HypothesisTableItem[] = isTrackStrategy
        ? getTrackStrategyHypothesisTemplate().map((h) => ({
          id: `strategy-tmpl-${h.id}`,
          direction: h.direction,
          category: h.category,
          name: h.name,
          owner: h.owner,
          createdAt: h.createdAt,
          updatedAt: today,
          status: "pending" as const,
        }))
        : getTemplateHypothesesForStrategy(sid)

      // Include both approved strategy hypotheses and pending ones (not yet approved)
      const pendingStrategyHypotheses = pendingHypotheses
        .filter((p) => p.hypothesis.strategyId === sid)
        .map((p) => p.hypothesis)
      const allStrategyHypotheses = [...(strategyHypotheses[sid] || []), ...pendingStrategyHypotheses]
      const userHypotheses: HypothesisTableItem[] = allStrategyHypotheses.map((h, i) => ({
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
      // For track strategies, use the strategy view term data; otherwise use existing helper
      const templateTerms: TermTableItem[] = isTrackStrategy
        ? getTrackStrategyTermTemplate().map((t) => ({
          id: `strategy-tmpl-${t.id}`,
          direction: t.direction,
          category: t.category,
          name: t.name,
          owner: t.owner,
          createdAt: t.createdAt,
          updatedAt: today,
          status: "pending" as const,
        }))
        : getTemplateTermsForStrategy(sid)

      // Include both approved strategy terms and pending ones (not yet approved)
      const pendingStrategyTerms = pendingTerms
        .filter((p) => p.term.strategyId === sid)
        .map((p) => p.term)
      const allStrategyTerms = [...(strategyTerms[sid] || []), ...pendingStrategyTerms]
      const userTerms: TermTableItem[] = allStrategyTerms.map((t, i) => ({
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

      // Inherit materials: template mock materials + user-approved strategy materials + pending strategy materials + files uploaded during project creation
      // For track strategies that have no specific material template, fall back to strategy "1" materials library
      const rawMaterialTemplate = isTrackStrategy && getTemplateMaterialsForStrategy(sid).length === 0
        ? getTemplateMaterialsForStrategy("1")
        : getTemplateMaterialsForStrategy(sid)
      const templateMaterials: StrategyMaterial[] = rawMaterialTemplate.map((m) => ({
        ...m,
        strategyId: sid,
        category: "",
        owner: "张伟",
        createdAt: today,
      }))
      const uploadedAtCreation: StrategyMaterial[] = (pending.uploadedFiles || []).map((f) => ({
        id: `uploaded-${f.id}-${Date.now()}`,
        strategyId: sid,
        name: f.name.replace(/\.[^.]+$/, ""), // strip file extension (e.g. "闫俊杰_CV.pdf" → "闫俊杰_CV")
        format: f.format,
        size: f.size,
        category: "",
        description: f.description || "",
        owner: "张伟",
        createdAt: today,
      }))
      // Include both approved strategy materials and pending ones (not yet approved)
      const pendingStrategyMaterialFiles: StrategyMaterial[] = pendingMaterials
        .filter((p) => p.strategyId === sid)
        .flatMap((p, pi) =>
          p.files.map((f, fi) => ({
            id: `pending-mat-${pi}-${fi}-${Date.now()}`,
            strategyId: sid,
            name: f.name,
            format: f.format,
            size: f.size,
            description: p.description,
            category: p.category,
            owner: "张伟",
            createdAt: today,
          }))
        )
      const inheritedMaterials: StrategyMaterial[] = [
        ...uploadedAtCreation,
        ...(strategyMaterials[sid] || []),
        ...pendingStrategyMaterialFiles,
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

      // Snapshot current project counts so completed phase cards display accurate numbers
      const snapshotHypothesesCount =
        (projectHypotheses[projectId]?.length ?? 0) +
        pendingProjectHypotheses.filter((h) => h.projectId === projectId).length
      const snapshotTermsCount =
        (projectTerms[projectId]?.length ?? 0) +
        pendingProjectTerms.filter((t) => t.projectId === projectId).length
      const snapshotMaterialsCount =
        (projectMaterialsMap[projectId]?.length ?? 0) +
        pendingProjectMaterials.filter((m) => m.projectId === projectId).length

      // Mark previous active phase as completed if exists
      const updatedPhases = currentPhases.map((p) =>
        p.status === "active"
          ? {
            ...p,
            status: "completed" as const,
            endDate: new Date().toISOString().split("T")[0],
            hypothesesCount: snapshotHypothesesCount,
            termsCount: snapshotTermsCount,
            materialsCount: snapshotMaterialsCount,
          }
          : p
      )

      // 退出: just complete active phase + mark project as exited, no new phase added
      if (changeType === "退出") {
        setProjectPhases({ ...projectPhases, [projectId]: updatedPhases })
        setExitedProjects((prev) => ({ ...prev, [projectId]: true }))
        setTuiChuRecords((prev) => ({
          ...prev,
          [projectId]: {
            details: pending.tuiChuDetails || "",
            owners: pending.tuiChuOwners || [],
            time: new Date().toISOString().split("T")[0],
          },
        }))
        // Update project card status to 已退出
        setProjects((prev) => prev.map((p) =>
          p.id === projectId ? { ...p, status: "已退出", statusColor: getStatusColor("已退出") } : p
        ))
        setPendingPhases(pendingPhases.filter((p) => p.id !== id))
        setView({ type: "project-detail", projectId })
        return
      }

      // Add new phase with generated id
      const prefixMap: Record<string, string> = {
        "设立期": "setup", "存续期": "duration",
        "投前期": "pre-inv", "投中期": "mid-inv", "投后期": "post-inv",
      }
      const newPhase: Phase = {
        id: `${prefixMap[phase.groupLabel] ?? "phase"}-${Date.now()}`,
        ...phase,
      }

      setProjectPhases({
        ...projectPhases,
        [projectId]: [...updatedPhases, newPhase],
      })
      // Update project card status based on the new phase's groupLabel
      const phaseStatusMap: Record<string, string> = {
        "投前期": "投前期",
        "投中期": "投中期",
        "投后期": "投后期",
      }
      const newStatus = phaseStatusMap[phase.groupLabel]
      if (newStatus) {
        setProjects((prev) => prev.map((p) =>
          p.id === projectId ? { ...p, status: newStatus, statusColor: getStatusColor(newStatus) } : p
        ))
      }
      // When a 立项 phase is approved, store the 立项 record for display in the workflow
      if (changeType === "立项") {
        setLiXiangRecords((prev) => ({
          ...prev,
          [projectId]: {
            details: pending.liXiangDetails || "",
            owners: pending.liXiangOwners || [],
            time: new Date().toISOString().split("T")[0],
          },
        }))
      }
      // When a 投决 phase is approved, store the 投决 record for display in the workflow
      // and add mid-investment hypotheses with statuses (first 18 verified, rest risky)
      if (changeType === "投决") {
        setTouJueRecords((prev) => ({
          ...prev,
          [projectId]: {
            details: pending.touJueDetails || "",
            owners: pending.touJueOwners || [],
            time: new Date().toISOString().split("T")[0],
          },
        }))
        // Add mid-investment hypotheses (ai-h8 to ai-h21) and set statuses:
        // first 18 → verified (成立), rest → risky (不成立)
        const currentHypotheses = projectHypotheses[projectId] || []
        const combined = [...currentHypotheses, ...midInvestmentHypotheses]
        const withStatuses = combined.map((h, idx) => ({
          ...h,
          status: (idx < 18 ? "verified" : "risky") as "verified" | "pending" | "risky",
        }))
        setProjectHypotheses((prev) => ({ ...prev, [projectId]: withStatuses }))
        // Add mid-investment terms (资本安全与下行保护条款) when entering 投中期
        // statuses are pre-set: 4 approved, 2 rejected, 1 pending
        const currentTerms = projectTerms[projectId] || []
        const hasAlreadyAdded = currentTerms.some((t) => t.id.startsWith("mid-t"))
        if (!hasAlreadyAdded) {
          setProjectTerms((prev) => ({
            ...prev,
            [projectId]: [...currentTerms, ...midInvestmentTerms],
          }))
        }
      }
      // When a 划款 phase is approved, store the 划款 record for display in the workflow
      // and add post-investment terms with statuses (4 rejected, rest approved)
      if (changeType === "划款") {
        setHuaKuanRecords((prev) => ({
          ...prev,
          [projectId]: {
            details: pending.huaKuanDetails || "",
            currency: pending.huaKuanCurrency || "USD",
            amount: pending.huaKuanAmount || "",
            owners: pending.huaKuanOwners || [],
            time: new Date().toISOString().split("T")[0],
          },
        }))
        // Add post-investment terms (控制权与治理稳定 + 激励与长期一致性) when entering 投后期
        // Then set statuses: 4 rejected (否决), rest approved (通过)
        const currentTerms = projectTerms[projectId] || []
        const hasAlreadyAdded = currentTerms.some((t) => t.id.startsWith("post-t"))
        if (!hasAlreadyAdded) {
          const combined = [...currentTerms, ...postInvestmentTerms]
          const totalTerms = combined.length
          // Last 4 terms → rejected, rest → approved
          const withStatuses = combined.map((t, idx) => ({
            ...t,
            status: (idx >= totalTerms - 4 ? "rejected" : "approved") as "approved" | "pending" | "rejected",
          }))
          setProjectTerms((prev) => ({ ...prev, [projectId]: withStatuses }))
        }
      }
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

  // Value/risk point direct addition handlers
  function handleAddValuePoint(projectId: string, hypothesisId: string, vp: ValuePoint) {
    setProjectHypothesisDetails((prev) => {
      const projectDetails = prev[projectId] || {}
      const existingDetail = projectDetails[hypothesisId]
      if (!existingDetail) return prev
      return {
        ...prev,
        [projectId]: {
          ...projectDetails,
          [hypothesisId]: {
            ...existingDetail,
            valuePoints: [...existingDetail.valuePoints, vp],
          },
        },
      }
    })
  }

  function handleAddRiskPoint(projectId: string, hypothesisId: string, rp: RiskPoint) {
    setProjectHypothesisDetails((prev) => {
      const projectDetails = prev[projectId] || {}
      const existingDetail = projectDetails[hypothesisId]
      if (!existingDetail) return prev
      return {
        ...prev,
        [projectId]: {
          ...projectDetails,
          [hypothesisId]: {
            ...existingDetail,
            riskPoints: [...existingDetail.riskPoints, rp],
          },
        },
      }
    })
  }

  // Committee decision change request handlers
  function handleCreateCommitteeDecision(projectId: string, hypothesisId: string, hypothesisName: string, data: CommitteeDecisionFormData) {
    const today = new Date().toISOString().split("T")[0]
    const project = projects.find((p) => p.id === projectId)
    const pending: PendingCommitteeDecision = {
      id: `cd-${Date.now()}`,
      projectId,
      projectName: project?.name || "",
      hypothesisId,
      hypothesisName,
      decision: data,
      changeId: `CD-${Date.now()}`,
      changeName: `更新假设审议结果: ${hypothesisName}`,
      changeType: "committee-decision",
      initiator: { id: "zhangwei", name: "张伟", initials: "ZW" },
      initiatedAt: today,
      reviewers: [
        { id: "wangzong", name: "王总", initials: "WZ" },
        { id: "chenzong", name: "陈总", initials: "CZ" },
      ],
    }
    setPendingCommitteeDecisions((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveCommitteeDecision(id: string) {
    const pending = pendingCommitteeDecisions.find((p) => p.id === id)
    if (pending) {
      const { projectId, hypothesisId, decision } = pending
      const today = new Date().toISOString().split("T")[0]
      // Update the committeeDecision and status in projectHypothesisDetails
      setProjectHypothesisDetails((prev) => {
        const projectDetails = prev[projectId] || {}
        const existingDetail = projectDetails[hypothesisId]
        const hypothesis = (projectHypotheses[projectId] || []).find((h) => h.id === hypothesisId)
        const newStatus = decision.conclusion === "假设成立" ? "verified" as const : "risky" as const
        const newDecision = {
          conclusion: decision.conclusion,
          status: decision.conclusion === "假设成立" ? "approved" as const : "rejected" as const,
          content: decision.content,
          creator: { name: "张伟", role: "投资经理" },
          reviewers: decision.reviewers,
          createdAt: today,
          comments: [] as { author: string; content: string; time: string }[],
        }
        const updatedDetail: HypothesisDetail = existingDetail
          ? { ...existingDetail, status: newStatus, committeeDecision: newDecision }
          : {
            id: hypothesisId,
            title: hypothesis?.name || "",
            qaId: `QA-${Date.now()}`,
            createdAt: hypothesis?.createdAt || today,
            updatedAt: today,
            status: newStatus,
            creator: { name: "张伟", role: "投资经理" },
            valuePoints: [],
            riskPoints: [],
            committeeDecision: newDecision,
            verification: {
              conclusion: "",
              status: "pending" as const,
              content: "",
              creator: { name: "张伟", role: "投资经理" },
              reviewers: [],
              createdAt: "",
              comments: [],
            },
            linkedTerms: [],
          }
        return {
          ...prev,
          [projectId]: {
            ...projectDetails,
            [hypothesisId]: updatedDetail,
          },
        }
      })
      // Update hypothesis status in projectHypotheses
      setProjectHypotheses((prev) => {
        const hypotheses = prev[projectId] || []
        return {
          ...prev,
          [projectId]: hypotheses.map((h) =>
            h.id === hypothesisId
              ? { ...h, status: decision.conclusion === "假设成立" ? "verified" as const : "risky" as const }
              : h
          ),
        }
      })
      setPendingCommitteeDecisions((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectCommitteeDecision(id: string) {
    setPendingCommitteeDecisions((prev) => prev.filter((p) => p.id !== id))
  }

  // Negotiation decision change request handlers
  function handleCreateNegotiationDecision(projectId: string, termId: string, termName: string, data: NegotiationDecisionFormData) {
    const today = new Date().toISOString().split("T")[0]
    const project = projects.find((p) => p.id === projectId)
    const pending: PendingNegotiationDecision = {
      id: `nd-${Date.now()}`,
      projectId,
      projectName: project?.name || "",
      termId,
      termName,
      decision: data,
      changeId: `ND-${Date.now()}`,
      changeName: `更新条款谈判结果: ${termName}`,
      changeType: "negotiation-decision",
      initiator: { id: "zhangwei", name: "张伟", initials: "ZW" },
      initiatedAt: today,
      reviewers: [
        { id: "wangzong", name: "王总", initials: "WZ" },
        { id: "chenzong", name: "陈总", initials: "CZ" },
      ],
    }
    setPendingNegotiationDecisions((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveNegotiationDecision(id: string) {
    const pending = pendingNegotiationDecisions.find((p) => p.id === id)
    if (pending) {
      const { projectId, termId, decision } = pending
      const today = new Date().toISOString().split("T")[0]
      const newStatus = decision.conclusion === "通过" ? "approved" as const : "rejected" as const
      const newNegotiationResult = {
        conclusion: decision.conclusion === "通过" ? "谈判达成" : "谈判否决",
        status: decision.conclusion === "通过" ? "agreed" as const : "rejected" as const,
        content: decision.content,
        creator: { name: "张伟", role: "投资经理" },
        reviewers: decision.reviewers,
        createdAt: today,
        comments: [] as { author: string; content: string; time: string }[],
      }
      // Update or create the term detail entry
      setProjectTermDetails((prev) => {
        const projectDetails = prev[projectId] || {}
        const existingDetail = projectDetails[termId]
        const termItem = (projectTerms[projectId] || []).find((t) => t.id === termId)
        // Import TermDetail structure from term-sheet — build a minimal entry if not existing
        const updatedDetail = existingDetail
          ? { ...existingDetail, status: newStatus, negotiationResult: newNegotiationResult }
          : {
            id: termId,
            title: termItem?.name || pending.termName,
            termId: `TM-${Date.now()}`,
            createdAt: termItem?.createdAt || today,
            updatedAt: today,
            status: newStatus,
            creator: { name: "张伟", role: "投资经理" },
            ourDemand: { content: "", files: [], linkedHypotheses: [], creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
            ourBasis: { content: "", files: [], linkedHypotheses: [], creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
            bilateralConflict: { content: "", creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
            ourBottomLine: { content: "", creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
            compromiseSpace: { content: "", creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
            negotiationResult: newNegotiationResult,
            implementationStatus: { status: "not-started" as const, content: "", creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: "", comments: [] },
          }
        return { ...prev, [projectId]: { ...projectDetails, [termId]: updatedDetail } }
      })
      // Update term status in projectTerms list
      setProjectTerms((prev) => {
        const terms = prev[projectId] || []
        return {
          ...prev,
          [projectId]: terms.map((t) =>
            t.id === termId ? { ...t, status: newStatus } : t
          ),
        }
      })
      setPendingNegotiationDecisions((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectNegotiationDecision(id: string) {
    setPendingNegotiationDecisions((prev) => prev.filter((p) => p.id !== id))
  }

  // Verification change request handlers
  function handleCreateVerification(projectId: string, hypothesisId: string, hypothesisName: string, data: VerificationFormData) {
    const today = new Date().toISOString().split("T")[0]
    const project = projects.find((p) => p.id === projectId)
    const pending: PendingVerification = {
      id: `vf-${Date.now()}`,
      projectId,
      projectName: project?.name || "",
      hypothesisId,
      hypothesisName,
      data,
      changeId: `VF-${Date.now()}`,
      changeName: `新增假设验证情况: ${hypothesisName}`,
      changeType: "verification",
      initiator: { id: "zhangwei", name: "张伟", initials: "ZW" },
      initiatedAt: today,
      reviewers: [
        { id: "wangzong", name: "王总", initials: "WZ" },
        { id: "chenzong", name: "陈总", initials: "CZ" },
      ],
    }
    setPendingVerifications((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveVerification(id: string) {
    const pending = pendingVerifications.find((p) => p.id === id)
    if (pending) {
      const { projectId, hypothesisId, data } = pending
      const today = new Date().toISOString().split("T")[0]
      const newVerification = {
        conclusion: data.conclusion,
        status: data.conclusion === "符合预期" ? "confirmed" as const : "invalidated" as const,
        content: data.content,
        creator: { name: "张伟", role: "投资经理" },
        reviewers: data.responsibles,
        createdAt: today,
        comments: [] as { author: string; content: string; time: string }[],
      }
      setProjectHypothesisDetails((prev) => {
        const projectDetails = prev[projectId] || {}
        const existingDetail = projectDetails[hypothesisId]
        const hypothesis = (projectHypotheses[projectId] || []).find((h) => h.id === hypothesisId)
        const updatedDetail: HypothesisDetail = existingDetail
          ? { ...existingDetail, verification: newVerification }
          : {
            id: hypothesisId,
            title: hypothesis?.name || "",
            qaId: `QA-${Date.now()}`,
            createdAt: hypothesis?.createdAt || today,
            updatedAt: today,
            status: hypothesis?.status || "pending",
            creator: { name: "张伟", role: "投资经理" },
            valuePoints: [],
            riskPoints: [],
            committeeDecision: {
              conclusion: "",
              status: "pending" as const,
              content: "",
              creator: { name: "张伟", role: "投资经理" },
              reviewers: [],
              createdAt: "",
              comments: [],
            },
            verification: newVerification,
            linkedTerms: [],
          }
        return {
          ...prev,
          [projectId]: { ...projectDetails, [hypothesisId]: updatedDetail },
        }
      })
      setPendingVerifications((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectVerification(id: string) {
    setPendingVerifications((prev) => prev.filter((p) => p.id !== id))
  }

  // Implementation status change request handlers
  function handleCreateImplementationStatus(projectId: string, termId: string, termName: string, data: ImplementationStatusFormData) {
    const today = new Date().toISOString().split("T")[0]
    const project = projects.find((p) => p.id === projectId)
    const pending: PendingImplementationStatus = {
      id: `is-${Date.now()}`,
      projectId,
      projectName: project?.name || "",
      termId,
      termName,
      data,
      changeId: `IS-${Date.now()}`,
      changeName: `新增条款落实情况: ${termName}`,
      changeType: "implementation-status",
      initiator: { id: "zhangwei", name: "张伟", initials: "ZW" },
      initiatedAt: today,
      reviewers: [
        { id: "wangzong", name: "王总", initials: "WZ" },
        { id: "chenzong", name: "陈总", initials: "CZ" },
      ],
    }
    setPendingImplementationStatuses((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveImplementationStatus(id: string) {
    const pending = pendingImplementationStatuses.find((p) => p.id === id)
    if (pending) {
      const { projectId, termId, data } = pending
      const today = new Date().toISOString().split("T")[0]
      const newStatus = {
        status: "implemented" as const,
        conclusion: data.conclusion,
        content: data.content,
        creator: { name: "张伟", role: "投资经理" },
        reviewers: data.responsibles,
        createdAt: today,
        comments: [] as { author: string; content: string; time: string }[],
      }
      setProjectTermDetails((prev) => {
        const projectDetails = prev[projectId] || {}
        const existingDetail = projectDetails[termId]
        if (!existingDetail) return prev
        return {
          ...prev,
          [projectId]: {
            ...projectDetails,
            [termId]: {
              ...existingDetail,
              implementationStatus: newStatus,
            },
          },
        }
      })
      setPendingImplementationStatuses((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectImplementationStatus(id: string) {
    setPendingImplementationStatuses((prev) => prev.filter((p) => p.id !== id))
  }

  function handleCreatePendingProjectTerm(pending: PendingProjectTerm) {
    setPendingProjectTerms((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveProjectTerm(id: string) {
    const pending = pendingProjectTerms.find((p) => p.id === id)
    if (pending) {
      const { projectId, term } = pending
      const today = new Date().toISOString().split("T")[0]
      const newId = `proj-term-${Date.now()}`
      const newTerm: TermTableItem = {
        id: newId,
        direction: term.direction,
        category: term.category,
        name: term.name,
        owner: "张伟",
        createdAt: today,
        updatedAt: today,
        status: "pending" as const,
      }
      // Resolve material file info from materialOptions
      const matMap = new Map((pending.materialOptions || []).map((m) => [m.id, m]))
      const resolveMaterials = (ids: string[]) =>
        ids
          .map((mid) => matMap.get(mid))
          .filter(Boolean)
          .map((m) => ({ name: `${m!.name}.${m!.format.toLowerCase()}`, size: m!.size || "—", date: today }))
      // Resolve hypothesis links
      const hypMap = new Map((pending.hypothesisOptions || []).map((h) => [h.id, h]))
      const resolveHypotheses = (ids: string[]) =>
        ids
          .map((hid) => hypMap.get(hid))
          .filter(Boolean)
          .map((h) => ({ id: h!.id, title: h!.name, status: "pending" as const }))

      const buildSection = (src: { content: string; linkedMaterialIds: string[]; linkedHypothesisIds: string[] }) => ({
        content: src.content,
        files: resolveMaterials(src.linkedMaterialIds),
        linkedHypotheses: resolveHypotheses(src.linkedHypothesisIds),
        creator: { name: "张伟", role: "投资经理" },
        reviewers: [],
        createdAt: today,
        comments: [],
      })

      const newDetail: TermDetail = {
        id: newId,
        title: term.name,
        termId: `TM-${newId}`,
        createdAt: today,
        updatedAt: today,
        status: "pending",
        creator: { name: "张伟", role: "投资经理" },
        ourDemand: buildSection(term.ourDemand),
        ourBasis: buildSection(term.ourBasis),
        bilateralConflict: { content: term.bilateralConflict.content, creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: today, comments: [] },
        ourBottomLine: { content: term.ourBottomLine.content, creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: today, comments: [] },
        compromiseSpace: { content: term.compromiseSpace.content, creator: { name: "张伟", role: "投资经理" }, reviewers: [], createdAt: today, comments: [] },
        negotiationResult: { conclusion: "", status: "partial", content: "", creator: { name: "", role: "" }, reviewers: [], createdAt: "", comments: [] },
        implementationStatus: { status: "not-started", content: "", creator: { name: "", role: "" }, reviewers: [], createdAt: "", comments: [] },
      }
      setProjectTerms((prev) => ({
        ...prev,
        [projectId]: [newTerm, ...(prev[projectId] || [])],
      }))
      setProjectTermDetails((prev) => ({
        ...prev,
        [projectId]: { ...(prev[projectId] || {}), [newId]: newDetail },
      }))
      setPendingProjectTerms((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectProjectTerm(id: string) {
    setPendingProjectTerms((prev) => prev.filter((p) => p.id !== id))
  }

  // Handler to save generated suggestions for a project
  function handleSaveProjectSuggestions(projectId: string, suggestions: GeneratedSuggestion[]) {
    setSavedProjectSuggestions((prev) => ({
      ...prev,
      [projectId]: suggestions,
    }))
  }

  function handleSaveProjectTermSuggestions(projectId: string, suggestions: GeneratedTermSuggestion[]) {
    setSavedProjectTermSuggestions((prev) => ({
      ...prev,
      [projectId]: suggestions,
    }))
  }

  function handleSaveProjectMaterialSuggestions(projectId: string, suggestions: GeneratedMaterialSuggestion[]) {
    setSavedProjectMaterialSuggestions((prev) => ({
      ...prev,
      [projectId]: suggestions,
    }))
  }

  function handleSaveProjectAiResearchGroups(projectId: string, groups: GeneratedAiResearchGroup[]) {
    setSavedProjectAiResearchGroups((prev) => ({
      ...prev,
      [projectId]: groups,
    }))
  }

  function handleCreatePendingProjectMaterial(pending: PendingProjectMaterial) {
    setPendingProjectMaterials((prev) => [pending, ...prev])
    setView({ type: "change-requests" })
  }

  function handleApproveProjectMaterial(id: string) {
    const pending = pendingProjectMaterials.find((p) => p.id === id)
    if (pending) {
      const { projectId, material } = pending
      const today = new Date().toISOString().split("T")[0]
      const newMaterial: StrategyMaterial = {
        id: `proj-mat-${Date.now()}`,
        strategyId: "",
        name: material.name,
        format: material.format,
        size: material.size || "—",
        description: material.description,
        category: material.category,
        owner: "张伟",
        createdAt: today,
      }
      setProjectMaterialsMap((prev) => ({
        ...prev,
        [projectId]: [newMaterial, ...(prev[projectId] || [])],
      }))
      setPendingProjectMaterials((prev) => prev.filter((p) => p.id !== id))
      setView({ type: "project-detail", projectId })
    }
  }

  function handleRejectProjectMaterial(id: string) {
    setPendingProjectMaterials((prev) => prev.filter((p) => p.id !== id))
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
  function getPhasesForProject(projectId: string): Phase[] | undefined {
    return projectPhases[projectId] || undefined
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
            isLoading={isLoadingProjects}
          />
        )}
        {view.type === "strategies" && (
          <StrategyCenter
            strategies={strategies}
            onStrategiesChange={setStrategies}
            onSelectStrategy={handleSelectStrategy}
            onCreatePending={handleCreatePendingStrategy}
            onCreatePendingFramework={handleCreatePendingFramework}
            createdFrameworks={createdFrameworks}
            onCreatedFrameworksChange={setCreatedFrameworks}
          />
        )}
        {view.type === "change-requests" && (
          <ChangeRequests
            pendingStrategies={pendingStrategies}
            pendingProjects={pendingProjects}
            pendingPhases={pendingPhases}
            pendingHypotheses={pendingHypotheses}
            pendingProjectHypotheses={pendingProjectHypotheses}
            pendingCommitteeDecisions={pendingCommitteeDecisions}
            pendingTerms={pendingTerms}
            pendingProjectTerms={pendingProjectTerms}
            pendingNegotiationDecisions={pendingNegotiationDecisions}
            pendingMaterials={pendingMaterials}
            pendingProjectMaterials={pendingProjectMaterials}
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
            onApproveCommitteeDecision={handleApproveCommitteeDecision}
            onRejectCommitteeDecision={handleRejectCommitteeDecision}
            onApproveTerm={handleApproveTerm}
            onRejectTerm={handleRejectTerm}
            onApproveProjectTerm={handleApproveProjectTerm}
            onRejectProjectTerm={handleRejectProjectTerm}
            onApproveNegotiationDecision={handleApproveNegotiationDecision}
            onRejectNegotiationDecision={handleRejectNegotiationDecision}
            onApproveMaterial={handleApproveMaterial}
            onRejectMaterial={handleRejectMaterial}
            onApproveProjectMaterial={handleApproveProjectMaterial}
            onRejectProjectMaterial={handleRejectProjectMaterial}
            pendingVerifications={pendingVerifications}
            onApproveVerification={handleApproveVerification}
            onRejectVerification={handleRejectVerification}
            pendingImplementationStatuses={pendingImplementationStatuses}
            onApproveImplementationStatus={handleApproveImplementationStatus}
            onRejectImplementationStatus={handleRejectImplementationStatus}
            pendingFrameworks={pendingFrameworks}
            onApproveFramework={handleApproveFramework}
            onRejectFramework={handleRejectFramework}
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
            savedGeneratedTermSuggestions={savedProjectTermSuggestions[view.projectId]}
            onSaveTermSuggestions={(suggestions) => handleSaveProjectTermSuggestions(view.projectId, suggestions)}
            onCreatePendingProjectTerm={handleCreatePendingProjectTerm}
            projectTermDetails={projectTermDetails[view.projectId]}
            onCreatePendingProjectMaterial={handleCreatePendingProjectMaterial}
            savedGeneratedMaterialSuggestions={savedProjectMaterialSuggestions[view.projectId]}
            onSaveMaterialSuggestions={(suggestions) => handleSaveProjectMaterialSuggestions(view.projectId, suggestions)}
            savedGeneratedAiResearchGroups={savedProjectAiResearchGroups[view.projectId]}
            onSaveAiResearchGroups={(groups) => handleSaveProjectAiResearchGroups(view.projectId, groups)}
            onAddValuePoint={(hypothesisId, vp) => handleAddValuePoint(view.projectId, hypothesisId, vp)}
            onAddRiskPoint={(hypothesisId, rp) => handleAddRiskPoint(view.projectId, hypothesisId, rp)}
            onCreateCommitteeDecision={(hypothesisId, hypothesisName, data) => handleCreateCommitteeDecision(view.projectId, hypothesisId, hypothesisName, data)}
            onCreateNegotiationDecision={(termId, termName, data) => handleCreateNegotiationDecision(view.projectId, termId, termName, data)}
            onCreateVerification={(hypothesisId, hypothesisName, data) => handleCreateVerification(view.projectId, hypothesisId, hypothesisName, data)}
            onCreateImplementationStatus={(termId, termName, data) => handleCreateImplementationStatus(view.projectId, termId, termName, data)}
            isExited={exitedProjects[view.projectId] === true}
            liXiangRecord={liXiangRecords[view.projectId]}
            touJueRecord={touJueRecords[view.projectId]}
            huaKuanRecord={huaKuanRecords[view.projectId]}
            tuiChuRecord={tuiChuRecords[view.projectId]}
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
