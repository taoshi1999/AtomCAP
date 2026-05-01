import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/src/server/api/trpc";

export const termRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1),
      ourRequest: z.string().optional(),
      ourBasis: z.string().optional(),
      conflict: z.string().optional(),
      ourBottomLine: z.string().optional(),
      compromiseSpace: z.string().optional(),
      negotiationResult: z.string().optional(),
      implementation: z.string().optional(),
      attachments: z.array(z.object({
        name: z.string(),
        url: z.string(),
        section: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const term = await ctx.db.term.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          ourRequest: input.ourRequest,
          ourBasis: input.ourBasis,
          conflict: input.conflict,
          ourBottomLine: input.ourBottomLine,
          compromiseSpace: input.compromiseSpace,
          negotiationResult: input.negotiationResult,
          implementation: input.implementation,
        },
      });

      if (input.attachments && input.attachments.length > 0) {
        await ctx.db.attachment.createMany({
          data: input.attachments.map(a => ({
            name: a.name,
            url: a.url,
            section: a.section,
            termId: term.id,
          })),
        });
      }

      return term;
    }),

  getByProjectId: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.term.findMany({
        where: { projectId: input.projectId },
        include: {
          attachments: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  updateSection: protectedProcedure
    .input(z.object({
      id: z.string(),
      section: z.enum([
        "ourRequest",
        "ourBasis",
        "conflict",
        "ourBottomLine",
        "compromiseSpace",
        "negotiationResult",
        "implementation",
      ]),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.term.update({
        where: { id: input.id },
        data: {
          [input.section]: input.content,
        },
      });
    }),

  addAttachment: protectedProcedure
    .input(z.object({
      termId: z.string(),
      section: z.string(),
      name: z.string(),
      url: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.attachment.create({
        data: {
          name: input.name,
          url: input.url,
          section: input.section,
          termId: input.termId,
        },
      });
    }),
});
