"use client"

import {
  LayoutDashboard,
  ListChecks,
  FileText,
  GitBranch,
  BarChart3,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"

export type PageKey =
  | "overview"
  | "hypotheses"
  | "terms"
  | "workflow"
  | "analytics"
  | "settings"

interface NavItem {
  key: PageKey
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { key: "overview", label: "项目概览", icon: LayoutDashboard },
  { key: "hypotheses", label: "假设清单", icon: ListChecks },
  { key: "terms", label: "条款构建", icon: FileText },
  { key: "workflow", label: "工作流", icon: GitBranch },
  { key: "analytics", label: "数据分析", icon: BarChart3 },
  { key: "settings", label: "系统设置", icon: Settings },
]

interface AppSidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
}

export function AppSidebar({ activePage, onNavigate }: AppSidebarProps) {
  const { data: session } = useSession()
  
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "用户"
  const userInitial = userName.charAt(0).toUpperCase()
  
  return (
    <aside className="flex h-screen w-[200px] flex-col bg-[#0F172A] text-[#94A3B8] shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-semibold italic text-white tracking-tight">
          AtomCAP
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.key
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#2563EB] text-white"
                  : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[#1E293B] px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[#334155] text-xs text-white">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-[#CBD5E1]">{userName}</span>
        </div>
      </div>
    </aside>
  )
}
