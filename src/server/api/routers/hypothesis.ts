import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const hypothesisRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        strategyId: z.string().optional(),
        title: z.string(),
        direction: z.string().optional(),
        category: z.string().optional(),
        owner: z.string().optional(),
        creatorName: z.string().optional(),
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
      const { projectId, strategyId, title, direction, category, owner, creatorName, valuePoints, riskPoints } = input;

      // 在同一事事务内利用 Prisma 的 nested writes (嵌套写入) 特性
      // 一次性创建假设及其从属的 valuePoints / riskPoints / attachments 子记录
      const newHypothesis = await ctx.db.hypothesis.create({
        data: {
          projectId,
          strategyId,
          title,
          direction,
          category,
          owner,
          creatorName,
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

  // 获取所有假设列表（支持筛选）
  getAll: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
      strategyId: z.string().optional(),
      direction: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      owner: z.string().optional(),
      createdAfter: z.string().optional(),
      createdBefore: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {}

      if (input?.projectId) {
        where.projectId = input.projectId
      }
      if (input?.strategyId) {
        where.strategyId = input.strategyId
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
      if (input?.owner) {
        where.owner = { contains: input.owner }
      }
      if (input?.createdAfter) {
        where.createdAt = { ...where.createdAt, gte: new Date(input.createdAfter) }
      }
      if (input?.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: new Date(input.createdBefore) }
      }

      const data = await ctx.db.hypothesis.findMany({
        where,
        include: {
          strategy: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          valuePoints: { include: { attachments: true } },
          riskPoints: { include: { attachments: true } },
        },
        orderBy: { updatedAt: "desc" },
      })

      return data.map((h: any) => ({
        id: h.id,
        projectId: h.projectId,
        strategyId: h.strategyId,
        title: h.title,
        description: h.description || "",
        direction: h.direction || "",
        category: h.category || "",
        owner: h.owner || "",
        status: h.status || "pending",
        strategy: h.strategy,
        project: h.project,
        committeeConclusion: h.committeeConclusion || "",
        committeeContent: h.committeeContent || "",
        committeeStatus: h.committeeStatus || "pending",
        committeeCreatorName: h.committeeCreatorName || "",
        committeeCreatorRole: h.committeeCreatorRole || "",
        committeeCreatedAt: h.committeeCreatedAt ? h.committeeCreatedAt.toISOString().split("T")[0] : "",
        verificationConclusion: h.verificationConclusion || "",
        verificationContent: h.verificationContent || "",
        verificationStatus: h.verificationStatus || "pending",
        verificationCreatorName: h.verificationCreatorName || "",
        verificationCreatorRole: h.verificationCreatorRole || "",
        verificationCreatedAt: h.verificationCreatedAt ? h.verificationCreatedAt.toISOString().split("T")[0] : "",
        createdAt: h.createdAt.toISOString().split("T")[0],
        updatedAt: h.updatedAt.toISOString().split("T")[0],
        valuePoints: h.valuePoints || [],
        riskPoints: h.riskPoints || [],
      }))
    }),

  // 获取筛选选项（方向列表、类别列表、状态列表、创建人列表）
  getFilterOptions: protectedProcedure
    .input(z.object({ projectId: z.string().optional(), strategyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {}
      if (input?.projectId) {
        where.projectId = input.projectId
      }
      if (input?.strategyId) {
        where.strategyId = input.strategyId
      }

      const hypotheses = await ctx.db.hypothesis.findMany({
        where,
        select: {
          direction: true,
          category: true,
          status: true,
          owner: true,
        },
        distinct: ['direction', 'category', 'status', 'owner'],
      })

      return {
        directions: [...new Set(hypotheses.map(h => h.direction).filter(Boolean))] as string[],
        categories: [...new Set(hypotheses.map(h => h.category).filter(Boolean))] as string[],
        statuses: [...new Set(hypotheses.map(h => h.status).filter(Boolean))] as string[],
        owners: [...new Set(hypotheses.map(h => h.owner).filter(Boolean))] as string[],
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      await ctx.db.hypothesis.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  getLinkedTermsByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const hypotheses = await ctx.db.hypothesis.findMany({
        where: { projectId: input.projectId },
        select: { id: true },
      });
      const hypothesisIds = hypotheses.map((h: any) => h.id);
      if (hypothesisIds.length === 0) return {};
      const links = await ctx.db.termHypothesis.findMany({
        where: { hypothesisId: { in: hypothesisIds } },
        include: { term: { select: { id: true, title: true, status: true } } },
      });
      const map: Record<string, { id: string; termId: string; title: string; status: string }[]> = {};
      for (const l of links) {
        if (!map[l.hypothesisId]) map[l.hypothesisId] = [];
        map[l.hypothesisId].push({
          id: l.id,
          termId: l.term.id,
          title: l.term.title,
          status: l.term.status || "pending",
        });
      }
      return map;
    }),

  getLinkedHypothesesByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const links = await ctx.db.termHypothesis.findMany({
        where: { term: { projectId: input.projectId } },
        include: { hypothesis: { select: { id: true, title: true, status: true } } },
      });
      const map: Record<string, { id: string; hypothesisId: string; title: string; status: string }[]> = {};
      for (const l of links) {
        if (!map[l.termId]) map[l.termId] = [];
        map[l.termId].push({
          id: l.id,
          hypothesisId: l.hypothesis.id,
          title: l.hypothesis.title,
          status: l.hypothesis.status || "pending",
        });
      }
      return map;
    }),

  addTermHypothesisLink: protectedProcedure
    .input(z.object({ termId: z.string(), hypothesisId: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      return ctx.db.termHypothesis.create({
        data: { termId: input.termId, hypothesisId: input.hypothesisId },
      });
    }),

  removeTermHypothesisLink: protectedProcedure
    .input(z.object({ linkId: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      return ctx.db.termHypothesis.delete({ where: { id: input.linkId } });
    }),
});
