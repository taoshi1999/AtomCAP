"use client"

import { useParams } from "next/navigation"
import { api } from "@/src/trpc/react"
import { HypothesisChecklist } from "@/src/components/pages/hypothesis-checklist"
import type { HypothesisDetail } from "@/src/components/pages/hypothesis-checklist"
import type { CommitteeDecisionFormData, VerificationFormData } from "@/src/components/pages/workflow"

export default function HypothesesPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const utils = api.useUtils()

  const { data: project, isLoading: projectLoading } = api.project.getById.useQuery({ id: projectId })

  const { data: projectHypotheses, isLoading: hyposLoading } = api.hypothesis.getByProject.useQuery({ projectId })

  const createMutation = api.hypothesis.create.useMutation({
    onSuccess: () => utils.hypothesis.getByProject.invalidate({ projectId }),
  })

  const updateCommitteeMutation = api.hypothesis.updateCommitteeDecision.useMutation({
    onSuccess: () => utils.hypothesis.getByProject.invalidate({ projectId }),
  })

  const updateVerificationMutation = api.hypothesis.updateVerification.useMutation({
    onSuccess: () => utils.hypothesis.getByProject.invalidate({ projectId }),
  })

  if (projectLoading || hyposLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground italic flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          正在加载假设清单...
        </div>
      </div>
    )
  }

  const isNewProject = projectId.startsWith("new-project-")

  const mappedHypotheses = projectHypotheses?.map((h: any) => ({
    id: h.id,
    direction: h.direction || "未分类",
    category: h.category || "未分类",
    name: h.title,
    owner: h.owner || "未分配",
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    status: h.status as "verified" | "pending" | "risky",
  })) || []
  const inheritedHypotheses = mappedHypotheses.length > 0 ? mappedHypotheses : undefined

  const extraDetails: Record<string, HypothesisDetail> = {}
  for (const h of projectHypotheses ?? []) {
    extraDetails[h.id] = {
      id: h.id,
      qaId: `HA-${h.id.slice(-4).toUpperCase()}`,
      title: h.title,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      status: (h.status as "verified" | "pending" | "risky") || "pending",
      creator: { name: h.owner || "未分配", role: "投资经理" },
      valuePoints: (h.valuePoints || []).map((vp: any, idx: number) => ({
        id: vp.id,
        title: `价值点 ${idx + 1}`,
        evidence: {
          description: vp.support || "",
          files: (vp.attachments || []).map((a: any) => ({ name: a.name, url: a.url, size: "-", date: (a.createdAt || "").toString().split("T")[0] }))
        },
        analysis: {
          content: vp.analysis || "",
          creator: { name: h.owner || "投资经理", role: "投资经理" },
          reviewers: [],
          createdAt: (vp.createdAt || "").toString().split("T")[0]
        },
        comments: []
      })),
      riskPoints: (h.riskPoints || []).map((rp: any, idx: number) => ({
        id: rp.id,
        title: `风险点 ${idx + 1}`,
        evidence: {
          description: rp.support || "",
          files: (rp.attachments || []).map((a: any) => ({ name: a.name, url: a.url, size: "-", date: (a.createdAt || "").toString().split("T")[0] }))
        },
        analysis: {
          content: rp.analysis || "",
          creator: { name: h.owner || "投资经理", role: "投资经理" },
          reviewers: [],
          createdAt: (rp.createdAt || "").toString().split("T")[0]
        },
        comments: []
      })),
      committeeDecision: {
        conclusion: h.committeeConclusion as "假设成立" | "假设不成立" | "" || "",
        status: (h.committeeStatus as "approved" | "rejected" | "pending") || "pending",
        content: h.committeeContent || "",
        creator: h.committeeCreatorName
          ? { name: h.committeeCreatorName, role: h.committeeCreatorRole || "" }
          : { name: "", role: "" },
        reviewers: [],
        createdAt: h.committeeCreatedAt || "",
        comments: [],
      },
      verification: {
        conclusion: h.verificationConclusion as "符合预期" | "不符合预期" | "" || "",
        status: (h.verificationStatus as "confirmed" | "invalidated" | "pending") || "pending",
        content: h.verificationContent || "",
        creator: h.verificationCreatorName
          ? { name: h.verificationCreatorName, role: h.verificationCreatorRole || "" }
          : { name: "", role: "" },
        reviewers: [],
        createdAt: h.verificationCreatedAt || "",
        comments: [],
      },
      linkedTerms: [],
    }
  }

  const handleCreateCommitteeDecision = (_hypothesisId: string, _hypothesisName: string, data: CommitteeDecisionFormData) => {
    const h = projectHypotheses?.find((h: any) => h.title === _hypothesisName)
    if (!h) return
    updateCommitteeMutation.mutate({
      hypothesisId: h.id,
      conclusion: data.conclusion === "假设成立" ? "成立" : "不成立",
      content: data.content,
      creatorName: data.reviewers[0]?.name || "张伟",
      creatorRole: data.reviewers[0]?.role || "投资经理",
    })
  }

  const handleCreateVerification = (_hypothesisId: string, _hypothesisName: string, data: VerificationFormData) => {
    const h = projectHypotheses?.find((h: any) => h.title === _hypothesisName)
    if (!h) return
    updateVerificationMutation.mutate({
      hypothesisId: h.id,
      conclusion: data.conclusion === "符合预期" ? "符合预期" : "偏离",
      content: data.content,
      creatorName: data.responsibles[0]?.name || "张伟",
      creatorRole: data.responsibles[0]?.role || "投资经理",
    })
  }

  return (
    <HypothesisChecklist
      project={project as any}
      isNewProject={isNewProject}
      inheritedHypotheses={inheritedHypotheses}
      extraDetails={extraDetails}
      onCreateCommitteeDecision={handleCreateCommitteeDecision}
      onCreateVerification={handleCreateVerification}
      isInDuration={project?.stage === "投后期" || project?.status === "投后期"}
    />
  )
}
