"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { TermSheet } from "@/src/components/pages/term-sheet"
import { toast } from "sonner"

export default function TermsPage() {
  const params = useParams()
  const projectId = params.projectId as string

  // Fetch project data
  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })
  
  // Fetch term sheets
  const utils = api.useUtils()
  const { data: terms = [], isLoading: termsLoading } = api.term.getAllByProjectId.useQuery({ projectId })
  
  const deleteMutation = api.term.delete.useMutation({
    onSuccess: () => {
      void utils.term.getAllByProjectId.invalidate({ projectId })
      toast.success("条款已成功删除")
    },
    onError: (err) => {
      toast.error("删除失败: " + err.message)
    }
  })

  if (projectLoading || termsLoading) {
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
      inheritedTerms={terms as any}
      extraDetails={{}}
      onDelete={(id) => {
        deleteMutation.mutate({ id });
      }}
    />
  )
}
