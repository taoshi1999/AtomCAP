import { useMemo, useState } from "react";
import { ExternalLink, FileText, Loader2, Search, X } from "lucide-react";
import {
  ApiError,
  generateDealPool,
  triggerDeliverableAction,
} from "../../lib/api";
import type {
  Claim,
  MarketSignal,
  SubDirection,
  Thesis,
  ThesisAction,
  ValueChainSegment,
} from "../../lib/types";

type EvidenceRow = {
  point: string;
  arguments: string[];
};

type EvidenceDialogState = {
  title: string;
  rows: EvidenceRow[];
};

type SegmentDialogState = {
  stage: string;
  segment: ValueChainSegment;
  relatedSignals: MarketSignal[];
  thesisName: string;
};

type ActionNotice = {
  tone: "info" | "success" | "error";
  text: string;
};

const SUB_ACTIONS: Array<{ action: ThesisAction; label: string; tone?: "primary" | "danger" }> = [
  { action: "generate_deal_pool", label: "生成项目池", tone: "primary" },
  { action: "generate_briefing", label: "深入分析" },
  { action: "join_project_library", label: "加入项目库" },
  { action: "dismiss_track", label: "不感兴趣", tone: "danger" },
];

function compactError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}

function syntheticClaim(text: string): Claim {
  return { text, evidence_ids: [], inferred: true };
}

function publicSearchUrl(query: string): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

function signalKindLabel(signal: MarketSignal): string {
  return signal.kind === "structural" ? "结构性" : "热度";
}

function signalText(signal: MarketSignal): string {
  return `${signal.title} ${signal.summary?.text ?? ""}`;
}

function evidenceIds(claim: Claim | undefined): string[] {
  return claim?.evidence_ids ?? [];
}

function hasEvidenceOverlap(claim: Claim, signal: MarketSignal): boolean {
  const ids = new Set(evidenceIds(claim));
  if (ids.size === 0) return false;
  return evidenceIds(signal.summary).some((id) => ids.has(id));
}

function extractTerms(text: string): string[] {
  const normalized = text.replace(/[，,。.；;、:：()（）\[\]【】]/g, " ");
  const chunks = normalized
    .split(/\s+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length >= 2);
  if (chunks.length > 0) return chunks.slice(0, 8);
  const compact = normalized.replace(/\s+/g, "").toLowerCase();
  if (compact.length >= 4) return [compact.slice(0, 4)];
  return compact ? [compact] : [];
}

function looselyMatches(claim: Claim, signal: MarketSignal): boolean {
  const hay = signalText(signal).toLowerCase();
  return extractTerms(claim.text).some((term) => hay.includes(term));
}

function relatedSignalsForClaim(claim: Claim, thesis: Thesis): MarketSignal[] {
  const direct = thesis.recent_signals.filter((signal) => hasEvidenceOverlap(claim, signal));
  if (direct.length > 0) return direct.slice(0, 4);
  return thesis.recent_signals.filter((signal) => looselyMatches(claim, signal)).slice(0, 3);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          if (typeof obj.label === "string") return obj.label;
          if (typeof obj.name === "string") return obj.name;
          if (typeof obj.value === "string") return obj.value;
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function preferenceEvidence(preference?: Record<string, unknown>): string[] {
  if (!preference || Object.keys(preference).length === 0) return [];
  const rows: string[] = [];
  const schema: Array<{ label: string; keys: string[] }> = [
    { label: "当前偏好名称", keys: ["name", "profile_name"] },
    { label: "关注赛道", keys: ["sectors", "track_preferences", "focus_sectors"] },
    { label: "投资阶段", keys: ["stages", "stage_preferences", "preferred_stages"] },
    { label: "地域偏好", keys: ["regions", "geographies", "geo_preferences"] },
    { label: "风险偏好", keys: ["risk_levels", "risk_appetite", "risk_preferences"] },
    { label: "投资规模", keys: ["check_sizes", "ticket_size", "check_size"] },
  ];

  for (const item of schema) {
    const value = item.keys.map((key) => preference[key]).find((v) => v !== undefined);
    const values = asStringArray(value);
    if (values.length > 0) rows.push(`${item.label}: ${values.join("、")}`);
  }

  const custom = preference.custom_dimensions;
  if (Array.isArray(custom)) {
    for (const item of custom) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const label = typeof obj.label === "string" ? obj.label : typeof obj.key === "string" ? obj.key : "自定义维度";
      const values = asStringArray(obj.values);
      if (values.length > 0) rows.push(`${label}: ${values.join("、")}`);
    }
  }

  if (rows.length > 0) return rows;
  return Object.entries(preference)
    .slice(0, 4)
    .map(([key, value]) => {
      const values = asStringArray(value);
      return values.length > 0 ? `${key}: ${values.join("、")}` : `${key}: ${JSON.stringify(value)}`;
    });
}

