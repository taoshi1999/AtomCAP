"use client"

import {
  LayoutDashboard,
  ListChecks,
  FileText,
  GitBranch,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface ProjectSidebarProps {
  projectId: string
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  currentPhase: string
}

const subNavItems = [
  { key: "overview", label: "项目概览", icon: LayoutDashboard, href: "" },
  { key: "hypotheses", label: "假设清单", icon: ListChecks, href: "/hypotheses" },
  { key: "terms", label: "条款构建", icon: FileText, href: "/terms" },
  { key: "workflow", label: "工作流", icon: GitBranch, href: "/workflow" },
]

export function ProjectSidebar({
  projectId,
  collapsed,
  setCollapsed,
  currentPhase,
}: ProjectSidebarProps) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-[#0F172A] text-[#94A3B8] transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[200px]",
      )}
    >
      <div className="flex items-center justify-end px-3 pb-2 pt-4">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#CBD5E1]",
            collapsed && "mx-auto",
          )}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="rounded-lg bg-[#1E293B] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748B]">当前阶段</p>
            <p className="mt-0.5 text-xs font-semibold text-[#E2E8F0]">{currentPhase || "无"}</p>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="px-2 pb-2">
          <div
            className="flex items-center justify-center rounded-lg bg-[#1E293B] p-1.5"
            title={currentPhase || "无"}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                currentPhase && currentPhase !== "无" ? "bg-[#2563EB]" : "bg-[#64748B]",
              )}
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {subNavItems.map((item) => {
          const Icon = item.icon
          const href = `${base}${item.href}`
          const isActive =
            pathname === href ||
            (item.href === "" && (pathname === base || pathname === `${base}/`))

          return (
            <Link
              key={item.key}
              href={href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-[#2563EB] text-white"
                  : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
