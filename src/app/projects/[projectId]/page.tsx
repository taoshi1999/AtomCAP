"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { api } from "@/src/trpc/react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import {
  ProjectDetail,
  type CreateHypothesisInput,
  type CreateTermInput,
  type PersistWorkflowPhaseInput,
  type SubPageKey,
} from "@/src/components/pages/project-detail"
import type { PendingProjectMaterial } from "@/src/components/pages/workflow"
import type { Project } from "@/src/components/pages/projects-grid"
import { toast } from "@/src/hooks/use-toast"
import { getTrpcToastMessage } from "@/src/lib/trpc-error-message"

const SUB_TABS: SubPageKey[] = ["overview", "hypotheses", "terms", "materials", "workflow"]

function parseTabFromWindow(): SubPageKey {
  if (typeof window === "undefined") return "overview"
  const raw = new URLSearchParams(window.location.search).get("tab")
  if (raw && SUB_TABS.includes(raw as SubPageKey)) return raw as SubPageKey
  return "overview"
}

/**
 * /projects/[projectId] — 项目详情工作区（US-005：`project.getOverview`）
 */
export default function ProjectDetailRoutePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = typeof params?.projectId === "string" ? params.projectId : ""
  const { status } = useSession()
  const [initialTab, setInitialTab] = useState<SubPageKey>("overview")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  useEffect(() => {
    setInitialTab(parseTabFromWindow())
  }, [projectId])

  const { data, isLoading, isError, error } = api.project.getOverview.useQuery(
    { projectId },
    { enabled: status === "authenticated" && projectId.length > 0 },
  )

  const utils = api.useUtils()
  const createHypothesisMut = api.project.createHypothesis.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })
  const createTermMut = api.project.createTerm.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })
  const createMaterialMut = api.project.createMaterial.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })
  const createWorkflowPhaseMut = api.project.createWorkflowPhase.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })
  const advanceWorkflowPhaseMut = api.project.advanceWorkflowPhase.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "无法启动下一阶段",
        description: getTrpcToastMessage(err, "推进阶段失败"),
      })
    },
  })
  const addHypothesisPointCommentMut = api.project.addHypothesisPointComment.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })
  const addTermSectionCommentMut = api.project.addTermSectionComment.useMutation({
    onSuccess: () => void utils.project.getOverview.invalidate({ projectId }),
  })

  const canPersist = projectId.length > 0 && !projectId.startsWith("new-project-")

  const handleCreateHypothesis = useCallback(
    async (input: CreateHypothesisInput) => {
      await createHypothesisMut.mutateAsync({
        projectId,
        ...input,
        workflowPhaseId: input.workflowPhaseId,
      })
    },
    [projectId, createHypothesisMut],
  )

  const handleCreateTerm = useCallback(
    async (input: CreateTermInput) => {
      await createTermMut.mutateAsync({
        projectId,
        ...input,
        workflowPhaseId: input.workflowPhaseId,
      })
    },
    [projectId, createTermMut],
  )

  const handlePersistProjectMaterial = useCallback(
    async (
      pending: PendingProjectMaterial,
      ctx?: { workflowPhaseId?: string | null },
    ) => {
      const m = pending.material
      await createMaterialMut.mutateAsync({
        projectId,
        name: m.name,
        format: m.format,
        size: m.size,
        description: m.description,
        category: m.category,
        workflowPhaseId: ctx?.workflowPhaseId ?? undefined,
      })
    },
    [projectId, createMaterialMut],
  )

  const handleAdvanceWorkflowPhase = useCallback(async () => {
    await advanceWorkflowPhaseMut.mutateAsync({ projectId })
  }, [projectId, advanceWorkflowPhaseMut])

  const handlePersistWorkflowPhase = useCallback(
    async (input: PersistWorkflowPhaseInput) => {
      await createWorkflowPhaseMut.mutateAsync({
        projectId,
        groupLabel: input.groupLabel,
        name: input.name,
        fullLabel: input.fullLabel,
        status: input.status,
      })
    },
    [projectId, createWorkflowPhaseMut],
  )

  const handleAddHypothesisPointComment = useCallback(
    async (input: {
      projectId: string
      hypothesisId: string
      pointKind: "value" | "risk"
      pointKey: string
      content: string
    }) => {
      await addHypothesisPointCommentMut.mutateAsync(input)
    },
    [addHypothesisPointCommentMut],
  )

  const handleAddTermSectionComment = useCallback(
    async (input: {
      projectId: string
      termId: string
      sectionKey:
        | "ourDemand"
        | "ourBasis"
        | "bilateralConflict"
        | "ourBottomLine"
        | "compromiseSpace"
        | "negotiationResult"
        | "implementationStatus"
      content: string
    }) => {
      await addTermSectionCommentMut.mutateAsync(input)
    },
    [addTermSectionCommentMut],
  )

  const projectCard = useMemo(() => {
    if (!data?.project) return undefined
    return data.project as unknown as Project
  }, [data])

  function handleTopNav(nav: TopNavKey) {
    if (nav === "projects") {
      router.push("/projects")
      return
    }
    if (nav === "dashboard") {
      router.push("/dashboard")
      return
    }
    if (nav === "strategies") {
      router.push("/strategies")
      return
    }
    router.push(`/?nav=${nav}`)
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-4">
        <p className="text-sm text-slate-700">无效的项目路径</p>
        <button type="button" className="text-sm text-blue-600 underline" onClick={() => router.push("/projects")}>
          返回项目列表
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AppTopbar activeNav="projects" onNavigate={handleTopNav} />
        <main className="flex flex-1 items-center justify-center text-sm text-slate-500">正在加载项目概览…</main>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AppTopbar activeNav="projects" onNavigate={handleTopNav} />
        <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
          <p className="text-sm font-medium text-slate-800">无法加载该项目</p>
          <p className="max-w-md text-center text-xs text-slate-500">
            {error?.message ?? "请确认项目 ID 是否正确，或返回列表重试。"}
          </p>
          <button type="button" className="text-sm text-blue-600 underline" onClick={() => router.push("/projects")}>
            返回项目列表
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav="projects" onNavigate={handleTopNav} />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ProjectDetail
          projectId={projectId}
          initialSubPage={initialTab}
          project={projectCard}
          overviewCounts={data.counts}
          overviewPhaseLabel={data.currentPhase.label}
          overviewPhaseId={data.currentPhase.phaseId}
          projectHypotheses={data.hypotheses}
          projectTerms={data.terms}
          projectMaterials={data.materials}
          phases={data.phases}
          onCreateHypothesis={canPersist ? handleCreateHypothesis : undefined}
          onCreateTerm={canPersist ? handleCreateTerm : undefined}
          onCreatePendingProjectMaterial={canPersist ? handlePersistProjectMaterial : undefined}
          onPersistWorkflowPhase={canPersist ? handlePersistWorkflowPhase : undefined}
          onAdvanceWorkflowPhase={canPersist ? handleAdvanceWorkflowPhase : undefined}
          onAddHypothesisPointComment={canPersist ? handleAddHypothesisPointComment : undefined}
          onAddTermSectionComment={canPersist ? handleAddTermSectionComment : undefined}
        />
      </main>
    </div>
  )
}
