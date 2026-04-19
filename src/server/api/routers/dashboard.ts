import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const dashboardRouter = createTRPCRouter({
  getOverview: protectedProcedure.query(async ({ ctx }: { ctx: any }) => {
    const [overview, charts, todos] = await Promise.all([
      ctx.db.dashboardOverview.findFirst({ orderBy: { updatedAt: 'desc' } }),
      ctx.db.dashboardChart.findMany({ orderBy: { id: 'desc' } }),
      ctx.db.dashboardTodo.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
    ]);
    return { overview, charts, todos };
  }),
});
