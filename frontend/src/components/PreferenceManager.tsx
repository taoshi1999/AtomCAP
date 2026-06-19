/**
 * 投资偏好管理（嵌入 ChatPage 的 mode==="preference" 主区，**复用 ChatPage 的左侧侧边栏**）。
 *
 * 不自带侧边栏 / 整页骨架——只渲染主内容区，故侧边栏与首页完全一致。
 *  - 列表：偏好卡片 + 右上「创建偏好」+ 创建弹窗（五维增量配置 + AI 推荐）
 *  - 详情：点击卡片进入，可编辑保存（内部 selectedId 状态切换，无需路由）
 *  - 中部「AI 助手」：点击后弹出**上下占满整个屏幕高度、水平居中**的对话框，可开关；
 *    始终挂载（hidden 切换）以保持会话连续。对话走通用对话 SSE，注入当前偏好上下文，
 *    并以用户真实问题为题进入会话历史。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageSquare, Plus, Sparkles, X } from "lucide-react";
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
import PageAssistant from "./PageAssistant";

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

/* ---------------------- 单维度增量编辑器 ---------------------- */
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
    if (next) void loadRecs();
  }

  function add(value: string) {
    const v = value.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setRecs((prev) => prev.filter((r) => r !== v));
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
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="h-3.5 w-3.5" /> 添加
        </button>
      </div>

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
              className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={submitCustom}
              className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
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
                    className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
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

/* ---------------------- 偏好表单（创建/编辑共用） ---------------------- */
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
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">偏好名称</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="例如：硬科技早期、华东消费成长"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </div>
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
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">备注（可选）</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          rows={2}
          placeholder="补充策略说明"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </div>
    </div>
  );
}

/* ---------------------- 创建偏好弹窗 ---------------------- */
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
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            创建偏好
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- 列表卡片 ---------------------- */
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
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
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

/* ---------------------- 详情 / 编辑 ---------------------- */
function DetailEditor({ id, onBack }: { id: string; onBack: () => void }) {
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
        const d = await getPreferenceProfile(id);
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
  }, [id]);

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
      const d = await updatePreferenceProfile(id, { ...form, name: form.name.trim() });
      setForm(d.profile);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600">
          ← 投资偏好
        </button>
        <h2 className="text-base font-bold text-slate-900">编辑偏好</h2>
        <button
          type="button"
          onClick={save}
          disabled={saving || loading || !form}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          保存
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
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
        </div>
      </div>
    </>
  );
}

/* ---------------------- 列表 ---------------------- */
function CardList({
  items,
  loading,
  error,
  onOpen,
  onCreate,
}: {
  items: PreferenceProfileSummary[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6">
        <h2 className="text-lg font-bold text-slate-900">投资偏好</h2>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> 创建偏好
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载偏好…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-500">还没有投资偏好</p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> 创建偏好
            </button>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <PreferenceCard key={p.id} profile={p} onClick={() => onOpen(p.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------- 中部全高对话框（可开关、始终挂载） ---------------------- */
function PreferenceChatDialog({ contextSummary }: { contextSummary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
        >
          <MessageSquare className="h-5 w-5" /> AI 助手
        </button>
      )}
      {/* 居中、从上到下占满整个屏幕高度的对话框；始终挂载（hidden 切换）保持会话连续 */}
      <div
        className={
          open
            ? "fixed inset-y-0 left-1/2 z-40 flex w-[min(94vw,560px)] -translate-x-1/2 flex-col border-x border-slate-200 bg-white shadow-2xl"
            : "hidden"
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-indigo-600" /> 投资偏好 · AI 助手
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <PageAssistant
            contextLabel="投资偏好"
            contextSummary={contextSummary}
            placeholder="用自然语言描述你的投资偏好需求…"
          />
        </div>
      </div>
    </>
  );
}

/* ---------------------- 入口 ---------------------- */
export default function PreferenceManager() {
  const [items, setItems] = useState<PreferenceProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPreferenceProfiles();
      setItems(res.items);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 500) {
        setError("加载失败（500）。如首次使用本功能，请重启后端（启动会自动建表）或在 backend 执行 alembic upgrade head 后重试。");
      } else if (e instanceof ApiError) {
        setError(`加载失败（${e.status}）`);
      } else {
        setError("后端未启动（uvicorn app.main:app）");
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chatContext = useMemo(() => {
    if (selectedId) {
      const sel = items.find((p) => p.id === selectedId);
      if (sel) return `用户正在编辑投资偏好「${sel.name}」。`;
      return "用户正在编辑一个投资偏好。";
    }
    if (items.length === 0) return "用户尚未创建任何投资偏好卡片。";
    return `用户已创建 ${items.length} 个投资偏好：${items.map((p) => p.name).join("、")}。`;
  }, [items, selectedId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selectedId ? (
        <DetailEditor
          id={selectedId}
          onBack={() => {
            setSelectedId(null);
            void refresh();
          }}
        />
      ) : (
        <CardList
          items={items}
          loading={loading}
          error={error}
          onOpen={(id) => setSelectedId(id)}
          onCreate={() => setCreateOpen(true)}
        />
      )}

      <PreferenceChatDialog contextSummary={chatContext} />

      {createOpen && (
        <CreatePreferenceModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
