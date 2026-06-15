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
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  getDealDetail,
  listDeals,
  transitionDeal,
  triggerDealAction,
} from "../lib/api";
import type {
  Claim,
  DealAction,
  DealDetail,
  DealStatus,
  DealSummary,
  FitScoreBreakdown,
} from "../lib/types";

// 管线状态展示元信息（与 backend DealStatus 对齐）
const STATUS_META: Record<DealStatus, { label: string; badge: string }> = {
  sourced: { label: "候选", badge: "bg-slate-100 text-slate-600" },
  screening: { label: "待初筛", badge: "bg-amber-100 text-amber-700" },
  pre_dd: { label: "尽调中", badge: "bg-blue-100 text-blue-700" },
  ic_ready: { label: "可上会", badge: "bg-indigo-100 text-indigo-700" },
  approved: { label: "已立项", badge: "bg-green-100 text-green-700" },
  rejected: { label: "已否决", badge: "bg-rose-100 text-rose-700" },
};

// 允许的前向流转（镜像 backend PIPELINE_TRANSITIONS，仅用于决定可点按钮；最终守卫在后端）
const PIPELINE_NEXT: Record<DealStatus, DealStatus[]> = {
  sourced: ["screening", "rejected"],
  screening: ["pre_dd", "rejected"],
  pre_dd: ["ic_ready", "rejected"],
  ic_ready: ["approved", "rejected", "pre_dd"],
  approved: [],
  rejected: [],
};

const FILTERS: { key: string; label: string; status?: DealStatus; inLibrary?: boolean }[] = [
  { key: "all", label: "全部" },
  { key: "library", label: "项目库", inLibrary: true },
  { key: "screening", label: "待初筛", status: "screening" },
  { key: "pre_dd", label: "尽调中", status: "pre_dd" },
  { key: "ic_ready", label: "可上会", status: "ic_ready" },
];

const ACTION_LABELS: Record<DealAction, string> = {
  add_to_library: "加入项目库",
  follow: "关注",
  dismiss: "不感兴趣",
  abandon: "放弃",
  create_workspace: "创建工作台",
};

