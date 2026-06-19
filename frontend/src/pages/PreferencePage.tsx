/**
 * 投资偏好界面 —— 用户自建命名偏好卡片的 列表 / 创建 / 详情编辑。
 *
 * 路由：
 *  - /preferences            → 卡片列表 + 右上「创建偏好」
 *  - /preferences/:profileId → 单张卡片详情，可编辑
 *
 * 五个固定维度（偏好赛道 / 融资阶段 / 所在地域 / 风险偏好 / 融资规模）均为「增量式配置」：
 * 每个维度点「添加」展开小下拉，下拉里给 AI 推荐候选，也支持自定义输入。
 * 与「当前投资偏好」（机构唯一生效偏好）分离，互不影响经验沉淀 / fit_score 主链路。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import {
  ApiError,
  createPreferenceProfile,
  getPreferenceProfile,
  getPreferenceRecommendations,
  listPreferenceProfiles,
  updatePreferenceProfile,
  type PreferenceProfileContent,
  type PreferenceProfileSummary,
} from "../lib/api";

/* 五个固定维度的元数据（字段名与后端 PreferenceProfile / 推荐端点对齐） */
const DIMENSIONS = [
  { key: "sectors", label: "偏好赛道" },
  { key: "stages", label: "融资阶段" },
  { key: "regions", label: "所在地域" },
  { key: "risk_levels", label: "风险偏好" },
  { key: "check_sizes", label: "融资规模" },
] as const;

type DimKey = (typeof DIMENSIONS)[number]["key"];

const EMPTY_FORM: PreferenceProfileContent = {
  name: "",
  sectors: [],
  stages: [],
  regions: [],
  risk_levels: [],
  check_sizes: [],
  notes: "",
};

/* ============================ 单维度增量编辑器 ============================ */
/**
 * 一个维度的取值编辑：已选项以标签展示（可删除），点「添加」展开下拉——
 * 下拉里先是自定义输入框（回车/点击添加），下面是 AI 推荐候选（点击即加入）。
 */
