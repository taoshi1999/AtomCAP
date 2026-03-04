"use client"

import { useState } from "react"
import { GitPullRequest, Search, Check, X, Eye, Clock, Briefcase, FolderKanban } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { PendingStrategy } from "./strategies-grid"
import type { PendingProject } from "./projects-grid"

type PendingRequest = 
  | { type: "strategy"; data: PendingStrategy }
  | { type: "project"; data: PendingProject }

interface ChangeRequestsProps {
  pendingStrategies: PendingStrategy[]
  pendingProjects: PendingProject[]
  onApproveStrategy: (id: string) => void
  onRejectStrategy: (id: string) => void
  onApproveProject: (id: string) => void
  onRejectProject: (id: string) => void
}

export function ChangeRequests({ 
  pendingStrategies, 
  pendingProjects,
  onApproveStrategy, 
  onRejectStrategy,
  onApproveProject,
  onRejectProject,
}: ChangeRequestsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
  const [filterType, setFilterType] = useState<"all" | "strategy" | "project">("all")

  // Combine all requests
  const allRequests: PendingRequest[] = [
    ...pendingStrategies.map((s) => ({ type: "strategy" as const, data: s })),
    ...pendingProjects.map((p) => ({ type: "project" as const, data: p })),
  ].sort((a, b) => new Date(b.data.initiatedAt).getTime() - new Date(a.data.initiatedAt).getTime())

  const filteredRequests = allRequests.filter((r) => {
    const matchesSearch = 
      r.data.changeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.data.changeId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === "all" || r.type === filterType
    return matchesSearch && matchesType
  })

  const totalCount = allRequests.length
  const strategyCount = pendingStrategies.length
  const projectCount = pendingProjects.length

  function handleViewDetail(request: PendingRequest) {
    setSelectedRequest(request)
    setDetailOpen(true)
  }

  function handleApprove(request: PendingRequest) {
    if (request.type === "strategy") {
      onApproveStrategy(request.data.id)
    } else {
      onApproveProject(request.data.id)
    }
  }

  function handleReject(request: PendingRequest) {
    if (request.type === "strategy") {
      onRejectStrategy(request.data.id)
    } else {
      onRejectProject(request.data.id)
    }
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-8">
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
        <div className="flex items-center gap-2 mb-6">
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
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E5E7EB]">
              <GitPullRequest className="h-8 w-8 text-[#9CA3AF]" />
            </div>
            <h3 className="text-lg font-semibold text-[#111827]">暂无待审核请求</h3>
            <p className="mt-1 text-sm text-[#6B7280]">所有变更请求已处理完毕</p>
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
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                      {request.type === "strategy" ? "策略" : "项目"}
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
                        ? `策略类型: ${(request.data as PendingStrategy).strategy.type}`
                        : `策略模板: ${(request.data as PendingProject).project.strategyName || "无"}`
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
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      接受
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      拒绝
                    </button>
                    <button
                      onClick={() => handleViewDetail(request)}
                      className="flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
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
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    {selectedRequest.type === "strategy" ? "策略" : "项目"}
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
                      <span className="text-sm text-[#6B7280]">策略类型</span>
                      <Badge className={cn("text-xs", (selectedRequest.data as PendingStrategy).strategy.typeColor)}>
                        {(selectedRequest.data as PendingStrategy).strategy.type}
                      </Badge>
                    </div>
                  </>
                ) : (
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
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">负责人</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-[#E5E7EB] text-[8px] text-[#374151]">
                        {selectedRequest.type === "strategy" 
                          ? (selectedRequest.data as PendingStrategy).strategy.owner.initials.slice(0, 1)
                          : (selectedRequest.data as PendingProject).project.owner.initials.slice(0, 1)
                        }
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-[#111827]">
                      {selectedRequest.type === "strategy" 
                        ? (selectedRequest.data as PendingStrategy).strategy.owner.name
                        : (selectedRequest.data as PendingProject).project.owner.name
                      }
                    </span>
                  </div>
                </div>
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

              <div>
                <p className="text-sm font-medium text-[#374151] mb-2">简介</p>
                <p className="text-sm text-[#6B7280] bg-[#F9FAFB] rounded-lg p-3">
                  {selectedRequest.type === "strategy" 
                    ? (selectedRequest.data as PendingStrategy).strategy.description
                    : (selectedRequest.data as PendingProject).project.description
                  }
                </p>
              </div>

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
