"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { api } from "@/src/trpc/react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import {
  DashboardView,
  type DashboardOverviewDTO,
  type DashboardChartRow,
  type DashboardTodoDTO,
} from "@/src/components/dashboard-view"

/**
 * /dashboard 路由 — 独立的数据看板页
 *
 * 通过 tRPC (api.dashboard.getOverview) 拉取服务端数据，
 * 再把结果作为 props 传入纯展示组件 <DashboardView />。
 */
export default function DashboardPage() {
  const router = useRouter()
  const { status } = useSession()

  // 未登录时跳转回 /login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  const { data, isLoading, isError } = api.dashboard.getOverview.useQuery(
    undefined,
    { enabled: status === "authenticated" },
  )

  function handleTopNav(nav: TopNavKey) {
    if (nav === "dashboard") {
      // 已在当前页
      return
    }
    // 其他导航项仍由主 SPA 页面承载
    router.push("/")
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
      <AppTopbar activeNav="dashboard" onNavigate={handleTopNav} />
      <main className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            数据加载中...
          </div>
        ) : isError || !data ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            数据加载失败，请稍后重试
          </div>
        ) : (
          <DashboardView
            overview={(data.overview as DashboardOverviewDTO | null) ?? null}
            charts={(data.charts as DashboardChartRow[]) ?? []}
            todos={(data.todos as DashboardTodoDTO[]) ?? []}
          />
        )}
      </main>
    </div>
  )
}
