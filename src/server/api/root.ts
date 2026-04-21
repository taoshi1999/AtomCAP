import { authRouter } from './routers/auth'
import { projectRouter } from './routers/project'
import { dashboardRouter } from './routers/dashboard'
import { strategyRouter } from './routers/strategy'
import { hypothesisRouter } from './routers/hypothesis'
import { commentRouter } from './routers/comment'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  project: projectRouter,
  dashboard: dashboardRouter,
  strategy: strategyRouter,
  hypothesis: hypothesisRouter,
  comment: commentRouter,
})

export type AppRouter = typeof appRouter
