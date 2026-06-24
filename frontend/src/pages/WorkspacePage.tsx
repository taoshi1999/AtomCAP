/**
 * 项目工作台 / 项目库。
 * 设计依据《项目获取Agent》流程一 Step 10 / 流程二 Step 9：
 *   项目获取 Agent 把项目带进系统后，左侧项目库（候选池）让人浏览/筛选，
 *   右侧项目工作台详情页承载初步分析画像、管线推进与用户反馈。
 *
 * 接 backend/app/api/deals.py：
 *   GET /api/deals（列表）、GET /api/deals/{id}（详情）、
 *   POST /transition（管线流转）、POST /actions/{action}（用户反馈）。
 * token 注入待登录页，开发期依赖后端 AUTH_DEV_FALLBACK。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, FileText, Heart, Plus, Search, ThumbsDown, Trash2, Upload } from "lucide-react";
import {
  ApiError,
  collectDealMarketSignals,
  createDeal,
  deleteDeal,
  generatePreDDBrief,
  getDealDetail,
  listPreDDBriefs,
  listDeals,
  transitionDeal,
  triggerDealAction,
  searchDealMaterials,
  updatePreDDMaterialStatus,
  uploadDealMaterial,
  type PreDDBriefHistoryItem,
} from "../lib/api";
import MarketSignalsPanel, { type MarketSignalViewItem } from "../components/MarketSignalsPanel";
import PageAssistant from "../components/PageAssistant";
import type {
  Claim,
  DDReport,
  DealAction,
  DealDetail,
  DealMarketSignal,
  DealMarketSignalCategory,
  DealMaterial,
  DealMaterialSearchResult,
  DealStatus,
  DealSummary,
  FitScoreBreakdown,
  PreDDChecklistItem,
  PreDDMaterialCollectionStatus,
  PreDDWorkspace,
} from "../lib/types";

// 管线状态展示元信息（与 backend DealStatus 对齐）
const STATUS_META: Record<DealStatus, { label: string; badge: string }> = {
  sourced: { label: "候选", badge: "bg-slate-100 text-slate-600" },
  screening: { label: "初筛中", badge: "bg-amber-100 text-amber-700" },
  pre_dd: { label: "尽调中", badge: "bg-blue-100 text-blue-700" },
  ic_ready: { label: "可上会", badge: "bg-indigo-100 text-indigo-700" },
  approved: { label: "进行中", badge: "bg-green-100 text-green-700" },
  rejected: { label: "已否决", badge: "bg-rose-100 text-rose-700" },
  exited: { label: "已退出", badge: "bg-slate-200 text-slate-700" },
  deleted: { label: "已删除", badge: "bg-slate-100 text-slate-400" },
};

// 允许的前向流转（镜像 backend PIPELINE_TRANSITIONS，仅用于决定可点按钮；最终守卫在后端）
const PIPELINE_NEXT: Record<DealStatus, DealStatus[]> = {
  sourced: ["screening", "rejected"],
  screening: ["pre_dd", "rejected"],
  pre_dd: ["approved", "rejected"],
  ic_ready: ["approved", "rejected", "pre_dd"],
  approved: ["exited"],
  rejected: [],
  exited: [],
  deleted: [],
};

const TRANSITION_ACTION_LABELS: Partial<Record<`${DealStatus}->${DealStatus}`, string>> = {
  "sourced->screening": "初筛",
  "sourced->rejected": "否决",
  "screening->pre_dd": "立项",
  "screening->rejected": "否决",
  "pre_dd->approved": "划款",
  "pre_dd->rejected": "否决",
  "ic_ready->approved": "划款",
  "ic_ready->rejected": "否决",
  "ic_ready->pre_dd": "回尽调",
  "approved->exited": "退出",
};

const FILTERS: { key: string; label: string; status?: DealStatus; inLibrary?: boolean }[] = [
  { key: "all", label: "全部" },
  { key: "library", label: "项目库", inLibrary: true },
  { key: "screening", label: "初筛中", status: "screening" },
  { key: "pre_dd", label: "尽调中", status: "pre_dd" },
  { key: "approved", label: "进行中", status: "approved" },
  { key: "exited", label: "已退出", status: "exited" },
];

const MATERIAL_STATUS_LABELS: Record<string, string> = {
  completed: "已解析",
  pending: "解析中",
  failed: "解析失败",
};

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  bp: "BP",
  internal_excel: "项目表",
};

const PRE_DD_TASK_LABELS: Record<string, string> = {
  bp_product: "BP/产品",
  equity: "股权",
  organization: "组织",
  business_model: "业务",
  sales_model: "营销",
  profit_model: "盈利",
  financials: "财务",
  suppliers: "供应商",
  customers: "客户",
  competitors: "竞争",
  market: "市场",
  team: "团队",
  financing: "融资",
  development: "发展",
};

const PRE_DD_COLLECTION_META: Record<PreDDMaterialCollectionStatus, { label: string; className: string }> = {
  collected: { label: "已收集", className: "bg-emerald-50 text-emerald-700" },
  pending: { label: "待收集", className: "bg-amber-50 text-amber-700" },
};

function StatusBadge({ status }: { status: DealStatus }) {
  const meta = STATUS_META[status] ?? { label: status, badge: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function transitionActionLabel(from: DealStatus, to: DealStatus) {
  return TRANSITION_ACTION_LABELS[`${from}->${to}`] ?? "推进";
}

function deriveStatusPath(current: DealStatus, history: DealStatus[] = []): DealStatus[] {
  const known = new Set<DealStatus>([
    "sourced",
    "screening",
    "pre_dd",
    "ic_ready",
    "approved",
    "rejected",
    "exited",
    "deleted",
  ]);
  const path = history.filter((status) => known.has(status));
  if (path.length > 0) {
    if (path[path.length - 1] !== current) path.push(current);
    return path;
  }

  switch (current) {
    case "sourced":
      return ["sourced"];
    case "pre_dd":
      return ["screening", "pre_dd"];
    case "ic_ready":
      return ["screening", "pre_dd", "ic_ready"];
    case "approved":
      return ["screening", "pre_dd", "approved"];
    case "rejected":
      return ["screening", "rejected"];
    case "exited":
      return ["screening", "pre_dd", "approved", "exited"];
    case "deleted":
      return history.length > 0 ? history : ["deleted"];
    case "screening":
    default:
      return ["screening"];
  }
}

function StatusFlowNode({ status, active }: { status: DealStatus; active: boolean }) {
  const meta = STATUS_META[status] ?? { label: status, badge: "bg-slate-100 text-slate-600" };
  return (
    <div
      className={`flex h-10 min-w-20 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${
        active
          ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {meta.label}
    </div>
  );
}

function CompletedFlowEdge({ from, to }: { from: DealStatus; to: DealStatus }) {
  return (
    <div className="flex items-center gap-2 text-slate-300">
      <div className="h-px w-6 bg-slate-300" />
      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
        {transitionActionLabel(from, to)}
      </span>
      <ArrowRight className="h-4 w-4" />
    </div>
  );
}

function PendingFlowEdge({
  from,
  to,
  busy,
  onTransition,
}: {
  from: DealStatus;
  to: DealStatus;
  busy: boolean;
  onTransition: (to: DealStatus) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px w-6 bg-slate-300" />
      <button
        type="button"
        disabled={busy}
        onClick={() => onTransition(to)}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {transitionActionLabel(from, to)}
      </button>
      <ArrowRight className="h-4 w-4 text-slate-300" />
      <StatusFlowNode status={to} active={false} />
    </div>
  );
}

function ProjectStatusFlow({
  detail,
  busy,
  onTransition,
}: {
  detail: DealDetail;
  busy: boolean;
  onTransition: (to: DealStatus) => void;
}) {
  const path = deriveStatusPath(detail.status, detail.data.status_history);
  const nextStatuses = PIPELINE_NEXT[detail.status] ?? [];
  const lastPathStatus = path[path.length - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">项目状态</h3>
        <StatusBadge status={detail.status} />
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-max items-center gap-2">
          {path.map((status, index) => (
            <div key={`${status}-${index}`} className="flex items-center gap-2">
              {index > 0 && <CompletedFlowEdge from={path[index - 1]} to={status} />}
              <StatusFlowNode status={status} active={status === detail.status && index === path.length - 1} />
            </div>
          ))}
          {nextStatuses.length > 0 && lastPathStatus === detail.status && (
            <div className={nextStatuses.length > 1 ? "grid gap-2" : "flex items-center"}>
              {nextStatuses.map((to) => (
                <PendingFlowEdge
                  key={to}
                  from={detail.status}
                  to={to}
                  busy={busy}
                  onTransition={onTransition}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 约定 2：inferred 结论必须可视化标识
function ClaimLine({ claim }: { claim: Claim }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-700">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      <span>
        {claim.text}
        {claim.inferred ? (
          <span className="ml-1 rounded bg-yellow-100 px-1 text-[10px] text-yellow-700">推断</span>
        ) : claim.evidence_ids.length > 0 ? (
          <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] text-emerald-600">
            {claim.evidence_ids.length} 证据
          </span>
        ) : null}
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function DialogShell({
  title,
  error,
  onClose,
  children,
}: {
  title: string;
  error: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {rows ? (
        <textarea
          value={value}
          required={required}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
      ) : (
        <input
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300"
        />
      )}
    </label>
  );
}

function CreateDealDialog({
  draft,
  error,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: {
    company_name: string;
    one_line_intro: string;
    track: string;
    sub_direction: string;
    funding_stage: string;
    source_note: string;
  };
  error: string | null;
  busy: boolean;
  onChange: (next: typeof draft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogShell title="新建项目" error={error} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="公司/项目名称"
          value={draft.company_name}
          required
          placeholder="例如：光羽科技"
          onChange={(value) => onChange({ ...draft, company_name: value })}
        />
        <Field
          label="一句话介绍"
          value={draft.one_line_intro}
          placeholder="这个项目是做什么的"
          onChange={(value) => onChange({ ...draft, one_line_intro: value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="所属赛道"
            value={draft.track}
            placeholder="AI 硬件"
            onChange={(value) => onChange({ ...draft, track: value })}
          />
          <Field
            label="子方向"
            value={draft.sub_direction}
            placeholder="光学模组"
            onChange={(value) => onChange({ ...draft, sub_direction: value })}
          />
        </div>
        <Field
          label="融资阶段"
          value={draft.funding_stage}
          placeholder="Pre-A / A / B+"
          onChange={(value) => onChange({ ...draft, funding_stage: value })}
        />
        <Field
          label="补充材料"
          value={draft.source_note}
          rows={3}
          placeholder="来源、联系人、初步判断或待验证信息"
          onChange={(value) => onChange({ ...draft, source_note: value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            取消
          </button>
          <button
            type="submit"
            disabled={busy || !draft.company_name.trim()}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            创建
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function FitScore({ fit }: { fit: FitScoreBreakdown }) {
  const rows: [string, number][] = [
    ["赛道偏好", fit.track_preference],
    ["阶段匹配", fit.stage_match],
    ["壁垒匹配", fit.moat_match],
    ["地域匹配", fit.geo_match],
    ["风险偏好", fit.risk_appetite_match],
    ["历史相似", fit.history_similarity],
    ["排除扣分", fit.exclusion_penalty],
  ];
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{Math.round(fit.total)}</span>
        <span className="text-xs text-slate-400">/ 100 匹配度</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
      {fit.rationale && <p className="mt-2 text-xs text-slate-500">{fit.rationale}</p>}
    </div>
  );
}

function PreDDTaskCard({
  item,
  busy,
  uploadBusy,
  uploadDisabled,
  onStatusChange,
  onUpload,
}: {
  item: PreDDChecklistItem;
  busy: boolean;
  uploadBusy: boolean;
  uploadDisabled: boolean;
  onStatusChange: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  onUpload: (taskKey: string, file: File) => void;
}) {
  const statusMeta = PRE_DD_COLLECTION_META[item.collection_status] ?? PRE_DD_COLLECTION_META.pending;
  const collectedMaterials = item.collected_materials ?? [];
  const suggestions = item.suggestions?.length ? item.suggestions : ["继续补充相关资料。"];
  const collectionOptions: PreDDMaterialCollectionStatus[] = ["collected", "pending"];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <label
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition ${
              uploadDisabled
                ? "cursor-not-allowed border-slate-200 text-slate-300"
                : "cursor-pointer border-blue-200 text-blue-700 hover:bg-blue-50"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadBusy ? "上传中..." : "上传资料"}
            <input
              type="file"
              disabled={uploadDisabled}
              accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md,.markdown"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(item.key, file);
              }}
              className="sr-only"
            />
          </label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {collectionOptions.map((status) => {
              const active = item.collection_status === status;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={busy || active}
                  onClick={() => onStatusChange(item.key, status)}
                  className={`h-7 rounded-md px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  {PRE_DD_COLLECTION_META[status].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">简介</div>
          <p className="text-xs leading-5 text-slate-600">{item.intro}</p>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">已收集材料</div>
          {collectedMaterials.length === 0 ? (
            <p className="text-xs text-slate-400">暂无已收集材料。</p>
          ) : (
            <div className="space-y-1.5">
              {collectedMaterials.slice(0, 6).map((material, index) => (
                <div
                  key={`${material.kind}-${material.document_id ?? material.title}-${index}`}
                  className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {material.kind}
                    </span>
                    <span className="min-w-0 font-medium text-slate-700">{material.title}</span>
                    {material.evidence_id && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        证据
                      </span>
                    )}
                  </div>
                  {material.detail && <p className="mt-0.5 text-slate-500">{material.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">待收集建议</div>
          {suggestions.length === 1 && suggestions[0] === "材料收集完成" ? (
            <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
              材料收集完成
            </p>
          ) : (
            <ul className="ml-4 list-disc text-xs leading-5 text-slate-600">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefClaimList({ claims }: { claims: Claim[] }) {
  if (claims.length === 0) return <p className="text-sm text-slate-400">暂无。</p>;
  return (
    <ul className="space-y-1">
      {claims.map((claim, index) => (
        <ClaimLine key={index} claim={claim} />
      ))}
    </ul>
  );
}

function formatBriefTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function materialStatusLabel(status: string) {
  return MATERIAL_STATUS_LABELS[status] ?? status;
}

function materialTypeLabel(type?: string | null) {
  if (!type) return "材料";
  return MATERIAL_TYPE_LABELS[type] ?? type;
}

const MATERIAL_CATEGORY_CONFIDENCE_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

function materialCategorySuggestionClassName(isBackground: boolean) {
  return isBackground
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : "border-amber-100 bg-amber-50 text-amber-800";
}

function DealMaterialsPanel({
  materials,
  showCategorySuggestion,
  busy,
  error,
  onUpload,
  searchQuery,
  searchBusy,
  searchError,
  searchResults,
  onSearchQueryChange,
  onSearch,
}: {
  materials: DealMaterial[];
  showCategorySuggestion: boolean;
  busy: boolean;
  error: string | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  searchBusy: boolean;
  searchError: string | null;
  searchResults: DealMaterialSearchResult[];
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Section title="项目材料">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label
          className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white ${
            busy ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <Upload className="h-4 w-4" />
          {busy ? "上传中..." : "上传材料"}
          <input
            type="file"
            disabled={busy}
            accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md,.markdown"
            onChange={onUpload}
            className="sr-only"
          />
        </label>
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      <form onSubmit={onSearch} className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="搜索项目材料内容"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searchBusy || !searchQuery.trim()}
          className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {searchBusy ? "搜索中..." : "搜索"}
        </button>
      </form>

      {(searchError || searchResults.length > 0) && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {searchError ? (
            <div className="text-xs text-rose-500">{searchError}</div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((item) => (
                <div key={`${item.document_id}-${item.chunk_id}`} className="text-xs leading-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700">{item.filename}</span>
                    {item.matched_terms.length > 0 && (
                      <span className="text-slate-400">命中 {item.matched_terms.join("、")}</span>
                    )}
                    {item.evidence_id && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        可引用
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-slate-500">{item.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {materials.length === 0 ? (
        <div className="text-sm text-slate-400">暂无项目材料。</div>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => (
            <div
              key={material.id}
              id={`material-${material.id}`}
              className="rounded-lg border border-slate-200 bg-white p-3 scroll-mt-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {material.filename}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>{materialTypeLabel(material.doc_type)}</span>
                    <span>{materialStatusLabel(material.parse_status)}</span>
                    <span>{material.text_chars} 字</span>
                    <span>{formatBriefTime(material.updated_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {material.evidence_id && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      证据
                    </span>
                  )}
                  {material.fmt && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {material.fmt}
                    </span>
                  )}
                </div>
              </div>
              {material.text_preview && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {material.text_preview}
                </p>
              )}
              {showCategorySuggestion && material.material_category_suggestion && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-5 ${materialCategorySuggestionClassName(
                    material.material_category_suggestion.is_background
                  )}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">建议归类</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold">
                      {material.material_category_suggestion.title}
                    </span>
                    <span className="text-[11px] opacity-75">
                      置信度 {MATERIAL_CATEGORY_CONFIDENCE_LABELS[material.material_category_suggestion.confidence]}
                    </span>
                  </div>
                  <div className="mt-0.5 opacity-80">{material.material_category_suggestion.reason}</div>
                </div>
              )}
              {(material.pre_dd_task_keys ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(material.pre_dd_task_keys ?? []).slice(0, 6).map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                    >
                      {PRE_DD_TASK_LABELS[key] ?? key}
                    </span>
                  ))}
                </div>
              )}
              {material.warnings.length > 0 && (
                <div className="mt-2 text-xs text-amber-600">{material.warnings.join("；")}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function DealMarketSignalsPanel({
  signals,
  selectedCategory,
  busy,
  error,
  onCategoryChange,
  onRefresh,
}: {
  signals: DealMarketSignal[];
  selectedCategory: DealMarketSignalCategory | "all";
  busy: boolean;
  error: string | null;
  onCategoryChange: (category: DealMarketSignalCategory | "all") => void;
  onRefresh: () => void;
}) {
  const viewSignals = useMemo<MarketSignalViewItem[]>(
    () =>
      signals.map((signal) => ({
        id: signal.evidence_id,
        title: signal.title,
        summary: signal.summary,
        analysis: signal.analysis,
        category: signal.category,
        date: signal.published_at,
        connector: signal.connector,
        collectedAt: signal.collected_at,
        href: signal.url,
        hrefLabel: "查看来源",
        external: true,
      })),
    [signals]
  );

  return (
    <MarketSignalsPanel
      signals={viewSignals}
      selectedCategory={selectedCategory}
      busy={busy}
      error={error}
      onCategoryChange={onCategoryChange}
      onRefresh={onRefresh}
      busyText="正在收集项目相关市场信号..."
      countClassName="bg-blue-600 text-white"
      itemClassName="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
    />
  );
}

function PreDDBriefCard({ report, updatedAt }: { report: DDReport; updatedAt?: string }) {
  const brief = report.brief;
  if (!brief) return null;
  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-950">Pre-DD Breif</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {report.company_name}
            {updatedAt ? ` · ${formatBriefTime(updatedAt)}` : ""}
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">项目概览</div>
            <BriefClaimList claims={[brief.project_overview]} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">机构匹配度</div>
            <BriefClaimList claims={[brief.fit_summary]} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">核心亮点</div>
            <BriefClaimList claims={brief.key_highlights} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">Top 风险</div>
            <BriefClaimList claims={brief.top_risks} />
          </div>
        </div>
      </div>
      {brief.priority_questions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-400">待验证问题</div>
          <ul className="ml-4 list-disc text-sm leading-6 text-slate-700">
            {brief.priority_questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold text-slate-400">建议下一步</div>
        <BriefClaimList claims={brief.recommended_next_steps} />
      </div>
    </div>
  );
}

function PreDDPanel({
  workspace,
  materialUploadError,
  materialStatusBusyKey,
  materialUploadBusyKey,
  onMaterialStatusChange,
  onMaterialUpload,
}: {
  workspace: PreDDWorkspace;
  materialUploadError: string | null;
  materialStatusBusyKey: string | null;
  materialUploadBusyKey: string | null;
  onMaterialStatusChange: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  onMaterialUpload: (taskKey: string, file: File) => void;
}) {
  const collectedItems = workspace.items.filter((item) => item.collection_status === "collected");
  const pendingItems = workspace.items.filter((item) => item.collection_status === "pending");
  const renderMaterialGroup = (
    title: string,
    items: PreDDChecklistItem[],
    emptyText: string
  ) => (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-900">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((item) => (
            <PreDDTaskCard
              key={item.key}
              item={item}
              busy={materialStatusBusyKey !== null}
              uploadBusy={materialUploadBusyKey === item.key}
              uploadDisabled={materialUploadBusyKey !== null}
              onStatusChange={onMaterialStatusChange}
              onUpload={onMaterialUpload}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Section title="Pre-DD 资料">
      {materialUploadError && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {materialUploadError}
        </div>
      )}

      <div className="space-y-4">
        {renderMaterialGroup("已收集", collectedItems, "暂无已收集的 Pre-DD 资料项。")}
        {renderMaterialGroup("待收集", pendingItems, "暂无待收集的 Pre-DD 资料项。")}
      </div>
    </Section>
  );
}

function PreDDBriefPanel({
  briefReport,
  briefHistory,
  briefHistoryBusy,
  briefBusy,
  briefError,
  selectedBriefId,
  onSelectedBriefChange,
  onGenerateBrief,
}: {
  briefReport: DDReport | null;
  briefHistory: PreDDBriefHistoryItem[];
  briefHistoryBusy: boolean;
  briefBusy: boolean;
  briefError: string | null;
  selectedBriefId: string | null;
  onSelectedBriefChange: (deliverableId: string) => void;
  onGenerateBrief: () => void;
}) {
  const briefs =
    briefHistory.length > 0
      ? briefHistory
      : briefReport
        ? [{
            deliverable_id: "latest",
            type: "dd_report" as const,
            payload: briefReport,
            created_at: "",
            updated_at: "",
          }]
        : [];
  const selectedBrief =
    briefs.find((item) => item.deliverable_id === selectedBriefId) ?? briefs[0] ?? null;

  return (
    <Section title="Pre-DD Breif">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={briefBusy}
          onClick={onGenerateBrief}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <FileText className="h-4 w-4" />
          {briefBusy ? "生成中..." : "生成 Pre-DD Breif"}
        </button>
        {briefError && <span className="text-xs text-rose-500">{briefError}</span>}
      </div>

      {briefHistoryBusy ? (
        <div className="mt-4 text-sm text-slate-400">加载 Breif 历史中...</div>
      ) : briefs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
          暂无已生成的 Pre-DD Breif。
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Pre-DD Breif 版本">
            {briefs.map((item, index) => {
              const active = item.deliverable_id === selectedBrief?.deliverable_id;
              const versionNumber = briefs.length - index;
              return (
                <button
                  key={item.deliverable_id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectedBriefChange(item.deliverable_id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span>版本 {versionNumber}</span>
                  {item.updated_at && (
                    <span className="ml-2 font-normal text-slate-400">
                      {formatBriefTime(item.updated_at)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedBrief && (
            <PreDDBriefCard
              report={selectedBrief.payload}
              updatedAt={selectedBrief.updated_at}
            />
          )}
        </>
      )}
    </Section>
  );
}

export function DealDetailPanel({
  detail,
  busy,
  onTransition,
  onAction,
  onMaterialUploaded,
  onPreDDMaterialStatusChange,
  preDDMaterialStatusBusyKey,
}: {
  detail: DealDetail;
  busy: boolean;
  onTransition: (to: DealStatus) => void;
  onAction: (action: DealAction) => void;
  onMaterialUploaded?: () => Promise<void> | void;
  onPreDDMaterialStatusChange?: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  preDDMaterialStatusBusyKey?: string | null;
}) {
  const { data, company } = detail;
  const a = data.analysis;
  const fb = data.user_feedback;
  const [materials, setMaterials] = useState<DealMaterial[]>(detail.materials ?? []);
  const [marketSignals, setMarketSignals] = useState<DealMarketSignal[]>(detail.data.market_signals ?? []);
  const [marketSignalCategory, setMarketSignalCategory] = useState<DealMarketSignalCategory | "all">("all");
  const [marketSignalBusy, setMarketSignalBusy] = useState(false);
  const [marketSignalError, setMarketSignalError] = useState<string | null>(null);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [preDDMaterialUploadBusyKey, setPreDDMaterialUploadBusyKey] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [preDDMaterialUploadError, setPreDDMaterialUploadError] = useState<string | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialSearchResults, setMaterialSearchResults] = useState<DealMaterialSearchResult[]>([]);
  const [materialSearchBusy, setMaterialSearchBusy] = useState(false);
  const [materialSearchError, setMaterialSearchError] = useState<string | null>(null);
  const [briefReport, setBriefReport] = useState<DDReport | null>(null);
  const [briefHistory, setBriefHistory] = useState<PreDDBriefHistoryItem[]>([]);
  const [briefHistoryBusy, setBriefHistoryBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const autoMarketSignalDealRef = useRef<string | null>(null);

  const handleCollectMarketSignals = useCallback(async (options: { auto?: boolean } = {}) => {
    setMarketSignalBusy(true);
    if (!options.auto) setMarketSignalError(null);
    try {
      const response = await collectDealMarketSignals(detail.id);
      setMarketSignals(response.items);
      setMarketSignalError(null);
    } catch (error) {
      if (!options.auto) {
        setMarketSignalError(error instanceof ApiError ? error.message : "收集市场信号失败");
      }
    } finally {
      setMarketSignalBusy(false);
    }
  }, [detail.id]);

  useEffect(() => {
    setMaterials(detail.materials ?? []);
    setMarketSignals(detail.data.market_signals ?? []);
    setMarketSignalCategory("all");
    setMarketSignalError(null);
    setMarketSignalBusy(false);
    setMaterialError(null);
    setPreDDMaterialUploadError(null);
    setMaterialBusy(false);
    setPreDDMaterialUploadBusyKey(null);
    setMaterialSearchQuery("");
    setMaterialSearchResults([]);
    setMaterialSearchError(null);
    setMaterialSearchBusy(false);
  }, [detail.id, detail.materials, detail.data.market_signals]);

  useEffect(() => {
    const hasExistingSignals = (detail.data.market_signals ?? []).length > 0;
    if (hasExistingSignals) {
      autoMarketSignalDealRef.current = detail.id;
      return;
    }
    if (autoMarketSignalDealRef.current === detail.id) return;
    autoMarketSignalDealRef.current = detail.id;
    void handleCollectMarketSignals({ auto: true });
  }, [detail.id, detail.data.market_signals, handleCollectMarketSignals]);

  useEffect(() => {
    setBriefReport(null);
    setBriefHistory([]);
    setBriefError(null);
    setBriefBusy(false);
    setSelectedBriefId(null);
  }, [detail.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadBriefHistory() {
      setBriefHistoryBusy(true);
      try {
        const response = await listPreDDBriefs(detail.id);
        if (!cancelled) {
          setBriefHistory(response.items);
          setSelectedBriefId((current) =>
            current && response.items.some((item) => item.deliverable_id === current)
              ? current
              : response.items[0]?.deliverable_id ?? null
          );
        }
      } catch {
        if (!cancelled) {
          setBriefHistory([]);
          setSelectedBriefId(null);
        }
      } finally {
        if (!cancelled) setBriefHistoryBusy(false);
      }
    }
    void loadBriefHistory();
    return () => {
      cancelled = true;
    };
  }, [detail.id]);

  async function handleGenerateBrief() {
    setBriefBusy(true);
    setBriefError(null);
    try {
      const response = await generatePreDDBrief(detail.id);
      setBriefReport(response.payload);
      try {
        const history = await listPreDDBriefs(detail.id);
        setBriefHistory(history.items);
        setSelectedBriefId(
          history.items.some((item) => item.deliverable_id === response.deliverable_id)
            ? response.deliverable_id
            : history.items[0]?.deliverable_id ?? response.deliverable_id
        );
      } catch {
        setSelectedBriefId(response.deliverable_id);
        setBriefHistory((items) => [
          {
            deliverable_id: response.deliverable_id,
            type: "dd_report",
            payload: response.payload,
            created_at: "",
            updated_at: "",
          },
          ...items,
        ]);
      }
    } catch (error) {
      setBriefError(error instanceof ApiError ? error.message : "生成 Pre-DD Breif 失败");
    } finally {
      setBriefBusy(false);
    }
  }

  async function handleUploadMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMaterialBusy(true);
    setMaterialError(null);
    try {
      const material = await uploadDealMaterial(detail.id, file);
      setMaterials((items) => [material, ...items.filter((item) => item.id !== material.id)]);
      await onMaterialUploaded?.();
    } catch (error) {
      setMaterialError(error instanceof ApiError ? error.message : "上传材料失败");
    } finally {
      setMaterialBusy(false);
    }
  }

  async function handleUploadPreDDMaterial(taskKey: string, file: File) {
    setPreDDMaterialUploadBusyKey(taskKey);
    setPreDDMaterialUploadError(null);
    try {
      const material = await uploadDealMaterial(detail.id, file, taskKey);
      setMaterials((items) => [material, ...items.filter((item) => item.id !== material.id)]);
      await onMaterialUploaded?.();
    } catch (error) {
      setPreDDMaterialUploadError(error instanceof ApiError ? error.message : "上传资料失败");
    } finally {
      setPreDDMaterialUploadBusyKey(null);
    }
  }

  async function handleSearchMaterials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = materialSearchQuery.trim();
    if (!query) return;
    setMaterialSearchBusy(true);
    setMaterialSearchError(null);
    try {
      const response = await searchDealMaterials(detail.id, query);
      setMaterialSearchResults(response.items);
      if (response.items.length === 0) setMaterialSearchError("未找到匹配材料片段");
    } catch (error) {
      setMaterialSearchResults([]);
      setMaterialSearchError(error instanceof ApiError ? error.message : "搜索材料失败");
    } finally {
      setMaterialSearchBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-xl font-bold text-slate-900">
            {company?.name ?? data.extraction.company_name}
          </h2>
          <button
            type="button"
            title={fb.is_liked ? "已关注" : "关注"}
            aria-label={fb.is_liked ? "已关注" : "关注"}
            disabled={busy}
            onClick={() => onAction("follow")}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              fb.is_liked
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            }`}
          >
            <Heart className={`h-4 w-4 ${fb.is_liked ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            title={fb.is_disliked ? "已标记不感兴趣" : "不感兴趣"}
            aria-label={fb.is_disliked ? "已标记不感兴趣" : "不感兴趣"}
            disabled={busy}
            onClick={() => onAction("dismiss")}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              fb.is_disliked
                ? "border-slate-300 bg-slate-100 text-slate-700"
                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <ThumbsDown className={`h-4 w-4 ${fb.is_disliked ? "fill-current" : ""}`} />
          </button>
        </div>
        {data.source_type && (
          <span className="text-xs text-slate-400">来源：{data.source_type}</span>
        )}
        <span className="ml-auto text-sm text-slate-500">
          匹配度 <span className="font-semibold text-slate-800">{Math.round(a.overall_fit)}</span>
        </span>
      </div>

      <ProjectStatusFlow detail={detail} busy={busy} onTransition={onTransition} />

      <Section title="项目画像">
        <p className="text-sm text-slate-700">{a.portrait}</p>
        {a.track_judgement && (
          <p className="mt-2 text-xs text-slate-500">赛道判断：{a.track_judgement}</p>
        )}
      </Section>

      <DealMaterialsPanel
        materials={materials}
        showCategorySuggestion={detail.status === "screening"}
        busy={materialBusy}
        error={materialError}
        onUpload={handleUploadMaterial}
        searchQuery={materialSearchQuery}
        searchBusy={materialSearchBusy}
        searchError={materialSearchError}
        searchResults={materialSearchResults}
        onSearchQueryChange={setMaterialSearchQuery}
        onSearch={handleSearchMaterials}
      />

      <DealMarketSignalsPanel
        signals={marketSignals}
        selectedCategory={marketSignalCategory}
        busy={marketSignalBusy}
        error={marketSignalError}
        onCategoryChange={setMarketSignalCategory}
        onRefresh={() => void handleCollectMarketSignals()}
      />

      {a.fit_score && (
        <Section title="机构匹配度">
          <FitScore fit={a.fit_score} />
        </Section>
      )}

      {detail.pre_dd && (
        <>
          <PreDDPanel
            workspace={detail.pre_dd}
            materialUploadError={preDDMaterialUploadError}
            materialStatusBusyKey={preDDMaterialStatusBusyKey ?? null}
            materialUploadBusyKey={preDDMaterialUploadBusyKey}
            onMaterialStatusChange={onPreDDMaterialStatusChange ?? (() => undefined)}
            onMaterialUpload={(taskKey, file) => void handleUploadPreDDMaterial(taskKey, file)}
          />
          <PreDDBriefPanel
            briefReport={briefReport}
            briefHistory={briefHistory}
            briefHistoryBusy={briefHistoryBusy}
            briefBusy={briefBusy}
            briefError={briefError}
            selectedBriefId={selectedBriefId}
            onSelectedBriefChange={setSelectedBriefId}
            onGenerateBrief={handleGenerateBrief}
          />
        </>
      )}

      {a.initial_risks.length > 0 && (
        <Section title="初步风险">
          <ul className="space-y-1">
            {a.initial_risks.map((c, i) => (
              <ClaimLine key={i} claim={c} />
            ))}
          </ul>
        </Section>
      )}

      {company && (
        <Section title="关联企业（工商）">
          <div className="text-sm text-slate-700">{company.name}</div>
          {company.uscc && <div className="text-xs text-slate-400">统一社会信用代码：{company.uscc}</div>}
        </Section>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [filter, setFilter] = useState<string>("all");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preDDMaterialStatusBusyKey, setPreDDMaterialStatusBusyKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({
    company_name: "",
    one_line_intro: "",
    track: "",
    sub_direction: "",
    funding_stage: "",
    source_note: "",
  });

  const assistantContext = useMemo(() => {
    if (detail) {
      return [
        `当前项目：${detail.company?.name ?? detail.data.extraction.company_name}`,
        `状态：${STATUS_META[detail.status]?.label ?? detail.status}`,
        `画像：${detail.data.analysis.portrait}`,
      ].join("；");
    }
    const queryText = listSearchQuery.trim() ? `，搜索：${listSearchQuery.trim()}` : "";
    return `当前项目库共 ${deals.length} 个项目，筛选器：${FILTERS.find((item) => item.key === filter)?.label ?? filter}${queryText}`;
  }, [deals.length, detail, filter, listSearchQuery]);

  const refreshList = useCallback(async () => {
    const f = FILTERS.find((x) => x.key === filter);
    const q = listSearchQuery.trim();
    try {
      const res = await listDeals({ status: f?.status, in_library: f?.inLibrary, q: q || undefined });
      setDeals(res.items);
      setListError(null);
    } catch (e) {
      setListError(
        e instanceof ApiError ? `加载项目库失败（${e.status}）` : "后端未启动（uvicorn app.main:app）"
      );
      setDeals([]);
    }
  }, [filter, listSearchQuery]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await getDealDetail(id);
      setDetail(d);
      setDetailError(null);
    } catch (e) {
      setDetail(null);
      setDetailError(
        e instanceof ApiError
          ? e.status === 404
            ? "项目不存在"
            : `加载详情失败（${e.status}）`
          : "后端未启动"
      );
    }
  }, []);

  useEffect(() => {
    if (dealId) void loadDetail(dealId);
    else setDetail(null);
  }, [dealId, loadDetail]);

  useEffect(() => {
    if (!detail || !location.hash.startsWith("#material-")) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      target?.scrollIntoView({ block: "center" });
    });
  }, [detail, location.hash]);

  async function handleTransition(to: DealStatus) {
    if (!dealId) return;
    setBusy(true);
    try {
      await transitionDeal(dealId, to);
      await loadDetail(dealId);
      await refreshList();
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "流转失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: DealAction) {
    if (!dealId) return;
    setBusy(true);
    try {
      await triggerDealAction(dealId, action);
      await loadDetail(dealId);
      await refreshList();
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreDDMaterialStatusChange(
    taskKey: string,
    status: PreDDMaterialCollectionStatus
  ) {
    if (!dealId) return;
    setPreDDMaterialStatusBusyKey(taskKey);
    try {
      await updatePreDDMaterialStatus(dealId, taskKey, status);
      await loadDetail(dealId);
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "更新 Pre-DD 资料状态失败");
    } finally {
      setPreDDMaterialStatusBusyKey(null);
    }
  }

  async function handleDeleteDealSummary(deal: DealSummary) {
    const name = deal.company_name ?? "未命名项目";
    if (!window.confirm(`确认删除「${name}」吗？删除后将从项目库中移除，但历史材料和事件仍会保留。`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteDeal(deal.id);
      if (deal.id === dealId) {
        setDetail(null);
        setDetailError(null);
        navigate("/workspace");
      }
      await refreshList();
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : "删除项目失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const companyName = createDraft.company_name.trim();
    if (!companyName) return;
    setBusy(true);
    try {
      setCreateError(null);
      const created = await createDeal({
        company_name: companyName,
        one_line_intro: createDraft.one_line_intro.trim() || null,
        track: createDraft.track.trim() || null,
        sub_direction: createDraft.sub_direction.trim() || null,
        funding_stage: createDraft.funding_stage.trim() || null,
        source_note: createDraft.source_note.trim() || null,
      });
      setCreateOpen(false);
      setCreateDraft({
        company_name: "",
        one_line_intro: "",
        track: "",
        sub_direction: "",
        funding_stage: "",
        source_note: "",
      });
      await refreshList();
      navigate(`/workspace/${created.id}`);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : "创建项目失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 左：项目库 */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
            ← 返回
          </a>
          <span className="text-base font-bold text-slate-900">项目库</span>
          <button
            type="button"
            title="新建项目"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                filter === f.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="border-b border-slate-200 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={listSearchQuery}
              onChange={(event) => setListSearchQuery(event.target.value)}
              placeholder="搜索项目、画像或来源"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            {listSearchQuery && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => setListSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {listError && <div className="p-3 text-sm text-rose-500">{listError}</div>}
          {!listError && deals.length === 0 && (
            <div className="p-3 text-sm text-slate-400">
              {listSearchQuery.trim() ? "没有匹配的项目。" : "暂无项目。"}
            </div>
          )}
          {deals.map((d) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/workspace/${d.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/workspace/${d.id}`);
                }
              }}
              className={`mb-1 w-full rounded-lg border p-3 text-left transition ${
                d.id === dealId
                  ? "border-blue-300 bg-blue-50"
                  : "border-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">
                  {d.company_name ?? "（未命名项目）"}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={d.status} />
                  <button
                    type="button"
                    title="删除项目"
                    aria-label={`删除${d.company_name ?? "未命名项目"}`}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteDealSummary(d);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* 已放弃项目按设计只展示名+时间，收起画像 */}
              {!d.is_abandoned && d.portrait && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{d.portrait}</p>
              )}
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                {d.overall_fit != null && <span>匹配 {Math.round(d.overall_fit)}</span>}
                {d.is_in_library && <span className="text-emerald-500">已入库</span>}
                {d.is_liked && <span className="text-amber-500">关注</span>}
                {d.is_abandoned && <span className="text-slate-400">已放弃</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* 右：详情 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <section className="min-h-0 flex-1 overflow-y-auto p-6">
          {!dealId && (
            <div className="flex h-full items-center justify-center text-slate-400">
              从左侧选择一个项目查看工作台详情
            </div>
          )}
          {dealId && detailError && (
            <div className="text-sm text-rose-500">{detailError}</div>
          )}
          {dealId && !detail && !detailError && (
            <div className="text-sm text-slate-400">加载中…</div>
          )}
          {dealId && detail && (
            <DealDetailPanel
              detail={detail}
              busy={busy}
              onTransition={handleTransition}
              onAction={handleAction}
              onMaterialUploaded={() => loadDetail(dealId)}
              onPreDDMaterialStatusChange={handlePreDDMaterialStatusChange}
              preDDMaterialStatusBusyKey={preDDMaterialStatusBusyKey}
            />
          )}
        </section>
        <div className="shrink-0 border-t border-slate-200 bg-white p-4">
          <PageAssistant
            contextLabel="项目库"
            contextSummary={assistantContext}
            placeholder="基于当前项目库提出需求..."
          />
        </div>
      </main>
      {createOpen && (
        <CreateDealDialog
          draft={createDraft}
          error={createError}
          busy={busy}
          onChange={setCreateDraft}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateDeal}
        />
      )}
    </div>
  );
}
