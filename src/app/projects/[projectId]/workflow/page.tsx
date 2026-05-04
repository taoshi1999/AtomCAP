"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Workflow, type Phase, type PendingPhase } from "@/src/components/pages/workflow"

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [phases, setPhases] = useState<Phase[]>([])

  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })

  function handlePhasesChange(newPhases: Phase[]) {
    setPhases(newPhases)
  }

  function handleCreatePendingPhase(pending: PendingPhase) {
    const newPhase = pending.phase
    const updated = phases.map(p =>
      p.status === "active" ? { ...p, status: "completed" as const, endDate: new Date().toISOString().split("T")[0] } : p
    )
    updated.push({ ...newPhase, status: "active" } as Phase)
    setPhases(updated)
  }

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载工作流...</div>
      </div>
    )
  }

  return (
    <Workflow 
      projectId={projectId}
      projectName={project?.name || ""}
      isNewProject={true}
      phases={phases}
      onPhasesChange={handlePhasesChange}
      onCreatePendingPhase={handleCreatePendingPhase}
      isExited={false}
    />
  )
}
