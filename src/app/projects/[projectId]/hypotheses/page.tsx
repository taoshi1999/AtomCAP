"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { HypothesisChecklist, type HypothesisDetail } from "@/src/components/pages/hypothesis-checklist"
import type { Project } from "@/src/components/pages/projects-grid"

/**
 * /projects/[projectId]/hypotheses — 假设清单
 */
export default function ProjectHypothesesPage() {
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
        <div className="text-sm text-muted-foreground">正在加载假设清单...</div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4">
        <p className="text-sm font-medium text-slate-800">无法加载假设清单</p>
        <p className="max-w-md text-center text-xs text-slate-500">{error?.message ?? "请返回列表重试。"}</p>
        <Link href="/projects" className="text-sm text-blue-600 underline">
          返回项目列表
        </Link>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")
  const phases = data.phases
  const isMidInvestment = isNewProject && phases.some((p) => p.groupLabel === "投中期")
  const isPostInvestment = isNewProject && phases.some((p) => p.groupLabel === "投后期")
  const isInDuration = phases.some((p) => p.groupLabel === "存续期") || isPostInvestment
  const isHypothesisLocked = isInDuration || isMidInvestment

  return (
    <HypothesisChecklist
      project={data.project as unknown as Project}
      projectMaterials={data.materials}
      inheritedHypotheses={data.hypotheses}
      extraDetails={data.hypothesisDetails as Record<string, HypothesisDetail>}
      isNewProject={isNewProject}
      isInDuration={isHypothesisLocked || data.isExited}
      isExited={data.isExited}
      isMidInvestment={isMidInvestment}
      isPostInvestment={isPostInvestment}
    />
  )
}
