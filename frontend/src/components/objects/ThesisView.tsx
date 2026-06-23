import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Search, X } from "lucide-react";
import EvidencePanel from "../EvidencePanel";
import MarketSignalsPanel, { type MarketSignalViewItem } from "../MarketSignalsPanel";
import {
  ApiError,
  collectThesisMarketSignals,
  generateDealPool,
  triggerDeliverableAction,
} from "../../lib/api";
import {
  PREFERENCE_HREF,
  argumentFromEvidence,
  evidenceIds,
  evidenceTarget,
} from "../../lib/evidence";
import type { EvidenceArgument, EvidenceDialogState, EvidenceTarget } from "../../lib/evidence";
import type {
  Claim,
  EvidenceItem,
  MarketSignal,
  MarketSignalCategory,
  SubDirection,
  Thesis,
  ThesisAction,
  ValueChainSegment,
} from "../../lib/types";

type SegmentDialogState = {
  stage: string;
  segment: ValueChainSegment;
  materials: SegmentMaterial[];
};

type SegmentMaterial = {
  title: string;
  detail?: string;
  target: EvidenceTarget;
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

const EMPTY_EVIDENCE_ITEMS: EvidenceItem[] = [];

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

function primarySignalEvidence(
  signal: MarketSignal,
  evidenceById: Map<string, EvidenceItem>
): EvidenceItem | undefined {
  return evidenceIds(signal.summary)
    .map((id) => evidenceById.get(id))
    .find((item): item is EvidenceItem => Boolean(item));
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

function preferenceEvidenceArguments(preference?: Record<string, unknown>): EvidenceArgument[] {
  return preferenceEvidence(preference).map((row) => ({
    title: row,
    href: PREFERENCE_HREF,
    external: false,
    kind: "preference",
  }));
}

function argumentsForClaim(
  claim: Claim,
  evidenceById: Map<string, EvidenceItem>,
  options: {
    preference?: Record<string, unknown>;
    includePreference?: boolean;
  } = {}
): EvidenceArgument[] {
  const { preference, includePreference = false } = options;
  const ids = evidenceIds(claim);
  if (ids.length > 0) {
    return ids.map((id) => {
      const evidence = evidenceById.get(id);
      if (evidence) return argumentFromEvidence(evidence);
      return {
        title: `证据 ${id} 尚未返回来源详情`,
        detail: "请刷新交付物详情或检查证据是否仍属于当前机构。",
        kind: "inferred",
      };
    });
  }

  if (includePreference) {
    const prefArgs = preferenceEvidenceArguments(preference);
    if (prefArgs.length > 0) return prefArgs;
  }

  return [
    {
      title: claim.inferred ? "该论点当前为模型推断" : "该论点当前未绑定可追溯证据",
      detail: "未展示无关市场信号或投资偏好，避免论据与论点错配。",
      kind: "inferred",
    },
  ];
}

function buildEvidenceRows(
  title: string,
  claims: Claim[],
  evidenceById: Map<string, EvidenceItem>,
  preference?: Record<string, unknown>,
  options: { includePreference?: boolean } = {}
): EvidenceDialogState {
  const sourceClaims = claims.length > 0 ? claims : [syntheticClaim(title)];
  const rows = sourceClaims.map((claim) => ({
    point: claim.text,
    arguments: argumentsForClaim(claim, evidenceById, {
      preference,
      includePreference: options.includePreference,
    }),
  }));
  return { title, rows };
}

function buildSignalEvidenceRows(
  signal: MarketSignal,
  evidenceById: Map<string, EvidenceItem>
): EvidenceDialogState {
  const ids = evidenceIds(signal.summary);
  if (ids.length === 0) {
    return {
      title: signal.title,
      rows: [
        {
          point: signal.summary.text,
          arguments: [
            {
              title: "该市场信号尚未绑定具体来源",
              detail: "未展示搜索结果，避免把关键词搜索误当成证据来源。",
              kind: "inferred",
            },
          ],
        },
      ],
    };
  }

  return {
    title: signal.title,
    rows: ids.map((id) => {
      const evidence = evidenceById.get(id);
      return {
        point: signal.summary.text,
        arguments: evidence
          ? [argumentFromEvidence(evidence)]
          : [
              {
                title: `证据 ${id} 尚未返回来源详情`,
                detail: "请刷新交付物详情或检查证据是否仍属于当前机构。",
                kind: "inferred",
              },
            ],
      };
    }),
  };
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

function segmentMaterialsForSegment(
  segment: ValueChainSegment,
  thesis: Thesis,
  evidenceById: Map<string, EvidenceItem>
): SegmentMaterial[] {
  const materials: SegmentMaterial[] = [];
  const seen = new Set<string>();

  for (const signal of relatedSignalsForSegment(segment, thesis)) {
    for (const id of evidenceIds(signal.summary)) {
      const evidence = evidenceById.get(id);
      const target = evidenceTarget(evidence);
      if (!evidence || !target || seen.has(target.href)) continue;

      seen.add(target.href);
      materials.push({
        title: evidence.title || signal.title,
        detail: evidence.snippet || signal.summary.text,
        target,
      });
    }
  }

  return materials;
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

function SegmentDialog({ state, onClose }: { state: SegmentDialogState; onClose: () => void }) {
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
              {state.materials.length > 0 ? (
                state.materials.map((item) => (
                  <a
                    key={`${item.target.href}-${item.title}`}
                    href={item.target.href}
                    target={item.target.external ? "_blank" : undefined}
                    rel={item.target.external ? "noreferrer" : undefined}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.title}</span>
                      {item.detail && <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</span>}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700">
                      {item.target.label}
                      <ExternalLink className="h-4 w-4 text-indigo-600" />
                    </span>
                  </a>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm leading-6 text-slate-500">
                  当前环节暂无已绑定网页或项目材料来源。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueChainSection({
  thesis,
  evidenceById,
  onOpenSegment,
}: {
  thesis: Thesis;
  evidenceById: Map<string, EvidenceItem>;
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
                        materials: segmentMaterialsForSegment(segment, thesis, evidenceById),
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
  evidenceItems = EMPTY_EVIDENCE_ITEMS,
  currentPreference,
  onActionComplete,
}: {
  thesis: Thesis;
  deliverableId?: string;
  evidenceItems?: EvidenceItem[];
  currentPreference?: Record<string, unknown>;
  onActionComplete?: () => void;
}) {
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(null);
  const [segmentDialog, setSegmentDialog] = useState<SegmentDialogState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>(thesis.recent_signals ?? []);
  const [marketSignalCategory, setMarketSignalCategory] = useState<MarketSignalCategory | "all">("all");
  const [marketSignalBusy, setMarketSignalBusy] = useState(false);
  const [marketSignalError, setMarketSignalError] = useState<string | null>(null);
  const [marketSignalCollectedAt, setMarketSignalCollectedAt] = useState<string | null>(null);
  const [localEvidenceItems, setLocalEvidenceItems] = useState<EvidenceItem[]>(evidenceItems);
  const autoMarketSignalDeliverableRef = useRef<string | null>(null);
  const preferenceRows = useMemo(() => preferenceEvidence(currentPreference), [currentPreference]);
  const displayedThesis = useMemo<Thesis>(
    () => ({ ...thesis, recent_signals: marketSignals }),
    [thesis, marketSignals]
  );
  const evidenceById = useMemo(
    () => new Map(localEvidenceItems.map((item) => [item.id, item])),
    [localEvidenceItems]
  );
  const marketSignalViewItems = useMemo<MarketSignalViewItem[]>(
    () =>
      marketSignals.map((signal, index) => {
        const target = evidenceTarget(primarySignalEvidence(signal, evidenceById));
        return {
          id: evidenceIds(signal.summary)[0] ?? `${signal.title}-${index}`,
          title: signal.title,
          summary: signal.summary.text,
          category: signal.category,
          date: signal.signal_date,
          href: target?.href,
          hrefLabel: target?.label,
          external: target?.external,
          badges: [{ label: signalKindLabel(signal), tone: signal.kind }],
          action: target
            ? undefined
            : {
                label: "查看证据",
                icon: <FileText className="h-3.5 w-3.5" />,
                onClick: () => setEvidenceDialog(buildSignalEvidenceRows(signal, evidenceById)),
              },
        };
      }),
    [evidenceById, marketSignals]
  );

  const handleCollectMarketSignals = useCallback(async (options: { auto?: boolean } = {}) => {
    if (!deliverableId) {
      if (!options.auto) setMarketSignalError("当前对象缺少 deliverable_id，无法收集市场信号。");
      return;
    }
    setMarketSignalBusy(true);
    if (!options.auto) setMarketSignalError(null);
    try {
      const response = await collectThesisMarketSignals(deliverableId);
      setMarketSignals(response.payload.recent_signals ?? response.items ?? []);
      setLocalEvidenceItems(response.evidence_items ?? []);
      setMarketSignalCollectedAt(response.collected_at);
      setMarketSignalError(null);
    } catch (error) {
      if (!options.auto) {
        setMarketSignalError(error instanceof ApiError ? error.message : "收集市场信号失败");
      }
    } finally {
      setMarketSignalBusy(false);
    }
  }, [deliverableId]);

  useEffect(() => {
    setMarketSignals(thesis.recent_signals ?? []);
    setMarketSignalCategory("all");
    setMarketSignalError(null);
    setMarketSignalBusy(false);
    setMarketSignalCollectedAt(null);
    setLocalEvidenceItems(evidenceItems);
  }, [deliverableId, evidenceItems, thesis.recent_signals]);

  useEffect(() => {
    if (!deliverableId) return;
    const hasExistingSignals = (thesis.recent_signals ?? []).length > 0;
    if (hasExistingSignals) {
      autoMarketSignalDeliverableRef.current = deliverableId;
      return;
    }
    if (autoMarketSignalDeliverableRef.current === deliverableId) return;
    autoMarketSignalDeliverableRef.current = deliverableId;
    void handleCollectMarketSignals({ auto: true });
  }, [deliverableId, thesis.recent_signals, handleCollectMarketSignals]);

  function openEvidence(
    title: string,
    claims: Claim[],
    options: { includePreference?: boolean } = {}
  ) {
    setEvidenceDialog(
      buildEvidenceRows(title, claims, evidenceById, currentPreference, options)
    );
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
              ], { includePreference: true })
            }
          />
          <InfoModule
            label="建议"
            value={thesis.advice}
            description={preferenceRows.length > 0 ? preferenceRows[0] : "结合当前偏好和市场信号给出。"}
            onEvidence={() => openEvidence("建议", [syntheticClaim(thesis.advice)], { includePreference: true })}
          />
        </div>
      </section>

      <MarketSignalsPanel
        signals={marketSignalViewItems}
        selectedCategory={marketSignalCategory}
        busy={marketSignalBusy}
        error={marketSignalError}
        lastCollectedAt={marketSignalCollectedAt}
        onCategoryChange={setMarketSignalCategory}
        onRefresh={() => void handleCollectMarketSignals()}
        busyText="正在收集赛道相关市场信号..."
        itemContainerClassName="max-h-72 space-y-2 overflow-y-auto pr-1"
        itemClassName="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left"
      />

      <ValueChainSection thesis={displayedThesis} evidenceById={evidenceById} onOpenSegment={setSegmentDialog} />

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

      {evidenceDialog && <EvidencePanel state={evidenceDialog} onClose={() => setEvidenceDialog(null)} />}
      {segmentDialog && <SegmentDialog state={segmentDialog} onClose={() => setSegmentDialog(null)} />}
    </div>
  );
}
