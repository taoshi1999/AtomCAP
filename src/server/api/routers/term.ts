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
      direction: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      creatorName: z.string().optional(),
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
          direction: input.direction,
          category: input.category,
          status: input.status ?? "草拟",
          creatorName: input.creatorName,
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

  // 获取某个项目的所有条款列表
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

  // 获取所有条款列表（支持筛选）
  getAll: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
      direction: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      creatorName: z.string().optional(),
      createdAfter: z.string().optional(),
      createdBefore: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {}

      if (input?.projectId) {
        where.projectId = input.projectId
      }
      if (input?.direction) {
        where.direction = input.direction
      }
      if (input?.category) {
        where.category = input.category
      }
      if (input?.status) {
        where.status = input.status
      }
      if (input?.creatorName) {
        where.creatorName = { contains: input.creatorName }
      }
      if (input?.createdAfter) {
        where.createdAt = { ...where.createdAt, gte: new Date(input.createdAfter) }
      }
      if (input?.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: new Date(input.createdBefore) }
      }

      return ctx.db.term.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          attachments: true,
        },
        orderBy: { updatedAt: "desc" },
      })
    }),

  // 获取筛选选项（方向列表、类别列表、状态列表、创建人列表）
  getFilterOptions: protectedProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {}
      if (input?.projectId) {
        where.projectId = input.projectId
      }

      const terms = await ctx.db.term.findMany({
        where,
        select: {
          direction: true,
          category: true,
          status: true,
          creatorName: true,
        },
        distinct: ['direction', 'category', 'status', 'creatorName'],
      })

      return {
        directions: [...new Set(terms.map(t => t.direction).filter(Boolean))] as string[],
        categories: [...new Set(terms.map(t => t.category).filter(Boolean))] as string[],
        statuses: [...new Set(terms.map(t => t.status).filter(Boolean))] as string[],
        creators: [...new Set(terms.map(t => t.creatorName).filter(Boolean))] as string[],
      }
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

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.term.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.term.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
