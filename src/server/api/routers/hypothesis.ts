import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const hypothesisRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string(),
        valuePoints: z
          .array(
            z.object({
              support: z.string(),
              analysis: z.string(),
              attachments: z
                .array(
                  z.object({
                    name: z.string(),
                    url: z.string(),
                  })
                )
                .optional(),
            })
          )
          .optional(),
        riskPoints: z
          .array(
            z.object({
              support: z.string(),
              analysis: z.string(),
              attachments: z
                .array(
                  z.object({
                    name: z.string(),
                    url: z.string(),
                  })
                )
                .optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { projectId, title, valuePoints, riskPoints } = input;

      // 在同一事事务内利用 Prisma 的 nested writes (嵌套写入) 特性
      // 一次性创建假设及其从属的 valuePoints / riskPoints / attachments 子记录
      const newHypothesis = await ctx.db.hypothesis.create({
        data: {
          projectId,
          title,
          status: "pending",
          valuePoints: {
            create:
              valuePoints?.map((vp: any) => ({
                support: vp.support,
                analysis: vp.analysis,
                attachments: {
                  create:
                    vp.attachments?.map((att: any) => ({
                      name: att.name,
                      url: att.url,
                    })) || [],
                },
              })) || [],
          },
          riskPoints: {
            create:
              riskPoints?.map((rp: any) => ({
                support: rp.support,
                analysis: rp.analysis,
                attachments: {
                  create:
                    rp.attachments?.map((att: any) => ({
                      name: att.name,
                      url: att.url,
                    })) || [],
                },
              })) || [],
          },
        },
      });

      return newHypothesis;
    }),

  getByProject: protectedProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const data = await ctx.db.hypothesis.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "asc" },
        include: {
          valuePoints: {
            include: { attachments: true }
          },
          riskPoints: {
            include: { attachments: true }
          },
        },
      });

      return data.map((h: any) => ({
        id: h.id,
        projectId: h.projectId,
        title: h.title,
        description: h.description || "",
        direction: h.direction || "",
        category: h.category || "",
        owner: h.owner || "",
        status: h.status || "pending",
        committeeConclusion: h.committeeConclusion || "",
        committeeContent: h.committeeContent || "",
        committeeStatus: h.committeeStatus || "pending",
        committeeCreatorName: h.committeeCreatorName || "",
        committeeCreatorRole: h.committeeCreatorRole || "",
        committeeCreatedAt: h.committeeCreatedAt
          ? h.committeeCreatedAt.toISOString().split("T")[0]
          : "",
        verificationConclusion: h.verificationConclusion || "",
        verificationContent: h.verificationContent || "",
        verificationStatus: h.verificationStatus || "pending",
        verificationCreatorName: h.verificationCreatorName || "",
        verificationCreatorRole: h.verificationCreatorRole || "",
        verificationCreatedAt: h.verificationCreatedAt
          ? h.verificationCreatedAt.toISOString().split("T")[0]
          : "",
        createdAt: h.createdAt.toISOString().split("T")[0],
        updatedAt: h.updatedAt.toISOString().split("T")[0],
        // GPT-FIX: 将查询出的价值点、风险点直接返回前端
        valuePoints: h.valuePoints || [],
        riskPoints: h.riskPoints || [],
      }));
    }),

  getByStrategy: protectedProcedure
    .input(z.object({
      strategyId: z.string(),
    }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const data = await ctx.db.hypothesis.findMany({
        where: { strategyId: input.strategyId },
        orderBy: { createdAt: "asc" },
      });

      return data.map((h: any) => ({
        id: h.id,
        strategyId: h.strategyId,
        title: h.title,
        description: h.description || "",
        direction: h.direction || "",
        category: h.category || "",
        owner: h.owner || "",
        status: h.status || "pending",
        committeeConclusion: h.committeeConclusion || "",
        committeeContent: h.committeeContent || "",
        committeeStatus: h.committeeStatus || "pending",
        committeeCreatorName: h.committeeCreatorName || "",
        committeeCreatorRole: h.committeeCreatorRole || "",
        committeeCreatedAt: h.committeeCreatedAt
          ? h.committeeCreatedAt.toISOString().split("T")[0]
          : "",
        verificationConclusion: h.verificationConclusion || "",
        verificationContent: h.verificationContent || "",
        verificationStatus: h.verificationStatus || "pending",
        verificationCreatorName: h.verificationCreatorName || "",
        verificationCreatorRole: h.verificationCreatorRole || "",
        verificationCreatedAt: h.verificationCreatedAt
          ? h.verificationCreatedAt.toISOString().split("T")[0]
          : "",
        createdAt: h.createdAt.toISOString().split("T")[0],
        updatedAt: h.updatedAt.toISOString().split("T")[0],
      }));
    }),

  updateCommitteeDecision: protectedProcedure
    .input(
      z.object({
        hypothesisId: z.string(),
        conclusion: z.enum(["成立", "不成立"]),
        content: z.string().min(1),
        creatorName: z.string().optional(),
        creatorRole: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { hypothesisId, conclusion, content, creatorName, creatorRole } = input;

      const newStatus = conclusion === "成立" ? "verified" : "risky";
      const committeeStatus = conclusion === "成立" ? "approved" : "rejected";

      const updated = await ctx.db.hypothesis.update({
        where: { id: hypothesisId },
        data: {
          committeeConclusion: conclusion,
          committeeContent: content,
          committeeStatus,
          committeeCreatorName: creatorName || "",
          committeeCreatorRole: creatorRole || "",
          committeeCreatedAt: new Date(),
          status: newStatus,
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        committeeConclusion: updated.committeeConclusion,
        committeeContent: updated.committeeContent,
        committeeStatus: updated.committeeStatus,
      };
    }),

  updateVerification: protectedProcedure
    .input(
      z.object({
        hypothesisId: z.string(),
        conclusion: z.enum(["符合预期", "偏离"]),
        content: z.string().min(1),
        creatorName: z.string().optional(),
        creatorRole: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { hypothesisId, conclusion, content, creatorName, creatorRole } = input;

      const verificationStatus = conclusion === "符合预期" ? "confirmed" : "invalidated";

      const updated = await ctx.db.hypothesis.update({
        where: { id: hypothesisId },
        data: {
          verificationConclusion: conclusion,
          verificationContent: content,
          verificationStatus,
          verificationCreatorName: creatorName || "",
          verificationCreatorRole: creatorRole || "",
          verificationCreatedAt: new Date(),
        },
      });

      return {
        id: updated.id,
        verificationConclusion: updated.verificationConclusion,
        verificationContent: updated.verificationContent,
        verificationStatus: updated.verificationStatus,
      };
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        valuePointId: z.string().optional(),
        riskPointId: z.string().optional(),
        hypothesisId: z.string().optional(),
        commentType: z.enum(["valuePoint", "riskPoint", "committeeDecision", "verification"]).optional(),
        content: z.string().optional(),
        author: z.string(),
        attachments: z
          .array(
            z.object({
              name: z.string(),
              url: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { valuePointId, riskPointId, hypothesisId, commentType, content, author, attachments } = input;

      let committeeDecisionId: string | undefined = undefined;
      let verificationId: string | undefined = undefined;
      let finalValuePointId: string | null = null;
      let finalRiskPointId: string | null = null;

      if (commentType === "committeeDecision" && hypothesisId) {
        committeeDecisionId = hypothesisId;
      } else if (commentType === "verification" && hypothesisId) {
        verificationId = hypothesisId;
      } else if (commentType === "valuePoint" && valuePointId) {
        finalValuePointId = valuePointId;
      } else if (commentType === "riskPoint" && riskPointId) {
        finalRiskPointId = riskPointId;
      }

      const comment = await ctx.db.comment.create({
        data: {
          content: content || "",
          author,
          valuePointId: finalValuePointId,
          riskPointId: finalRiskPointId,
          committeeDecisionId,
          verificationId,
          attachments: {
            create:
              attachments?.map((att: any) => ({
                name: att.name,
                url: att.url,
              })) || [],
          },
        },
        include: {
          attachments: true,
        },
      });

      return comment;
    }),

  getComments: protectedProcedure
    .input(
      z.object({
        valuePointIds: z.array(z.string()).optional(),
        riskPointIds: z.array(z.string()).optional(),
        hypothesisId: z.string().optional(),
        commentType: z.enum(["valuePoint", "riskPoint", "committeeDecision", "verification"]).optional(),
      })
    )
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { valuePointIds, riskPointIds, hypothesisId, commentType } = input;

      const whereConditions: any[] = [];
      if (valuePointIds && valuePointIds.length > 0) {
        whereConditions.push({ valuePointId: { in: valuePointIds } });
      }
      if (riskPointIds && riskPointIds.length > 0) {
        whereConditions.push({ riskPointId: { in: riskPointIds } });
      }
      if (hypothesisId) {
        whereConditions.push({ committeeDecisionId: hypothesisId });
        whereConditions.push({ verificationId: hypothesisId });
      }

      const comments = await ctx.db.comment.findMany({
        where: whereConditions.length > 0 ? { OR: whereConditions } : {},
        include: {
          attachments: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        author: c.author,
        createdAt: c.createdAt.toISOString(),
        attachments: c.attachments || [],
        valuePointId: c.valuePointId,
        riskPointId: c.riskPointId,
        committeeDecisionId: c.committeeDecisionId,
        verificationId: c.verificationId,
      }));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      await ctx.db.hypothesis.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
