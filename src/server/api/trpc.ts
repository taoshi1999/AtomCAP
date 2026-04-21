import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { Context } from './context'

// 初始化 tRPC
// 注意：transformer 必须与客户端（src/trpc/react.tsx 中的 httpBatchLink）一致，
// 否则客户端发出的 superjson 编码请求在服务端无法被正确反序列化，
// 所有 query 都会在客户端收到 isError=true。
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
