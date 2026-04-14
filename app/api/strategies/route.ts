import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) { // 【修改】：从无参变为接收 request 对象以便获取 URL 分页参数
  try {
    // 【新增】：解析前端传递的分页参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 【新增】：计算数据库跳过的条数偏移量 offset
    const skip = (page - 1) * limit

    // 【修改】：在 Prisma 查询中加入 skip(跳过前N条) 和 take(只取M条) 实现数据库切割
    const data = await prisma.strategy.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
    
    const strategies = data.map(strategy => ({
      id: strategy.id,
      iconName: strategy.iconName || "Target",
      name: strategy.name,
      frameworkName: strategy.frameworkName || "未关联框架",
      description: strategy.description || "",
      owner: {
        id: "1",
        name: strategy.managerName || "未指派", // Remove hardcoded "张伟"
        initials: strategy.managerName ? strategy.managerName.substring(0, 1) : "未"
      },
      projectCount: strategy.projectCount,
      totalInvest: strategy.totalInvestment || "0亿",
      returnRate: strategy.returnRate || "+0%",
      createdAt: strategy.createdAt.toISOString()
    }))

    return NextResponse.json(strategies)
  } catch (error) {
    console.error("GET /api/strategies error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
