/**
 * 投资偏好管理（嵌入 ChatPage 的 mode==="preference" 主区，**复用 ChatPage 左侧侧边栏**）。
 *
 * 点「AI 助手」后页面呈左中右三列：左=首页同款侧边栏（ChatPage 提供）｜中=会话栏（指令助手）｜
 * 右=投资偏好栏（卡片/详情）。用户在中间用自然语言下指令：
 *   - 「帮我创建一个关注 AI、A 轮的投资偏好」→ 系统自动在右侧创建卡片；
 *   - 「筛选出半导体相关的投资偏好」→ 系统自动在右侧过滤展示；
 *   - 与投资偏好无关的请求 → 助手提示用户输入相关操作。
 * 关闭会话栏后右侧偏好栏占满（默认形态）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  ApiError,
  createPreferenceProfile,
  getPreferenceProfile,
  getPreferenceRecommendations,
  listPreferenceProfiles,
  preferenceAssistant,
  updatePreferenceProfile,
  type PreferenceProfileContent,
  type PreferenceProfileSummary,
} from "../lib/api";

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

/* 关键词匹配（空格无关、大小写无关），供右侧栏按助手返回的关键词过滤 */
function normTerm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}
function matchesKeywords(p: PreferenceProfileSummary, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = normTerm(
    [p.name, ...p.sectors, ...p.stages, ...p.regions, ...p.risk_levels, ...p.check_sizes].join("\n")
  );
  return keywords.some((k) => hay.includes(normTerm(k)));
}

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
      const res = await getPreferenceRecommendations(dimensionKey, { name: profileName, existing: values });
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
            <button type="button" onClick={() => remove(v)} className="text-slate-400 hover:text-rose-500" aria-label={`删除 ${v}`}>
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
            <button type="button" onClick={submitCustom} className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
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
                  <button key={r} type="button" onClick={() => add(r)} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-50">
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

/* ---------------------- 偏好表单 ---------------------- */
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

/* ---------------------- 创建弹窗 ---------------------- */
function CreatePreferenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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

