"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { TermSheet } from "@/src/components/pages/term-sheet"

export default function TermsPage() {
  const params = useParams()
  const projectId = params.projectId as string

  // Fetch project data
  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载条款清单...</div>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")

  return (
    <TermSheet 
      project={project as any}
      isNewProject={isNewProject}
      isInDuration={false}
      isExited={false}
      termLockPeriod="存续期"
      inheritedTerms={[]}
      extraDetails={{}}
    />
  )
}