function buildEvidenceRows(
  title: string,
  claims: Claim[],
  thesis: Thesis,
  preference?: Record<string, unknown>
): EvidenceDialogState {
  const prefEvidence = preferenceEvidence(preference);
  const sourceClaims = claims.length > 0 ? claims : [syntheticClaim(title)];
  const rows = sourceClaims.map((claim) => {
    const signalArguments = relatedSignalsForClaim(claim, thesis).map(
      (signal) => `${signalKindLabel(signal)}信号: ${signal.title} - ${signal.summary.text}`
    );
    const args = [...signalArguments, ...prefEvidence.slice(0, 4)];
    return {
      point: claim.text,
      arguments: args.length > 0 ? args : ["当前交付物中暂无可用市场信号或投资偏好论据。"],
    };
  });
  return { title, rows };
}

function relatedSignalsForSegment(segment: ValueChainSegment, thesis: Thesis): MarketSignal[] {
  const terms = [segment.name, ...(segment.examples ?? [])].flatMap(extractTerms);
  if (terms.length === 0) return thesis.recent_signals.slice(0, 3);
  return thesis.recent_signals
    .filter((signal) => {
      const hay = signalText(signal).toLowerCase();
      return terms.some((term) => hay.includes(term));
    })
    .slice(0, 4);
}

function InfoModule({
  label,
  value,
  description,
  onEvidence,
}: {
  label: string;
  value: string;
  description?: string;
  onEvidence: () => void;
}) {
  return (
    <div className="flex min-h-[132px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
      {description && <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{description}</div>}
      <button
        type="button"
        onClick={onEvidence}
        className="mt-auto inline-flex items-center gap-1.5 self-start rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        <FileText className="h-3.5 w-3.5" />
        查看证据链
      </button>
    </div>
  );
}

