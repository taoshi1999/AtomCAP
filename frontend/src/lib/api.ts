/**
 * API 客户端 + SSE 订阅。
 * 事件协议与 backend/app/api/conversations.py 对应：
 * token / reasoning / progress / object / usage / error / done
 */
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type {
  DealAction,
  DealDetail,
  DealStatus,
  DealSummary,
  Deliverable,
  ThesisAction,
} from "./types";

/* ----------------------------------------------------------------------------
 * token 注入。
 * 后端 settings.auth_dev_fallback 默认 False —— 未携带 JWT 一律 401，
 * 故所有业务请求（含 SSE）都需带 Authorization 头。
 * token 由 lib/auth.tsx 的 AuthProvider 在登录/启动时通过 setAuthToken 写入，
 * 持久化与回灌同样在 auth.tsx（localStorage）。
 * --------------------------------------------------------------------------*/

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated?: boolean;
}

export interface SseObjectRef {
  type: string;
  deliverable_id?: string | null;
  deal_id?: string | null;
  company_id?: string | null;
}

export interface SseHandlers {
  onToken?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onProgress?: (text: string) => void;
  onObject?: (ref: SseObjectRef) => void;
  onUsage?: (usage: TokenUsage) => void;
  onError?: (text: string) => void;
  onDone?: () => void;
}

export interface SendMessageOptions {
  conversationType?: "normal" | "track_workspace";
  sourceThesisId?: string;
}

async function ensureSseResponse(response: Response) {
  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    try {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        if (body && typeof body.detail === "string") detail = body.detail;
      } else {
        const text = await response.text();
        if (text) detail = text;
      }
    } catch {
      /* use status text */
    }
    throw new Error(detail);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("后端没有返回有效的 SSE 响应");
  }
}

export interface ModelOption {
  tier: string;
  model: string;
  label: string;
  requires_overseas: boolean;
  available: boolean;
}

export interface ModelsInfo {
  provider: string;
  default_tier: string;
  options: ModelOption[];
}

export async function getModels(): Promise<ModelsInfo> {
  return apiJson<ModelsInfo>("/api/models");
}

export async function sendMessage(
  conversationId: string,
  content: string,
  handlers: SseHandlers,
  signal?: AbortSignal,
  modelTier?: string,
  context?: string,
  options: SendMessageOptions = {}
) {
  await fetchEventSource(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    // context 为页面级助手注入的页面上下文：只进 LLM 输入，后端不写入持久化消息正文
    body: JSON.stringify({
      content,
      model_tier: modelTier,
      context,
      conversation_type: options.conversationType ?? "normal",
      source_thesis_id: options.sourceThesisId ?? null,
    }),
    signal,
    openWhenHidden: true,
    onopen: ensureSseResponse,
    onmessage(ev) {
      switch (ev.event) {
        case "token":
          handlers.onToken?.(ev.data);
          break;
        case "reasoning":
          handlers.onReasoning?.(ev.data);
          break;
        case "progress":
          handlers.onProgress?.(ev.data);
          break;
        case "object":
          handlers.onObject?.(JSON.parse(ev.data));
          break;
        case "usage":
          handlers.onUsage?.(JSON.parse(ev.data));
          break;
        case "error":
          handlers.onError?.(ev.data);
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    },
    onerror(error) {
      throw error;
    },
  });
}

