import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/server/auth'
import { prisma } from '@/src/server/db'
import { type NextRequest } from 'next/server'

export type Session = Awaited<ReturnType<typeof getServerSession>>

/**
 * 为 tRPC 创建上下文（T3 Stack 惯例：将 session 与 db 注入 ctx，
 * 后续 router 中可通过 ctx.db 访问 Prisma 客户端）
 */
export const createContext = async (req: NextRequest) => {
  const session = await getServerSession(authOptions)

  return {
    session,
    db: prisma,
    req,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
