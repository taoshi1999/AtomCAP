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
