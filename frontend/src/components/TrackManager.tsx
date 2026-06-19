/**
 * 赛道库管理（嵌入 ChatPage 的 mode==="tracks" 主区，**复用 ChatPage 左侧侧边栏**）。
 *
 * 与投资偏好页同构：点「AI 助手」后呈左中右三列（左=首页同款侧边栏 ｜ 中=会话栏 ｜ 右=赛道栏）。
 * 中间会话栏接受自然语言指令，系统自动在右侧完成：
 *   - 「帮我创建一个关注固态电池的赛道」→ 自动创建赛道草稿；
 *   - 「筛选出半导体相关的赛道」→ 自动过滤展示；
 *   - 与赛道无关的请求 → 提示用户输入相关操作。
 * 点击赛道卡片 → 调 onOpenTrack 在对话视图打开该赛道交付物（沿用 ChatPage 既有行为）。
 */
import { useMemo, useState } from "react";
import { ArrowUp, Bot, Filter, Loader2, MessageSquare, Plus, Sparkles, X } from "lucide-react";
import {
  ApiError,
  createManualThesis,
  trackAssistant,
  type HomeDeliverable,
} from "../lib/api";

function normTerm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}
function matchesKeywords(t: HomeDeliverable, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = normTerm(t.title);
  return keywords.some((k) => hay.includes(normTerm(k)));
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-CN");
  } catch {
    return iso.slice(0, 10);
  }
}

/* ---------------------- 「AI 助手」开关按钮 ---------------------- */
function AssistantToggle({ chatOpen, onToggle }: { chatOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        chatOpen ? "bg-indigo-100 text-indigo-700" : "border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
      }`}
    >
      <MessageSquare className="h-4 w-4" /> AI 助手
    </button>
  );
}

/* ---------------------- 赛道卡片 ---------------------- */
function TrackCard({ track, onClick }: { track: HomeDeliverable; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
    >
      <span className="text-sm font-bold text-slate-900">{track.title}</span>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{track.status}</span>
        <span>{formatDate(track.updated_at)}</span>
      </div>
    </button>
  );
}

/* ---------------------- 创建赛道弹窗 ---------------------- */
function CreateTrackModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [oneLine, setOneLine] = useState("");
  const [subDirections, setSubDirections] = useState("");
  const [opportunity, setOpportunity] = useState("中");
  const [risk, setRisk] = useState("中");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("请填写赛道名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createManualThesis({
        thesis_name: name.trim(),
        one_line_view: oneLine.trim() || null,
        opportunity_level: opportunity,
        risk_level: risk,
        sub_directions: subDirections
          .split(/[,，\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
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
          <h2 className="text-base font-bold text-slate-900">新建赛道</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">赛道名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：固态电池、具身智能"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">一句话判断（可选）</label>
            <input
              value={oneLine}
              onChange={(e) => setOneLine(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">子方向（可选，逗号或换行分隔）</label>
            <textarea
              value={subDirections}
              onChange={(e) => setSubDirections(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">机会等级</label>
              <input
                value={opportunity}
                onChange={(e) => setOpportunity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">风险等级</label>
              <input
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
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
            新建赛道
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- 中间会话栏（指令助手） ---------------------- */
type ChatMsg = { id: string; role: "user" | "assistant"; text: string; pending?: boolean; error?: boolean };
let _mid = 0;
function mid() {
  _mid += 1;
  return `t${_mid}-${Date.now()}`;
}

function TrackAssistantPanel({
  onClose,
  onCreated,
  onFilter,
}: {
  onClose: () => void;
  onCreated: () => void;
  onFilter: (keywords: string[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: mid(),
      role: "assistant",
      text: "你可以让我创建或筛选赛道，例如「帮我创建一个关注固态电池的赛道」「筛选出半导体相关的赛道」。",
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
      const res = await trackAssistant(text);
      setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, text: res.message, pending: false } : m)));
      if (res.action === "create" && res.deliverable) {
        onCreated();
      } else if (res.action === "filter") {
        onFilter(res.filter_keywords ?? []);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "请求失败，请确认后端已启动。";
      setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, text: msg, pending: false, error: true } : m)));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-[400px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Sparkles className="h-4 w-4 text-indigo-600" /> 赛道库 · AI 助手
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
            placeholder="用自然语言下达赛道指令…"
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
export default function TrackManager({
  theses,
  loading,
  onOpenTrack,
  onChanged,
}: {
  theses: HomeDeliverable[];
  loading: boolean;
  onOpenTrack: (id: string) => void;
  onChanged: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);

  const filtered = useMemo(
    () => theses.filter((t) => matchesKeywords(t, filterKeywords)),
    [theses, filterKeywords]
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* 中栏：会话指令助手 */}
      {chatOpen && (
        <TrackAssistantPanel
          onClose={() => setChatOpen(false)}
          onCreated={() => {
            setFilterKeywords([]);
            onChanged();
          }}
          onFilter={(kw) => setFilterKeywords(kw)}
        />
      )}

      {/* 右栏：赛道库 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-6">
          <h2 className="text-lg font-bold text-slate-900">赛道库</h2>
          <div className="flex items-center gap-2">
            <AssistantToggle chatOpen={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> 新建赛道
            </button>
          </div>
        </header>

        {filterKeywords.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-indigo-50/50 px-6 py-2 text-xs text-slate-600">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>筛选：{filterKeywords.join("、")}（{filtered.length} 个）</span>
            <button type="button" onClick={() => setFilterKeywords([])} className="ml-auto text-indigo-600 hover:underline">
              清除
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在加载赛道…
            </div>
          )}
          {!loading && theses.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-sm text-slate-500">赛道库暂无赛道</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> 新建赛道
              </button>
            </div>
          )}
          {!loading && theses.length > 0 && filtered.length === 0 && (
            <div className="text-sm text-slate-400">没有匹配筛选条件的赛道。</div>
          )}
          {!loading && filtered.length > 0 && (
            <div className={`grid grid-cols-1 gap-4 ${chatOpen ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {filtered.map((t) => (
                <TrackCard key={t.id} track={t} onClick={() => onOpenTrack(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateTrackModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setFilterKeywords([]);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