function DimensionField({
  label,
  dimensionKey,
  values,
  profileName,
  onChange,
}: {
  label: string;
  dimensionKey: DimKey;
  values: string[];
  profileName: string;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [recs, setRecs] = useState<string[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState("");

  const loadRecs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPreferenceRecommendations(dimensionKey, {
        name: profileName,
        existing: values,
      });
      setRecs(res.recommendations);
      setSource(res.source);
    } catch {
      setRecs([]);
      setSource("");
    } finally {
      setLoading(false);
    }
  }, [dimensionKey, profileName, values]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadRecs(); // 每次展开都拉一次（已选会被后端排除）
  }

  function add(value: string) {
    const v = value.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setRecs((prev) => prev.filter((r) => r !== v)); // 加过的从推荐里移除
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  function submitCustom() {
    if (!custom.trim()) return;
    add(custom);
    setCustom("");
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-3.5 w-3.5" /> 添加
        </button>
      </div>

      {/* 已选标签 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-xs text-slate-400">尚未配置</span>}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-slate-400 hover:text-rose-500"
              aria-label={`删除 ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* 展开的小下拉：自定义输入 + AI 推荐 */}
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCustom();
                }
              }}
              placeholder="自定义输入，回车添加"
              className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={submitCustom}
              className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              添加
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
            <Sparkles className="h-3 w-3" />
            {loading ? "正在生成推荐…" : source === "ai" ? "AI 推荐（点击加入）" : "推荐（点击加入）"}
          </div>

          {!loading && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recs.length === 0 ? (
                <span className="text-xs text-slate-400">暂无更多推荐，可自定义输入</span>
              ) : (
                recs.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => add(r)}
                    className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    + {r}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ 偏好表单（创建/编辑共用） ============================ */
function ProfileForm({
  form,
  onChange,
}: {
  form: PreferenceProfileContent;
  onChange: (next: PreferenceProfileContent) => void;
}) {
  function setDim(key: DimKey, next: string[]) {
    onChange({ ...form, [key]: next });
  }

  return (
    <div className="space-y-3">
      {/* 偏好名称（最上方，手动输入） */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">偏好名称</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="例如：硬科技早期、华东消费成长"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
      </div>

      {/* 五个固定维度，增量配置 */}
      {DIMENSIONS.map((d) => (
        <DimensionField
          key={d.key}
          label={d.label}
          dimensionKey={d.key}
          values={form[d.key]}
          profileName={form.name}
          onChange={(next) => setDim(d.key, next)}
        />
      ))}

      {/* 备注（可选） */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">备注（可选）</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          rows={2}
          placeholder="补充策略说明"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
      </div>
    </div>
  );
}

/* ============================ 创建偏好弹窗 ============================ */
function CreatePreferenceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<PreferenceProfileContent>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) {
      setError("请填写偏好名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPreferenceProfile({ ...form, name: form.name.trim() });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "创建失败，请确认后端已启动");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">创建偏好</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          <ProfileForm form={form} onChange={setForm} />
          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            创建偏好
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ 列表卡片 ============================ */
function summaryChips(profile: PreferenceProfileSummary): { label: string; values: string[] }[] {
  return DIMENSIONS.map((d) => ({ label: d.label, values: profile[d.key] })).filter(
    (x) => x.values.length > 0
  );
}

function PreferenceCard({
  profile,
  onClick,
}: {
  profile: PreferenceProfileSummary;
  onClick: () => void;
}) {
  const chips = summaryChips(profile);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
    >
      <span className="text-sm font-bold text-slate-900">{profile.name}</span>
      <div className="mt-2 space-y-1.5">
        {chips.length === 0 && <span className="text-xs text-slate-400">尚未配置维度</span>}
        {chips.slice(0, 3).map((c) => (
          <div key={c.label} className="flex gap-1.5 text-xs">
            <span className="shrink-0 text-slate-400">{c.label}</span>
            <span className="truncate text-slate-600">{c.values.join("、")}</span>
          </div>
        ))}
        {chips.length > 3 && <span className="text-xs text-slate-400">等 {chips.length} 个维度</span>}
      </div>
    </button>
  );
}

/* ============================ 列表视图 ============================ */
function PreferenceListView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PreferenceProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPreferenceProfiles();
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? `加载失败（${e.status}）` : "后端未启动（uvicorn app.main:app）");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
              ← 返回
            </a>
            <h1 className="text-lg font-bold text-slate-900">投资偏好</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> 创建偏好
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载偏好…
          </div>
        )}
        {error && <div className="text-sm text-rose-500">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-500">还没有投资偏好</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> 创建偏好
            </button>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <PreferenceCard key={p.id} profile={p} onClick={() => navigate(`/preferences/${p.id}`)} />
            ))}
          </div>
        )}
      </main>

      {createOpen && (
        <CreatePreferenceModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void refresh(); // 创建后刷新，新卡片即出现在列表
          }}
        />
      )}
    </div>
  );
}

/* ============================ 详情 / 编辑视图 ============================ */
function PreferenceDetailView({ profileId }: { profileId: string }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<PreferenceProfileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getPreferenceProfile(profileId);
        if (alive) {
          setForm(d.profile);
          setError(null);
        }
      } catch (e) {
        if (alive) {
          setError(
            e instanceof ApiError
              ? e.status === 404
                ? "偏好不存在"
                : `加载失败（${e.status}）`
              : "后端未启动"
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileId]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setError("请填写偏好名称");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const d = await updatePreferenceProfile(profileId, { ...form, name: form.name.trim() });
      setForm(d.profile);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/preferences")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" /> 投资偏好
          </button>
          <h1 className="text-base font-bold text-slate-900">编辑偏好</h1>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !form}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            保存
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载…
          </div>
        )}
        {error && !form && <div className="text-sm text-rose-500">{error}</div>}
        {form && (
          <>
            <ProfileForm form={form} onChange={setForm} />
            {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
            {saved && (
              <p className="mt-3 flex items-center gap-1 text-sm text-emerald-600">
                <Check className="h-4 w-4" /> 已保存
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ============================ 入口：按路由参数分流 ============================ */
export default function PreferencePage() {
  const { profileId } = useParams();
  // useMemo 仅为消除「条件渲染不同组件」时的告警噪声，无副作用
  const content = useMemo(
    () => (profileId ? <PreferenceDetailView profileId={profileId} /> : <PreferenceListView />),
    [profileId]
  );
  return content;
}
