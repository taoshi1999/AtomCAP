import { authRouter } from './routers/auth'
import { projectRouter } from './routers/project'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  project: projectRouter,
})

export type AppRouter = typeof appRouter
