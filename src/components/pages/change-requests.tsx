"use client"

import { useState } from "react"
import { GitPullRequest, Search, Check, X, Eye, Clock, Briefcase, FolderKanban, GitBranch, Lightbulb, FileText, FolderOpen, LayoutGrid } from "lucide-react"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import { Badge } from "@/src/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog"
import { cn } from "@/src/lib/utils"
import type { PendingStrategy, PendingHypothesis, PendingTerm, PendingMaterial } from "./strategies-grid"
import type { PendingProject } from "./projects-grid"
import type { PendingPhase, PendingProjectHypothesis, PendingProjectTerm, PendingProjectMaterial, PendingCommitteeDecision, PendingNegotiationDecision, PendingVerification, PendingImplementationStatus } from "./workflow"
import type { PendingFramework } from "./analysis-frameworks"

type PendingRequest =
  | { type: "strategy"; data: PendingStrategy }
  | { type: "project"; data: PendingProject }
  | { type: "phase"; data: PendingPhase }
  | { type: "hypothesis"; data: PendingHypothesis }
  | { type: "project-hypothesis"; data: PendingProjectHypothesis }
  | { type: "committee-decision"; data: PendingCommitteeDecision }
  | { type: "term"; data: PendingTerm }
  | { type: "project-term"; data: PendingProjectTerm }
  | { type: "negotiation-decision"; data: PendingNegotiationDecision }
  | { type: "material"; data: PendingMaterial }
  | { type: "project-material"; data: PendingProjectMaterial }
  | { type: "verification"; data: PendingVerification }
  | { type: "implementation-status"; data: PendingImplementationStatus }
  | { type: "framework"; data: PendingFramework }

interface ChangeRequestsProps {
  pendingStrategies: PendingStrategy[]
  pendingProjects: PendingProject[]
  pendingPhases: PendingPhase[]
  pendingHypotheses: PendingHypothesis[]
  pendingProjectHypotheses: PendingProjectHypothesis[]
  pendingCommitteeDecisions: PendingCommitteeDecision[]
  pendingTerms: PendingTerm[]
  pendingProjectTerms: PendingProjectTerm[]
  pendingNegotiationDecisions: PendingNegotiationDecision[]
  pendingMaterials: PendingMaterial[]
  pendingProjectMaterials: PendingProjectMaterial[]
  onApproveStrategy: (id: string) => void
  onRejectStrategy: (id: string) => void
  onApproveProject: (id: string) => void
  onRejectProject: (id: string) => void
  onApprovePhase: (id: string) => void
  onRejectPhase: (id: string) => void
  onApproveHypothesis: (id: string) => void
  onRejectHypothesis: (id: string) => void
  onApproveProjectHypothesis: (id: string) => void
  onRejectProjectHypothesis: (id: string) => void
  onApproveCommitteeDecision: (id: string) => void
  onRejectCommitteeDecision: (id: string) => void
  onApproveTerm: (id: string) => void
  onRejectTerm: (id: string) => void
  onApproveProjectTerm: (id: string) => void
  onRejectProjectTerm: (id: string) => void
  onApproveNegotiationDecision: (id: string) => void
  onRejectNegotiationDecision: (id: string) => void
  onApproveMaterial: (id: string) => void
  onRejectMaterial: (id: string) => void
  onApproveProjectMaterial: (id: string) => void
  onRejectProjectMaterial: (id: string) => void
  pendingVerifications: PendingVerification[]
  onApproveVerification: (id: string) => void
  onRejectVerification: (id: string) => void
  pendingImplementationStatuses: PendingImplementationStatus[]
  onApproveImplementationStatus: (id: string) => void
  onRejectImplementationStatus: (id: string) => void
  pendingFrameworks: PendingFramework[]
  onApproveFramework: (id: string) => void
  onRejectFramework: (id: string) => void
}

