import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc"

export const commentRouter = createTRPCRouter({
  getByHypothesis: protectedProcedure
    .input(z.object({
      hypothesisId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db.comment.findMany({
        where: { hypothesisId: input.hypothesisId },
        orderBy: { createdAt: "asc" },
        include: {
          attachments: true,
        },
      })

      return comments.map((c) => ({
        id: c.id,
        hypothesisId: c.hypothesisId,
        content: c.content,
        authorName: c.authorName,
        authorAvatar: c.authorAvatar || "",
        createdAt: c.createdAt.toISOString().split("T")[0],
        updatedAt: c.updatedAt.toISOString().split("T")[0],
        attachments: c.attachments.map((a) => ({
          id: a.id,
          hypothesisId: a.hypothesisId,
          commentId: a.commentId || "",
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileFormat: a.fileFormat || "",
          fileSize: a.fileSize || "",
          createdAt: a.createdAt.toISOString().split("T")[0],
        })),
      }))
    }),

  create: protectedProcedure
    .input(z.object({
      hypothesisId: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.comment.create({
        data: {
          hypothesisId: input.hypothesisId,
          content: input.content,
          authorName: ctx.session.user.name || "匿名用户",
        },
      })
    }),

  addAttachment: protectedProcedure
    .input(z.object({
      hypothesisId: z.string(),
      commentId: z.string().optional(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileFormat: z.string().optional(),
      fileSize: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.attachment.create({
        data: {
          hypothesisId: input.hypothesisId,
          commentId: input.commentId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileFormat: input.fileFormat,
          fileSize: input.fileSize,
        },
      })
    }),
})
