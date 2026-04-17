import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { Context } from './context'

// 初始化 tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

// 导出基础配置
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

// 受保护的程序（需要登录）
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    })
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  })
})
