/**
 * 投资偏好界面 —— 用户自建命名偏好卡片的 列表 / 创建 / 详情编辑。
 *
 * 布局与全站一致：保留左侧侧边栏（导航 + 用户），主区是偏好卡片 / 详情；
 * 右下角常驻一个**可打开 / 关闭的 AI 对话窗口**，用户可用自然语言对投资偏好提需求
 * （复用通用对话 PageAssistant，注入当前偏好上下文）。
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
import {
  ArrowLeft,
  Atom,
  Check,
  FolderKanban,
  Library,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";
import {
  ApiError,
  createPreferenceProfile,
  getHome,
  getPreferenceProfile,
  getPreferenceRecommendations,
  listPreferenceProfiles,
  updatePreferenceProfile,
  type HomeData,
  type PreferenceProfileContent,
  type PreferenceProfileSummary,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import PageAssistant from "../components/PageAssistant";

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

/* ============================ 左侧侧边栏 ============================ */
function NavItem({
  icon: Icon,
  label,
  meta,
  active,
  onClick,
}: {
  icon: typeof Target;
  label: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {meta && <span className="text-xs text-slate-400">{meta}</span>}
    </button>
  );
}

function Sidebar({ home }: { home: HomeData | null }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const dealCount = home?.deals.length ?? 0;
  const thesisCount = home?.deliverables.filter((d) => d.type === "thesis").length ?? 0;
  const userName = home?.user.name ?? "我的账户";
  const userSubtitle = home?.institution.name ?? home?.user.email ?? "";

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center text-indigo-600">
          <Atom className="h-9 w-9" strokeWidth={2.4} />
        </div>
        <div className="text-2xl font-bold">AtomCAP</div>
      </div>

      <nav className="space-y-1">
        <NavItem icon={Plus} label="新对话" onClick={() => navigate("/")} />
        <NavItem icon={FolderKanban} label="项目库" meta={String(dealCount)} onClick={() => navigate("/workspace")} />
        <NavItem icon={Library} label="赛道库" meta={String(thesisCount)} onClick={() => navigate("/?view=tracks")} />
        <NavItem icon={Target} label="投资偏好" active onClick={() => navigate("/preferences")} />
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={handleSignOut}
          title="退出登录"
          className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-900">{userName}</div>
            <div className="truncate text-xs text-slate-500">{userSubtitle}</div>
          </div>
          <LogOut className="h-5 w-5 text-slate-500" />
        </button>
      </div>
    </aside>
  );
}

/* ====================== 可开关的 AI 对话窗口 ====================== */
/** 右下角常驻浮窗：关闭时是一个启动按钮，打开时是带标题/关闭键的对话面板（中间偏下）。 */
function PreferenceChatDock({ contextSummary }: { contextSummary: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
      >
        <MessageSquare className="h-5 w-5" /> AI 助手
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-indigo-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Sparkles className="h-4 w-4 text-indigo-600" /> 投资偏好 · AI 助手
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" title="关闭">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-3">
        <PageAssistant
          contextLabel="投资偏好"
          contextSummary={contextSummary}
          placeholder="用自然语言描述你的投资偏好需求…"
        />
      </div>
    </div>
  );
}

/* ============================ 单维度增量编辑器 ============================ */
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
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
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

/* ============================ 列表视图 ============================ */
function ListView() {
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
      // 500 常见原因：数据库尚未建表（首次启用本功能需迁移）
      if (e instanceof ApiError && e.status === 500) {
        setError("加载失败（500）。如首次使用本功能，请在 backend 目录执行：alembic upgrade head 完成数据库迁移后重试。");
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
    if (items.length === 0) return "用户尚未创建任何投资偏好卡片。";
    return `用户已创建 ${items.length} 个投资偏好：${items.map((p) => p.name).join("、")}。`;
  }, [items]);

  return (
    <>
      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6">
          <h1 className="text-lg font-bold text-slate-900">投资偏好</h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
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
                onClick={() => setCreateOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> 创建偏好
              </button>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <PreferenceCard key={p.id} profile={p} onClick={() => navigate(`/preferences/${p.id}`)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <PreferenceChatDock contextSummary={chatContext} />

      {createOpen && (
        <CreatePreferenceModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void refresh(); // 创建后刷新，新卡片即出现在列表
          }}
        />
      )}
    </>
  );
}

/* ============================ 详情 / 编辑视图 ============================ */
function DetailView({ profileId }: { profileId: string }) {
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

  const chatContext = useMemo(() => {
    if (!form) return "正在查看一个投资偏好。";
    const dims = DIMENSIONS.map((d) => `${d.label}：${form[d.key].join("、") || "未配置"}`).join("；");
    return `当前编辑偏好「${form.name}」。${dims}。`;
  }, [form]);

  return (
    <>
      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6">
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
      </main>

      <PreferenceChatDock contextSummary={chatContext} />
    </>
  );
}

/* ============================ 入口：侧边栏 + 主区（按路由分流） ============================ */
export default function PreferencePage() {
  const { profileId } = useParams();
  const [home, setHome] = useState<HomeData | null>(null);

  useEffect(() => {
    let alive = true;
    getHome()
      .then((h) => {
        if (alive) setHome(h);
      })
      .catch(() => {
        /* 侧边栏计数取不到不阻塞主流程 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbfcff] text-slate-950">
      <Sidebar home={home} />
      {profileId ? <DetailView profileId={profileId} /> : <ListView />}
    </div>
  );
}
