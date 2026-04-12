import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateProjectCode } from "@/lib/project-code"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      logo,
      description,
      tags,
      valuation,
      round,
      ownerId,
      ownerName,
      strategyId,
      strategyName,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "项目名称不能为空" },
        { status: 400 }
      )
    }

    const code = generateProjectCode()

    const project = await prisma.project.create({
      data: {
        code,
        name: name.trim(),
        logo: logo || name.trim().charAt(0),
        description: description || "",
        tags: tags || [],
        status: "待立项",
        valuation: valuation || "",
        round: round || "",
        ownerId: ownerId || "",
        ownerName: ownerName || "",
        strategyId: strategyId || "",
        strategyName: strategyName || "",
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error("创建项目失败:", error)
    return NextResponse.json(
      { error: "创建项目失败" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const ownerId = searchParams.get("ownerId")
    const strategyId = searchParams.get("strategyId")

    const where: Record<string, string> = {}
    if (status) where.status = status
    if (ownerId) where.ownerId = ownerId
    if (strategyId) where.strategyId = strategyId

    const projects = await prisma.project.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("获取项目列表失败:", error)
    return NextResponse.json(
      { error: "获取项目列表失败" },
      { status: 500 }
    )
  }
}