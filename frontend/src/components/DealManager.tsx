/**
 * 项目库管理（嵌入 ChatPage 的 mode==="deals" 主区，**复用 ChatPage 左侧侧边栏**）。
 *
 * 与投资偏好 / 赛道库同构：点「AI 助手」后呈左中右三列（左=首页同款侧边栏 ｜ 中=会话栏 ｜
 * 右=项目栏）。中间会话栏接受自然语言指令，系统自动在右侧完成：
 *   - 「帮我创建一个叫追觅科技的项目」→ 自动创建项目草稿；
 *   - 「筛选出半导体相关的项目」→ 自动过滤展示；
 *   - 与项目无关的请求 → 提示用户输入相关操作。
 * 点击项目卡片 → 跳转 /workspace/:id 打开该项目工作台（Pre-DD、管线推进等深度动作）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  ApiError,
  createDeal,
  dealAssistant,
  getDealDetail,
  listDeals,
  sendMessage,
  transitionDeal,
  triggerDealAction,
  type SseHandlers,
  type TokenUsage,
} from "../lib/api";
import type { DealAction, DealDetail, DealStatus, DealSummary } from "../lib/types";
import { DealDetailPanel } from "../pages/WorkspacePage";

const STATUS_LABEL: Record<string, string> = {
  sourced: "已发现",
  screening: "筛选中",
  pre_dd: "尽调中",
  ic_ready: "待上会",
  approved: "已立项",
  rejected: "已否决",
};

function normTerm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}
function matchesKeywords(d: DealSummary, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = normTerm([d.company_name ?? "", d.portrait ?? ""].join("\n"));
  return keywords.some((k) => hay.includes(normTerm(k)));
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

/* ---------------------- 项目卡片 ---------------------- */
function DealCard({ deal, onClick }: { deal: DealSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-slate-900">
          {deal.company_name ?? "（未命名项目）"}
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {STATUS_LABEL[deal.status] ?? deal.status}
        </span>
      </div>
      {deal.portrait && <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{deal.portrait}</p>}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        {deal.overall_fit != null && <span>匹配 {Math.round(deal.overall_fit)}</span>}
        {deal.is_in_library && <span className="text-emerald-500">已入库</span>}
        {deal.is_liked && <span className="text-amber-500">关注</span>}
        {deal.is_abandoned && <span className="text-slate-400">已放弃</span>}
      </div>
    </button>
  );
}

