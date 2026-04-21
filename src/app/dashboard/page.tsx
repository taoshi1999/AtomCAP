"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { api } from "@/src/trpc/react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import { DashboardView } from "@/src/components/dashboard-view"

/**
 * /dashboard 路由 — 数据看板页
 *
 * 【需求实现】数据看板核心指标实时监控
 * - 规模总览：基金总规模、在管基金数量、在管项目总数、本年度新增项目
 * - 收益核心：IRR中位数、DPI分布、平均回报率、退出胜率
 * - 效率核心：单项目平均耗时、无效尽调占比、立项过会率
 * - 风险总览：高风险项目、合规待办事项、今日待上会项目
 * - 图表：赛道投资分布、项目流程趋势、IRR行业对标、团队效能排行
 * - 待办：我的待办决策事项列表
 *
 * 数据源：tRPC `api.dashboard.getOverview`
 */
export default function DashboardPage() {
  const router = useRouter()
  const { status } = useSession()

  // 1) 登录守卫
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  // 2) 拉数据（仅在已登录时 enable）
  const { data, isLoading, isError } = api.dashboard.getOverview.useQuery(
    undefined,
    { enabled: status === "authenticated" },
  )

  // 4) 顶部导航
  function handleTopNav(nav: TopNavKey) {
    if (nav === "dashboard") return
    if (nav === "projects") {
      router.push("/projects")
    } else if (nav === "strategies") {
      router.push("/strategies")
    } else {
      // change-requests 仍由 "/" 下的 SPA 承载
      router.push(`/?nav=${nav}`)
    }
  }

  // 加载中或未登录时
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
            数据看板加载中...
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            数据看板加载失败，请稍后重试
          </div>
        ) : (
          <DashboardView
            overview={data?.overview ?? null}
            charts={data?.charts ?? []}
            todos={data?.todos ?? []}
          />
        )}
      </main>
    </div>
  )
}
