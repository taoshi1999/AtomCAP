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
import { ArrowRight, Check, ChevronDown, ChevronRight, Clock, Download, FileText, Heart, Mic, Plus, Search, Square, ThumbsDown, Trash2, Upload, Wrench, X } from "lucide-react";
import {
  ApiError,
  collectDealMarketSignals,
  collectPreDDMaterialsStream,
  confirmDealMaterialCategories,
  createAuthorizedObjectUrl,
  createMeetingMinutes,
  createDeal,
  deleteDealMaterial,
  deleteDeal,
  downloadGeneratedFile,
  exportDealInformation,
  exportMeetingMinutes,
  exportPreDDReport,
  generatePreDDBrief,
  getDealDetail,
  listPreDDBriefs,
  listDeals,
  transitionDeal,
  triggerDealAction,
  searchDealMaterials,
  updatePreDDMeetingQuestions,
  updateDealWorkspaceSummary,
  updatePreDDMaterialStatus,
  uploadDealMaterial,
  type MessageReference,
  type PreDDMaterialCollectResponse,
  type PreDDBriefHistoryItem,
} from "../lib/api";
import EvidencePanel from "../components/EvidencePanel";
import MarketSignalsPanel, { type MarketSignalViewItem } from "../components/MarketSignalsPanel";
import PageAssistant from "../components/PageAssistant";
import { argumentFromEvidence } from "../lib/evidence";
import type { EvidenceDialogState } from "../lib/evidence";
import type {
  Claim,
  DDReport,
  DealAction,
  DealDetail,
  DealMarketSignal,
  DealMarketSignalCategory,
  DealMaterial,
  DealMaterialSearchResult,
  DealMeetingMinutes,
  DealStatus,
  DealSummary,
  DealWorkspaceSummary,
  EvidenceItem,
  FitScoreBreakdown,
  MaterialCollectionStep,
  PreDDMeetingQuestion,
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

const PRE_DD_TASK_KEYS = Object.keys(PRE_DD_TASK_LABELS);

function normalizePreDDTaskKeys(keys: string[] = []) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  keys.forEach((key) => {
    if (!PRE_DD_TASK_LABELS[key] || seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
}

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

export function updatePreDDMaterialStatusInDetail(
  detail: DealDetail,
  taskKey: string,
  status: PreDDMaterialCollectionStatus
): DealDetail {
  const preDD = detail.pre_dd;
  const currentStatuses = detail.data.pre_dd_material_statuses ?? {};
  const nextStatuses = { ...currentStatuses, [taskKey]: status };

  if (!preDD) {
    return {
      ...detail,
      data: {
        ...detail.data,
        pre_dd_material_statuses: nextStatuses,
      },
    };
  }

  const items = preDD.items.map((item) =>
    item.key === taskKey ? { ...item, collection_status: status } : item
  );
  const collected = items.filter((item) => item.collection_status === "collected").length;
  const pending = items.length - collected;

  return {
    ...detail,
    data: {
      ...detail.data,
      pre_dd_material_statuses: nextStatuses,
    },
    pre_dd: {
      ...preDD,
      items,
      completion: {
        ...preDD.completion,
        collected,
        pending,
      },
    },
  };
}

function normalizeWorkspaceSummary(
  detail: DealDetail,
  summary: DealWorkspaceSummary = detail.data.workspace.summary
): Required<DealWorkspaceSummary> {
  const extraction = detail.data.extraction;
  const hasSavedValue = [
    summary.founded_at,
    summary.region,
    summary.main_business,
    summary.valuation,
  ].some((value) => Boolean((value ?? "").trim()));
  return {
    founded_at: summary.founded_at ?? (hasSavedValue ? "" : extraction.founded_at ?? ""),
    region: summary.region ?? (hasSavedValue ? "" : extraction.region ?? ""),
    main_business:
      summary.main_business ??
      (hasSavedValue
        ? ""
        : extraction.main_business ??
          extraction.business_model ??
          extraction.product ??
          extraction.one_line_intro ??
          detail.data.analysis.portrait ??
          ""),
    valuation: summary.valuation ?? (hasSavedValue ? "" : extraction.valuation ?? ""),
  };
}

export function updateWorkspaceSummaryInDetail(
  detail: DealDetail,
  summary: DealWorkspaceSummary
): DealDetail {
  return {
    ...detail,
    data: {
      ...detail.data,
      workspace: {
        ...detail.data.workspace,
        summary,
      },
    },
  };
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

function CollectionStepDetails({ details }: { details: string[] }) {
  if (details.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-500">
      {details.map((detail, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          <span>{detail}</span>
        </li>
      ))}
    </ul>
  );
}

function CollectionProcessTrace({
  steps,
  defaultOpen = false,
}: {
  steps?: MaterialCollectionStep[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const safeSteps = steps ?? [];
  useEffect(() => {
    if (defaultOpen && safeSteps.length > 0) setOpen(true);
  }, [defaultOpen, safeSteps.length]);
  if (safeSteps.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 transition hover:text-slate-700"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        查看收集过程
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          {safeSteps.map((step, index) => (
            <div key={step.id || `${step.loop}-${step.phase}-${index}`} className="border-l border-slate-200 pl-3">
              <div className="flex items-start gap-2">
                {step.phase === "action" ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-500">
                    <Wrench className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-5 text-slate-700">
                    {step.phase === "action" && step.tool_name ? `已调用工具：${step.tool_name}。` : ""}
                    {step.summary}
                  </div>
                  <CollectionStepDetails details={step.details ?? []} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceSummaryPanel({
  detail,
  onSaved,
}: {
  detail: DealDetail;
  onSaved?: (summary: DealWorkspaceSummary) => void;
}) {
  const [draft, setDraft] = useState<Required<DealWorkspaceSummary>>(() =>
    normalizeWorkspaceSummary(detail)
  );
  const [saved, setSaved] = useState<Required<DealWorkspaceSummary>>(() =>
    normalizeWorkspaceSummary(detail)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const next = normalizeWorkspaceSummary(detail);
    setDraft(next);
    setSaved(next);
    setError(null);
    setSavedAt(null);
  }, [detail.id, detail.data.workspace.summary]);

  const fields: {
    key: keyof DealWorkspaceSummary;
    label: string;
    placeholder: string;
    multiline?: boolean;
  }[] = [
    { key: "founded_at", label: "成立时间", placeholder: "例如：2021-08" },
    { key: "region", label: "地域", placeholder: "例如：江苏苏州" },
    { key: "main_business", label: "主营业务", placeholder: "概括公司主要产品或业务", multiline: true },
    { key: "valuation", label: "估值", placeholder: "例如：本轮投前 5 亿元" },
  ];

  const dirty = fields.some(({ key }) => (draft[key] ?? "") !== (saved[key] ?? ""));

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const payload: DealWorkspaceSummary = {
        founded_at: (draft.founded_at ?? "").trim() || null,
        region: (draft.region ?? "").trim() || null,
        main_business: (draft.main_business ?? "").trim() || null,
        valuation: (draft.valuation ?? "").trim() || null,
      };
      const response = await updateDealWorkspaceSummary(detail.id, payload);
      const next = normalizeWorkspaceSummary(detail, response.summary);
      setDraft(next);
      setSaved(next);
      setSavedAt("已保存");
      onSaved?.(response.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存项目基础信息失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">项目基础信息</h3>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-rose-500">{error}</span>}
          {!error && savedAt && !dirty && <span className="text-xs text-emerald-600">{savedAt}</span>}
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(saved)}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              重置
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || !dirty}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "保存中" : "保存"}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {fields.map((field) => (
          <label
            key={field.key}
            className="flex min-h-28 flex-col rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <span className="mb-2 text-xs font-semibold text-slate-500">{field.label}</span>
            {field.multiline ? (
              <textarea
                value={draft[field.key] ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
                className="min-h-16 flex-1 resize-none border-0 bg-transparent text-sm font-semibold leading-6 text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            ) : (
              <input
                value={draft[field.key] ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
                className="min-h-16 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            )}
          </label>
        ))}
      </div>
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
  collectBusy,
  uploadDisabled,
  collectDisabled,
  deletingMaterialId,
  latestCollectionSteps,
  onStatusChange,
  onAutoCollect,
  onDeleteMaterial,
  onUpload,
}: {
  item: PreDDChecklistItem;
  busy: boolean;
  uploadBusy: boolean;
  collectBusy: boolean;
  uploadDisabled: boolean;
  collectDisabled: boolean;
  deletingMaterialId: string | null;
  latestCollectionSteps?: MaterialCollectionStep[];
  onStatusChange: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  onAutoCollect: (taskKey: string) => void;
  onDeleteMaterial: (documentId: string) => void;
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
          <button
            type="button"
            disabled={collectDisabled}
            onClick={() => onAutoCollect(item.key)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            <Search className="h-3.5 w-3.5" />
            {collectBusy ? "收集中..." : "自动收集"}
          </button>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {collectionOptions.map((status) => {
              const active = item.collection_status === status;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!active) onStatusChange(item.key, status);
                  }}
                  className={`h-7 rounded-md px-2 text-[11px] font-semibold transition disabled:cursor-wait ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  {busy ? "切换中..." : PRE_DD_COLLECTION_META[status].label}
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
          <CollectionProcessTrace steps={latestCollectionSteps} defaultOpen={collectBusy} />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">已收集材料</div>
          {collectedMaterials.length === 0 ? (
            <p className="text-xs text-slate-400">暂无已收集材料。</p>
          ) : (
            <div className="space-y-1.5">
              {collectedMaterials.slice(0, 6).map((material, index) => {
                const autoCollected = Boolean(material.source_url || material.source_title);
                const kindLabel = autoCollected ? "自动收集" : material.kind;
                const deleting = Boolean(material.document_id && deletingMaterialId === material.document_id);
                return (
                <div
                  key={`${material.kind}-${material.document_id ?? material.title}-${index}`}
                  className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        autoCollected ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-500"
                      }`}
                    >
                      {kindLabel}
                    </span>
                    <span className="min-w-0 font-medium text-slate-700">{material.title}</span>
                    {material.evidence_id && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        证据
                      </span>
                    )}
                    {material.document_id && (
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => onDeleteMaterial(material.document_id!)}
                        className="ml-auto inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deleting ? "删除中" : "删除"}
                      </button>
                    )}
                  </div>
                  {material.source_title && (
                    <div className="mt-1 text-slate-500">
                      出处：
                      {material.source_url ? (
                        <a
                          href={material.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {material.source_title}
                        </a>
                      ) : (
                        material.source_title
                      )}
                    </div>
                  )}
                  {material.detail && <p className="mt-0.5 text-slate-500">{material.detail}</p>}
                  <CollectionProcessTrace steps={material.collection_steps} />
                </div>
                );
              })}
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

function buildReportClaimEvidenceDialog(
  title: string,
  claim: Claim,
  evidenceById: Map<string, EvidenceItem>
): EvidenceDialogState {
  const ids = Array.isArray(claim.evidence_ids) ? claim.evidence_ids : [];
  return {
    title,
    rows: [
      {
        point: claim.text,
        arguments:
          ids.length > 0
            ? ids.map((id) => {
                const evidence = evidenceById.get(id);
                return evidence
                  ? argumentFromEvidence(evidence)
                  : {
                      title: `证据 ${id} 尚未返回来源详情`,
                      detail: "请刷新 Report 或检查证据是否仍属于当前机构。",
                      kind: "inferred" as const,
                    };
              })
            : [
                {
                  title: claim.inferred ? "该观点当前为模型推断" : "该观点当前未绑定可追溯证据",
                  detail: "暂无可打开的支撑材料。",
                  kind: "inferred" as const,
                },
              ],
      },
    ],
  };
}

function ReportClaimList({
  claims,
  evidenceTitle,
  evidenceById,
  onOpenEvidence,
}: {
  claims: Claim[];
  evidenceTitle: string;
  evidenceById: Map<string, EvidenceItem>;
  onOpenEvidence: (state: EvidenceDialogState) => void;
}) {
  if (claims.length === 0) return <p className="text-sm text-slate-400">暂无。</p>;
  return (
    <ul className="space-y-2">
      {claims.map((claim, index) => {
        const evidenceCount = Array.isArray(claim.evidence_ids) ? claim.evidence_ids.length : 0;
        return (
          <li key={`${claim.text}-${index}`} className="rounded-lg bg-white/80 px-3 py-2">
            <div className="text-sm leading-6 text-slate-700">{claim.text}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              {claim.inferred && <span>模型推断</span>}
              <span>{evidenceCount} 条证据</span>
              <button
                type="button"
                onClick={() => onOpenEvidence(buildReportClaimEvidenceDialog(evidenceTitle, claim, evidenceById))}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-white px-2 py-1 font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                <FileText className="h-3 w-3" />
                查看证据
              </button>
            </div>
          </li>
        );
      })}
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
  deletingMaterialId,
  categoryConfirmingMaterialId,
  onSearchQueryChange,
  onSearch,
  onDelete,
  onConfirmCategories,
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
  deletingMaterialId: string | null;
  categoryConfirmingMaterialId: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (documentId: string) => void;
  onConfirmCategories: (documentId: string, taskKeys: string[], rejectedTaskKeys?: string[]) => void;
}) {
  const [editingCategoryMaterialId, setEditingCategoryMaterialId] = useState<string | null>(null);
  const [draftCategoryKeys, setDraftCategoryKeys] = useState<string[]>([]);
  const [collapsedCategorySuggestionIds, setCollapsedCategorySuggestionIds] = useState<Set<string>>(
    () => new Set()
  );

  function startEditingCategories(materialId: string, keys: string[]) {
    setEditingCategoryMaterialId(materialId);
    setDraftCategoryKeys(normalizePreDDTaskKeys(keys));
  }

  function toggleDraftCategory(key: string) {
    setDraftCategoryKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : normalizePreDDTaskKeys([...current, key])
    );
  }

  function toggleCategorySuggestion(materialId: string) {
    setCollapsedCategorySuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  }

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
          {materials.map((material) => {
            const deleting = deletingMaterialId === material.id;
            const confirmedKeys = normalizePreDDTaskKeys(material.confirmed_pre_dd_task_keys ?? material.pre_dd_task_keys ?? []);
            const suggestedKeys = normalizePreDDTaskKeys(material.suggested_pre_dd_task_keys ?? []);
            const rejectedKeys = normalizePreDDTaskKeys(material.rejected_pre_dd_task_keys ?? []).filter(
              (key) => !confirmedKeys.includes(key)
            );
            const pendingSuggestedKeys = suggestedKeys.filter(
              (key) => !confirmedKeys.includes(key) && !rejectedKeys.includes(key)
            );
            const suggestionDecisionKeys = normalizePreDDTaskKeys([...suggestedKeys, ...rejectedKeys]);
            const confirmingCategories = categoryConfirmingMaterialId === material.id;
            const editingCategories = editingCategoryMaterialId === material.id;
            const categorySuggestionCollapsed = collapsedCategorySuggestionIds.has(material.id);
            return (
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
                  {material.is_auto_collected && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      自动收集
                    </span>
                  )}
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
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => onDelete(material.id)}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deleting ? "删除中" : "删除"}
                  </button>
                </div>
              </div>
              {material.source_title && (
                <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                  <div>
                    出处：
                    {material.source_url ? (
                      <a
                        href={material.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {material.source_title}
                      </a>
                    ) : (
                      <span className="font-semibold">{material.source_title}</span>
                    )}
                  </div>
                  {material.source_intro && <div className="mt-0.5">{material.source_intro}</div>}
                </div>
              )}
              {material.text_preview && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {material.text_preview}
                </p>
              )}
              <CollectionProcessTrace steps={material.collection_steps} />
              {showCategorySuggestion && material.material_category_suggestion && suggestedKeys.length === 0 && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-5 ${materialCategorySuggestionClassName(
                    material.material_category_suggestion.is_background
                  )}`}
                >
                  <button
                    type="button"
                    aria-expanded={!categorySuggestionCollapsed}
                    onClick={() => toggleCategorySuggestion(material.id)}
                    className="flex w-full flex-wrap items-center gap-2 text-left"
                  >
                    {categorySuggestionCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-semibold">建议归类</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold">
                      {material.material_category_suggestion.title}
                    </span>
                    <span className="text-[11px] opacity-75">
                      置信度 {MATERIAL_CATEGORY_CONFIDENCE_LABELS[material.material_category_suggestion.confidence]}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold opacity-75">
                      {categorySuggestionCollapsed ? "展开" : "收起"}
                    </span>
                  </button>
                  {!categorySuggestionCollapsed && (
                    <div className="mt-0.5 opacity-80">{material.material_category_suggestion.reason}</div>
                  )}
                </div>
              )}
              {showCategorySuggestion && suggestedKeys.length > 0 && (
                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  <button
                    type="button"
                    aria-expanded={!categorySuggestionCollapsed}
                    onClick={() => toggleCategorySuggestion(material.id)}
                    className="mb-1 flex w-full flex-wrap items-center gap-2 text-left font-semibold"
                  >
                    {categorySuggestionCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>建议归类</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-blue-700">
                      {suggestedKeys.length} 个建议
                    </span>
                    {pendingSuggestedKeys.length > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        {pendingSuggestedKeys.length} 个待处理
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-blue-600">
                      {categorySuggestionCollapsed ? "展开" : "收起"}
                    </span>
                  </button>
                  {!categorySuggestionCollapsed && (
                    <>
                      <div className="space-y-1.5">
                        {suggestedKeys.map((key) => {
                          const accepted = confirmedKeys.includes(key);
                          const rejected = rejectedKeys.includes(key);
                          return (
                            <div key={key} className="flex flex-wrap items-center gap-2 rounded-md bg-white/80 px-2 py-1">
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                                {PRE_DD_TASK_LABELS[key] ?? key}
                              </span>
                              {accepted && <span className="text-[11px] font-semibold text-emerald-600">已接受</span>}
                              {rejected && <span className="text-[11px] font-semibold text-rose-500">已拒绝</span>}
                              {!accepted && !rejected && (
                                <span className="text-[11px] text-blue-500">待处理</span>
                              )}
                              <div className="ml-auto flex items-center gap-1">
                                {!accepted && (
                                  <button
                                    type="button"
                                    disabled={confirmingCategories}
                                    onClick={() =>
                                      onConfirmCategories(
                                        material.id,
                                        normalizePreDDTaskKeys([...confirmedKeys, key]),
                                        rejectedKeys.filter((item) => item !== key)
                                      )
                                    }
                                    className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-100 bg-white px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:text-emerald-300"
                                  >
                                    <Check className="h-3 w-3" />
                                    接受
                                  </button>
                                )}
                                {!rejected && (
                                  <button
                                    type="button"
                                    disabled={confirmingCategories}
                                    onClick={() =>
                                      onConfirmCategories(
                                        material.id,
                                        confirmedKeys.filter((item) => item !== key),
                                        normalizePreDDTaskKeys([...rejectedKeys, key])
                                      )
                                    }
                                    className="inline-flex h-6 items-center gap-1 rounded-md border border-rose-100 bg-white px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-wait disabled:text-rose-300"
                                  >
                                    <X className="h-3 w-3" />
                                    拒绝
                                  </button>
                                )}
                                {(accepted || rejected) && (
                                  <button
                                    type="button"
                                    disabled={confirmingCategories}
                                    onClick={() =>
                                      onConfirmCategories(
                                        material.id,
                                        confirmedKeys.filter((item) => item !== key),
                                        rejectedKeys.filter((item) => item !== key)
                                      )
                                    }
                                    className="inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-wait disabled:text-slate-300"
                                  >
                                    撤销
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {pendingSuggestedKeys.length > 0 && (
                        <div className="mt-0.5 text-blue-600">
                          可逐项接受或拒绝；接受后，该材料会出现在对应的 Pre-DD 资料类别中。
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">当前归类</span>
                  {confirmedKeys.length > 0 ? (
                    confirmedKeys.map((key) => (
                      <span
                        key={key}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                      >
                        {PRE_DD_TASK_LABELS[key] ?? key}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">暂未归入 Pre-DD 类别</span>
                  )}
                  <button
                    type="button"
                    disabled={confirmingCategories}
                    onClick={() => startEditingCategories(material.id, confirmedKeys)}
                    className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-300"
                  >
                    <Wrench className="h-3 w-3" />
                    调整分类
                  </button>
                </div>
                {editingCategories && (
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      {PRE_DD_TASK_KEYS.map((key) => {
                        const selected = draftCategoryKeys.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleDraftCategory(key)}
                            className={`h-8 rounded-md border px-2 text-left text-[11px] font-semibold transition ${
                              selected
                                ? "border-blue-200 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {PRE_DD_TASK_LABELS[key]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCategoryMaterialId(null)}
                        className="h-7 rounded-md px-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={confirmingCategories}
                        onClick={() => {
                          const nextRejectedKeys = suggestionDecisionKeys.filter(
                            (key) => !draftCategoryKeys.includes(key)
                          );
                          onConfirmCategories(material.id, draftCategoryKeys, nextRejectedKeys);
                          setEditingCategoryMaterialId(null);
                        }}
                        className="h-7 rounded-md bg-blue-600 px-2 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
                      >
                        {confirmingCategories ? "保存中..." : "保存分类"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {material.warnings.length > 0 && (
                <div className="mt-2 text-xs text-amber-600">{material.warnings.join("；")}</div>
              )}
            </div>
            );
          })}
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

function formatMeetingTime(seconds?: number | null) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function normalizePreDDMeetingQuestions(items: unknown): PreDDMeetingQuestion[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const question = item.trim();
        return question
          ? {
              question,
              purpose: "该问题用于补充当前 Pre-DD 资料缺口，并帮助投资团队在会后更新项目判断。",
            }
          : null;
      }
      if (item && typeof item === "object") {
        const value = item as { question?: unknown; purpose?: unknown };
        const question = String(value.question ?? "").trim();
        const purpose = String(value.purpose ?? "").trim();
        return question
          ? {
              question,
              purpose:
                purpose ||
                "该问题用于补充当前 Pre-DD 资料缺口，并帮助投资团队在会后更新项目判断。",
            }
          : null;
      }
      return null;
    })
    .filter((item): item is PreDDMeetingQuestion => item !== null);
}

type MeetingTranscriptSegmentInput = {
  start_seconds: number;
  end_seconds: number;
  text: string;
};

function MeetingMinutesPanel({
  minutes,
  busy,
  error,
  exportingId,
  onCreateMinutes,
  onExportMinutes,
}: {
  minutes: DealMeetingMinutes[];
  busy: boolean;
  error: string | null;
  exportingId: string | null;
  onCreateMinutes: (
    file: File | Blob,
    options: {
      filename?: string;
      mode: "upload" | "live";
      transcriptText?: string;
      transcriptSegments?: MeetingTranscriptSegmentInput[];
      durationSeconds?: number;
    }
  ) => Promise<void>;
  onExportMinutes: (minutes: DealMeetingMinutes) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(minutes[0]?.id ?? null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveTranscriptPreview, setLiveTranscriptPreview] = useState("");
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [pendingJump, setPendingJump] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);
  const transcriptSegmentsRef = useRef<MeetingTranscriptSegmentInput[]>([]);
  const transcriptTextRef = useRef("");
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);

  const selected = minutes.find((item) => item.id === selectedId) ?? minutes[0] ?? null;

  useEffect(() => {
    if (minutes.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && minutes.some((item) => item.id === current) ? current : minutes[0].id));
  }, [minutes]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    setAudioError(null);
    setAudioUrl(null);
    if (!selected?.audio_url) return undefined;
    createAuthorizedObjectUrl(selected.audio_url)
      .then((url) => {
        revokedUrl = url;
        setAudioUrl(url);
      })
      .catch((err) => setAudioError(err instanceof Error ? err.message : "录音加载失败"));
    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [selected?.audio_url]);

  useEffect(() => {
    if (audioUrl && pendingJump !== null && audioRef.current) {
      audioRef.current.currentTime = pendingJump;
      void audioRef.current.play().catch(() => undefined);
      setPendingJump(null);
    }
  }, [audioUrl, pendingJump]);

  function jumpTo(item: DealMeetingMinutes, seconds: number) {
    setSelectedId(item.id);
    setPendingJump(seconds);
    if (selected?.id === item.id && audioRef.current) {
      audioRef.current.currentTime = seconds;
      void audioRef.current.play().catch(() => undefined);
      setPendingJump(null);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onCreateMinutes(file, { mode: "upload", filename: file.name });
  }

  async function startRecording() {
    if (recording || busy) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaStreamRef.current = stream;
    audioChunksRef.current = [];
    transcriptSegmentsRef.current = [];
    transcriptTextRef.current = "";
    setLiveTranscriptPreview("");
    recordingStartedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
      const durationSeconds = (Date.now() - recordingStartedAtRef.current) / 1000;
      const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
      void onCreateMinutes(blob, {
        mode: "live",
        filename: `meeting-${Date.now()}.webm`,
        transcriptText: transcriptTextRef.current,
        transcriptSegments: transcriptSegmentsRef.current,
        durationSeconds,
      });
    };
    mediaRecorderRef.current = recorder;
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognitionCtor));
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result?.isFinal) continue;
          const text = String(result[0]?.transcript || "").trim();
          if (!text) continue;
          const end = (Date.now() - recordingStartedAtRef.current) / 1000;
          const start = Math.max(0, end - 8);
          transcriptSegmentsRef.current.push({ start_seconds: start, end_seconds: end, text });
          transcriptTextRef.current = `${transcriptTextRef.current} ${text}`.trim();
          setLiveTranscriptPreview(transcriptTextRef.current);
        }
      };
      recognition.onerror = () => setSpeechSupported(false);
      recognition.start();
      recognitionRef.current = recognition;
    }
    recorder.start(1000);
    setRecording(true);
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  return (
    <Section title="会议纪要">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
          <Upload className="h-4 w-4" />
          上传录音
          <input
            type="file"
            accept="audio/*,video/mp4"
            disabled={busy || recording}
            onChange={(event) => void handleUpload(event)}
            className="sr-only"
          />
        </label>
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <Square className="h-4 w-4" />
            停止录音
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startRecording()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Mic className="h-4 w-4" />
            实时录音
          </button>
        )}
        {busy && <span className="text-xs text-slate-400">正在生成会议纪要...</span>}
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {recording && (
        <div className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
          正在录音。{speechSupported === false ? "当前浏览器未提供实时语音转写，系统会保存录音并生成待转写纪要。" : "系统会同步捕获转写片段用于生成可跳转纪要。"}
          {liveTranscriptPreview && <div className="mt-1 text-slate-600">{liveTranscriptPreview.slice(-160)}</div>}
        </div>
      )}

      {selected && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{selected.audio_filename}</span>
            <span>{selected.mode === "live" ? "实时录音" : "上传录音"}</span>
            {selected.duration_seconds ? <span>{formatMeetingTime(selected.duration_seconds)}</span> : null}
            {audioError && <span className="text-rose-500">{audioError}</span>}
          </div>
          {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="w-full" />}
        </div>
      )}

      {minutes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
          暂无会议纪要。可上传历史录音，或点击实时录音开始记录会议。
        </div>
      ) : (
        <div className="space-y-3">
          {minutes.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>{formatBriefTime(item.created_at)}</span>
                    <span>{item.mode === "live" ? "实时录音" : "上传录音"}</span>
                    <span>{item.qa_pairs.length} 个 QA</span>
                    <span>{item.key_infos.length} 条关键信息</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={exportingId === item.id}
                  onClick={() => onExportMinutes(item)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:text-blue-300"
                >
                  <Download className="h-4 w-4" />
                  {exportingId === item.id ? "导出中..." : item.generated_file ? "重新导出 Word" : "导出 Word"}
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-400">关键信息</div>
                  <div className="space-y-2">
                    {item.key_infos.map((info, index) => (
                      <button
                        key={`${info.title}-${index}`}
                        type="button"
                        onClick={() => jumpTo(item, info.start_seconds)}
                        className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm leading-6 text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold">{formatMeetingTime(info.start_seconds)}</span>
                          <span className="font-semibold">{info.title}</span>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{info.summary}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-400">关键问题 QA</div>
                  <div className="space-y-2">
                    {item.qa_pairs.map((qa, index) => (
                      <button
                        key={`${qa.question}-${index}`}
                        type="button"
                        onClick={() => jumpTo(item, qa.start_seconds)}
                        className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm leading-6 text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatMeetingTime(qa.start_seconds)}</span>
                        </div>
                        <div className="mt-1 font-semibold">Q：{qa.question}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">A：{qa.answer}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {item.generated_file && (
                <button
                  type="button"
                  onClick={() => void downloadGeneratedFile(item.generated_file!)}
                  className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  下载已导出 Word
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function PreDDBriefCard({
  report,
  updatedAt,
  evidenceItems = [],
  deliverableId,
  updatingQuestions,
  questionUpdateError,
  exportingReport,
  reportExportError,
  onUpdateMeetingQuestions,
  onExportReport,
}: {
  report: DDReport;
  updatedAt?: string;
  evidenceItems?: EvidenceItem[];
  deliverableId?: string;
  updatingQuestions?: boolean;
  questionUpdateError?: string | null;
  exportingReport?: boolean;
  reportExportError?: string | null;
  onUpdateMeetingQuestions?: (deliverableId: string, questions: PreDDMeetingQuestion[]) => Promise<void>;
  onExportReport?: (deliverableId: string) => void;
}) {
  const preDDReport = report.report;
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<PreDDMeetingQuestion[]>([]);
  const [questionSaved, setQuestionSaved] = useState(false);
  const evidenceById = useMemo(
    () => new Map(evidenceItems.map((item) => [item.id, item])),
    [evidenceItems]
  );
  useEffect(() => {
    setQuestionDrafts(normalizePreDDMeetingQuestions(preDDReport?.meeting_questions));
    setQuestionSaved(false);
  }, [preDDReport?.meeting_questions, deliverableId]);
  if (!preDDReport) return null;
  const canPersistQuestions = Boolean(deliverableId && deliverableId !== "latest" && onUpdateMeetingQuestions);
  const canExportReport = Boolean(deliverableId && deliverableId !== "latest" && onExportReport);
  const updateQuestionDraft = (
    index: number,
    key: keyof PreDDMeetingQuestion,
    value: string
  ) => {
    setQuestionSaved(false);
    setQuestionDrafts((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };
  const addQuestionDraft = () => {
    setQuestionSaved(false);
    setQuestionDrafts((items) => [
      ...items,
      {
        question: "",
        purpose: "",
      },
    ]);
  };
  const removeQuestionDraft = (index: number) => {
    setQuestionSaved(false);
    setQuestionDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };
  const saveQuestionDrafts = async () => {
    if (!deliverableId || !onUpdateMeetingQuestions) return;
    const cleaned = questionDrafts
      .map((item) => ({
        question: item.question.trim(),
        purpose: item.purpose.trim(),
      }))
      .filter((item) => item.question && item.purpose);
    await onUpdateMeetingQuestions(deliverableId, cleaned);
    setQuestionDrafts(cleaned);
    setQuestionSaved(true);
  };
  const overviewItems = [
    ["成立时间", preDDReport.project_overview.founded_at],
    ["地域", preDDReport.project_overview.region],
    ["主营业务", preDDReport.project_overview.main_business],
    ["估值", preDDReport.project_overview.valuation],
  ] as const;
  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-950">Pre-DD Report</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {report.company_name}
            {updatedAt ? ` · ${formatBriefTime(updatedAt)}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reportExportError && <span className="text-xs text-rose-500">{reportExportError}</span>}
          <button
            type="button"
            disabled={!canExportReport || exportingReport}
            onClick={() => {
              if (deliverableId) onExportReport?.(deliverableId);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            <Download className="h-4 w-4" />
            {exportingReport ? "导出中..." : "导出 Word"}
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-400">项目概览</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {overviewItems.map(([label, claim]) => (
              <div key={label} className="rounded-lg bg-white/80 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-400">{label}</div>
                <div className="mt-1 text-sm leading-5 text-slate-700">{claim.text.replace(`${label}：`, "")}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">机构匹配度</div>
          <ReportClaimList
            claims={[preDDReport.fit_summary]}
            evidenceTitle="机构匹配度"
            evidenceById={evidenceById}
            onOpenEvidence={setEvidenceDialog}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">价值点</div>
            <ReportClaimList
              claims={preDDReport.value_points}
              evidenceTitle="价值点"
              evidenceById={evidenceById}
              onOpenEvidence={setEvidenceDialog}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-400">风险点</div>
            <ReportClaimList
              claims={preDDReport.risk_points}
              evidenceTitle="风险点"
              evidenceById={evidenceById}
              onOpenEvidence={setEvidenceDialog}
            />
          </div>
        </div>
        {(
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-400">推荐会议问题列表</div>
              <div className="flex flex-wrap items-center gap-2">
                {questionSaved && <span className="text-xs text-emerald-600">已保存</span>}
                {questionUpdateError && <span className="text-xs text-rose-500">{questionUpdateError}</span>}
                <button
                  type="button"
                  onClick={addQuestionDraft}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  新增问题
                </button>
                <button
                  type="button"
                  disabled={!canPersistQuestions || updatingQuestions}
                  onClick={() => void saveQuestionDrafts()}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Check className="h-4 w-4" />
                  {updatingQuestions ? "保存中..." : "保存问题"}
                </button>
              </div>
            </div>
            <ol className="space-y-2 text-sm leading-6 text-slate-700">
              {questionDrafts.length === 0 ? (
                <li className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-sm text-slate-400">
                  暂无会议问题，可点击「新增问题」手动添加。
                </li>
              ) : questionDrafts.map((item, index) => (
                <li key={index} className="rounded-lg bg-white/80 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-blue-500">问题 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeQuestionDraft(index)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-100 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">提问方式</span>
                    <textarea
                      value={item.question}
                      onChange={(event) => updateQuestionDraft(index, "question", event.target.value)}
                      rows={2}
                      placeholder="例如：您能否提供详细的股权分配明细？"
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="mt-2 block">
                    <span className="text-[11px] font-semibold text-slate-400">预期目的</span>
                    <textarea
                      value={item.purpose}
                      onChange={(event) => updateQuestionDraft(index, "purpose", event.target.value)}
                      rows={2}
                      placeholder="例如：该问题预期能收集到股权分配信息，有助于分析控制权结构和潜在治理风险。"
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {evidenceDialog && <EvidencePanel state={evidenceDialog} onClose={() => setEvidenceDialog(null)} />}
    </div>
  );
}

function PreDDPanel({
  workspace,
  materialUploadError,
  materialStatusError,
  materialStatusBusyKey,
  materialUploadBusyKey,
  materialCollectBusyKeys,
  deletingMaterialId,
  latestCollectionStepsByTask,
  onMaterialStatusChange,
  onMaterialAutoCollect,
  onMaterialDelete,
  onMaterialUpload,
}: {
  workspace: PreDDWorkspace;
  materialUploadError: string | null;
  materialStatusError: string | null;
  materialStatusBusyKey: string | null;
  materialUploadBusyKey: string | null;
  materialCollectBusyKeys: string[];
  deletingMaterialId: string | null;
  latestCollectionStepsByTask: Record<string, MaterialCollectionStep[]>;
  onMaterialStatusChange: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  onMaterialAutoCollect: (taskKey: string) => void;
  onMaterialDelete: (documentId: string) => void;
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
              busy={materialStatusBusyKey === item.key}
              uploadBusy={materialUploadBusyKey === item.key}
              collectBusy={materialCollectBusyKeys.includes(item.key)}
              uploadDisabled={materialUploadBusyKey !== null}
              collectDisabled={materialCollectBusyKeys.includes(item.key)}
              deletingMaterialId={deletingMaterialId}
              latestCollectionSteps={latestCollectionStepsByTask[item.key]}
              onStatusChange={onMaterialStatusChange}
              onAutoCollect={onMaterialAutoCollect}
              onDeleteMaterial={onMaterialDelete}
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
      {materialStatusError && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {materialStatusError}
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
  questionUpdatingId,
  questionUpdateError,
  reportExportingId,
  reportExportError,
  selectedBriefId,
  onSelectedBriefChange,
  onGenerateBrief,
  onUpdateMeetingQuestions,
  onExportReport,
}: {
  briefReport: DDReport | null;
  briefHistory: PreDDBriefHistoryItem[];
  briefHistoryBusy: boolean;
  briefBusy: boolean;
  briefError: string | null;
  questionUpdatingId: string | null;
  questionUpdateError: string | null;
  reportExportingId: string | null;
  reportExportError: string | null;
  selectedBriefId: string | null;
  onSelectedBriefChange: (deliverableId: string) => void;
  onGenerateBrief: () => void;
  onUpdateMeetingQuestions: (deliverableId: string, questions: PreDDMeetingQuestion[]) => Promise<void>;
  onExportReport: (deliverableId: string) => void;
}) {
  const briefs =
    briefHistory.length > 0
      ? briefHistory
      : briefReport
        ? [{
            deliverable_id: "latest",
            type: "dd_report" as const,
            payload: briefReport,
            evidence_items: [],
            created_at: "",
            updated_at: "",
          }]
        : [];
  const selectedBrief =
    briefs.find((item) => item.deliverable_id === selectedBriefId) ?? briefs[0] ?? null;

  return (
    <Section title="Pre-DD Report">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={briefBusy}
          onClick={onGenerateBrief}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <FileText className="h-4 w-4" />
          {briefBusy ? "生成中..." : "生成 Pre-DD Report"}
        </button>
        {briefError && <span className="text-xs text-rose-500">{briefError}</span>}
      </div>

      {briefHistoryBusy ? (
        <div className="mt-4 text-sm text-slate-400">加载 Report 历史中...</div>
      ) : briefs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
          暂无已生成的 Pre-DD Report。
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Pre-DD Report 版本">
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
              evidenceItems={selectedBrief.evidence_items ?? []}
              deliverableId={selectedBrief.deliverable_id}
              updatingQuestions={questionUpdatingId === selectedBrief.deliverable_id}
              questionUpdateError={questionUpdateError}
              exportingReport={reportExportingId === selectedBrief.deliverable_id}
              reportExportError={reportExportError}
              onUpdateMeetingQuestions={onUpdateMeetingQuestions}
              onExportReport={onExportReport}
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
  preDDMaterialStatusError,
  onWorkspaceSummarySaved,
}: {
  detail: DealDetail;
  busy: boolean;
  onTransition: (to: DealStatus) => void;
  onAction: (action: DealAction) => void;
  onMaterialUploaded?: () => Promise<void> | void;
  onPreDDMaterialStatusChange?: (taskKey: string, status: PreDDMaterialCollectionStatus) => void;
  preDDMaterialStatusBusyKey?: string | null;
  preDDMaterialStatusError?: string | null;
  onWorkspaceSummarySaved?: (summary: DealWorkspaceSummary) => void;
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
  const [preDDMaterialCollectBusyKeys, setPreDDMaterialCollectBusyKeys] = useState<string[]>([]);
  const [latestCollectionStepsByTask, setLatestCollectionStepsByTask] = useState<Record<string, MaterialCollectionStep[]>>({});
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [categoryConfirmingMaterialId, setCategoryConfirmingMaterialId] = useState<string | null>(null);
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
  const [questionUpdatingId, setQuestionUpdatingId] = useState<string | null>(null);
  const [questionUpdateError, setQuestionUpdateError] = useState<string | null>(null);
  const [reportExportingId, setReportExportingId] = useState<string | null>(null);
  const [reportExportError, setReportExportError] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [meetingMinutes, setMeetingMinutes] = useState<DealMeetingMinutes[]>(detail.data.meeting_minutes ?? []);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingExportingId, setMeetingExportingId] = useState<string | null>(null);
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
    setPreDDMaterialCollectBusyKeys([]);
    setLatestCollectionStepsByTask({});
    setDeletingMaterialId(null);
    setCategoryConfirmingMaterialId(null);
    setMaterialSearchQuery("");
    setMaterialSearchResults([]);
    setMaterialSearchError(null);
    setMaterialSearchBusy(false);
    setMeetingMinutes(detail.data.meeting_minutes ?? []);
    setMeetingError(null);
    setMeetingBusy(false);
    setMeetingExportingId(null);
  }, [detail.id, detail.materials, detail.data.market_signals, detail.data.meeting_minutes]);

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
    setQuestionUpdatingId(null);
    setQuestionUpdateError(null);
    setReportExportingId(null);
    setReportExportError(null);
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
            evidence_items: response.evidence_items ?? [],
            created_at: "",
            updated_at: "",
          },
          ...items,
        ]);
      }
    } catch (error) {
      setBriefError(error instanceof ApiError ? error.message : "生成 Pre-DD Report 失败");
    } finally {
      setBriefBusy(false);
    }
  }

  async function handleUpdateMeetingQuestions(
    deliverableId: string,
    questions: PreDDMeetingQuestion[]
  ) {
    setQuestionUpdatingId(deliverableId);
    setQuestionUpdateError(null);
    try {
      const response = await updatePreDDMeetingQuestions(detail.id, deliverableId, questions);
      setBriefReport(response.payload);
      setBriefHistory((items) =>
        items.map((item) =>
          item.deliverable_id === deliverableId
            ? {
                ...item,
                payload: response.payload,
                evidence_items: response.evidence_items ?? item.evidence_items,
              }
            : item
        )
      );
    } catch (error) {
      setQuestionUpdateError(error instanceof ApiError ? error.message : "保存会议问题失败");
      throw error;
    } finally {
      setQuestionUpdatingId(null);
    }
  }

  async function handleExportPreDDReport(deliverableId: string) {
    setReportExportingId(deliverableId);
    setReportExportError(null);
    try {
      const response = await exportPreDDReport(detail.id, deliverableId);
      await downloadGeneratedFile(response.file);
    } catch (error) {
      setReportExportError(error instanceof ApiError ? error.message : "导出 Pre-DD Report 失败");
    } finally {
      setReportExportingId(null);
    }
  }

  async function handleCreateMeetingMinutes(
    file: File | Blob,
    options: {
      filename?: string;
      mode: "upload" | "live";
      transcriptText?: string;
      transcriptSegments?: { start_seconds: number; end_seconds: number; text: string }[];
      durationSeconds?: number;
    }
  ) {
    setMeetingBusy(true);
    setMeetingError(null);
    try {
      const response = await createMeetingMinutes(detail.id, file, options);
      setMeetingMinutes((items) => [
        response.minutes,
        ...items.filter((item) => item.id !== response.minutes.id),
      ]);
    } catch (error) {
      setMeetingError(error instanceof ApiError ? error.message : "生成会议纪要失败");
    } finally {
      setMeetingBusy(false);
    }
  }

  async function handleExportMeetingMinutes(minutes: DealMeetingMinutes) {
    setMeetingExportingId(minutes.id);
    setMeetingError(null);
    try {
      const response = await exportMeetingMinutes(detail.id, minutes.id);
      setMeetingMinutes((items) =>
        items.map((item) => (item.id === minutes.id ? response.minutes : item))
      );
      await downloadGeneratedFile(response.file);
    } catch (error) {
      setMeetingError(error instanceof ApiError ? error.message : "导出会议纪要失败");
    } finally {
      setMeetingExportingId(null);
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

  async function handleCollectPreDDMaterial(taskKey: string) {
    if (preDDMaterialCollectBusyKeys.includes(taskKey)) return;
    setPreDDMaterialCollectBusyKeys((keys) => (keys.includes(taskKey) ? keys : [...keys, taskKey]));
    setLatestCollectionStepsByTask((current) => ({ ...current, [taskKey]: [] }));
    setPreDDMaterialUploadError(null);
    const streamState: {
      response: PreDDMaterialCollectResponse | null;
      error: string | null;
    } = { response: null, error: null };
    try {
      await collectPreDDMaterialsStream(detail.id, taskKey, {
        onStep(step) {
          setLatestCollectionStepsByTask((current) => {
            const currentSteps = current[taskKey] ?? [];
            const existingIndex = currentSteps.findIndex((item) => item.id === step.id);
            const nextSteps =
              existingIndex >= 0
                ? currentSteps.map((item, index) => (index === existingIndex ? step : item))
                : [...currentSteps, step];
            return { ...current, [taskKey]: nextSteps };
          });
        },
        onResult(response) {
          streamState.response = response;
          setLatestCollectionStepsByTask((current) => ({ ...current, [taskKey]: response.steps ?? current[taskKey] ?? [] }));
        },
        onError(message) {
          streamState.error = message || "自动收集资料失败";
        },
      });
      if (streamState.error) throw new ApiError(500, streamState.error);
      if (!streamState.response) throw new ApiError(500, "自动收集资料未返回结果");
      const response = streamState.response;
      if (response.items.length === 0) {
        setPreDDMaterialUploadError("本次未检索到可用的公开资料，可稍后重试或手动上传材料。");
      } else {
        setMaterials((items) => [
          ...response.items,
          ...items.filter((item) => !response.items.some((created) => created.id === item.id)),
        ]);
        await onMaterialUploaded?.();
      }
    } catch (error) {
      setPreDDMaterialUploadError(error instanceof ApiError ? error.message : "自动收集资料失败");
    } finally {
      setPreDDMaterialCollectBusyKeys((keys) => keys.filter((key) => key !== taskKey));
    }
  }

  async function handleDeleteMaterial(documentId: string) {
    setDeletingMaterialId(documentId);
    setMaterialError(null);
    setPreDDMaterialUploadError(null);
    try {
      await deleteDealMaterial(detail.id, documentId);
      setMaterials((items) => items.filter((item) => item.id !== documentId));
      await onMaterialUploaded?.();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "删除材料失败";
      setMaterialError(message);
      setPreDDMaterialUploadError(message);
    } finally {
      setDeletingMaterialId(null);
    }
  }

  async function handleConfirmMaterialCategories(
    documentId: string,
    taskKeys: string[],
    rejectedTaskKeys: string[] = []
  ) {
    setCategoryConfirmingMaterialId(documentId);
    setMaterialError(null);
    setPreDDMaterialUploadError(null);
    try {
      const material = await confirmDealMaterialCategories(detail.id, documentId, taskKeys, rejectedTaskKeys);
      setMaterials((items) => items.map((item) => (item.id === material.id ? material : item)));
      await onMaterialUploaded?.();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "确认材料归类失败";
      setMaterialError(message);
      setPreDDMaterialUploadError(message);
    } finally {
      setCategoryConfirmingMaterialId(null);
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

      <WorkspaceSummaryPanel detail={detail} onSaved={onWorkspaceSummarySaved} />

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
        deletingMaterialId={deletingMaterialId}
        categoryConfirmingMaterialId={categoryConfirmingMaterialId}
        onSearchQueryChange={setMaterialSearchQuery}
        onSearch={handleSearchMaterials}
        onDelete={(documentId) => void handleDeleteMaterial(documentId)}
        onConfirmCategories={(documentId, taskKeys, rejectedTaskKeys) =>
          void handleConfirmMaterialCategories(documentId, taskKeys, rejectedTaskKeys)
        }
      />

      <DealMarketSignalsPanel
        signals={marketSignals}
        selectedCategory={marketSignalCategory}
        busy={marketSignalBusy}
        error={marketSignalError}
        onCategoryChange={setMarketSignalCategory}
        onRefresh={() => void handleCollectMarketSignals()}
      />

      <MeetingMinutesPanel
        minutes={meetingMinutes}
        busy={meetingBusy}
        error={meetingError}
        exportingId={meetingExportingId}
        onCreateMinutes={handleCreateMeetingMinutes}
        onExportMinutes={(minutes) => void handleExportMeetingMinutes(minutes)}
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
            materialStatusError={preDDMaterialStatusError ?? null}
            materialStatusBusyKey={preDDMaterialStatusBusyKey ?? null}
            materialUploadBusyKey={preDDMaterialUploadBusyKey}
            materialCollectBusyKeys={preDDMaterialCollectBusyKeys}
            deletingMaterialId={deletingMaterialId}
            latestCollectionStepsByTask={latestCollectionStepsByTask}
            onMaterialStatusChange={onPreDDMaterialStatusChange ?? (() => undefined)}
            onMaterialAutoCollect={(taskKey) => void handleCollectPreDDMaterial(taskKey)}
            onMaterialDelete={(documentId) => void handleDeleteMaterial(documentId)}
            onMaterialUpload={(taskKey, file) => void handleUploadPreDDMaterial(taskKey, file)}
          />
          <PreDDBriefPanel
            briefReport={briefReport}
            briefHistory={briefHistory}
            briefHistoryBusy={briefHistoryBusy}
            briefBusy={briefBusy}
            briefError={briefError}
            questionUpdatingId={questionUpdatingId}
            questionUpdateError={questionUpdateError}
            reportExportingId={reportExportingId}
            reportExportError={reportExportError}
            selectedBriefId={selectedBriefId}
            onSelectedBriefChange={setSelectedBriefId}
            onGenerateBrief={handleGenerateBrief}
            onUpdateMeetingQuestions={handleUpdateMeetingQuestions}
            onExportReport={handleExportPreDDReport}
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
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(() => new Set());
  const [dealExportBusy, setDealExportBusy] = useState(false);
  const [dealExportError, setDealExportError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preDDMaterialStatusBusyKey, setPreDDMaterialStatusBusyKey] = useState<string | null>(null);
  const [preDDMaterialStatusError, setPreDDMaterialStatusError] = useState<string | null>(null);
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
      const summary = normalizeWorkspaceSummary(detail);
      return [
        `当前项目：${detail.company?.name ?? detail.data.extraction.company_name}`,
        `状态：${STATUS_META[detail.status]?.label ?? detail.status}`,
        `成立时间：${summary.founded_at || "未设置"}`,
        `地域：${summary.region || "未设置"}`,
        `主营业务：${summary.main_business || "未设置"}`,
        `估值：${summary.valuation || "未设置"}`,
      ].join("；");
    }
    const queryText = listSearchQuery.trim() ? `，搜索：${listSearchQuery.trim()}` : "";
    return `当前项目库共 ${deals.length} 个项目，筛选器：${FILTERS.find((item) => item.key === filter)?.label ?? filter}${queryText}`;
  }, [deals.length, detail, filter, listSearchQuery]);

  const assistantReferences = useMemo<MessageReference[]>(() => {
    if (!detail) return [];
    const title = detail.company?.name ?? detail.data.extraction.company_name ?? "未命名项目";
    return [
      {
        kind: "deal",
        id: detail.id,
        title,
        subtitle: detail.data.analysis.portrait ?? STATUS_META[detail.status]?.label ?? detail.status,
      },
    ];
  }, [detail]);

  const refreshList = useCallback(async () => {
    const f = FILTERS.find((x) => x.key === filter);
    const q = listSearchQuery.trim();
    try {
      const res = await listDeals({ status: f?.status, in_library: f?.inLibrary, q: q || undefined });
      setDeals(res.items);
      setSelectedDealIds((current) => {
        const visibleIds = new Set(res.items.map((item) => item.id));
        return new Set([...current].filter((id) => visibleIds.has(id)));
      });
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

  function toggleDealSelection(id: string) {
    setDealExportError(null);
    setSelectedDealIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExportDealInformation() {
    const dealIds = [...selectedDealIds];
    if (dealIds.length === 0) return;
    setDealExportBusy(true);
    setDealExportError(null);
    try {
      const response = await exportDealInformation(dealIds);
      await downloadGeneratedFile(response.file);
    } catch (error) {
      setDealExportError(error instanceof ApiError ? error.message : "导出项目信息失败");
    } finally {
      setDealExportBusy(false);
    }
  }

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await getDealDetail(id);
      setDetail(d);
      setDetailError(null);
      setPreDDMaterialStatusError(null);
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
    const previousDetail = detail;
    setPreDDMaterialStatusBusyKey(taskKey);
    setPreDDMaterialStatusError(null);
    setDetail((current) =>
      current && current.id === dealId
        ? updatePreDDMaterialStatusInDetail(current, taskKey, status)
        : current
    );
    try {
      await updatePreDDMaterialStatus(dealId, taskKey, status);
      try {
        const refreshed = await getDealDetail(dealId);
        setDetail(refreshed);
        setDetailError(null);
        setPreDDMaterialStatusError(null);
      } catch {
        setPreDDMaterialStatusError("状态已更新，但刷新项目详情失败，请稍后刷新页面确认。");
      }
    } catch (e) {
      setDetail((current) =>
        previousDetail && current?.id === previousDetail.id ? previousDetail : current
      );
      setPreDDMaterialStatusError(e instanceof ApiError ? e.message : "更新 Pre-DD 资料状态失败");
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="导出项目信息"
              disabled={selectedDealIds.size === 0 || dealExportBusy}
              onClick={() => void handleExportDealInformation()}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              <Download className="h-4 w-4" />
              <span>导出</span>
            </button>
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
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          <span>{selectedDealIds.size > 0 ? `已选择 ${selectedDealIds.size} 个项目` : "勾选项目后可导出项目信息"}</span>
          {dealExportError && <span className="text-rose-500">{dealExportError}</span>}
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
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  title={selectedDealIds.has(d.id) ? "取消选择" : "选择项目"}
                  aria-pressed={selectedDealIds.has(d.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleDealSelection(d.id);
                  }}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                    selectedDealIds.has(d.id)
                      ? "border-blue-200 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-400 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  {selectedDealIds.has(d.id) ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
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
              preDDMaterialStatusError={preDDMaterialStatusError}
              onWorkspaceSummarySaved={(summary) =>
                setDetail((current) =>
                  current && current.id === detail.id
                    ? updateWorkspaceSummaryInDetail(current, summary)
                    : current
                )
              }
            />
          )}
        </section>
        <div className="shrink-0 border-t border-slate-200 bg-white p-4">
          <PageAssistant
            contextLabel={detail ? "项目详情" : "项目库"}
            contextSummary={assistantContext}
            placeholder={detail ? "基于当前项目提出需求..." : "基于当前项目库提出需求..."}
            references={assistantReferences}
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
