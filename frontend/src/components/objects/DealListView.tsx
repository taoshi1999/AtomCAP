import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  ShieldAlert,
  ThumbsDown,
} from "lucide-react";
import EvidencePanel from "../EvidencePanel";
import { ApiError, createDeal, triggerDealAction, type CreateDealPayload } from "../../lib/api";
import { argumentFromEvidence, evidenceIds } from "../../lib/evidence";
import type { EvidenceDialogState } from "../../lib/evidence";
import type {
  Claim,
  DealCandidate,
  DealListDeliverable,
  DealSummary,
  EvidenceItem,
  FitScoreBreakdown,
  RecommendationTier,
} from "../../lib/types";

type CandidateBusy = "library" | "workspace" | "dismiss";
type LibraryFilter = "all" | "in_library" | "not_in_library";

interface CandidateState {
  deal?: DealSummary;
  busy?: CandidateBusy;
  dismissed?: boolean;
  notice?: string;
  error?: string;
}

const TIER_META: Record<RecommendationTier, { label: string; className: string }> = {
  strong: {
    label: "强推荐",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  watch: {
    label: "可关注",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  observe: {
    label: "待观察",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  reject: {
    label: "不推荐",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

const SOURCE_LABEL: Record<string, string> = {
  thesis_generated: "赛道生成",
  public_signal_mining: "公开信号挖掘",
  system_push: "系统推送",
  user_input: "用户录入",
  bp_upload: "BP 上传",
  fa_recommendation: "FA 推荐",
  internal_excel: "内部表格",
};

const REFERENCE_SOURCE_LABEL: Record<string, string> = {
  official_website: "官网",
  web_search: "网页",
  news: "新闻",
  funding: "融资",
  patent: "专利",
  academic: "论文",
  company_registry: "工商",
  company_shareholder: "股东",
  company_investment: "对外投资",
};

const SCORE_FIELDS: Array<[keyof FitScoreBreakdown, string]> = [
  ["track_preference", "赛道"],
  ["stage_match", "阶段"],
  ["moat_match", "壁垒"],
  ["geo_match", "地域"],
  ["risk_appetite_match", "风险"],
  ["history_similarity", "历史"],
  ["exclusion_penalty", "扣分"],
];

function candidateKey(candidate: DealCandidate, index: number): string {
  return candidate.company_id || `${candidate.company_name}-${index}`;
}

function sourceLabel(source?: string | null): string {
  if (!source) return "未知来源";
  return SOURCE_LABEL[source] ?? source;
}

function tierMeta(tier?: string | null): { label: string; className: string } {
  if (tier && tier in TIER_META) return TIER_META[tier as RecommendationTier];
  return {
    label: tier || "未分层",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  };
}

function scoreValue(candidate: DealCandidate): number | null {
  const score = candidate.fit_score?.total ?? candidate.initial_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function formatScore(candidate: DealCandidate): string {
  const score = scoreValue(candidate);
  return score == null ? "未评分" : `${Math.round(score)} 分`;
}

function normalizeClaims(value: Claim[] | null | undefined): Claim[] {
  return Array.isArray(value) ? value : [];
}

function claimText(claim: Claim | undefined): string {
  return claim?.text?.trim() || "未提供说明";
}

function compactText(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function safeLinks(candidate: DealCandidate) {
  const links = Array.isArray(candidate.reference_links) ? candidate.reference_links : [];
  const seen = new Set<string>();
  const normalized = links.filter((link) => {
    const url = link.url?.trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  const official = candidate.official_website?.trim();
  if (official && /^https?:\/\//i.test(official) && !seen.has(official)) {
    normalized.unshift({
      title: `${candidate.company_name} 官网/主页`,
      url: official,
      source_type: "official_website",
    });
  }
  return normalized.slice(0, 5);
}

function referenceSourceLabel(source?: string | null): string {
  if (!source) return "资料";
  return REFERENCE_SOURCE_LABEL[source] ?? source;
}

function clampMultiline(text: string, maxLength = 1900): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...`;
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "操作失败，请确认后端服务正常";
}

function buildSourceNote(pool: DealListDeliverable, candidate: DealCandidate): string {
  const selectionReasons = normalizeClaims(candidate.selection_reasons);
  const recommendationReasons = normalizeClaims(candidate.recommendation_reasons);
  const initialRisks = normalizeClaims(candidate.initial_risks);
  const fitScore = candidate.fit_score;

  const sections: string[] = [
    `项目池：${pool.name || "候选项目池"}`,
    `项目池来源：${sourceLabel(pool.source_type)}`,
    `候选来源：${sourceLabel(candidate.source_type)}`,
  ];

  if (pool.search_themes?.length) sections.push(`搜索主题：${pool.search_themes.join("、")}`);
  if (candidate.sub_direction) sections.push(`子方向：${candidate.sub_direction}`);
  if (candidate.uscc) sections.push(`统一社会信用代码：${candidate.uscc}`);
  if (candidate.official_website) sections.push(`官网/主页：${candidate.official_website}`);
  if (scoreValue(candidate) != null) sections.push(`初始评分：${formatScore(candidate)}`);
  if (fitScore?.rationale) sections.push(`匹配度说明：${fitScore.rationale}`);
  const links = safeLinks(candidate);
  if (links.length) {
    sections.push("相关资料：", ...links.map((link) => `- ${link.title || "相关资料"}：${link.url}`));
  }

  if (selectionReasons.length) {
    sections.push(
      "筛选理由：",
      ...selectionReasons.slice(0, 5).map((claim) => `- ${claimText(claim)}`)
    );
  }
  if (recommendationReasons.length) {
    sections.push(
      "推荐理由：",
      ...recommendationReasons.slice(0, 5).map((claim) => `- ${claimText(claim)}`)
    );
  }
  if (initialRisks.length) {
    sections.push(
      "初始风险：",
      ...initialRisks.slice(0, 5).map((claim) => `- ${claimText(claim)}`)
    );
  }

  return sections.join("\n");
}

function buildCreateDealPayload(
  pool: DealListDeliverable,
  candidate: DealCandidate
): CreateDealPayload {
  const firstReason =
    normalizeClaims(candidate.recommendation_reasons)[0] ??
    normalizeClaims(candidate.selection_reasons)[0];
  return {
    company_name: candidate.company_name,
    one_line_intro: compactText(
      firstReason?.text?.trim() ||
        pool.summary ||
        `${candidate.company_name} 是项目池中筛选出的候选项目。`,
      160
    ),
    track: pool.search_themes?.[0] ?? null,
    sub_direction: candidate.sub_direction ?? null,
    source_note: clampMultiline(buildSourceNote(pool, candidate)),
  };
}

function buildClaimEvidenceDialog(
  title: string,
  claim: Claim,
  evidenceById: Map<string, EvidenceItem>
): EvidenceDialogState {
  const ids = evidenceIds(claim);
  return {
    title,
    rows: [
      {
        point: claimText(claim),
        arguments:
          ids.length > 0
            ? ids.map((id) => {
                const evidence = evidenceById.get(id);
                if (evidence) return argumentFromEvidence(evidence);
                return {
                  title: `证据 ${id} 尚未返回来源详情`,
                  detail: "请刷新交付物详情或检查证据是否仍属于当前机构。",
                  kind: "inferred",
                };
              })
            : [
                {
                  title: claim.inferred ? "该观点当前为模型推断" : "该观点当前未绑定可追溯证据",
                  detail: "暂无可打开的支撑材料。",
                  kind: "inferred",
                },
              ],
      },
    ],
  };
}

function ClaimList({
  claims,
  emptyText,
  evidenceTitle,
  evidenceById,
  onOpenEvidence,
}: {
  claims: Claim[];
  emptyText: string;
  evidenceTitle: string;
  evidenceById: Map<string, EvidenceItem>;
  onOpenEvidence: (state: EvidenceDialogState) => void;
}) {
  if (!claims.length) {
    return <p className="text-xs text-slate-400">{emptyText}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {claims.map((claim, index) => {
        const evidenceCount = Array.isArray(claim.evidence_ids) ? claim.evidence_ids.length : 0;
        return (
          <li key={`${claim.text}-${index}`} className="rounded-lg bg-slate-50 px-2.5 py-2">
            <p className="text-xs leading-5 text-slate-700">{claimText(claim)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              {claim.inferred && <span>模型推断</span>}
              <span>{evidenceCount} 条证据</span>
              <button
                type="button"
                onClick={() => onOpenEvidence(buildClaimEvidenceDialog(evidenceTitle, claim, evidenceById))}
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

function FitScoreDetails({ score }: { score?: FitScoreBreakdown | null }) {
  if (!score) return null;

  return (
    <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-slate-600">
        匹配度拆解
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_FIELDS.map(([key, label]) => (
          <div key={key} className="rounded-md bg-slate-50 px-2 py-1.5">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className="text-sm font-semibold text-slate-800">{Math.round(Number(score[key]))}</div>
          </div>
        ))}
      </div>
      {score.rationale && <p className="mt-2 text-xs leading-5 text-slate-500">{score.rationale}</p>}
    </details>
  );
}

function CandidateReferenceLinks({ candidate }: { candidate: DealCandidate }) {
  const links = safeLinks(candidate);
  if (!links.length) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
        暂无可打开的相关资料。
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Link2 className="h-3.5 w-3.5 text-indigo-500" />
        相关资料
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
            title={link.title || link.url}
          >
            <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">
              {referenceSourceLabel(link.source_type)}
            </span>
            <span className="max-w-[16rem] truncate">{link.title || link.url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

function CandidateActionButton({
  busy,
  disabled,
  icon,
  label,
  onClick,
  tone = "default",
}: {
  busy: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "primary";
}) {
  const className =
    tone === "primary"
      ? "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700"
      : tone === "danger"
        ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-600";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

export default function DealListView({
  payload,
  evidenceItems = [],
}: {
  payload: DealListDeliverable;
  evidenceItems?: EvidenceItem[];
}) {
  const navigate = useNavigate();
  const [candidateStates, setCandidateStates] = useState<Record<string, CandidateState>>({});
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(null);

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const searchThemes = Array.isArray(payload.search_themes) ? payload.search_themes : [];
  const evidenceById = useMemo(
    () => new Map(evidenceItems.map((item) => [item.id, item])),
    [evidenceItems]
  );

  function isCandidateInLibrary(candidate: DealCandidate, index: number) {
    const key = candidateKey(candidate, index);
    return Boolean(candidate.is_in_library || candidateStates[key]?.deal);
  }

  const candidateEntries = candidates.map((candidate, index) => ({
    candidate,
    index,
    inLibrary: isCandidateInLibrary(candidate, index),
  }));
  const libraryCounts = {
    all: candidateEntries.length,
    in_library: candidateEntries.filter((entry) => entry.inLibrary).length,
    not_in_library: candidateEntries.filter((entry) => !entry.inLibrary).length,
  };
  const visibleCandidateEntries = candidateEntries.filter((entry) => {
    if (libraryFilter === "in_library") return entry.inLibrary;
    if (libraryFilter === "not_in_library") return !entry.inLibrary;
    return true;
  });

  function updateCandidateState(key: string, patch: CandidateState) {
    setCandidateStates((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  async function persistAndRun(
    candidate: DealCandidate,
    index: number,
    busy: CandidateBusy,
    perform: (deal: DealSummary) => Promise<Partial<CandidateState> | void>,
    afterSuccess?: (deal: DealSummary) => void
  ) {
    const key = candidateKey(candidate, index);
    updateCandidateState(key, { busy, error: undefined, notice: undefined });

    try {
      let deal = candidateStates[key]?.deal;
      if (!deal) {
        deal = await createDeal(buildCreateDealPayload(payload, candidate));
        updateCandidateState(key, { deal });
      }

      const result = await perform(deal);
      updateCandidateState(key, {
        deal,
        busy: undefined,
        error: undefined,
        ...(result ?? {}),
      });
      afterSuccess?.(deal);
    } catch (error) {
      updateCandidateState(key, {
        busy: undefined,
        error: apiErrorMessage(error),
      });
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600">
            <BriefcaseBusiness className="h-4 w-4" />
            项目池
          </div>
          <h2 className="truncate text-xl font-bold text-slate-950">
            {payload.name || "候选项目池"}
          </h2>
          {payload.summary && (
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{payload.summary}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              来源：{sourceLabel(payload.source_type)}
            </span>
            {searchThemes.map((theme) => (
              <span key={theme} className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                {theme}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["all", "全部", libraryCounts.all],
              ["in_library", "已在项目库中", libraryCounts.in_library],
              ["not_in_library", "未在项目库中", libraryCounts.not_in_library],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLibraryFilter(key as LibraryFilter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  libraryFilter === key
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-right">
          <div className="text-2xl font-bold text-slate-950">{candidates.length}</div>
          <div className="text-xs text-slate-400">候选项目</div>
        </div>
      </header>

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
          本次没有发现候选项目。可调整需求、赛道或数据源后重新生成项目池。
        </div>
      ) : (
        <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
          {visibleCandidateEntries.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
              当前筛选条件下暂无候选项目。
            </div>
          )}
          {visibleCandidateEntries.map(({ candidate, index, inLibrary }) => {
            const key = candidateKey(candidate, index);
            const state = candidateStates[key] ?? {};
            const tier = tierMeta(candidate.recommendation_tier);
            const recommendationReasons = normalizeClaims(candidate.recommendation_reasons);
            const initialRisks = normalizeClaims(candidate.initial_risks);
            const isBusy = Boolean(state.busy);
            const existingDealId = state.deal?.id ?? candidate.deal_id ?? null;

            return (
              <article
                key={key}
                className={`rounded-xl border border-slate-200 bg-white p-4 transition ${
                  state.dismissed ? "opacity-60" : "hover:border-indigo-200 hover:shadow-sm"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${tier.className}`}>
                        {tier.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                        {sourceLabel(candidate.source_type)}
                      </span>
                      {inLibrary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          已在项目库中
                        </span>
                      )}
                      {state.dismissed && (
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-600">
                          不感兴趣
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-950">{candidate.company_name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {candidate.sub_direction && <span>方向：{candidate.sub_direction}</span>}
                      {candidate.uscc && <span>统一社会信用代码：{candidate.uscc}</span>}
                      {candidate.aliases?.length > 0 && <span>别名：{candidate.aliases.join("、")}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-slate-50 px-4 py-3 text-right">
                    <div className="text-2xl font-bold text-slate-950">{formatScore(candidate)}</div>
                    <div className="text-xs text-slate-400">初始评分</div>
                  </div>
                </div>

                <CandidateReferenceLinks candidate={candidate} />

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-indigo-500" />
                      推荐理由
                    </div>
                    <ClaimList
                      claims={recommendationReasons}
                      emptyText="暂无推荐理由"
                      evidenceTitle={`${candidate.company_name} 推荐理由`}
                      evidenceById={evidenceById}
                      onOpenEvidence={setEvidenceDialog}
                    />
                  </section>
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      风险点
                    </div>
                    <ClaimList
                      claims={initialRisks}
                      emptyText="暂无风险点"
                      evidenceTitle={`${candidate.company_name} 风险点`}
                      evidenceById={evidenceById}
                      onOpenEvidence={setEvidenceDialog}
                    />
                  </section>
                </div>

                <div className="mt-4">
                  <FitScoreDetails score={candidate.fit_score} />
                </div>

                {(state.notice || state.error) && (
                  <div
                    className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${
                      state.error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {state.error ? (
                      <CircleAlert className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {state.error || state.notice}
                  </div>
                )}

                <footer className="mt-4 flex flex-wrap gap-2">
                  <CandidateActionButton
                    busy={state.busy === "library"}
                    disabled={isBusy || inLibrary || state.dismissed === true}
                    icon={<Plus className="h-3.5 w-3.5" />}
                    label={inLibrary ? "已在项目库中" : "加入项目库"}
                    onClick={() =>
                      void persistAndRun(candidate, index, "library", async (deal) => {
                        await triggerDealAction(deal.id, "add_to_library");
                        return { notice: "已加入项目库", dismissed: false };
                      })
                    }
                    tone="primary"
                  />
                  <CandidateActionButton
                    busy={state.busy === "workspace"}
                    disabled={isBusy || state.dismissed === true}
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                    label={existingDealId ? "查看工作台" : "创建工作台"}
                    onClick={() => {
                      if (existingDealId) {
                        navigate(`/workspace/${existingDealId}`);
                        return;
                      }
                      void persistAndRun(
                        candidate,
                        index,
                        "workspace",
                        async (deal) => {
                          await triggerDealAction(deal.id, "create_workspace");
                          return { notice: "工作台已创建", dismissed: false };
                        },
                        (deal) => navigate(`/workspace/${deal.id}`)
                      );
                    }}
                  />
                  <CandidateActionButton
                    busy={state.busy === "dismiss"}
                    disabled={isBusy || state.dismissed === true}
                    icon={<ThumbsDown className="h-3.5 w-3.5" />}
                    label="不感兴趣"
                    onClick={() => {
                      if (existingDealId) {
                        updateCandidateState(key, {
                          busy: "dismiss",
                          error: undefined,
                          notice: undefined,
                        });
                        void triggerDealAction(existingDealId, "dismiss")
                          .then(() => {
                            updateCandidateState(key, {
                              busy: undefined,
                              notice: "已标记不感兴趣",
                              dismissed: true,
                            });
                          })
                          .catch((error) => {
                            updateCandidateState(key, {
                              busy: undefined,
                              error: apiErrorMessage(error),
                            });
                          });
                        return;
                      }
                      void persistAndRun(candidate, index, "dismiss", async (deal) => {
                        await triggerDealAction(deal.id, "dismiss");
                        return { notice: "已标记不感兴趣", dismissed: true };
                      });
                    }}
                    tone="danger"
                  />
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {evidenceDialog && <EvidencePanel state={evidenceDialog} onClose={() => setEvidenceDialog(null)} />}
    </section>
  );
}