export function ChangeRequests({
  pendingStrategies,
  pendingProjects,
  pendingPhases,
  pendingHypotheses,
  pendingProjectHypotheses,
  pendingCommitteeDecisions,
  pendingTerms,
  pendingProjectTerms,
  pendingNegotiationDecisions,
  pendingMaterials,
  pendingProjectMaterials,
  onApproveStrategy,
  onRejectStrategy,
  onApproveProject,
  onRejectProject,
  onApprovePhase,
  onRejectPhase,
  onApproveHypothesis,
  onRejectHypothesis,
  onApproveProjectHypothesis,
  onRejectProjectHypothesis,
  onApproveCommitteeDecision,
  onRejectCommitteeDecision,
  onApproveTerm,
  onRejectTerm,
  onApproveProjectTerm,
  onRejectProjectTerm,
  onApproveNegotiationDecision,
  onRejectNegotiationDecision,
  onApproveMaterial,
  onRejectMaterial,
  onApproveProjectMaterial,
  onRejectProjectMaterial,
  pendingVerifications,
  onApproveVerification,
  onRejectVerification,
  pendingImplementationStatuses,
  onApproveImplementationStatus,
  onRejectImplementationStatus,
  pendingFrameworks,
  onApproveFramework,
  onRejectFramework,
}: ChangeRequestsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
  const [filterType, setFilterType] = useState<"all" | "strategy" | "project" | "phase" | "hypothesis" | "term" | "material" | "framework">("all")

  // Combine all requests
  const allRequests: PendingRequest[] = [
    ...pendingStrategies.map((s) => ({ type: "strategy" as const, data: s })),
    ...pendingProjects.map((p) => ({ type: "project" as const, data: p })),
    ...pendingPhases.map((p) => ({ type: "phase" as const, data: p })),
    ...pendingHypotheses.map((h) => ({ type: "hypothesis" as const, data: h })),
    ...pendingProjectHypotheses.map((h) => ({ type: "project-hypothesis" as const, data: h })),
    ...pendingCommitteeDecisions.map((c) => ({ type: "committee-decision" as const, data: c })),
    ...pendingTerms.map((t) => ({ type: "term" as const, data: t })),
    ...pendingProjectTerms.map((t) => ({ type: "project-term" as const, data: t })),
    ...pendingNegotiationDecisions.map((n) => ({ type: "negotiation-decision" as const, data: n })),
    ...pendingMaterials.map((m) => ({ type: "material" as const, data: m })),
    ...pendingProjectMaterials.map((m) => ({ type: "project-material" as const, data: m })),
    ...pendingVerifications.map((v) => ({ type: "verification" as const, data: v })),
    ...pendingImplementationStatuses.map((is) => ({ type: "implementation-status" as const, data: is })),
    ...pendingFrameworks.map((f) => ({ type: "framework" as const, data: f })),
  ].sort((a, b) => new Date(b.data.initiatedAt).getTime() - new Date(a.data.initiatedAt).getTime())

  const filteredRequests = allRequests.filter((r) => {
    const matchesSearch =
      r.data.changeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.data.changeId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType =
      filterType === "all" ||
      r.type === filterType ||
      (filterType === "hypothesis" && (r.type === "project-hypothesis" || r.type === "committee-decision" || r.type === "verification")) ||
      (filterType === "term" && (r.type === "negotiation-decision" || r.type === "implementation-status")) ||
      (filterType === "framework" && r.type === "framework")
    return matchesSearch && matchesType
  })

  const totalCount = allRequests.length
  const strategyCount = pendingStrategies.length
  const projectCount = pendingProjects.length
  const phaseCount = pendingPhases.length
  const hypothesisCount = pendingHypotheses.length + pendingProjectHypotheses.length + pendingCommitteeDecisions.length + pendingVerifications.length
  const projectHypothesisCount = pendingProjectHypotheses.length
  const termCount = pendingTerms.length + pendingProjectTerms.length + pendingNegotiationDecisions.length + pendingImplementationStatuses.length
  const materialCount = pendingMaterials.length + pendingProjectMaterials.length
  const frameworkCount = pendingFrameworks.length

  function handleViewDetail(request: PendingRequest) {
    setSelectedRequest(request)
    setDetailOpen(true)
  }

  function handleApprove(request: PendingRequest) {
    if (request.type === "strategy") {
      onApproveStrategy(request.data.id)
    } else if (request.type === "project") {
      onApproveProject(request.data.id)
    } else if (request.type === "phase") {
      onApprovePhase(request.data.id)
    } else if (request.type === "hypothesis") {
      onApproveHypothesis(request.data.id)
    } else if (request.type === "project-hypothesis") {
      onApproveProjectHypothesis(request.data.id)
    } else if (request.type === "committee-decision") {
      onApproveCommitteeDecision(request.data.id)
    } else if (request.type === "term") {
      onApproveTerm(request.data.id)
    } else if (request.type === "project-term") {
      onApproveProjectTerm(request.data.id)
    } else if (request.type === "negotiation-decision") {
      onApproveNegotiationDecision(request.data.id)
    } else if (request.type === "project-material") {
      onApproveProjectMaterial(request.data.id)
    } else if (request.type === "verification") {
      onApproveVerification(request.data.id)
    } else if (request.type === "implementation-status") {
      onApproveImplementationStatus(request.data.id)
    } else if (request.type === "framework") {
      onApproveFramework(request.data.id)
    } else {
      onApproveMaterial(request.data.id)
    }
  }

  function handleReject(request: PendingRequest) {
    if (request.type === "strategy") {
      onRejectStrategy(request.data.id)
    } else if (request.type === "project") {
      onRejectProject(request.data.id)
    } else if (request.type === "phase") {
      onRejectPhase(request.data.id)
    } else if (request.type === "hypothesis") {
      onRejectHypothesis(request.data.id)
    } else if (request.type === "project-hypothesis") {
      onRejectProjectHypothesis(request.data.id)
    } else if (request.type === "committee-decision") {
      onRejectCommitteeDecision(request.data.id)
    } else if (request.type === "term") {
      onRejectTerm(request.data.id)
    } else if (request.type === "project-term") {
      onRejectProjectTerm(request.data.id)
    } else if (request.type === "negotiation-decision") {
      onRejectNegotiationDecision(request.data.id)
    } else if (request.type === "project-material") {
      onRejectProjectMaterial(request.data.id)
    } else if (request.type === "verification") {
      onRejectVerification(request.data.id)
    } else if (request.type === "implementation-status") {
      onRejectImplementationStatus(request.data.id)
    } else if (request.type === "framework") {
      onRejectFramework(request.data.id)
    } else {
      onRejectMaterial(request.data.id)
    }
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED] text-white">
              <GitPullRequest className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">变更请求</h1>
              <p className="text-sm text-[#6B7280]">
                共 {totalCount} 条待审核请求
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="搜索变更请求..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "all"
                ? "bg-[#111827] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            全部
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "all" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {totalCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("strategy")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "strategy"
                ? "bg-[#2563EB] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <Briefcase className="h-4 w-4" />
            策略
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "strategy" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {strategyCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("project")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "project"
                ? "bg-[#059669] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <FolderKanban className="h-4 w-4" />
            项目
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "project" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {projectCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("framework")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "framework"
                ? "bg-[#4F46E5] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            框架
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "framework" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {frameworkCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("phase")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "phase"
                ? "bg-[#7C3AED] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <GitBranch className="h-4 w-4" />
            工作流
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "phase" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {phaseCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("hypothesis")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "hypothesis"
                ? "bg-[#F59E0B] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <Lightbulb className="h-4 w-4" />
            假设
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "hypothesis" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {hypothesisCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("term")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "term"
                ? "bg-[#7C3AED] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <FileText className="h-4 w-4" />
            条款
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "term" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {termCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType("material")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filterType === "material"
                ? "bg-[#059669] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            )}
          >
            <FolderOpen className="h-4 w-4" />
            材料
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              filterType === "material" ? "bg-white/20" : "bg-[#F3F4F6]"
            )}>
              {materialCount}
            </span>
          </button>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E5E7EB]">
              <GitPullRequest className="h-8 w-8 text-[#9CA3AF]" />
            </div>
            <h3 className="text-lg font-semibold text-[#111827]">暂无待审核请求</h3>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[60px_140px_1fr_120px_120px_180px_160px] gap-4 border-b border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3">
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">类型</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">变更ID</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">变更名</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">发起人</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">发起时间</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">审核人</div>
              <div className="text-xs font-medium text-[#6B7280] uppercase tracking-wider text-right">操作</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#E5E7EB]">
              {filteredRequests.map((request) => (
                <div
                  key={request.data.id}
                  className="grid grid-cols-[60px_140px_1fr_120px_120px_180px_160px] gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors items-center"
                >
                  {/* Type Badge */}
                  <div>
                    <Badge className={cn(
                      "text-[10px]",
                      request.type === "strategy"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : request.type === "project"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : request.type === "framework"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : request.type === "hypothesis" || request.type === "project-hypothesis" || request.type === "committee-decision" || request.type === "verification"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : request.type === "term" || request.type === "project-term" || request.type === "negotiation-decision" || request.type === "implementation-status"
                                ? "bg-violet-50 text-violet-700 border-violet-200"
                                : request.type === "material"
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : request.type === "project-material"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                    )}>
                      {request.type === "strategy" ? "策略"
                        : request.type === "project" ? "项目"
                          : request.type === "framework" ? "框架"
                            : request.type === "hypothesis" ? "假设"
                              : request.type === "project-hypothesis" ? "项目假设"
                                : request.type === "committee-decision" ? "审议结果"
                                  : request.type === "verification" ? "验证情况"
                                    : request.type === "term" ? "条款"
                                      : request.type === "project-term" ? "项目条款"
                                        : request.type === "negotiation-decision" ? "谈判结果"
                                          : request.type === "implementation-status" ? "落实情况"
                                            : request.type === "material" ? "材料"
                                              : request.type === "project-material" ? "项目材料"
                                                : "工作流"}
                    </Badge>
                  </div>

                  {/* Change ID */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-mono text-[#374151]">{request.data.changeId}</span>
                  </div>

                  {/* Change Name */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111827] truncate">{request.data.changeName}</p>
                    <p className="text-xs text-[#6B7280] truncate">
                      {request.type === "strategy"
                        ? `框架: ${(request.data as PendingStrategy).strategy.frameworkName || "通用"}`
                        : request.type === "framework"
                          ? `维度数量: ${(request.data as PendingFramework).framework.dimensionCount}`
                          : request.type === "project"
                          ? `策略模板: ${(request.data as PendingProject).project.strategyName || "无"}`
                          : request.type === "hypothesis"
                            ? `假设方向: ${(request.data as PendingHypothesis).hypothesis.direction}`
                            : request.type === "project-hypothesis"
                              ? `项目: ${(request.data as PendingProjectHypothesis).projectName} / 方向: ${(request.data as PendingProjectHypothesis).hypothesis.direction}`
                              : request.type === "committee-decision"
                                ? `项目: ${(request.data as PendingCommitteeDecision).projectName} / 假设: ${(request.data as PendingCommitteeDecision).hypothesisName}`
                                : request.type === "verification"
                                  ? `项目: ${(request.data as PendingVerification).projectName} / 假设: ${(request.data as PendingVerification).hypothesisName}`
                                  : request.type === "implementation-status"
                                    ? `项目: ${(request.data as PendingImplementationStatus).projectName} / 条款: ${(request.data as PendingImplementationStatus).termName}`
                                    : request.type === "term"
                                  ? `条款方向: ${(request.data as PendingTerm).term.direction}`
                                  : request.type === "project-term"
                                    ? `项目: ${(request.data as PendingProjectTerm).projectName} / 方向: ${(request.data as PendingProjectTerm).term.direction}`
                                    : request.type === "negotiation-decision"
                                      ? `项目: ${(request.data as PendingNegotiationDecision).projectName} / 条款: ${(request.data as PendingNegotiationDecision).termName}`
                                      : request.type === "material"
                                        ? `材料类别: ${(request.data as PendingMaterial).category}`
                                        : request.type === "project-material"
                                          ? `项目: ${(request.data as PendingProjectMaterial).projectName} / 分类: ${(request.data as PendingProjectMaterial).material.category}`
                                          : `项目: ${(request.data as PendingPhase).projectName}`
                      }
                    </p>
                  </div>

                  {/* Initiator */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-[#DBEAFE] text-[9px] text-[#2563EB]">
                        {request.data.initiator.initials.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-[#374151]">{request.data.initiator.name}</span>
                  </div>

                  {/* Initiated At */}
                  <div className="text-sm text-[#6B7280]">{request.data.initiatedAt}</div>

                  {/* Reviewers */}
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {request.data.reviewers.slice(0, 3).map((reviewer) => (
                        <Avatar key={reviewer.id} className="h-7 w-7 border-2 border-white" title={reviewer.name}>
                          <AvatarFallback className="bg-[#E5E7EB] text-[9px] text-[#374151]">
                            {reviewer.initials.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {request.data.reviewers.length > 3 && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-[10px] font-medium text-[#6B7280]">
                          +{request.data.reviewers.length - 3}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleApprove(request)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <Check className="h-3.5 w-3.5" />
                      接受
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap"
                    >
                      <X className="h-3.5 w-3.5" />
                      拒绝
                    </button>
                    <button
                      onClick={() => handleViewDetail(request)}
                      className="flex items-center gap-1 rounded-lg bg-gray-50 px-4 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">变更请求详情</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              {selectedRequest?.data.changeId}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-[#E5E7EB] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">类型</span>
                  <Badge className={cn(
                    "text-xs",
                    selectedRequest.type === "strategy"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : selectedRequest.type === "project"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : selectedRequest.type === "framework"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : selectedRequest.type === "hypothesis" || selectedRequest.type === "project-hypothesis" || selectedRequest.type === "committee-decision" || selectedRequest.type === "verification"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : selectedRequest.type === "term" || selectedRequest.type === "project-term" || selectedRequest.type === "negotiation-decision" || selectedRequest.type === "implementation-status"
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : selectedRequest.type === "material"
                                ? "bg-teal-50 text-teal-700 border-teal-200"
                                : selectedRequest.type === "project-material"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                  )}>
                    {selectedRequest.type === "strategy" ? "策略"
                      : selectedRequest.type === "project" ? "项目"
                        : selectedRequest.type === "framework" ? "框架"
                          : selectedRequest.type === "hypothesis" ? "假设"
                            : selectedRequest.type === "project-hypothesis" ? "项目假设"
                              : selectedRequest.type === "committee-decision" ? "审议结果"
                                : selectedRequest.type === "verification" ? "验证情况"
                                  : selectedRequest.type === "implementation-status" ? "落实情况"
                                    : selectedRequest.type === "term" ? "条款"
                                      : selectedRequest.type === "project-term" ? "项目条款"
                                        : selectedRequest.type === "negotiation-decision" ? "谈判结果"
                                        : selectedRequest.type === "material" ? "材料"
                                          : selectedRequest.type === "project-material" ? "项目材料"
                                            : "工作流"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">变更名称</span>
                  <span className="text-sm font-medium text-[#111827]">{selectedRequest.data.changeName}</span>
                </div>
                {selectedRequest.type === "strategy" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">策略名称</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingStrategy).strategy.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属框架</span>
                      <Badge className={cn("text-xs", "bg-blue-100 text-blue-700")}>
                        {(selectedRequest.data as PendingStrategy).strategy.frameworkName || "通用框架"}
                      </Badge>
                    </div>
                  </>
                ) : selectedRequest.type === "project" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">项目名称</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProject).project.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">策略模板</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProject).project.strategyName || "无"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">估值</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProject).project.valuation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">轮次</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProject).project.round}
                      </span>
                    </div>
                  </>
                ) : selectedRequest.type === "framework" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">框架名称</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingFramework).framework.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">框架描述</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingFramework).framework.description}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">分析维度</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingFramework).framework.dimensions.join("、")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">维度数量</span>
                      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                        {(selectedRequest.data as PendingFramework).framework.dimensionCount}
                      </Badge>
                    </div>
                  </>
                ) : selectedRequest.type === "hypothesis" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">假设名称</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingHypothesis).hypothesis.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">假设方向</span>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        {(selectedRequest.data as PendingHypothesis).hypothesis.direction}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">假设类别</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                        {(selectedRequest.data as PendingHypothesis).hypothesis.category}
                      </Badge>
                    </div>
                  </>
                ) : selectedRequest.type === "committee-decision" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingCommitteeDecision).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">相关假设</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingCommitteeDecision).hypothesisName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">审议结果</span>
                      <Badge className={
                        (selectedRequest.data as PendingCommitteeDecision).decision.conclusion === "假设成立"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : "bg-red-50 text-red-700 border-red-200 text-xs"
                      }>
                        {(selectedRequest.data as PendingCommitteeDecision).decision.conclusion === "假设成立" ? "成立" : "不成立"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B7280] mb-1">审议内容</p>
                      <p className="text-sm bg-[#F9FAFB] rounded-lg p-2.5 text-[#374151]">
                        {(selectedRequest.data as PendingCommitteeDecision).decision.content}
                      </p>
                    </div>
                  </>
                ) : selectedRequest.type === "term" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款名称</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingTerm).term.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款方向</span>
                      <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                        {(selectedRequest.data as PendingTerm).term.direction}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款类别</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                        {(selectedRequest.data as PendingTerm).term.category}
                      </Badge>
                    </div>
                  </>
                ) : selectedRequest.type === "project-term" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProjectTerm).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款名称</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingProjectTerm).term.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款方向</span>
                      <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                        {(selectedRequest.data as PendingProjectTerm).term.direction}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">条款类别</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                        {(selectedRequest.data as PendingProjectTerm).term.category}
                      </Badge>
                    </div>
                  </>
                ) : selectedRequest.type === "negotiation-decision" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingNegotiationDecision).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">相关条款</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingNegotiationDecision).termName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">谈判结果</span>
                      <Badge className={
                        (selectedRequest.data as PendingNegotiationDecision).decision.conclusion === "通过"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : "bg-red-50 text-red-700 border-red-200 text-xs"
                      }>
                        {(selectedRequest.data as PendingNegotiationDecision).decision.conclusion}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B7280] mb-1">谈判内容</p>
                      <p className="text-sm bg-[#F9FAFB] rounded-lg p-2.5 text-[#374151]">
                        {(selectedRequest.data as PendingNegotiationDecision).decision.content}
                      </p>
                    </div>
                  </>
                ) : selectedRequest.type === "verification" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingVerification).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">相关假设</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingVerification).hypothesisName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">验证结果</span>
                      <Badge className={
                        (selectedRequest.data as PendingVerification).data.conclusion === "符合预期"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : "bg-red-50 text-red-700 border-red-200 text-xs"
                      }>
                        {(selectedRequest.data as PendingVerification).data.conclusion}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B7280] mb-1">验证内容</p>
                      <p className="text-sm bg-[#F9FAFB] rounded-lg p-2.5 text-[#374151]">
                        {(selectedRequest.data as PendingVerification).data.content}
                      </p>
                    </div>
                    {(selectedRequest.data as PendingVerification).data.responsibles.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#6B7280]">负责人</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {(selectedRequest.data as PendingVerification).data.responsibles.map((r, i) => (
                            <Badge key={i} className="bg-purple-50 text-purple-700 border-purple-200 text-xs">{r.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : selectedRequest.type === "implementation-status" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingImplementationStatus).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">相关条款</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingImplementationStatus).termName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">落实结果</span>
                      <Badge className={
                        (selectedRequest.data as PendingImplementationStatus).data.conclusion === "符合预期"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : (selectedRequest.data as PendingImplementationStatus).data.conclusion === "待定"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-xs"
                            : "bg-red-50 text-red-700 border-red-200 text-xs"
                      }>
                        {(selectedRequest.data as PendingImplementationStatus).data.conclusion}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B7280] mb-1">落实内容</p>
                      <p className="text-sm bg-[#F9FAFB] rounded-lg p-2.5 text-[#374151]">
                        {(selectedRequest.data as PendingImplementationStatus).data.content}
                      </p>
                    </div>
                    {(selectedRequest.data as PendingImplementationStatus).data.responsibles.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#6B7280]">负责人</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {(selectedRequest.data as PendingImplementationStatus).data.responsibles.map((r, i) => (
                            <Badge key={i} className="bg-purple-50 text-purple-700 border-purple-200 text-xs">{r.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : selectedRequest.type === "material" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">材料名称</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingMaterial).name}
                      </span>
                    </div>
                    {(selectedRequest.data as PendingMaterial).category && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#6B7280]">材料类别</span>
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                          {(selectedRequest.data as PendingMaterial).category}
                        </Badge>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-[#6B7280] mb-2">上传文件</p>
                      <div className="space-y-1.5">
                        {(selectedRequest.data as PendingMaterial).files.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5">
                            <FileText className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
                            <span className="flex-1 truncate text-xs text-[#374151]">{f.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{f.format}</Badge>
                            <span className="text-[10px] text-[#9CA3AF] shrink-0">{f.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : selectedRequest.type === "project-material" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">所属项目</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {(selectedRequest.data as PendingProjectMaterial).projectName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">材料名称</span>
                      <span className="text-sm font-medium text-[#111827] text-right max-w-[240px] leading-snug">
                        {(selectedRequest.data as PendingProjectMaterial).material.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">材料格式</span>
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                        {(selectedRequest.data as PendingProjectMaterial).material.format}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">材料分类</span>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        {(selectedRequest.data as PendingProjectMaterial).material.category}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">所属项目</span>
                    <span className="text-sm font-medium text-[#111827]">
                      {(selectedRequest.data as PendingPhase).projectName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">发起人</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-[#DBEAFE] text-[8px] text-[#2563EB]">
                        {selectedRequest.data.initiator.initials.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-[#111827]">{selectedRequest.data.initiator.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">发起时间</span>
                  <span className="text-sm font-medium text-[#111827]">{selectedRequest.data.initiatedAt}</span>
                </div>
              </div>

              {(selectedRequest.type === "strategy" || selectedRequest.type === "project" || selectedRequest.type === "hypothesis" || selectedRequest.type === "term" || selectedRequest.type === "material" || selectedRequest.type === "framework") && (
                <div>
                  <p className="text-sm font-medium text-[#374151] mb-2">简介</p>
                  <p className="text-sm text-[#6B7280] bg-[#F9FAFB] rounded-lg p-3">
                    {selectedRequest.type === "strategy"
                      ? (selectedRequest.data as PendingStrategy).strategy.description
                      : selectedRequest.type === "project"
                        ? (selectedRequest.data as PendingProject).project.description
                        : selectedRequest.type === "framework"
                          ? (selectedRequest.data as PendingFramework).framework.description
                          : selectedRequest.type === "hypothesis"
                            ? (selectedRequest.data as PendingHypothesis).hypothesis.content
                            : selectedRequest.type === "term"
                              ? (selectedRequest.data as PendingTerm).term.content
                              : (selectedRequest.data as PendingMaterial).description
                    }
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-[#374151] mb-2">审核人</p>
                <div className="flex items-center gap-2">
                  {selectedRequest.data.reviewers.map((reviewer) => (
                    <div key={reviewer.id} className="flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2.5 py-1">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                          {reviewer.initials.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-[#374151]">{reviewer.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                if (selectedRequest) handleReject(selectedRequest)
                setDetailOpen(false)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <X className="h-4 w-4" />
              拒绝
            </button>
            <button
              onClick={() => {
                if (selectedRequest) handleApprove(selectedRequest)
                setDetailOpen(false)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              接受
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
