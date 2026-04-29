"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Workflow } from "@/src/components/pages/workflow"

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.projectId as string

  // Fetch project data
  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })

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
      isNewProject={projectId.startsWith("new-project-")}
      isExited={false}
    />
  )
}
