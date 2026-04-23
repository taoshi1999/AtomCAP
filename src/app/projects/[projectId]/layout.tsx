"use client"

import { useState } from "react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import { ProjectSidebar } from "@/src/components/project-sidebar"
import { useRouter, useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Badge } from "@/src/components/ui/badge"

/** 项目工作区：顶栏、左侧深色菜单、顶部项目信息条；子路由为概览 / 假设 / 条款 / 工作流。 */
export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const projectId = typeof params?.projectId === "string" ? params.projectId : ""
  const [collapsed, setCollapsed] = useState(false)

  const { data: project } = api.project.getById.useQuery(
    { id: projectId },
    { enabled: projectId.length > 0 },
  )

  const handleTopNav = (nav: TopNavKey) => {
    if (nav === "projects") {
      router.push("/projects")
    } else if (nav === "dashboard") {
      router.push("/dashboard")
    } else if (nav === "strategies") {
      router.push("/strategies")
    } else {
      router.push(`/?nav=${nav}`)
    }
  }

  if (!projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-4">
        <p className="text-sm text-slate-700">无效的项目路径</p>
        <button
          type="button"
          className="text-sm text-blue-600 underline"
          onClick={() => router.push("/projects")}
        >
          返回项目列表
        </button>
      </div>
    )
  }

  const logoChar =
    typeof project?.logo === "string" && project.logo.length > 0
      ? project.logo[0]
      : project?.name?.[0] ?? "P"

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav="projects" onNavigate={handleTopNav} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ProjectSidebar
          projectId={projectId}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          currentPhase={project?.stage || "无"}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6 shadow-sm">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-100 text-sm font-bold text-blue-600">
                {logoChar}
              </div>
              <div className="min-w-0 flex flex-col">
                <h1 className="truncate text-sm font-semibold text-foreground">
                  {project?.name ?? "加载中..."}
                </h1>
                <p className="max-w-[300px] truncate text-[10px] text-muted-foreground">
                  {project?.description ?? "..."}
                </p>
              </div>
              <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                {project?.stage ?? "未知阶段"}
              </Badge>
            </div>

            <div className="shrink-0 text-[10px] text-muted-foreground">
              负责人: {project?.managerName ?? "未分配"}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto bg-gray-50/50">{children}</main>
        </div>
      </div>
    </div>
  )
}
