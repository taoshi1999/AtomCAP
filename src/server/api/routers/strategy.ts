import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const strategyRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(10)
    }))
    .query(async ({ ctx, input }: { ctx: any, input: any }) => {
      const skip = (input.page - 1) * input.limit;
      const data = await ctx.db.strategy.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
      });

      return data.map((strategy: any) => ({
        id: strategy.id,
        iconName: strategy.iconName || "Target",
        name: strategy.name,
        frameworkName: strategy.frameworkName || "未关联框架",
        description: strategy.description || "",
        owner: {
          id: "1",
          name: strategy.managerName || "未指派",
          initials: strategy.managerName ? strategy.managerName.substring(0, 1) : "无"
        },
        projectCount: strategy.projectCount,
        totalInvest: strategy.totalInvestment || "0亿",
        returnRate: strategy.returnRate || "+0%",
        createdAt: strategy.createdAt.toISOString()
      }));
    }),
});