export async function uploadMaterial(
  conversationId: string,
  file: File,
  handlers: SseHandlers,
  signal?: AbortSignal
) {
  const body = new FormData();
  body.append("file", file);
  await fetchEventSource(`/api/conversations/${conversationId}/upload`, {
    method: "POST",
    headers: authHeaders(),
    body,
    signal,
    openWhenHidden: true,
    onopen: ensureSseResponse,
    onmessage(ev) {
      switch (ev.event) {
        case "token":
          handlers.onToken?.(ev.data);
          break;
        case "reasoning":
          handlers.onReasoning?.(ev.data);
          break;
        case "progress":
          handlers.onProgress?.(ev.data);
          break;
        case "object":
          handlers.onObject?.(JSON.parse(ev.data));
          break;
        case "usage":
          handlers.onUsage?.(JSON.parse(ev.data));
          break;
        case "error":
          handlers.onError?.(ev.data);
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    },
    onerror(error) {
      throw error;
    },
  });
}

/* ----------------------------------------------------------------------------
 * 通用 JSON 请求封装。
 * --------------------------------------------------------------------------*/

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
    ...authHeaders(),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
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

/* --------------------------------- 首页 --------------------------------- */

export interface HomeConversation {
  id: string;
  title: string;
  preview?: string | null;
  updated_at: string;
}

export interface HomeDeliverable {
  id: string;
  type: string;
  title: string;
  status: string;
  updated_at: string;
}

export interface HomePreference {
  exists: boolean;
  version: number;
  updated_at?: string;
  preference: Record<string, unknown>;
}

export interface HomeData {
  user: { id: string; name: string; email: string };
  institution: { id: string; name: string; allow_overseas_models: boolean };
  preference: HomePreference;
  conversations: HomeConversation[];
  deliverables: HomeDeliverable[];
  deals: DealSummary[];
  recent_conversations: HomeConversation[];
  recent_deliverables: HomeDeliverable[];
  recent_deals: DealSummary[];
  stats: {
    conversation_count: number;
    deliverable_count: number;
    preference_profile_count: number;
    deal_status_counts: Record<string, number>;
  };
}

export async function getHome(): Promise<HomeData> {
  return apiJson<HomeData>("/api/home");
}

/* -------------------------------- 投资偏好 -------------------------------- */

export async function getPreference(): Promise<HomePreference> {
  return apiJson<HomePreference>("/api/preferences");
}

export interface PreferenceUpdateResponse {
  version: number;
  preference: Record<string, unknown>;
  event_recorded: boolean;
}

export async function updatePreference(
  preference: Record<string, unknown>
): Promise<PreferenceUpdateResponse> {
  return apiJson<PreferenceUpdateResponse>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(preference),
  });
}

/* ---------------------- 投资偏好卡片（用户自建命名偏好） ---------------------- */
/* 与「当前投资偏好」（机构唯一生效偏好 /api/preferences）分离：这里是用户在
 * 「投资偏好」界面手动创建的多张命名卡片，五维（赛道/阶段/地域/风险/规模）增量配置。 */

export interface PreferenceProfileContent {
  name: string;
  sectors: string[];
  stages: string[];
  regions: string[];
  risk_levels: string[];
  check_sizes: string[];
  custom_dimensions?: PreferenceCustomDimension[];
  notes?: string | null;
}

export interface PreferenceCustomDimension {
  key?: string | null;
  label: string;
  values: string[];
}

