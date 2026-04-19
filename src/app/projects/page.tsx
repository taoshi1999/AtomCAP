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
 * /projects 路由 — 项目列表页
 *
 * 数据源：tRPC `api.project.getProjsForGrid`
 * 新建项目：tRPC `api.project.create`（mutation 成功后自动 refetch）
 *
 * 项目详情 / 变更请求 / 策略中心等视图仍由 "/" 下的 SPA 承载；
 * 点击某张项目卡片会带 ?projectId= 查询参数跳回 "/"。
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
      // change-requests 仍由 "/" 下的 SPA 承载
      router.push(`/?nav=${nav}`)
    }
  }

  function handleSelectProject(projectId: string) {
    router.push(`/?projectId=${encodeURIComponent(projectId)}`)
  }

  /**
   * 目前 ProjectsGrid 的"新建项目"会产出一条 PendingProject（走前端审批流）。
   * 为了尽快落库，这里直接把它映射成 `api.project.create` 的 mutation：
   *   - name / description / stage / tags 走后端字段
   *   - 标签以逗号拼接后存入 Project.tags（与 getProjsForGrid 反向解析一致）
   *
   * 后续若要恢复"变更请求"审批流，可在此处分叉：先存 PendingProject，再在审批通过时调用 mutation。
   */
  function handleCreatePending(pending: PendingProject) {
    const p = pending.project
    createMutation.mutate({
      name: p.name,
      description: p.description || undefined,
      stage: p.status || undefined,
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
      <main className="flex-1 overflow-hidden">
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
              // 服务端为单一数据源；表单内部若需要同步，触发 refetch 即可
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
