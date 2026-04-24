import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const hypothesisRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string(),
        direction: z.string().optional(),
        category: z.string().optional(),
        owner: z.string().optional(),
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
      const { projectId, title, direction, category, owner, valuePoints, riskPoints } = input;

      const newHypothesis = await ctx.db.hypothesis.create({
        data: {
          projectId,
          title,
          direction,
          category,
          owner,
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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      return ctx.db.hypothesis.delete({ where: { id: input.id } });
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

  getLinkedTerms: protectedProcedure
    .input(z.object({ hypothesisId: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const links = await ctx.db.termHypothesis.findMany({
        where: { hypothesisId: input.hypothesisId },
      });
      return links.map((l: any) => ({
        id: l.id,
        termId: l.termId,
        hypothesisId: l.hypothesisId,
      }));
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
      });
      const map: Record<string, { id: string; termId: string; title: string; status: string }[]> = {};
      for (const l of links) {
        if (!map[l.hypothesisId]) map[l.hypothesisId] = [];
        map[l.hypothesisId].push({
          id: l.id,
          termId: l.termId,
          title: `条款 ${l.termId.slice(-4).toUpperCase()}`,
          status: "pending",
        });
      }
      return map;
    }),

  getLinkedHypothesesByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const links = await ctx.db.termHypothesis.findMany({
        where: { hypothesis: { projectId: input.projectId } },
        include: { hypothesis: { select: { id: true, title: true, status: true } } },
      });
      const map: Record<string, { id: string; hypothesisId: string; title: string; status: string }[]> = {};
      for (const l of links) {
        if (!map[l.termId]) map[l.termId] = [];
        map[l.termId].push({
          id: l.id,
          hypothesisId: l.hypothesisId,
          title: l.hypothesis.title,
          status: l.hypothesis.status || "pending",
        });
      }
      return map;
    }),

  getLinkedHypotheses: protectedProcedure
    .input(z.object({ termId: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const links = await ctx.db.termHypothesis.findMany({
        where: { termId: input.termId },
        include: { hypothesis: { select: { id: true, title: true, status: true } } },
      });
      return links.map((l: any) => ({
        id: l.id,
        termId: l.termId,
        hypothesisId: l.hypothesisId,
        hypothesis: l.hypothesis,
      }));
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
