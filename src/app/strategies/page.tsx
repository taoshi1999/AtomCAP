"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Briefcase,
  Building2,
  Cpu,
  Leaf,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import { api } from "@/src/trpc/react"
import { AppTopbar, type TopNavKey } from "@/src/components/app-topbar"
import { StrategyCenter } from "@/src/components/pages/strategy-center"
import type { Strategy } from "@/src/components/pages/strategies-grid"

/* --------------------------------------------------------------------------
 * API → UI adapter
 *
 * `api.strategy.getAll` 返回的是一行扁平 DTO（iconName: string），
 * StrategiesGrid 的 Strategy 类型却要求 `icon: ComponentType` 加配色 `iconBg`。
 * 这里按 availableIcons 的名称建立映射，缺失时回退到 Target。
 * -------------------------------------------------------------------------- */

const ICON_MAP: Record<string, { icon: Strategy["icon"]; iconBg: string }> = {
  CPU: { icon: Cpu, iconBg: "bg-blue-100 text-blue-600" },
  Target: { icon: Target, iconBg: "bg-violet-100 text-violet-600" },
  Building: { icon: Building2, iconBg: "bg-emerald-100 text-emerald-600" },
  Zap: { icon: Zap, iconBg: "bg-rose-100 text-rose-600" },
  Leaf: { icon: Leaf, iconBg: "bg-lime-100 text-lime-600" },
  Trending: { icon: TrendingUp, iconBg: "bg-amber-100 text-amber-600" },
  Briefcase: { icon: Briefcase, iconBg: "bg-indigo-100 text-indigo-600" },
}

interface ApiStrategyRow {
  id: string
  iconName: string
  name: string
  frameworkName: string
  description: string
  owner: { id: string; name: string; initials: string }
  projectCount: number
  totalInvest: string
  returnRate: string
  createdAt: string
}

function adaptStrategy(row: ApiStrategyRow): Strategy {
  const cfg = ICON_MAP[row.iconName] ?? ICON_MAP.Target!
  return {
    id: row.id,
    name: row.name,
    icon: cfg.icon,
    iconBg: cfg.iconBg,
    description: row.description,
    projectCount: row.projectCount,
    totalInvest: row.totalInvest,
    returnRate: row.returnRate,
    owner: row.owner,
    createdAt: row.createdAt,
    frameworkName: row.frameworkName || undefined,
  }
}

/* --------------------------------------------------------------------------
 * /strategies 路由 — 策略中心
 *
 * 数据源：tRPC `api.strategy.getAll`
 * 子页签由 StrategyCenter 自身管理（资讯中心 / 研报中心 / 分析框架 / 策略列表）。
 * -------------------------------------------------------------------------- */

export default function StrategiesPage() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  const { data, isLoading, isError } = api.strategy.getAll.useQuery(
    { page: 1, limit: 100 },
    { enabled: status === "authenticated" },
  )

  const strategies = useMemo<Strategy[]>(
    () => (data ? (data as ApiStrategyRow[]).map(adaptStrategy) : []),
    [data],
  )

  // StrategyCenter 要求传入可变的 strategies 数组。
  // 由于目前 strategy router 尚无 mutation，编辑操作只在本地副本生效，不持久化。
  // 后续在 strategy.ts 里加 create / update / delete mutation 后再替换成真调。
  const [localStrategies, setLocalStrategies] = useState<Strategy[]>([])
  useEffect(() => {
    setLocalStrategies(strategies)
  }, [strategies])

  function handleTopNav(nav: TopNavKey) {
    if (nav === "strategies") return
    if (nav === "dashboard") {
      router.push("/dashboard")
    } else if (nav === "projects") {
      router.push("/projects")
    } else {
      // change-requests 仍由 "/" 下的 SPA 承载
      router.push(`/?nav=${nav}`)
    }
  }

  function handleSelectStrategy(strategyId: string) {
    // 策略详情仍由 "/" 下的 SPA 承载
    router.push(`/?strategyId=${encodeURIComponent(strategyId)}`)
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
      <AppTopbar activeNav="strategies" onNavigate={handleTopNav} />
      <main className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            策略数据加载中...
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            策略数据加载失败，请稍后重试
          </div>
        ) : (
          <StrategyCenter
            strategies={localStrategies}
            onStrategiesChange={setLocalStrategies}
            onSelectStrategy={handleSelectStrategy}
            // 变更请求审批流仍是纯前端状态，这里留空；后续加 mutation 后再接
            onCreatePending={() => {
              console.warn(
                "[strategies] onCreatePending is a no-op until strategy router gains a create mutation",
              )
            }}
          />
        )}
      </main>
    </div>
  )
}
