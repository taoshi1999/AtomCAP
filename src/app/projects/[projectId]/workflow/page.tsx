"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Workflow } from "@/src/components/pages/workflow"

/**
 * /projects/[projectId]/workflow — 工作流
 */
export default function ProjectWorkflowPage() {
  const params = useParams()
  const projectId = typeof params?.projectId === "string" ? params.projectId : ""

  const { data, isLoading, isError, error } = api.project.getDetailBundle.useQuery(
    { projectId },
    { enabled: projectId.length > 0 },
  )

  if (!projectId) return null

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <div className="text-sm text-muted-foreground">加载工作流...</div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4">
        <p className="text-sm font-medium text-slate-800">无法加载工作流</p>
        <p className="max-w-md text-center text-xs text-slate-500">{error?.message ?? "请返回列表重试。"}</p>
        <Link href="/projects" className="text-sm text-blue-600 underline">
          返回项目列表
        </Link>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")

  return (
    <Workflow
      projectId={projectId}
      projectName={data.project.name}
      isNewProject={isNewProject}
      phases={data.phases}
      isExited={data.isExited}
      hypothesesCount={data.hypotheses.length}
      termsCount={data.terms.length}
      materialsCount={data.materials.length}
    />
  )
}
