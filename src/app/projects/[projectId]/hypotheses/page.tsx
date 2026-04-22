"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { HypothesisChecklist } from "@/src/components/pages/hypothesis-checklist"

export default function HypothesesPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const utils = api.useUtils()

  // Fetch project data
  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })
  
  // Fetch hypotheses for this project
  const { data: projectHypotheses, isLoading: hyposLoading } = api.hypothesis.getByProject.useQuery({ projectId })

  // Mutations
  const createMutation = api.hypothesis.create.useMutation({
    onSuccess: () => utils.hypothesis.getByProject.invalidate({ projectId })
  })
  
  const deleteMutation = api.hypothesis.delete.useMutation({
    onSuccess: () => utils.hypothesis.getByProject.invalidate({ projectId })
  })

  if (projectLoading || hyposLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground italic flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          正在加载假设清单...
        </div>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")

  // Map DB data to UI format
  const mappedHypotheses = projectHypotheses?.map(h => ({
    id: h.id,
    direction: h.direction || "未分类",
    category: h.category || "未分类",
    name: h.title,
    owner: h.owner || "未分配",
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    status: h.status as any
  })) || []

  const handleCreate = (data: any) => {
    createMutation.mutate({
      projectId,
      title: data.title,
      direction: data.direction,
      category: data.category,
      owner: data.owner
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id })
  }

  return (
    <HypothesisChecklist 
      project={project as any}
      isNewProject={isNewProject}
      inheritedHypotheses={mappedHypotheses}
      onCreateHypothesis={handleCreate}
      onDeleteHypothesis={handleDelete}
      // Other props
      isInDuration={project?.stage === "投后期" || project?.status === "投后期"}
    />
  )
}