export interface PreferenceProfileSummary {
  id: string;
  name: string;
  sectors: string[];
  stages: string[];
  regions: string[];
  risk_levels: string[];
  check_sizes: string[];
  custom_dimensions?: PreferenceCustomDimension[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PreferenceProfileDetail {
  id: string;
  name: string;
  archived: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  profile: PreferenceProfileContent;
}

export interface PreferenceProfileListResponse {
  items: PreferenceProfileSummary[];
  count: number;
}

export interface PreferenceProfileVersion {
  version: number;
  event_type: string;
  occurred_at?: string | null;
  profile: PreferenceProfileContent;
}

export interface PreferenceProfileVersionListResponse {
  items: PreferenceProfileVersion[];
  count: number;
}

export interface ApplyPreferenceProfileResponse {
  profile: PreferenceProfileDetail;
  applied_preference: {
    id: string;
    version: number;
    preference: Record<string, unknown>;
  };
}

// GET /api/preference-profiles —— 卡片列表
export async function listPreferenceProfiles(): Promise<PreferenceProfileListResponse> {
  return apiJson<PreferenceProfileListResponse>("/api/preference-profiles");
}

// GET /api/preference-profiles/{id} —— 卡片详情
export async function getPreferenceProfile(id: string): Promise<PreferenceProfileDetail> {
  return apiJson<PreferenceProfileDetail>(`/api/preference-profiles/${id}`);
}

// GET /api/preference-profiles/{id}/versions —— 卡片历史版本
export async function listPreferenceProfileVersions(
  id: string
): Promise<PreferenceProfileVersionListResponse> {
  return apiJson<PreferenceProfileVersionListResponse>(
    `/api/preference-profiles/${id}/versions`
  );
}

// POST /api/preference-profiles/{id}/apply —— 应用为机构当前生效偏好
export async function applyPreferenceProfile(
  id: string
): Promise<ApplyPreferenceProfileResponse> {
  return apiJson<ApplyPreferenceProfileResponse>(
    `/api/preference-profiles/${id}/apply`,
    { method: "POST" }
  );
}

// POST /api/preference-profiles —— 创建命名偏好卡片
export async function createPreferenceProfile(
  content: PreferenceProfileContent
): Promise<PreferenceProfileDetail> {
  return apiJson<PreferenceProfileDetail>("/api/preference-profiles", {
    method: "POST",
    body: JSON.stringify(content),
  });
}

// PUT /api/preference-profiles/{id} —— 整体覆盖（详情界面编辑保存）
export async function updatePreferenceProfile(
  id: string,
  content: PreferenceProfileContent
): Promise<PreferenceProfileDetail> {
  return apiJson<PreferenceProfileDetail>(`/api/preference-profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(content),
  });
}

export interface DimensionRecommendationResponse {
  dimension: string;
  recommendations: string[];
  source: "ai" | "curated" | string; // ai=LLM 生成；curated=精选清单兜底
}

// GET /api/preference-profiles/recommendations —— 某维度「添加」时的推荐候选
export async function getPreferenceRecommendations(
  dimension: string,
  opts: { name?: string; existing?: string[]; limit?: number } = {}
): Promise<DimensionRecommendationResponse> {
  const qs = new URLSearchParams();
  qs.set("dimension", dimension);
  if (opts.name?.trim()) qs.set("name", opts.name.trim());
  if (opts.existing && opts.existing.length) qs.set("existing", opts.existing.join(","));
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  return apiJson<DimensionRecommendationResponse>(
    `/api/preference-profiles/recommendations?${qs.toString()}`
  );
}

export interface PreferenceAssistantResponse {
  action: "create" | "filter" | "unrelated" | string;
  message: string;
  profile?: PreferenceProfileDetail;
  filter_keywords?: string[];
}

// POST /api/preference-profiles/assistant —— 会话栏自然语言指令（创建/筛选/无关）
export async function preferenceAssistant(
  instruction: string
): Promise<PreferenceAssistantResponse> {
  return apiJson<PreferenceAssistantResponse>("/api/preference-profiles/assistant", {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

export interface TrackAssistantResponse {
  action: "create" | "filter" | "unrelated" | string;
  message: string;
  deliverable?: HomeDeliverable;
  filter_keywords?: string[];
}

// POST /api/deliverables/tracks/assistant —— 赛道库会话栏自然语言指令（创建/筛选/无关）
export async function trackAssistant(instruction: string): Promise<TrackAssistantResponse> {
  return apiJson<TrackAssistantResponse>("/api/deliverables/tracks/assistant", {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

export interface DealAssistantResponse {
  action: "create" | "filter" | "unrelated" | string;
  message: string;
  deal?: DealSummary;
  filter_keywords?: string[];
}

// POST /api/deals/assistant —— 项目库会话栏自然语言指令（创建/筛选/无关）
export async function dealAssistant(instruction: string): Promise<DealAssistantResponse> {
  return apiJson<DealAssistantResponse>("/api/deals/assistant", {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

/* --------------------------------- 认证 --------------------------------- */

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  institution_name: string;
  name: string;
  email: string;
  password: string;
}

// POST /api/auth/login
export async function login(payload: LoginPayload): Promise<AuthTokenResponse> {
  return apiJson<AuthTokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// POST /api/auth/register —— 机构引导注册（创建机构 + 首个用户）
export async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  return apiJson<AuthTokenResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ----------------------------- 交付结果对象 ----------------------------- */

// GET /api/deliverables/{id}
export async function getDeliverable(deliverableId: string): Promise<Deliverable> {
  return apiJson<Deliverable>(`/api/deliverables/${deliverableId}`);
}

export interface CreateThesisPayload {
  thesis_name: string;
  one_line_view?: string | null;
  opportunity_level?: string;
  risk_level?: string;
  advice?: string | null;
  sub_directions?: string[];
}

export async function createManualThesis(payload: CreateThesisPayload): Promise<HomeDeliverable> {
  return apiJson<HomeDeliverable>("/api/deliverables/manual-thesis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface DeliverableActionPayload {
  source_sub_direction?: string | null;
  note?: string | null;
}

export interface DeliverableActionResponse {
  deliverable_id: string;
  action: ThesisAction | string;
  status: string;
  event_recorded: boolean;
}

export async function triggerDeliverableAction(
  deliverableId: string,
  action: ThesisAction,
  payload?: DeliverableActionPayload
): Promise<DeliverableActionResponse> {
  return apiJson<DeliverableActionResponse>(
    `/api/deliverables/${deliverableId}/actions/${action}`,
    {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
}

export async function generateDealPool(
  deliverableId: string,
  handlers: SseHandlers,
  payload?: DeliverableActionPayload,
  signal?: AbortSignal
) {
  await fetchEventSource(`/api/deliverables/${deliverableId}/generate-deal-pool`, {
    method: "POST",
    headers: payload
      ? { "Content-Type": "application/json", ...authHeaders() }
      : authHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
    signal,
    openWhenHidden: true,
    onopen: ensureSseResponse,
    onmessage(ev) {
      switch (ev.event) {
        case "token":
          handlers.onToken?.(ev.data);
          break;
        case "reasoning":
          handlers.onReasoning?.(ev.data);
          break;
        case "progress":
          handlers.onProgress?.(ev.data);
          break;
        case "object":
          handlers.onObject?.(JSON.parse(ev.data));
          break;
        case "usage":
          handlers.onUsage?.(JSON.parse(ev.data));
          break;
        case "error":
          handlers.onError?.(ev.data);
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    },
    onerror(error) {
      throw error;
    },
  });
}

/* --------------------------------- 会话 --------------------------------- */

export interface MessageBlock {
  type: "text" | "object_ref" | "deal_ref" | string;
  text?: string;
  deliverable_id?: string;
  deal_id?: string;
  company_id?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | string;
  content: MessageBlock[] | { blocks?: MessageBlock[] };
  created_at: string;
}

export interface ConversationMessagesResponse {
  conversation: { id: string; title?: string | null; updated_at: string };
  messages: ConversationMessage[];
}

export interface ConversationListResponse {
  items: HomeConversation[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConversationListParams {
  limit?: number;
  offset?: number;
  q?: string;
}

export async function listConversations(
  params: ConversationListParams = {}
): Promise<ConversationListResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = params.q?.trim();
  if (query) qs.set("q", query);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson<ConversationListResponse>(`/api/conversations${suffix}`);
}

export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessagesResponse> {
  return apiJson<ConversationMessagesResponse>(
    `/api/conversations/${conversationId}/messages`
  );
}

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

export interface CreateDealPayload {
  company_name: string;
  one_line_intro?: string | null;
  track?: string | null;
  sub_direction?: string | null;
  funding_stage?: string | null;
  source_note?: string | null;
}

export async function createDeal(payload: CreateDealPayload): Promise<DealSummary> {
  return apiJson<DealSummary>("/api/deals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