function EvidenceDialog({ state, onClose }: { state: EvidenceDialogState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">{state.title} · 证据链</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[1.1fr_1.5fr] bg-slate-50 text-xs font-bold text-slate-500">
              <div className="border-r border-slate-200 px-4 py-3">论点</div>
              <div className="px-4 py-3">论据</div>
            </div>
            {state.rows.map((row, index) => (
              <div key={`${row.point}-${index}`} className="grid grid-cols-[1.1fr_1.5fr] border-t border-slate-200 text-sm">
                <div className="border-r border-slate-200 px-4 py-3 font-medium leading-6 text-slate-800">
                  {row.point}
                </div>
                <div className="space-y-2 px-4 py-3">
                  {row.arguments.map((argument, i) => (
                    <div key={`${argument}-${i}`} className="rounded-md bg-slate-50 px-3 py-2 leading-6 text-slate-700">
                      {argument}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentDialog({ state, onClose }: { state: SegmentDialogState; onClose: () => void }) {
  const materials =
    state.relatedSignals.length > 0
      ? state.relatedSignals.map((signal) => ({
          title: signal.title,
          href: publicSearchUrl(`${state.thesisName} ${signal.title}`),
        }))
      : [
          {
            title: `${state.thesisName} ${state.segment.name} 公开资料`,
            href: publicSearchUrl(`${state.thesisName} ${state.segment.name} 行业 资料`),
          },
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">{state.segment.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{state.stage}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p>
              {state.segment.name}
              {state.segment.examples?.length ? ` 代表方向包括 ${state.segment.examples.join("、")}。` : " 当前暂无代表方向。"}
            </p>
            {state.segment.margin_potential && <p>毛利率潜力：{state.segment.margin_potential}</p>}
            {state.segment.entry_difficulty && <p>进入难度：{state.segment.entry_difficulty}</p>}
            {state.segment.suitable_stage && <p>适合阶段：{state.segment.suitable_stage}</p>}
            {state.segment.preference_fit && <p>偏好匹配：{state.segment.preference_fit}</p>}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">相关资料</h3>
            <div className="mt-2 space-y-2">
              {materials.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <span className="line-clamp-1">{item.title}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-indigo-600" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketSignalsSection({ thesis }: { thesis: Thesis }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">近期市场信号</h3>
        <span className="text-xs text-slate-400">{thesis.recent_signals.length} 条</span>
      </div>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {thesis.recent_signals.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400">
            当前 Thesis 暂无近期市场信号。
          </div>
        )}
        {thesis.recent_signals.map((signal, index) => (
          <div key={`${signal.title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      signal.kind === "structural"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"
                    }
                  >
                    {signalKindLabel(signal)}
                  </span>
                  {signal.signal_date && <span className="text-xs text-slate-400">{signal.signal_date}</span>}
                </div>
                <div className="mt-1 font-semibold text-slate-900">{signal.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{signal.summary.text}</p>
              </div>
              <a
                href={publicSearchUrl(`${thesis.thesis_name} ${signal.title}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                查看详情
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValueChainSection({
  thesis,
  onOpenSegment,
}: {
  thesis: Thesis;
  onOpenSegment: (state: SegmentDialogState) => void;
}) {
  const groups: Array<{ label: string; items: ValueChainSegment[] }> = [
    { label: "上游", items: thesis.value_chain.upstream },
    { label: "中游", items: thesis.value_chain.midstream },
    { label: "下游", items: thesis.value_chain.downstream },
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">产业链</h3>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 text-xs font-bold text-slate-500">{group.label}</div>
            {group.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400">
                暂无{group.label}环节数据
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((segment) => (
                  <button
                    key={`${group.label}-${segment.name}`}
                    type="button"
                    onClick={() =>
                      onOpenSegment({
                        stage: group.label,
                        segment,
                        relatedSignals: relatedSignalsForSegment(segment, thesis),
                        thesisName: thesis.thesis_name,
                      })
                    }
                    className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <div className="font-semibold text-slate-900">{segment.name}</div>
                    {segment.examples?.length ? (
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500">{segment.examples.join("、")}</div>
                    ) : null}
                    {segment.preference_fit && (
                      <div className="mt-2 text-xs leading-5 text-slate-600">{segment.preference_fit}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thesis.value_chain.customers.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-bold text-slate-500">终端客户</div>
            <div className="flex flex-wrap gap-2">
              {thesis.value_chain.customers.map((customer) => (
                <a
                  key={customer}
                  href={publicSearchUrl(`${thesis.thesis_name} ${customer}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"
                >
                  {customer}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function actionButtonClass(tone?: "primary" | "danger"): string {
  if (tone === "primary") {
    return "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:border-slate-200 disabled:bg-slate-200";
  }
  if (tone === "danger") {
    return "border-rose-200 text-rose-600 hover:bg-rose-50 disabled:text-slate-400";
  }
  return "border-slate-200 text-slate-700 hover:bg-slate-50 disabled:text-slate-400";
}

export default function ThesisView({
  thesis,
  deliverableId,
  currentPreference,
  onActionComplete,
}: {
  thesis: Thesis;
  deliverableId?: string;
  currentPreference?: Record<string, unknown>;
  onActionComplete?: () => void;
}) {
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(null);
  const [segmentDialog, setSegmentDialog] = useState<SegmentDialogState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const preferenceRows = useMemo(() => preferenceEvidence(currentPreference), [currentPreference]);

  function openEvidence(title: string, claims: Claim[]) {
    setEvidenceDialog(buildEvidenceRows(title, claims, thesis, currentPreference));
  }

  async function runSubAction(action: ThesisAction, sub: SubDirection) {
    if (!deliverableId) {
      setNotice({ tone: "error", text: "当前对象缺少 deliverable_id，无法执行动作。" });
      return;
    }
    const key = `${action}:${sub.name}`;
    setBusyAction(key);
    setNotice(null);
    try {
      if (action === "generate_deal_pool") {
        let streamError = "";
        await generateDealPool(
          deliverableId,
          {
            onProgress(text) {
              if (text) setNotice({ tone: "info", text });
            },
            onObject(ref) {
              if (ref.deliverable_id) {
                setNotice({ tone: "success", text: `项目池已生成，交付物 ID: ${ref.deliverable_id}` });
              }
            },
            onError(text) {
              streamError = text || "生成项目池失败";
              setNotice({ tone: "error", text: streamError });
            },
          },
          { source_sub_direction: sub.name }
        );
        if (streamError) throw new Error(streamError);
        setNotice({ tone: "success", text: `已根据「${sub.name}」发起项目池生成。` });
      } else {
        await triggerDeliverableAction(deliverableId, action, { source_sub_direction: sub.name });
        const label = SUB_ACTIONS.find((item) => item.action === action)?.label ?? action;
        setNotice({ tone: "success", text: `已执行「${label}」：${sub.name}` });
      }
      onActionComplete?.();
    } catch (error) {
      setNotice({ tone: "error", text: compactError(error) });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="w-full space-y-4">
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">{thesis.thesis_name}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{thesis.one_line_view}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoModule
            label="机会等级"
            value={thesis.opportunity_level}
            description={thesis.one_line_view}
            onEvidence={() => openEvidence("机会等级", thesis.investment_reason)}
          />
          <InfoModule
            label="风险等级"
            value={thesis.risk_level}
            description={thesis.key_risks[0]?.text}
            onEvidence={() => openEvidence("风险等级", thesis.key_risks)}
          />
          <InfoModule
            label="与本机构匹配度"
            value={`${Math.round(thesis.institution_fit_score.total)} 分`}
            description={thesis.institution_fit_score.rationale}
            onEvidence={() =>
              openEvidence("与本机构匹配度", [
                syntheticClaim(`匹配度 ${Math.round(thesis.institution_fit_score.total)} 分：${thesis.institution_fit_score.rationale}`),
              ])
            }
          />
          <InfoModule
            label="建议"
            value={thesis.advice}
            description={preferenceRows.length > 0 ? preferenceRows[0] : "结合当前偏好和市场信号给出。"}
            onEvidence={() => openEvidence("建议", [syntheticClaim(thesis.advice)])}
          />
        </div>
      </section>

      <MarketSignalsSection thesis={thesis} />

      <ValueChainSection thesis={thesis} onOpenSegment={setSegmentDialog} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">子赛道</h3>
          <span className="text-xs text-slate-400">{thesis.sub_directions.length} 个</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {thesis.sub_directions.map((sub) => (
            <div key={sub.name} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-950">{sub.name}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{sub.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                  匹配 {Math.round(sub.fit_score.total)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <div>适合阶段：{sub.suitable_stage}</div>
                <div className="truncate" title={sub.fit_score.rationale}>
                  匹配依据：{sub.fit_score.rationale}
                </div>
              </div>
              {sub.representative_companies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sub.representative_companies.map((company) => (
                    <span key={company.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {company.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEvidence(`${sub.name} 推荐依据`, sub.investment_reasons)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  查看证据链
                </button>
                {SUB_ACTIONS.map((item) => {
                  const key = `${item.action}:${sub.name}`;
                  const busy = busyAction === key;
                  return (
                    <button
                      key={item.action}
                      type="button"
                      disabled={!!busyAction}
                      onClick={() => void runSubAction(item.action, sub)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed ${actionButtonClass(item.tone)}`}
                    >
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {notice && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice.tone === "error"
                ? "bg-rose-50 text-rose-700"
                : notice.tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-indigo-50 text-indigo-700"
            }`}
          >
            {notice.text}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">风险点</h3>
          <span className="text-xs text-slate-400">{thesis.key_risks.length} 条</span>
        </div>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {thesis.key_risks.map((risk, index) => (
            <button
              key={`${risk.text}-${index}`}
              type="button"
              onClick={() => openEvidence("风险点", [risk])}
              className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 text-left hover:border-rose-200 hover:bg-rose-50"
            >
              <span className="text-sm leading-6 text-slate-700">{risk.text}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-600">
                证据链
                <Search className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {evidenceDialog && <EvidenceDialog state={evidenceDialog} onClose={() => setEvidenceDialog(null)} />}
      {segmentDialog && <SegmentDialog state={segmentDialog} onClose={() => setSegmentDialog(null)} />}
    </div>
  );
}
