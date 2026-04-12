"use client"

import {
  FolderKanban,
  Briefcase,
  GitPullRequest,
  ChevronDown,
  LogOut,
  User,
  Settings,
  LayoutDashboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
<<<<<<< HEAD
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
=======
>>>>>>> upstream/main

export type TopNavKey = "dashboard" | "projects" | "strategies" | "change-requests"

interface AppTopbarProps {
  activeNav: TopNavKey | null
  onNavigate: (nav: TopNavKey) => void
}

export function AppTopbar({ activeNav, onNavigate }: AppTopbarProps) {
<<<<<<< HEAD
  const { data: session } = useSession()
  const router = useRouter()
  
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "用户"
  const userInitial = userName.charAt(0).toUpperCase()
=======
>>>>>>> upstream/main
  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center border-b border-border bg-[#0F172A] px-6 shrink-0">
      {/* Logo */}
      <button
        onClick={() => onNavigate("projects")}
        className="flex items-center mr-8"
      >
        <span className="text-lg font-semibold italic text-white tracking-tight">
          AtomCAP
        </span>
      </button>

      {/* Main Navigation */}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => onNavigate("dashboard")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeNav === "dashboard"
              ? "bg-[#2563EB] text-white"
              : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          数据看板
        </button>
        <button
          onClick={() => onNavigate("projects")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeNav === "projects"
              ? "bg-[#2563EB] text-white"
              : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
          )}
        >
          <FolderKanban className="h-4 w-4" />
          项目列表
        </button>
        <button
          onClick={() => onNavigate("strategies")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeNav === "strategies"
              ? "bg-[#2563EB] text-white"
              : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
          )}
        >
          <Briefcase className="h-4 w-4" />
          策略中心
        </button>
        <button
          onClick={() => onNavigate("change-requests")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeNav === "change-requests"
              ? "bg-[#2563EB] text-white"
              : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]"
          )}
        >
          <GitPullRequest className="h-4 w-4" />
          变更请求
        </button>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[#1E293B]">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[#334155] text-[10px] text-white">
<<<<<<< HEAD
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-[#CBD5E1]">{userName}</span>
=======
                张伟
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-[#CBD5E1]">张伟</span>
>>>>>>> upstream/main
            <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-48">
          <DropdownMenuItem className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            个人信息
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            账户设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
<<<<<<< HEAD
          <DropdownMenuItem 
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
=======
          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
>>>>>>> upstream/main
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
