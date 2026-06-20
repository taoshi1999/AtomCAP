/**
 * 交付结果对象的 TS 类型 —— 与 backend/app/objects/ 的 Pydantic Schema 镜像。
 * 后续以 `npm run gen:api`（openapi-typescript）生成替代手写，保证前后端不漂移。
 */

export interface Claim {
  text: string;
  evidence_ids: string[];
  inferred: boolean; // true = 无直接证据的模型推断，前端必须可视化标识
}

export type SignalKind = "heat" | "structural";

export interface MarketSignal {
  kind: SignalKind;
  title: string;
  summary: Claim;
  signal_date?: string | null;
}

export interface FitScoreBreakdown {
  track_preference: number;
  stage_match: number;
  moat_match: number;
  geo_match: number;
  risk_appetite_match: number;
  history_similarity: number;
  exclusion_penalty: number;
  total: number;
  rationale: string;
}

export interface ValueChainSegment {
  name: string;
  examples?: string[];
  margin_potential?: string | null;
  entry_difficulty?: string | null;
  suitable_stage?: string | null;
  preference_fit?: string | null;
}

export interface ValueChain {
  upstream: ValueChainSegment[];
  midstream: ValueChainSegment[];
  downstream: ValueChainSegment[];
  customers: string[];
}

export interface RepresentativeCompany {
  name: string;
  note?: Claim | null;
  company_id?: string | null;
}

export interface SubDirection {
  name: string;
  detail: string;
  investment_reasons: Claim[];
  representative_companies: RepresentativeCompany[];
  key_risks: Claim[];
  suitable_stage: string;
  fit_score: FitScoreBreakdown;
}

export type RecommendedAction =
  | "generate_deal_pool"
  | "follow_track"
  | "generate_briefing"
  | "re_recommend";

export type ThesisAction =
  | RecommendedAction
  | "join_project_library"
  | "dismiss_track";

export type ThesisStatus = "draft" | "following" | "deal_pool_generated" | "deleted";

export interface Thesis {
  schema_version: number;
  thesis_name: string;
  one_line_view: string;
  opportunity_level: string;
  risk_level: string;
  advice: string;
  sub_directions: SubDirection[];
  investment_reason: Claim[];
  institution_fit_score: FitScoreBreakdown;
  value_chain: ValueChain;
  recent_signals: MarketSignal[];
  representative_companies: RepresentativeCompany[];
  key_risks: Claim[];
  recommended_actions: RecommendedAction[];
  status: ThesisStatus;
}

export type DeliverableType = "thesis" | "deal_list" | "dd_report" | "briefing" | "lp_report";

export interface Deliverable<T = unknown> {
  id: string;
  type: DeliverableType;
  payload: T;
}

/* ============================================================================
 * Deal 业务对象类型 —— 与 backend/app/objects/deal.py 镜像。
 * 项目获取 Agent（Deal Intake 分析流）产出 DealProfile 落库 deals.data；
 * 项目库 / 项目工作台 API（backend/app/api/deals.py）据此读取与推进。
 * ==========================================================================*/

// 与 backend DealStatus 对齐：管线状态机
export type DealStatus =
  | "sourced"
  | "screening"
  | "pre_dd"
  | "ic_ready"
  | "approved"
  | "rejected";

// 与 backend DealSourceType 对齐（项目来源）
export type DealSourceType =
  | "user_input"
  | "bp_upload"
  | "fa_recommendation"
  | "internal_excel"
  | "thesis_generated"
  | string;

// Step 3：材料解析出的客观事实（未提及字段留空）
export interface DealExtraction {
  company_name: string;
  aliases: string[];
  uscc?: string | null;
  official_website?: string | null;
  one_line_intro?: string | null;
  track?: string | null;
  sub_direction?: string | null;
  product?: string | null;
  tech_route?: string | null;
  founders: string[];
  funding_stage?: string | null;
  funding_amount?: string | null;
  valuation?: string | null;
  revenue?: string | null;
  customers: string[];
  business_model?: string | null;
  market_size?: string | null;
  competitors: string[];
  contact?: string | null;
}

// Step 8：初步分析研判（非完整 Pre-DD）
export interface DealAnalysis {
  portrait: string;
  track_judgement?: string | null;
  fit_score?: FitScoreBreakdown | null;
  overall_fit: number;
  highlights: Claim[];
  initial_risks: Claim[];
  info_gaps: string[];
  open_questions: string[];
  next_steps: Claim[];
}

export interface DealUserFeedback {
  is_in_library: boolean;
  is_liked: boolean;
  is_disliked: boolean;
  is_abandoned: boolean;
}

export interface DealWorkspace {
  created: boolean;
  conversation_id?: string | null;
}

export type PreDDTaskStatus = "complete" | "partial" | "missing" | "public_data_possible";

export interface PreDDChecklistItem {
  key: string;
  title: string;
  status: PreDDTaskStatus;
  provided: string[];
  missing: string[];
  gaps: string[];
  questions: string[];
}

export interface PreDDCompletion {
  score: number;
  total: number;
  complete: number;
  partial: number;
  missing: number;
  public_data_possible: number;
}

export interface PreDDWorkspace {
  completion: PreDDCompletion;
  items: PreDDChecklistItem[];
  priority_questions: string[];
  risk_queue: string[];
  next_steps: string[];
}

// deals.data 完整契约（DealProfile）
export interface DealProfile {
  schema_version: number;
  source_type: DealSourceType;
  status: DealStatus;
  extraction: DealExtraction;
  analysis: DealAnalysis;
  created_from_conversation?: string | null;
  user_feedback: DealUserFeedback;
  workspace: DealWorkspace;
}

// GET /api/deals 列表行投影（services.deal_summary）
export interface DealSummary {
  id: string;
  company_id: string;
  company_name: string | null;
  status: DealStatus;
  source_type?: DealSourceType | null;
  overall_fit?: number | null;
  portrait?: string | null;
  is_in_library: boolean;
  is_liked: boolean;
  is_abandoned: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/deals/{id} 详情（services.get_deal_detail）
export interface DealCompany {
  id: string;
  name: string;
  uscc?: string | null;
  profile?: Record<string, unknown> | null;
}

export interface DealDetail {
  id: string;
  company_id: string;
  status: DealStatus;
  data: DealProfile;
  company: DealCompany | null;
  pre_dd?: PreDDWorkspace | null;
  created_at: string;
  updated_at: string;
}

// 项目库/工作台用户动作（backend USER_ACTIONS）
export type DealAction =
  | "add_to_library"
  | "follow"
  | "dismiss"
  | "abandon"
  | "create_workspace";
