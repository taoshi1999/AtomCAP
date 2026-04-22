"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { ProjectOverview } from "@/src/components/pages/project-overview"

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string

  // Fetch project data
  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })
  
  // Note: These might need more specific queries if you want real data
  // For now, passing default or loading states
  const projectHypotheses = [] as any[]
  const projectTerms = [] as any[]
  const projectMaterials = [] as any[]

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载项目概览...</div>
      </div>
    )
  }

  return (
    <ProjectOverview 
      project={project as any} 
      isNewProject={projectId.startsWith("new-project-")}
      projectHypotheses={projectHypotheses}
      projectTerms={projectTerms}
      projectMaterials={projectMaterials}
    />
  )
}
