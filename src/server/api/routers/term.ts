import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/src/server/api/trpc";

export const termRouter = createTRPCRouter({
  getAllByProjectId: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const terms = await ctx.db.term.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });

      // Map to TermTableItem format
      return terms.map((term) => ({
        id: term.id,
        direction: term.direction || "",
        category: term.category || "",
        name: term.title,
        owner: term.owner || "未知",
        createdAt: term.createdAt.toISOString().split("T")[0],
        updatedAt: term.updatedAt.toISOString().split("T")[0],
        status: term.status, // "drafted" | "negotiating" | "approved" | "rejected" | "implemented"
      }));
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.term.delete({
        where: { id: input.id },
      });
    }),
});
