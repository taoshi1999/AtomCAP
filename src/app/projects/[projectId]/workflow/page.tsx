"use client"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Workflow, type Phase, type PendingPhase } from "@/src/components/pages/workflow"

function dbPhaseToPhase(p: {
  id: string
  groupLabel: string
  name: string
  fullLabel: string
  assignee: string | null
  assigneeAvatar: string | null
  status: string
  startDate: string | null
  endDate: string | null
}): Phase {
  return {
    id: p.id,
    groupLabel: p.groupLabel,
    name: p.name,
    fullLabel: p.fullLabel,
    assignee: p.assignee || "张伟",
    assigneeAvatar: p.assigneeAvatar || "张",
    hypothesesCount: 0,
    termsCount: 0,
    materialsCount: 0,
    status: p.status as "completed" | "active" | "upcoming",
    startDate: p.startDate || "",
    endDate: p.endDate || undefined,
    logs: [],
  }
}

const STAGE_ORDER = ["投前阶段", "投中阶段", "投后阶段", "已退出"]
const NEXT_STAGE_MAP: Record<string, string> = {
  "投前阶段": "投中阶段",
  "投中阶段": "投后阶段",
  "投后阶段": "已退出",
}

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })
  const { data: dbPhases, isLoading: phasesLoading, refetch: refetchPhases } = api.project.getPhases.useQuery(
    { projectId },
    { enabled: !!projectId }
  )
  const { data: hypotheses } = api.hypothesis.getByProject.useQuery(
    { projectId },
    { enabled: !!projectId }
  )
  const { data: terms } = api.term.getByProjectId.useQuery(
    { projectId },
    { enabled: !!projectId }
  )
  const { data: materials } = api.project.getMaterials.useQuery(
    { projectId },
    { enabled: !!projectId }
  )

  const utils = api.useUtils()
  const createPhaseMutation = api.project.createPhase.useMutation({
    onSuccess: async () => {
      await utils.project.getPhases.invalidate({ projectId })
      await utils.project.getById.invalidate({ id: projectId })
    },
  })
  const advanceStageMutation = api.project.advanceStage.useMutation({
    onSuccess: async () => {
      await utils.project.getById.invalidate({ id: projectId })
    },
  })

  const hypothesesCount = hypotheses?.length ?? 0
  const termsCount = terms?.length ?? 0
  const materialsCount = materials?.length ?? 0

  const phases: Phase[] = (dbPhases || []).map(dbPhaseToPhase)

  const handlePhasesChange = useCallback((_newPhases: Phase[]) => {
    // No-op: phases are now managed by the DB
  }, [])

  const handleCreatePendingPhase = useCallback(async (pending: PendingPhase) => {
    const currentStage = project?.stage || ""
    const changeType = pending.changeType

    const maxOrder = dbPhases && dbPhases.length > 0
      ? Math.max(...dbPhases.map(p => p.phaseOrder))
      : 0

    if (changeType === "投决") {
      await advanceStageMutation.mutateAsync({ projectId, newStage: "投中阶段" })
      await createPhaseMutation.mutateAsync({
        projectId,
        groupLabel: pending.phase.groupLabel,
        name: pending.phase.name,
        fullLabel: pending.phase.fullLabel,
        assignee: pending.phase.assignee,
        assigneeAvatar: pending.phase.assigneeAvatar,
        status: "active",
        startDate: new Date().toISOString().split("T")[0],
        phaseOrder: maxOrder + 1,
      })
    } else if (changeType === "划款") {
      await advanceStageMutation.mutateAsync({ projectId, newStage: "投后阶段" })
      await createPhaseMutation.mutateAsync({
        projectId,
        groupLabel: pending.phase.groupLabel,
        name: pending.phase.name,
        fullLabel: pending.phase.fullLabel,
        assignee: pending.phase.assignee,
        assigneeAvatar: pending.phase.assigneeAvatar,
        status: "active",
        startDate: new Date().toISOString().split("T")[0],
        phaseOrder: maxOrder + 1,
      })
    } else if (changeType === "退出") {
      await advanceStageMutation.mutateAsync({ projectId, newStage: "已退出" })
      await createPhaseMutation.mutateAsync({
        projectId,
        groupLabel: pending.phase.groupLabel,
        name: pending.phase.name,
        fullLabel: pending.phase.fullLabel,
        assignee: pending.phase.assignee,
        assigneeAvatar: pending.phase.assigneeAvatar,
        status: "active",
        startDate: new Date().toISOString().split("T")[0],
        phaseOrder: maxOrder + 1,
      })
    } else if (changeType === "立项") {
      await advanceStageMutation.mutateAsync({ projectId, newStage: "投前阶段" })
      await createPhaseMutation.mutateAsync({
        projectId,
        groupLabel: pending.phase.groupLabel,
        name: pending.phase.name,
        fullLabel: pending.phase.fullLabel,
        assignee: pending.phase.assignee,
        assigneeAvatar: pending.phase.assigneeAvatar,
        status: "active",
        startDate: new Date().toISOString().split("T")[0],
        phaseOrder: maxOrder + 1,
      })
    } else {
      await createPhaseMutation.mutateAsync({
        projectId,
        groupLabel: pending.phase.groupLabel,
        name: pending.phase.name,
        fullLabel: pending.phase.fullLabel,
        assignee: pending.phase.assignee,
        assigneeAvatar: pending.phase.assigneeAvatar,
        status: "active",
        startDate: new Date().toISOString().split("T")[0],
        phaseOrder: maxOrder + 1,
      })
    }
  }, [projectId, project, dbPhases, createPhaseMutation, advanceStageMutation])

  if (projectLoading || phasesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载工作流...</div>
      </div>
    )
  }

  const currentStage = project?.stage || ""
  const isExited = currentStage === "已退出"

  return (
    <Workflow 
      projectId={projectId}
      projectName={project?.name || ""}
      isNewProject={true}
      phases={phases}
      onPhasesChange={handlePhasesChange}
      onCreatePendingPhase={handleCreatePendingPhase}
      isExited={isExited}
      hypothesesCount={hypothesesCount}
      termsCount={termsCount}
      materialsCount={materialsCount}
    />
  )
}
