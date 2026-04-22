"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { TermSheet, type TermDetail } from "@/src/components/pages/term-sheet"
import type { Project } from "@/src/components/pages/projects-grid"

/**
 * /projects/[projectId]/terms — 条款构建
 */
export default function ProjectTermsPage() {
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
        <div className="text-sm text-muted-foreground">加载条款构建...</div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4">
        <p className="text-sm font-medium text-slate-800">无法加载条款数据</p>
        <p className="max-w-md text-center text-xs text-slate-500">{error?.message ?? "请返回列表重试。"}</p>
        <Link href="/projects" className="text-sm text-blue-600 underline">
          返回项目列表
        </Link>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")
  const phases = data.phases
  const isPostInvestment = isNewProject && phases.some((p) => p.groupLabel === "投后期")
  const isInDuration = phases.some((p) => p.groupLabel === "存续期") || isPostInvestment
  const termLockPeriod = isPostInvestment ? "投后期" : "存续期"

  return (
    <TermSheet
      project={data.project as unknown as Project}
      projectMaterials={data.materials}
      inheritedTerms={data.terms}
      extraDetails={data.termDetails as Record<string, TermDetail>}
      isNewProject={isNewProject}
      isInDuration={isInDuration || data.isExited}
      isExited={data.isExited}
      termLockPeriod={termLockPeriod}
    />
  )
}
