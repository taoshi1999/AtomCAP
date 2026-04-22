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
 * 【需求实现 - US-004】作为投资经理，我可以在项目列表页查看所有项目并筛选
 * - 视图：卡片视图展示所有项目（通过 ProjectsGrid 实现）
 * - 展示字段：公司名、描述、负责人、标签、项目阶段
 * - 筛选功能：支持按阶段、标签、负责人筛选及全局搜索
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
    router.push(`/projects/${encodeURIComponent(projectId)}`)
  }

  /**
   * US-003: 创建新项目
   * ProjectsGrid 的"新建项目"产出 PendingProject，直接落库。
   * 支持字段：公司名称、描述、赛道标签、投资轮次、负责人
   * 项目编号由Prisma自动生成(cuid)
   */
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
