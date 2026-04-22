"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { api } from "@/src/trpc/react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import {
  ProjectsGrid,
  type Project,
  type PendingProject,
} from "@/src/components/pages/projects-grid"
import { initialStrategies } from "@/src/components/pages/strategies-grid"

/**
 * /projects — 项目列表页（与远端 `origin/main` 一致）
 *
 * 【US-004】卡片列表与筛选；`api.project.getProjsForGrid`；新建 `api.project.create`。
 * 点击卡片进入 `/projects/[projectId]` 项目工作区（概览 / 假设 / 条款 / 工作流）。
 */
export default function ProjectsPage() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  const utils = api.useUtils()
  const { data, isLoading, isError } = api.project.getProjsForGrid.useQuery(
    undefined,
    { enabled: status === "authenticated" },
  )

  const createMutation = api.project.create.useMutation({
    onSuccess: async () => {
      await utils.project.getProjsForGrid.invalidate()
    },
  })

  function handleTopNav(nav: TopNavKey) {
    if (nav === "projects") return
    if (nav === "dashboard") {
      router.push("/dashboard")
    } else if (nav === "strategies") {
      router.push("/strategies")
    } else {
      router.push(`/?nav=${nav}`)
    }
  }

  function handleSelectProject(projectId: string) {
    router.push(`/projects/${encodeURIComponent(projectId)}`)
  }

  function handleCreatePending(pending: PendingProject) {
    const p = pending.project
    createMutation.mutate({
      name: p.name,
      description: p.description || undefined,
      stage: p.status || undefined,
      logo: p.logo || undefined,
      tags: p.tags.length > 0 ? p.tags.join(",") : undefined,
      round: p.round || undefined,
      valuation: p.valuation || undefined,
      managerId: p.owner.id || undefined,
      managerName: p.owner.name || undefined,
    })
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav="projects" onNavigate={handleTopNav} />
      <main className="min-h-0 flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            项目列表加载中...
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            项目数据加载失败，请稍后重试
          </div>
        ) : (
          <ProjectsGrid
            projects={(data ?? []) as Project[]}
            strategies={initialStrategies}
            onProjectsChange={() => {
              void utils.project.getProjsForGrid.invalidate()
            }}
            onSelectProject={handleSelectProject}
            onCreatePending={handleCreatePending}
          />
        )}
      </main>
    </div>
  )
}
