import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // 用 Promise.all 后，这三个查询发往数据库会同时启动，总查询时长仅取决于最慢的那一个查询
    const [overview, charts, todos] = await Promise.all([
      prisma.dashboardOverview.findFirst({ orderBy: { updatedAt: 'desc' } }), // 查第一块：顶部总览数据
      prisma.dashboardChart.findMany({ orderBy: { id: 'desc' } }),            // 查第二块：中间各类图表数组
      prisma.dashboardTodo.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }) // 查第三块：底部待办事项
    ])
    
    // 【合并为一个包打过去】：
    // 直接把它们合装成一个大 JSON 包给前端，前端发一次 fetch 请求就能把整块首屏数据拿全，瞬间完成全量渲染。
    return NextResponse.json({ overview, charts, todos })
  } catch (error) {
    console.error("GET /api/dashboard error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
