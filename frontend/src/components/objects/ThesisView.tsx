/**
 * Thesis 对象渲染 —— 设计文档规定的六区：
 * 1 顶部核心信息卡片  2 子赛道卡片  3 产业链图谱（MVP 静态结构图）
 * 4 近期市场信号  5 风险点  6 下一步操作
 *
 * 证据链约定：任何 Claim 都渲染证据徽标（可点开证据面板）或「模型推断」标识。
 */
import type { Claim, RecommendedAction, Thesis } from "../../lib/types";

const ACTION_LABELS: Record<RecommendedAction, string> = {
  generate_deal_pool: "生成项目池",
  follow_track: "关注该赛道",
  generate_briefing: "生成赛道简报",
  re_recommend: "重新推荐",
};

function ClaimText({ claim }: { claim: Claim }) {
  return (
    <span>
      {claim.text}
      {claim.inferred ? (
        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-700">模型推断</span>
      ) : (
        <button
          className="ml-1 rounded bg-blue-50 px-1 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
          title="展开证据链"
          // TODO: 打开全局 EvidencePanel，按 evidence_ids 拉取 evidence_items
        >
          证据 {claim.evidence_ids.length}
        </button>
      )}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function ChainRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-slate-400">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <span key={x} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs">
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ThesisView({
  thesis,
  onAction,
}: {
  thesis: Thesis;
  onAction?: (action: RecommendedAction) => void;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      {/* 1. 顶部核心信息卡片 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{thesis.thesis_name}赛道前瞻</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{thesis.one_line_view}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="机会等级" value={thesis.opportunity_level} />
          <Stat label="风险等级" value={thesis.risk_level} />
          <Stat label="与本机构匹配度" value={String(Math.round(thesis.institution_fit_score.total))} />
          <Stat label="建议" value={thesis.advice} />
        </div>
      </section>

      {/* 2. 子赛道卡片 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {thesis.sub_directions.map((sub) => (
          <div key={sub.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{sub.name}</h3>
              <span
                className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                title={sub.fit_score.rationale}
              >
                匹配 {Math.round(sub.fit_score.total)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{sub.detail}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {sub.investment_reasons.map((r, i) => (
                <li key={i}>
                  <ClaimText claim={r} />
                </li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-slate-500">
              适合阶段：{sub.suitable_stage}
              {sub.representative_companies.length > 0 &&
                ` ｜ 代表公司：${sub.representative_companies.map((c) => c.name).join("、")}`}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                onClick={() => onAction?.("generate_deal_pool")}
              >
                生成项目池
              </button>
              <button className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50">
                深入分析
              </button>
              <button className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
                不感兴趣
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* 3. 产业链图谱（MVP：静态结构图；后续换 React Flow 交互图） */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">产业链图谱</h3>
        <div className="space-y-2">
          <ChainRow title="上游" items={thesis.value_chain.upstream.map((s) => s.name)} />
          <ChainRow title="中游" items={thesis.value_chain.midstream.map((s) => s.name)} />
          <ChainRow title="下游" items={thesis.value_chain.downstream.map((s) => s.name)} />
          <ChainRow title="客户" items={thesis.value_chain.customers} />
        </div>
      </section>

      {/* 4. 近期市场信号（热度 / 结构性区分展示，每条可展开证据链） */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-semibold text-slate-900">近期市场信号</h3>
        <ul className="space-y-2">
          {thesis.recent_signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={
                  s.kind === "structural"
                    ? "mt-0.5 shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700"
                    : "mt-0.5 shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700"
                }
              >
                {s.kind === "structural" ? "结构性" : "热度"}
              </span>
              <div>
                <span className="font-medium text-slate-800">{s.title}</span>
                {s.signal_date && <span className="ml-2 text-xs text-slate-400">{s.signal_date}</span>}
                <div className="text-slate-600">
                  <ClaimText claim={s.summary} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. 风险点（必须有，否则像销售材料） */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-semibold text-slate-900">风险点</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {thesis.key_risks.map((r, i) => (
            <li key={i}>
              <ClaimText claim={r} />
            </li>
          ))}
        </ul>
      </section>

      {/* 6. 下一步操作 */}
      <section className="flex flex-wrap gap-2">
        {thesis.recommended_actions.map((a) => (
          <button
            key={a}
            onClick={() => onAction?.(a)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            {ACTION_LABELS[a]}
          </button>
        ))}
      </section>
    </div>
  );
}
