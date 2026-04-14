import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) { // 【修改】：从无参变为接收 request 对象以便获取 URL 分页参数
  try {
    // 【新增】：解析前端传递的分页参数，如果没传默认第一页，每页10条
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 【新增】：计算数据库跳过的条数偏移量 offset
    const skip = (page - 1) * limit

    // 【修改】：在 Prisma 查询中加入 skip(跳过前N条) 和 take(只取M条) 实现数据库切割
    const data = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
    
    // Status color helper matching components logic
    const getStatusColor = (status: string) => {
      const options: Record<string, string> = {
        "未立项": "bg-gray-50 text-gray-600 border-gray-200",
        "投前期": "bg-blue-50 text-blue-700 border-blue-200",
        "投中期": "bg-amber-50 text-amber-700 border-amber-200",
        "投后期": "bg-emerald-50 text-emerald-700 border-emerald-200",
        "已退出": "bg-red-50 text-red-700 border-red-200",
      }
      return options[status] || "bg-gray-50 text-gray-600 border-gray-200"
    }

    const projects = data.map(project => ({
      id: project.id,
      name: project.name,
      logo: project.logo || (project.name.length > 0 ? project.name[0] : "P"),
      description: project.description || "",
      tags: project.tags ? project.tags.split(',') : [],
      status: project.stage,
      statusColor: getStatusColor(project.stage),
      valuation: "估值未知", // Or fetched
      round: project.round || "未知轮次",
      owner: { 
        id: project.managerId || "1", 
        name: project.managerName || "未指派", 
        initials: (project.managerName || "未指派").substring(0, 1) 
      },
      createdAt: project.createdAt.toISOString()
    }))

    return NextResponse.json(projects)
  } catch (error) {
    console.error("GET /api/projects error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
