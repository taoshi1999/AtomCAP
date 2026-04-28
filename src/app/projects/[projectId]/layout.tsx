"use client"

import { useState } from "react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import { ProjectSidebar } from "@/src/components/project-sidebar"
import { useRouter, useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { Badge } from "@/src/components/ui/badge"

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const [collapsed, setCollapsed] = useState(false)

  // Fetch project data for the top info bar
  const { data: project } = api.project.getById.useQuery({ id: projectId })

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppTopbar activeNav="projects" onNavigate={handleTopNav} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          projectId={projectId}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          currentPhase={project?.stage || "无"}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Project Info Bar */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-white px-6 shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-blue-600 font-bold shrink-0">
                {project?.logo || project?.name?.[0] || "P"}
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-semibold text-foreground">
                  {project?.name || "加载中..."}
                </h1>
                <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                  {project?.description || "..."}
                </p>
              </div>
              {project?.stage && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {project.stage}
                </Badge>
              )}
              {project?.round && (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-200 text-amber-700">
                  {project.round}
                </Badge>
              )}
              {project?.industry && (
                <Badge variant="outline" className="text-[10px] h-5 border-blue-200 text-blue-700">
                  {project.industry}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[10px] text-muted-foreground mr-2">
                负责人: {project?.managerName || "未分配"}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-gray-50/50">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
