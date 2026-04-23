import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const hypothesisRouter = createTRPCRouter({
  getByStrategy: protectedProcedure
    .input(z.object({
      strategyId: z.string(),
    }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const data = await ctx.db.hypothesis.findMany({
        where: { strategyId: input.strategyId },
        include: {
          valuePoints: { include: { attachments: true } },
          riskPoints: { include: { attachments: true } },
          attachments: true,
        },
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
        valuePoints: h.valuePoints || [],
        riskPoints: h.riskPoints || [],
        attachments: h.attachments || [],
        createdAt: h.createdAt.toISOString().split("T")[0],
        updatedAt: h.updatedAt.toISOString().split("T")[0],
      }));
    }),
  
  getByProject: protectedProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const data = await ctx.db.hypothesis.findMany({
        where: { projectId: input.projectId },
        include: {
          valuePoints: { include: { attachments: true } },
          riskPoints: { include: { attachments: true } },
          attachments: true,
        },
        orderBy: { updatedAt: "desc" },
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
        valuePoints: h.valuePoints || [],
        riskPoints: h.riskPoints || [],
        attachments: h.attachments || [],
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

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      strategyId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      direction: z.string().optional(),
      category: z.string().optional(),
      owner: z.string().optional(),
      valuePoints: z.array(z.any()).optional(),
      riskPoints: z.array(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      // Default strategy if not provided
      const strategyId = input.strategyId || "1"; 
      
      const hypothesis = await ctx.db.hypothesis.create({
        data: {
          projectId: input.projectId,
          strategyId,
          title: input.title,
          description: input.description,
          direction: input.direction || "未分类",
          category: input.category || "未分类",
          owner: input.owner || "投资经理",
          status: "pending",
          valuePoints: {
            create: (input.valuePoints || []).map((vp: any) => ({
              support: vp.support,
              analysis: vp.analysis,
              attachments: {
                create: (vp.attachments || []).map((a: any) => ({
                  name: a.name,
                  url: a.url,
                })),
              },
            })),
          },
          riskPoints: {
            create: (input.riskPoints || []).map((rp: any) => ({
              support: rp.support,
              analysis: rp.analysis,
              attachments: {
                create: (rp.attachments || []).map((a: any) => ({
                  name: a.name,
                  url: a.url,
                })),
              },
            })),
          },
        },
      });
      return hypothesis;
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      await ctx.db.hypothesis.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
