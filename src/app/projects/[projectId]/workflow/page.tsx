"use client"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Workflow, type Phase, type PendingPhase, type LiXiangRecord, type TouJueRecord, type HuaKuanRecord, type TuiChuRecord } from "@/src/components/pages/workflow"

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

const NEXT_STAGE_MAP: Record<string, string> = {
  "投前阶段": "投中阶段",
  "投中阶段": "投后阶段",
  "投后阶段": "已退出",
}

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })
  const { data: dbPhases, isLoading: phasesLoading } = api.project.getPhases.useQuery(
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

  const [liXiangRecord, setLiXiangRecord] = useState<LiXiangRecord | undefined>(undefined)
  const [touJueRecord, setTouJueRecord] = useState<TouJueRecord | undefined>(undefined)
  const [huaKuanRecord, setHuaKuanRecord] = useState<HuaKuanRecord | undefined>(undefined)
  const [tuiChuRecord, setTuiChuRecord] = useState<TuiChuRecord | undefined>(undefined)

  const hasPreInvestment = phases.some(p => p.groupLabel === "投前期")
  const hasMidInvestment = phases.some(p => p.groupLabel === "投中期")
  const hasPostInvestment = phases.some(p => p.groupLabel === "投后期")
  const hasExit = phases.some(p => p.groupLabel === "退出")

  const effectiveLiXiangRecord = liXiangRecord || (hasPreInvestment ? {
    details: "项目立项审批通过，进入投前期阶段",
    owners: [{ id: "zhangwei", name: "张伟" }, { id: "lisi", name: "李四" }],
    time: phases.find(p => p.groupLabel === "投前期")?.startDate || "",
  } : undefined)

  const effectiveTouJueRecord = touJueRecord || (hasMidInvestment ? {
    details: "投资决策委员会审批通过，进入投中期阶段",
    owners: [{ id: "zhangwei", name: "张伟" }, { id: "wangfang", name: "王芳" }],
    time: phases.find(p => p.groupLabel === "投中期")?.startDate || "",
  } : undefined)

  const effectiveHuaKuanRecord = huaKuanRecord || (hasPostInvestment ? {
    details: "资金划拨完成，进入投后期管理阶段",
    currency: "CNY",
    amount: "1000万",
    owners: [{ id: "lisi", name: "李四" }, { id: "zhangwei", name: "张伟" }],
    time: phases.find(p => p.groupLabel === "投后期")?.startDate || "",
  } : undefined)

  const effectiveTuiChuRecord = tuiChuRecord || (hasExit ? {
    details: "项目退出审批通过",
    owners: [{ id: "zhangwei", name: "张伟" }],
    time: phases.find(p => p.groupLabel === "退出")?.startDate || "",
  } : undefined)

  const handlePhasesChange = useCallback((_newPhases: Phase[]) => {}, [])

  const handleCreatePendingPhase = useCallback(async (pending: PendingPhase) => {
    const changeType = pending.changeType

    const maxOrder = dbPhases && dbPhases.length > 0
      ? Math.max(...dbPhases.map(p => p.phaseOrder))
      : 0

    if (changeType === "立项") {
      setLiXiangRecord({
        details: pending.liXiangDetails || "项目立项审批通过",
        owners: pending.liXiangOwners || [{ id: "zhangwei", name: "张伟" }],
        time: pending.initiatedAt,
      })
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
    } else if (changeType === "投决") {
      setTouJueRecord({
        details: pending.touJueDetails || "投资决策委员会审批通过",
        owners: pending.touJueOwners || [{ id: "zhangwei", name: "张伟" }],
        time: pending.initiatedAt,
      })
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
      setHuaKuanRecord({
        details: pending.huaKuanDetails || "资金划拨完成",
        currency: pending.huaKuanCurrency || "CNY",
        amount: pending.huaKuanAmount || "1000万",
        owners: pending.huaKuanOwners || [{ id: "zhangwei", name: "张伟" }],
        time: pending.initiatedAt,
      })
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
      setTuiChuRecord({
        details: pending.tuiChuDetails || "项目退出审批通过",
        owners: pending.tuiChuOwners || [{ id: "zhangwei", name: "张伟" }],
        time: pending.initiatedAt,
      })
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
      liXiangRecord={effectiveLiXiangRecord}
      touJueRecord={effectiveTouJueRecord}
      huaKuanRecord={effectiveHuaKuanRecord}
      tuiChuRecord={effectiveTuiChuRecord}
    />
  )
}
