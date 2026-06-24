import type { ReactNode } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { MarketSignalCategory } from "../lib/types";

export const MARKET_SIGNAL_CATEGORY_LABELS: Record<MarketSignalCategory, string> = {
  finance_news: "财经新闻",
  business_registry: "工商信息",
  patent: "专利信息",
  paper: "学术论文",
  personnel: "人事变动",
};

export const MARKET_SIGNAL_CATEGORIES: MarketSignalCategory[] = [
  "finance_news",
  "business_registry",
  "patent",
  "paper",
  "personnel",
];

export type MarketSignalViewItem = {
  id: string;
  title: string;
  summary?: string | null;
  analysis?: string | null;
  category?: MarketSignalCategory | null;
  date?: string | null;
  connector?: string | null;
  collectedAt?: string | null;
  href?: string | null;
  hrefLabel?: string;
  external?: boolean;
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  badges?: Array<{
    label: string;
    tone?: "heat" | "structural" | "neutral";
  }>;
};

type MarketSignalsPanelProps = {
  signals: MarketSignalViewItem[];
  selectedCategory: MarketSignalCategory | "all";
  busy: boolean;
  error: string | null;
  onCategoryChange: (category: MarketSignalCategory | "all") => void;
  onRefresh: () => void;
  title?: string;
  emptyText?: string;
  busyText?: string;
  itemContainerClassName?: string;
  itemClassName?: string;
  countClassName?: string;
  lastCollectedAt?: string | null;
};

function formatSignalTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeClassName(tone: "heat" | "structural" | "neutral" = "neutral"): string {
  if (tone === "structural") return "bg-emerald-100 text-emerald-700";
  if (tone === "heat") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

export default function MarketSignalsPanel({
  signals,
  selectedCategory,
  busy,
  error,
  onCategoryChange,
  onRefresh,
  title = "近期市场信号",
  emptyText = "当前分类暂无已收集信号。",
  busyText = "正在收集市场信号...",
  itemContainerClassName = "grid gap-2 lg:grid-cols-2",
  itemClassName = "rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40",
  countClassName = "bg-indigo-600 text-white",
  lastCollectedAt,
}: MarketSignalsPanelProps) {
  const filteredSignals =
    selectedCategory === "all"
      ? signals
      : signals.filter((signal) => signal.category === selectedCategory);
  const collectedTimes = signals
    .map((signal) => signal.collectedAt)
    .filter(Boolean)
    .sort();
  const latestCollectedAt = lastCollectedAt ?? collectedTimes[collectedTimes.length - 1];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "收集中..." : signals.length > 0 ? "再次收集" : "收集信号"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onCategoryChange("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            selectedCategory === "all" ? countClassName : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          全部 {signals.length}
        </button>
        {MARKET_SIGNAL_CATEGORIES.map((category) => {
          const count = signals.filter((signal) => signal.category === category).length;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedCategory === category ? countClassName : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {MARKET_SIGNAL_CATEGORY_LABELS[category]} {count}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {latestCollectedAt && <span>最近收集：{formatSignalTime(latestCollectedAt)}</span>}
      </div>

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>}

      {busy && signals.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400">
          {busyText}
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className={`mt-3 ${itemContainerClassName}`}>
          {filteredSignals.map((signal) => {
            const content = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {signal.category && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {MARKET_SIGNAL_CATEGORY_LABELS[signal.category]}
                    </span>
                  )}
                  {signal.badges?.map((badge) => (
                    <span
                      key={`${signal.id}-${badge.label}`}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClassName(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                  {signal.date && <span className="text-xs text-slate-400">{signal.date}</span>}
                  {signal.connector && <span className="text-xs text-slate-400">{signal.connector}</span>}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-900">{signal.title}</div>
                {signal.summary && <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{signal.summary}</p>}
                {signal.analysis && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="text-xs font-bold text-slate-700">信号分析</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{signal.analysis}</p>
                  </div>
                )}
              </>
            );

            if (signal.href) {
              return (
                <a
                  key={signal.id}
                  href={signal.href}
                  target={signal.external ? "_blank" : undefined}
                  rel={signal.external ? "noreferrer" : undefined}
                  className={`block ${itemClassName}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{content}</div>
                    <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700">
                      {signal.hrefLabel ?? "查看来源"}
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </div>
                </a>
              );
            }

            return (
              <div key={signal.id} className={itemClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">{content}</div>
                  {signal.action && (
                    <button
                      type="button"
                      onClick={signal.action.onClick}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      {signal.action.label}
                      {signal.action.icon}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
