const SEARCH_DEPTH_KEY = "atomcap.marketSignalSearchDepth";
export const DEFAULT_MARKET_SIGNAL_SEARCH_DEPTH = 1;
export const MAX_MARKET_SIGNAL_SEARCH_DEPTH = 5;

export function getMarketSignalSearchDepth(): number {
  if (typeof window === "undefined") return DEFAULT_MARKET_SIGNAL_SEARCH_DEPTH;
  try {
    const parsed = Number.parseInt(window.localStorage.getItem(SEARCH_DEPTH_KEY) ?? "", 10);
    if (!Number.isFinite(parsed)) return DEFAULT_MARKET_SIGNAL_SEARCH_DEPTH;
    return Math.max(1, Math.min(MAX_MARKET_SIGNAL_SEARCH_DEPTH, parsed));
  } catch {
    return DEFAULT_MARKET_SIGNAL_SEARCH_DEPTH;
  }
}

export function setMarketSignalSearchDepth(value: number): number {
  const normalized = Math.max(1, Math.min(MAX_MARKET_SIGNAL_SEARCH_DEPTH, Math.round(value)));
  try {
    window.localStorage.setItem(SEARCH_DEPTH_KEY, String(normalized));
  } catch {
    /* Browsers with disabled storage still use the in-memory value for the current view. */
  }
  return normalized;
}
