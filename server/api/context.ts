import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { type NextRequest } from 'next/server'

export type Session = Awaited<ReturnType<typeof getServerSession>>

/**
 * 为 tRPC 创建上下文
 */
export const createContext = async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  
  return {
    session,
    req,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
