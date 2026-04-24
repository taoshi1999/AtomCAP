"use client"

import { useParams, useRouter } from "next/navigation"
import { api } from "@/src/trpc/react"
import { TermSheet } from "@/src/components/pages/term-sheet"

export default function TermsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const utils = api.useUtils()

  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })

  const { data: projectHypotheses } = api.hypothesis.getByProject.useQuery({ projectId }, { enabled: !projectId.startsWith("new-project-") })

  const { data: linkedHypothesesMap } = api.hypothesis.getLinkedHypothesesByProject.useQuery({ projectId }, { enabled: !projectId.startsWith("new-project-") })

  const addLinkMutation = api.hypothesis.addTermHypothesisLink.useMutation({
    onSuccess: () => {
      utils.hypothesis.getLinkedHypothesesByProject.invalidate({ projectId })
      utils.hypothesis.getLinkedTermsByProject.invalidate({ projectId })
    },
  })

  const removeLinkMutation = api.hypothesis.removeTermHypothesisLink.useMutation({
    onSuccess: () => {
      utils.hypothesis.getLinkedHypothesesByProject.invalidate({ projectId })
      utils.hypothesis.getLinkedTermsByProject.invalidate({ projectId })
    },
  })

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载条款清单...</div>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")

  const availableHypotheses = (projectHypotheses || []).map((h: any) => ({
    id: h.id,
    title: h.title,
    status: h.status || "pending",
  }))

  return (
    <TermSheet 
      project={project as any}
      isNewProject={isNewProject}
      isInDuration={false}
      isExited={false}
      termLockPeriod="存续期"
      inheritedTerms={[]}
      extraDetails={{}}
      availableHypotheses={availableHypotheses}
      linkedHypothesesMap={linkedHypothesesMap as any}
      onAddHypothesisLink={(termId, hypothesisId) => addLinkMutation.mutate({ termId, hypothesisId })}
      onRemoveHypothesisLink={(linkId) => removeLinkMutation.mutate({ linkId })}
      onNavigateToHypothesis={(hypothesisId) => router.push(`/projects/${projectId}/hypotheses`)}
    />
  )
}
