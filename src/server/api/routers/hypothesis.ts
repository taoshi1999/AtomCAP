import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

const commentScopeSchema = z.enum([
  "hypothesis",
  "value_point",
  "risk_point",
  "committee_decision",
  "verification",
]);

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

  getComments: protectedProcedure
    .input(
      z.object({
        hypothesisId: z.string(),
        scopeType: commentScopeSchema.default("hypothesis"),
        scopeRefId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      return ctx.db.hypothesisComment.findMany({
        where: {
          hypothesisId: input.hypothesisId,
          scopeType: input.scopeType,
          scopeRefId: input.scopeRefId ?? null,
        },
        include: { attachments: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        hypothesisId: z.string(),
        scopeType: commentScopeSchema.default("hypothesis"),
        scopeRefId: z.string().optional(),
        content: z.string().optional(),
        attachments: z
          .array(
            z.object({
              name: z.string(),
              format: z.string().optional(),
              size: z.string().optional(),
              url: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const user = ctx.session.user;

      if (
        (!input.content || input.content.trim() === "") &&
        (!input.attachments || input.attachments.length === 0)
      ) {
        throw new Error("Cannot add empty comment");
      }

      // 如果数据库中不存在该 hypothesisId，为了避免外键约束错误，先创建一个空的假数据占位
      // 这主要是因为当前项目部分列表数据(如 tech-bg)是硬编码在前端的，并不在数据库里
      const existingHypothesis = await ctx.db.hypothesis.findUnique({
        where: { id: input.hypothesisId }
      });

      if (!existingHypothesis) {
        await ctx.db.hypothesis.create({
          data: {
            id: input.hypothesisId,
            title: input.hypothesisId, // 使用 id 作为标题占位
            status: "pending",
          }
        });
      }

      return ctx.db.hypothesisComment.create({
        data: {
          hypothesisId: input.hypothesisId,
          scopeType: input.scopeType,
          scopeRefId: input.scopeRefId,
          content: input.content || "",
          creatorId: user.id,
          creatorName: user.name || "Unknown User",
          creatorAvatar: user.image,
          attachments:
            input.attachments && input.attachments.length > 0
              ? {
                  create: input.attachments,
                }
              : undefined,
        },
        include: { attachments: true },
      });
    }),
});
