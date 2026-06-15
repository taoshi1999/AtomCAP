/**
 * API 客户端 + SSE 订阅。
 * 事件协议与 backend/app/api/conversations.py 对应：
 * token / progress / object / done
 */
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { DealAction, DealDetail, DealStatus, DealSummary } from "./types";

export interface SseHandlers {
  onToken?: (text: string) => void;
  onProgress?: (text: string) => void;
  onObject?: (ref: { type: string; deliverable_id: string | null }) => void;
  onDone?: () => void;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  handlers: SseHandlers,
  signal?: AbortSignal
) {
  await fetchEventSource(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
    onmessage(ev) {
      switch (ev.event) {
        case "token":
          handlers.onToken?.(ev.data);
          break;
        case "progress":
          handlers.onProgress?.(ev.data);
          break;
        case "object":
          handlers.onObject?.(JSON.parse(ev.data));
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    },
  });
}

/* ----------------------------------------------------------------------------
 * 通用 JSON 请求封装。
 * token 注入待登录页落地（README 待办「前端登录页 + token 注入」）；
 * 当前依赖后端 AUTH_DEV_FALLBACK 开发回退（多租户上下文走默认机构）。
 * 接通登录后在此读取持久化 token 注入 Authorization 头并关闭 dev fallback。
 * --------------------------------------------------------------------------*/

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      /* 非 JSON 错误体，沿用 statusText */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { ApiError };

/* ----------------------------- 项目库 / 项目工作台 ----------------------------- */

export interface DealListResponse {
  items: DealSummary[];
  count: number;
}

export interface DealListParams {
  status?: DealStatus;
  in_library?: boolean;
  limit?: number;
}

// GET /api/deals
export async function listDeals(params: DealListParams = {}): Promise<DealListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.in_library !== undefined) qs.set("in_library", String(params.in_library));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson<DealListResponse>(`/api/deals${suffix}`);
}

// GET /api/deals/{id}
export async function getDealDetail(dealId: string): Promise<DealDetail> {
  return apiJson<DealDetail>(`/api/deals/${dealId}`);
}

export interface TransitionResponse {
  deal_id: string;
  status: DealStatus;
  event_recorded: boolean;
}

// POST /api/deals/{id}/transition
export async function transitionDeal(
  dealId: string,
  toStatus: DealStatus
): Promise<TransitionResponse> {
  return apiJson<TransitionResponse>(`/api/deals/${dealId}/transition`, {
    method: "POST",
    body: JSON.stringify({ to_status: toStatus }),
  });
}

export interface DealActionResponse {
  deal_id: string;
  action: DealAction;
  status: DealStatus;
  user_feedback: Record<string, boolean> | null;
  workspace: Record<string, unknown> | null;
  event_recorded: boolean;
}

// POST /api/deals/{id}/actions/{action}
export async function triggerDealAction(
  dealId: string,
  action: DealAction
): Promise<DealActionResponse> {
  return apiJson<DealActionResponse>(`/api/deals/${dealId}/actions/${action}`, {
    method: "POST",
  });
}