/* ---------------------- 创建项目弹窗 ---------------------- */
function CreateDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [track, setTrack] = useState("");
  const [stage, setStage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("请填写项目/公司名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDeal({
        company_name: name.trim(),
        one_line_intro: intro.trim() || null,
        track: track.trim() || null,
        funding_stage: stage.trim() || null,
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
          <h2 className="text-base font-bold text-slate-900">新建项目</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">项目 / 公司名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：追觅科技"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">一句话介绍（可选）</label>
            <input
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">赛道（可选）</label>
              <input
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">融资阶段（可选）</label>
              <input
                value={stage}
                onChange={(e) => setStage(e.target.value)}
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
            新建项目
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- 中间会话栏（指令助手 / 项目工作台会话） ---------------------- */
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
  usage?: TokenUsage;
  pending?: boolean;
  streaming?: boolean;
  error?: boolean;
};
let _mid = 0;
function mid() {
  _mid += 1;
  return `d${_mid}-${Date.now()}`;
}

function makeConversationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `deal-conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updateAssistantMessage(
  messages: ChatMsg[],
  id: string,
  updater: (message: ChatMsg) => ChatMsg
) {
  return messages.map((message) => (message.id === id ? updater(message) : message));
}

function formatTokens(usage: TokenUsage): string {
  const parts: string[] = [];
  if (usage.estimated) parts.push("预估");
  if (typeof usage.prompt_tokens === "number") parts.push(`输入 ${usage.prompt_tokens}`);
  if (typeof usage.completion_tokens === "number") parts.push(`输出 ${usage.completion_tokens}`);
  const total =
    typeof usage.total_tokens === "number"
      ? usage.total_tokens
      : (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0) || undefined;
  if (typeof total === "number") parts.push(`共 ${total} tokens`);
  return parts.join(" · ");
}

function AssistantReasoning({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Brain className="h-3.5 w-3.5" />
        <span>思考过程{streaming ? "（生成中…）" : ""}</span>
      </button>
      {open && (
        <div className="whitespace-pre-wrap border-t border-slate-200 px-2.5 py-2 text-xs leading-5 text-slate-500">
          {text}
        </div>
      )}
    </div>
  );
}

function DealAssistantPanel({
  onClose,
  onCreated,
  onFilter,
  workspaceDeal,
  onWorkspaceChanged,
}: {
  onClose: () => void;
  onCreated: () => void;
  onFilter: (keywords: string[]) => void;
  workspaceDeal?: DealDetail | null;
  onWorkspaceChanged?: () => void;
}) {
  const isWorkspace = !!workspaceDeal;
  const companyName =
    workspaceDeal?.company?.name ??
    workspaceDeal?.data.extraction.company_name ??
    "当前项目";
  const [conversationId] = useState(
    () => workspaceDeal?.data.workspace.conversation_id ?? makeConversationId()
  );
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: mid(),
      role: "assistant",
      text: isWorkspace
        ? `当前是「${companyName}」的项目工作台。这里发起的会话和操作只会围绕这个项目。`
        : "你可以让我创建或筛选项目，例如「帮我创建一个叫追觅科技的项目」「筛选出半导体相关的项目」。",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function sendWorkspaceMessage(text: string, assistantId: string) {
    if (!workspaceDeal) return;
    const extraction = workspaceDeal.data.extraction;
    const analysis = workspaceDeal.data.analysis;
    const context = [
      "当前页面：项目工作台",
      "对话类型：项目工作台",
      `操作对象：${companyName}`,
      `deal_id：${workspaceDeal.id}`,
      `状态：${STATUS_LABEL[workspaceDeal.status] ?? workspaceDeal.status}`,
      `来源：${workspaceDeal.data.source_type}`,
      `项目画像：${analysis.portrait}`,
      extraction.track ? `赛道：${extraction.track}` : "",
      extraction.sub_direction ? `子方向：${extraction.sub_direction}` : "",
      extraction.funding_stage ? `融资阶段：${extraction.funding_stage}` : "",
      `整体匹配度：${analysis.overall_fit}`,
      "用户在该页面提出的分析、风险梳理、资料补全和后续建议，均只针对当前项目。",
    ]
      .filter(Boolean)
      .join("\n");

    const handlers: SseHandlers = {
      onProgress(next) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({ ...m, text: next, pending: true }))
        );
      },
      onToken(token) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({
            ...m,
            text: `${m.pending ? "" : m.text}${token}`,
            pending: false,
            streaming: true,
          }))
        );
      },
      onReasoning(delta) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({
            ...m,
            reasoning: (m.reasoning ?? "") + delta,
            streaming: true,
          }))
        );
      },
      onObject(ref) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({
            ...m,
            text:
              m.text && !m.pending
                ? `${m.text}\n\n已生成结果：${ref.type}`
                : `已生成结果：${ref.type}`,
            pending: false,
            streaming: true,
          }))
        );
        onWorkspaceChanged?.();
      },
      onUsage(usage) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({ ...m, usage }))
        );
      },
      onError(message) {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({
            ...m,
            text: message,
            pending: false,
            streaming: false,
            error: true,
          }))
        );
      },
      onDone() {
        setMessages((cur) =>
          updateAssistantMessage(cur, assistantId, (m) => ({
            ...m,
            text: m.text || "已完成。",
            pending: false,
            streaming: false,
          }))
        );
        onWorkspaceChanged?.();
      },
    };

    await sendMessage(conversationId, text, handlers, undefined, undefined, context, {
      conversationType: "project_workspace",
      sourceDealId: workspaceDeal.id,
    });
  }

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
      if (isWorkspace) {
        await sendWorkspaceMessage(text, assistantId);
      } else {
        const res = await dealAssistant(text);
        setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, text: res.message, pending: false } : m)));
        if (res.action === "create" && res.deal) {
          onCreated();
        } else if (res.action === "filter") {
          onFilter(res.filter_keywords ?? []);
        }
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
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>{isWorkspace ? "项目工作台 · AI 助手" : "项目库 · AI 助手"}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-400">
            {isWorkspace ? `操作对象：${companyName}` : "普通对话 · 面向全部项目"}
          </div>
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
              <div className="max-w-[88%]">
                {!isUser && m.reasoning && (
                  <AssistantReasoning text={m.reasoning} streaming={!!m.streaming} />
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm leading-6 ${
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
                {!isUser && m.usage && (
                  <div className="mt-1 px-1 text-[11px] text-slate-400">{formatTokens(m.usage)}</div>
                )}
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
            placeholder="用自然语言下达项目指令…"
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
export default function DealManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedDealId = searchParams.get("dealId");
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDeals({ limit: 200 });
      setDeals(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? `加载失败（${e.status}）` : "后端未启动（uvicorn app.main:app）");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadDealDetail = useCallback(async (id: string) => {
    setSelectedDeal(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await getDealDetail(id);
      setSelectedDeal(detail);
    } catch (e) {
      setDetailError(
        e instanceof ApiError
          ? e.status === 404
            ? "项目不存在"
            : `加载详情失败（${e.status}）`
          : "项目详情加载失败"
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDealId) {
      void loadDealDetail(selectedDealId);
    } else {
      setSelectedDeal(null);
      setDetailError(null);
      setDetailLoading(false);
    }
  }, [loadDealDetail, selectedDealId]);

  const filtered = useMemo(
    () => deals.filter((d) => matchesKeywords(d, filterKeywords)),
    [deals, filterKeywords]
  );

  function openDeal(id: string) {
    navigate(`/?view=deals&dealId=${id}`);
  }

  function closeDealDetail() {
    navigate("/?view=deals");
  }

  function refreshAfterDetailAction() {
    void refresh();
    if (selectedDealId) void loadDealDetail(selectedDealId);
  }

  async function handleTransition(to: DealStatus) {
    if (!selectedDealId) return;
    setDetailBusy(true);
    try {
      await transitionDeal(selectedDealId, to);
      refreshAfterDetailAction();
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "流转失败");
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleAction(action: DealAction) {
    if (!selectedDealId) return;
    setDetailBusy(true);
    try {
      await triggerDealAction(selectedDealId, action);
      refreshAfterDetailAction();
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 中栏：会话指令助手 */}
      {chatOpen && (
        <DealAssistantPanel
          key={selectedDeal ? `workspace-${selectedDeal.id}` : "library"}
          onClose={() => setChatOpen(false)}
          onCreated={() => {
            setFilterKeywords([]);
            void refresh();
          }}
          onFilter={(kw) => setFilterKeywords(kw)}
          workspaceDeal={selectedDeal}
          onWorkspaceChanged={refreshAfterDetailAction}
        />
      )}

      {/* 右栏：项目库 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-6">
          <h2 className="text-lg font-bold text-slate-900">
            {selectedDealId ? "项目工作台" : "项目库"}
          </h2>
          <div className="flex items-center gap-2">
            <AssistantToggle chatOpen={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> 新建项目
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
          {selectedDealId ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={closeDealDetail}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                返回项目库
              </button>

              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在加载项目详情…
                </div>
              )}

              {detailError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {detailError}
                </div>
              )}

              {selectedDeal && (
                <DealDetailPanel
                  detail={selectedDeal}
                  busy={detailBusy}
                  onTransition={handleTransition}
                  onAction={handleAction}
                />
              )}
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在加载项目…
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
              )}
              {!loading && !error && deals.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                  <p className="text-sm text-slate-500">项目库暂无项目</p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" /> 新建项目
                  </button>
                </div>
              )}
              {!loading && deals.length > 0 && filtered.length === 0 && (
                <div className="text-sm text-slate-400">没有匹配筛选条件的项目。</div>
              )}
              {!loading && filtered.length > 0 && (
                <div className={`grid grid-cols-1 gap-4 ${chatOpen ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
                  {filtered.map((d) => (
                    <DealCard key={d.id} deal={d} onClick={() => openDeal(d.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateDealModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setFilterKeywords([]);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