/* ---------------------- 卡片 ---------------------- */
function summaryChips(profile: PreferenceProfileSummary): { label: string; values: string[] }[] {
  return DIMENSIONS.map((d) => ({ label: d.label, values: profile[d.key] })).filter((x) => x.values.length > 0);
}
function PreferenceCard({ profile, onClick }: { profile: PreferenceProfileSummary; onClick: () => void }) {
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
function DetailEditor({
  id,
  chatOpen,
  onToggleChat,
  onBack,
}: {
  id: string;
  chatOpen: boolean;
  onToggleChat: () => void;
  onBack: () => void;
}) {
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
          setError(e instanceof ApiError ? (e.status === 404 ? "偏好不存在" : `加载失败（${e.status}）`) : "后端未启动");
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
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-6">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600">
          ← 投资偏好
        </button>
        <h2 className="text-base font-bold text-slate-900">编辑偏好</h2>
        <div className="flex items-center gap-2">
          <AssistantToggle chatOpen={chatOpen} onToggle={onToggleChat} />
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !form}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            保存
          </button>
        </div>
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

/* ---------------------- 「AI 助手」开关按钮 ---------------------- */
function AssistantToggle({ chatOpen, onToggle }: { chatOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        chatOpen
          ? "bg-indigo-100 text-indigo-700"
          : "border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
      }`}
    >
      <MessageSquare className="h-4 w-4" /> AI 助手
    </button>
  );
}

/* ---------------------- 列表（右侧偏好栏） ---------------------- */
function CardList({
  items,
  loading,
  error,
  filterKeywords,
  chatOpen,
  onToggleChat,
  onClearFilter,
  onOpen,
  onCreate,
}: {
  items: PreferenceProfileSummary[];
  loading: boolean;
  error: string | null;
  filterKeywords: string[];
  chatOpen: boolean;
  onToggleChat: () => void;
  onClearFilter: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const filtered = useMemo(
    () => items.filter((p) => matchesKeywords(p, filterKeywords)),
    [items, filterKeywords]
  );
  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-6">
        <h2 className="text-lg font-bold text-slate-900">投资偏好</h2>
        <div className="flex items-center gap-2">
          <AssistantToggle chatOpen={chatOpen} onToggle={onToggleChat} />
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> 创建偏好
          </button>
        </div>
      </header>
      {filterKeywords.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-indigo-50/50 px-6 py-2 text-xs text-slate-600">
          <Filter className="h-3.5 w-3.5 text-indigo-600" />
          <span>筛选：{filterKeywords.join("、")}（{filtered.length} 个）</span>
          <button type="button" onClick={onClearFilter} className="ml-auto text-indigo-600 hover:underline">
            清除
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载偏好…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
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
        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="text-sm text-slate-400">没有匹配筛选条件的偏好。</div>
        )}
        {!loading && filtered.length > 0 && (
          <div className={`grid grid-cols-1 gap-4 ${chatOpen ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {filtered.map((p) => (
              <PreferenceCard key={p.id} profile={p} onClick={() => onOpen(p.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------- 中间会话栏（指令助手） ---------------------- */
type ChatMsg = { id: string; role: "user" | "assistant"; text: string; pending?: boolean; error?: boolean };
let _mid = 0;
function mid() {
  _mid += 1;
  return `m${_mid}-${Date.now()}`;
}

function AssistantPanel({
  onClose,
  onCreated,
  onFilter,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
  onFilter: (keywords: string[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: mid(),
      role: "assistant",
      text: "你可以让我创建或筛选投资偏好，例如「帮我创建一个关注 AI、A 轮的投资偏好」「筛选出半导体相关的投资偏好」。",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const assistantId = mid();
    setInput("");
    setSending(true);
    setMessages((cur) => [
      ...cur,
      { id: mid(), role: "user", text },
      { id: assistantId, role: "assistant", text: "正在处理…", pending: true },
    ]);
    try {
      const res = await preferenceAssistant(text);
      setMessages((cur) =>
        cur.map((m) => (m.id === assistantId ? { ...m, text: res.message, pending: false } : m))
      );
      if (res.action === "create" && res.profile) {
        onCreated(res.profile.name);
      } else if (res.action === "filter") {
        onFilter(res.filter_keywords ?? []);
      }
      // unrelated：仅展示提示信息
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "请求失败，请确认后端已启动。";
      setMessages((cur) =>
        cur.map((m) => (m.id === assistantId ? { ...m, text: msg, pending: false, error: true } : m))
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-[400px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Sparkles className="h-4 w-4 text-indigo-600" /> 投资偏好 · AI 助手
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="关闭">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 ${
                  isUser
                    ? "bg-indigo-600 text-white"
                    : m.error
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {!isUser && <Bot className="mr-1.5 inline h-4 w-4 align-[-2px] text-indigo-600" />}
                {m.pending && <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin align-[-2px]" />}
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="用自然语言下达偏好指令…"
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            title="发送"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- 入口：三列编排 ---------------------- */
export default function PreferenceManager() {
  const [items, setItems] = useState<PreferenceProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);

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

  return (
    <div className="flex min-h-0 flex-1">
      {/* 中栏：会话指令助手（点 AI 助手后出现，形成左中右三列） */}
      {chatOpen && (
        <AssistantPanel
          onClose={() => setChatOpen(false)}
          onCreated={() => {
            setFilterKeywords([]); // 清除筛选，确保新卡片可见
            setSelectedId(null);
            void refresh();
          }}
          onFilter={(kw) => {
            setSelectedId(null);
            setFilterKeywords(kw);
          }}
        />
      )}

      {/* 右栏：投资偏好（卡片列表 / 详情编辑） */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selectedId ? (
          <DetailEditor
            id={selectedId}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
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
            filterKeywords={filterKeywords}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
            onClearFilter={() => setFilterKeywords([])}
            onOpen={(id) => setSelectedId(id)}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </div>

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
