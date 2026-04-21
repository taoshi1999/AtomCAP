import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";


export const hypothesisRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const hypotheses = await ctx.db.hypothesis.findMany({
      orderBy: { createdAt: "desc" },
    });
    
    return hypotheses.map((h) => ({
      id: h.id,
      direction: h.direction || "",
      category: h.category || "",
      name: h.title,
      owner: h.owner || "未知",
      createdAt: h.createdAt.toISOString().split("T")[0],
      updatedAt: h.updatedAt.toISOString().split("T")[0],
      status: (h.status as "verified" | "pending" | "risky") || "pending",
    }));
  }),

  // Provide details to render hypothesis clicking properly without breaking mock UI
  getDetails: publicProcedure.query(async ({ ctx }) => {
    const hypotheses = await ctx.db.hypothesis.findMany();
    const mockPerson = { name: "未知角色", role: "员工" };
    const detailsMap: Record<string, any> = {};
    
    hypotheses.forEach((h) => {
      detailsMap[h.id] = {
        id: h.id,
        title: h.title,
        qaId: `QA-${h.id.slice(-6).toUpperCase()}`,
        createdAt: h.createdAt.toISOString().split("T")[0],
        updatedAt: h.updatedAt.toISOString().split("T")[0],
        status: (h.status as "verified" | "pending" | "risky") || "pending",
        creator: { name: h.owner || "未知", role: "投资经理" },
        valuePoints: [],
        riskPoints: [],
        committeeDecision: {
          conclusion: h.committeeConclusion || "",
          status: h.committeeStatus || "pending",
          content: h.committeeContent || "",
          creator: { 
            name: h.committeeCreatorName || mockPerson.name, 
            role: h.committeeCreatorRole || mockPerson.role 
          },
          reviewers: [],
          createdAt: h.committeeCreatedAt ? h.committeeCreatedAt.toISOString().split("T")[0] : "",
          comments: [],
        },
        verification: {
          conclusion: h.verificationConclusion || "",
          status: h.verificationStatus || "pending",
          content: h.verificationContent || "",
          creator: { 
            name: h.verificationCreatorName || mockPerson.name, 
            role: h.verificationCreatorRole || mockPerson.role 
          },
          reviewers: [],
          createdAt: h.verificationCreatedAt ? h.verificationCreatedAt.toISOString().split("T")[0] : "",
          comments: [],
        },
        linkedTerms: [],
      };
    });
    
    return detailsMap;
  }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.hypothesis.delete({
        where: { id: input.id },
      });
      return { success: true };
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
});