function StatusBadge({ status }: { status: DealStatus }) {
  const meta = STATUS_META[status] ?? { label: status, badge: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      {meta.label}
    </span>
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

function Facts({ detail }: { detail: DealDetail }) {
  const e = detail.data.extraction;
  const rows: [string, string | null | undefined][] = [
    ["赛道", e.track],
    ["子方向", e.sub_direction],
    ["产品", e.product],
    ["技术路线", e.tech_route],
    ["创始团队", e.founders.join("、") || null],
    ["融资阶段", e.funding_stage],
    ["融资金额", e.funding_amount],
    ["估值", e.valuation],
    ["收入", e.revenue],
    ["商业模式", e.business_model],
    ["市场空间", e.market_size],
    ["主要客户", e.customers.join("、") || null],
    ["竞争对手", e.competitors.join("、") || null],
    ["官网", e.official_website],
  ];
  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0) return <p className="text-sm text-slate-400">材料未提供结构化事实。</p>;
  return (
    <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
      {visible.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 text-slate-400">{k}</dt>
          <dd className="text-slate-700">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DealDetailPanel({
  detail,
  busy,
  onTransition,
  onAction,
}: {
  detail: DealDetail;
  busy: boolean;
  onTransition: (to: DealStatus) => void;
  onAction: (action: DealAction) => void;
}) {
  const { data, company } = detail;
  const a = data.analysis;
  const fb = data.user_feedback;
  const nextStatuses = PIPELINE_NEXT[detail.status] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">
          {company?.name ?? data.extraction.company_name}
        </h2>
        <StatusBadge status={detail.status} />
        {data.source_type && (
          <span className="text-xs text-slate-400">来源：{data.source_type}</span>
        )}
        <span className="ml-auto text-sm text-slate-500">
          匹配度 <span className="font-semibold text-slate-800">{Math.round(a.overall_fit)}</span>
        </span>
      </div>

      {/* 管线流转 + 用户反馈动作 */}
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((to) => (
          <button
            key={to}
            disabled={busy}
            onClick={() => onTransition(to)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            推进至「{STATUS_META[to]?.label ?? to}」
          </button>
        ))}
        {nextStatuses.length === 0 && (
          <span className="text-xs text-slate-400">已到终态，无可推进的管线动作。</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ACTION_LABELS) as DealAction[]).map((action) => {
          const active =
            (action === "add_to_library" && fb.is_in_library) ||
            (action === "follow" && fb.is_liked) ||
            (action === "dismiss" && fb.is_disliked) ||
            (action === "abandon" && fb.is_abandoned) ||
            (action === "create_workspace" && data.workspace.created);
          return (
            <button
              key={action}
              disabled={busy}
              onClick={() => onAction(action)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {ACTION_LABELS[action]}
              {active ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <Section title="项目画像">
        <p className="text-sm text-slate-700">{a.portrait}</p>
        {a.track_judgement && (
          <p className="mt-2 text-xs text-slate-500">赛道判断：{a.track_judgement}</p>
        )}
      </Section>

      {a.fit_score && (
        <Section title="机构匹配度">
          <FitScore fit={a.fit_score} />
        </Section>
      )}

      {a.highlights.length > 0 && (
        <Section title="投资亮点">
          <ul className="space-y-1">
            {a.highlights.map((c, i) => (
              <ClaimLine key={i} claim={c} />
            ))}
          </ul>
        </Section>
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

      {(a.info_gaps.length > 0 || a.open_questions.length > 0) && (
        <Section title="信息缺口 / 待验证问题">
          {a.info_gaps.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-slate-400">信息缺口</div>
              <ul className="ml-4 list-disc text-sm text-slate-700">
                {a.info_gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {a.open_questions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-400">待验证问题</div>
              <ul className="ml-4 list-disc text-sm text-slate-700">
                {a.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {a.next_steps.length > 0 && (
        <Section title="推荐下一步">
          <ul className="space-y-1">
            {a.next_steps.map((c, i) => (
              <ClaimLine key={i} claim={c} />
            ))}
          </ul>
        </Section>
      )}

      <Section title="材料事实">
        <Facts detail={detail} />
      </Section>

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

  const [filter, setFilter] = useState<string>("all");
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshList = useCallback(async () => {
    const f = FILTERS.find((x) => x.key === filter);
    try {
      const res = await listDeals({ status: f?.status, in_library: f?.inLibrary });
      setDeals(res.items);
      setListError(null);
    } catch (e) {
      setListError(
        e instanceof ApiError ? `加载项目库失败（${e.status}）` : "后端未启动（uvicorn app.main:app）"
      );
      setDeals([]);
    }
  }, [filter]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await getDealDetail(id);
      setDetail(d);
      setDetailError(null);
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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 左：项目库 */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
            ← 返回
          </a>
          <span className="text-base font-bold text-slate-900">项目库</span>
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
        <div className="flex-1 overflow-y-auto p-2">
          {listError && <div className="p-3 text-sm text-rose-500">{listError}</div>}
          {!listError && deals.length === 0 && (
            <div className="p-3 text-sm text-slate-400">暂无项目。</div>
          )}
          {deals.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/workspace/${d.id}`)}
              className={`mb-1 w-full rounded-lg border p-3 text-left transition ${
                d.id === dealId
                  ? "border-blue-300 bg-blue-50"
                  : "border-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">
                  {d.company_name ?? "（未命名项目）"}
                </span>
                <StatusBadge status={d.status} />
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
            </button>
          ))}
        </div>
      </aside>

      {/* 右：详情 */}
      <main className="flex-1 overflow-y-auto p-6">
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
          />
        )}
      </main>
    </div>
  );
}
