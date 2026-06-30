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
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createDeal,
  dealAssistant,
  deleteDeal,
  downloadGeneratedFile,
  exportDealInformation,
  getDealDetail,
  listDeals,
  sendMessage,
  transitionDeal,
  triggerDealAction,
  updatePreDDMaterialStatus,
  type MessageReference,
  type SseHandlers,
  type TokenUsage,
} from "../lib/api";
import type { DealAction, DealDetail, DealStatus, DealSummary, PreDDMaterialCollectionStatus } from "../lib/types";
import { DealDetailPanel, updatePreDDMaterialStatusInDetail } from "../pages/WorkspacePage";

const STATUS_LABEL: Record<string, string> = {
  sourced: "已发现",
  screening: "初筛中",
  pre_dd: "尽调中",
  ic_ready: "待上会",
  approved: "进行中",
  rejected: "已否决",
  exited: "已退出",
  deleted: "已删除",
};

const SOURCE_LABEL: Record<string, string> = {
  user_input: "用户录入",
  bp_upload: "BP 上传",
  fa_recommendation: "FA 推荐",
  internal_excel: "内部表格",
  thesis_generated: "赛道推荐生成",
  public_signal_mining: "公开信号挖掘",
  system_push: "系统推送",
};

type DealFilterState = {
  foundedFrom: string;
  foundedTo: string;
  createdFrom: string;
  createdTo: string;
  sourceType: string;
  status: string;
  region: string;
};

const EMPTY_DEAL_FILTERS: DealFilterState = {
  foundedFrom: "",
  foundedTo: "",
  createdFrom: "",
  createdTo: "",
  sourceType: "",
  status: "",
  region: "",
};

function normTerm(s: string): string {
  return s.replace(/[\s_\-－]+/g, "").toLowerCase();
}

function parseDateRangeValue(value: string | null | undefined, rangeEnd = false): number | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const match = text.match(/(\d{4})(?:[-年/.](\d{1,2}))?(?:[-月/.](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : rangeEnd ? 12 : 1;
  const day = match[3]
    ? Number(match[3])
    : rangeEnd
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 1;
  const timestamp = Date.UTC(year, month - 1, day);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function dateRangeIntersects(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const valueStart = parseDateRangeValue(value, false);
  const valueEnd = parseDateRangeValue(value, true);
  if (valueStart == null || valueEnd == null) return false;
  const fromValue = from ? parseDateRangeValue(from, false) : null;
  const toValue = to ? parseDateRangeValue(to, true) : null;
  if (fromValue != null && valueEnd < fromValue) return false;
  if (toValue != null && valueStart > toValue) return false;
  return true;
}

function matchesDealFilters(deal: DealSummary, filters: DealFilterState): boolean {
  if (filters.status && deal.status !== filters.status) return false;
  if (filters.sourceType && deal.source_type !== filters.sourceType) return false;
  if (filters.region && deal.region !== filters.region) return false;
  if (!dateRangeIntersects(deal.founded_at, filters.foundedFrom, filters.foundedTo)) return false;
  if (!dateRangeIntersects(deal.created_at, filters.createdFrom, filters.createdTo)) return false;
  return true;
}

function matchesKeywords(d: DealSummary, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = normTerm([d.company_name ?? "", d.portrait ?? ""].join("\n"));
  return keywords.some((k) => hay.includes(normTerm(k)));
}
function matchesSearch(d: DealSummary, query: string): boolean {
  const term = normTerm(query);
  if (!term) return true;
  const hay = normTerm(
    [
      d.company_name ?? "",
      d.portrait ?? "",
      d.source_type ?? "",
      STATUS_LABEL[d.status] ?? d.status,
    ].join("\n")
  );
  return hay.includes(term);
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
function DealCard({
  deal,
  selected,
  onClick,
  onToggleSelect,
  onDelete,
}: {
  deal: DealSummary;
  selected: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          title={selected ? "取消选择项目" : "选择项目"}
          aria-label={`${selected ? "取消选择" : "选择"}${deal.company_name ?? "未命名项目"}`}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect();
          }}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
            selected
              ? "border-indigo-200 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-400 hover:border-indigo-200 hover:text-indigo-600"
          }`}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-bold text-slate-900">
              {deal.company_name ?? "（未命名项目）"}
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {STATUS_LABEL[deal.status] ?? deal.status}
            </span>
            <button
              type="button"
              title="删除项目"
              aria-label={`删除项目 ${deal.company_name ?? "未命名项目"}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      {deal.portrait && <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{deal.portrait}</p>}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        {deal.overall_fit != null && <span>匹配 {Math.round(deal.overall_fit)}</span>}
        {deal.is_in_library && <span className="text-emerald-500">已入库</span>}
        {deal.is_liked && <span className="text-amber-500">关注</span>}
        {deal.is_abandoned && <span className="text-slate-400">已放弃</span>}
      </div>
    </div>
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
  const [conversationId] = useState(() => makeConversationId());
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

    const references: MessageReference[] = [
      {
        kind: "deal",
        id: workspaceDeal.id,
        title: companyName,
        subtitle: analysis.portrait ?? STATUS_LABEL[workspaceDeal.status] ?? workspaceDeal.status,
      },
    ];
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
      references,
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
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(() => new Set());
  const [dealExportBusy, setDealExportBusy] = useState(false);
  const [dealExportError, setDealExportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [preDDMaterialStatusBusyKey, setPreDDMaterialStatusBusyKey] = useState<string | null>(null);
  const [preDDMaterialStatusError, setPreDDMaterialStatusError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dealFilters, setDealFilters] = useState<DealFilterState>(EMPTY_DEAL_FILTERS);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDeals({ limit: 200 });
      setDeals(res.items);
      setSelectedDealIds((current) => {
        const availableIds = new Set(res.items.map((item) => item.id));
        return new Set([...current].filter((id) => availableIds.has(id)));
      });
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
    setPreDDMaterialStatusError(null);
    setPreDDMaterialStatusBusyKey(null);
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
      setPreDDMaterialStatusError(null);
      setPreDDMaterialStatusBusyKey(null);
      setDetailLoading(false);
    }
  }, [loadDealDetail, selectedDealId]);

  const sourceOptions = useMemo(
    () => Array.from(new Set(deals.map((deal) => deal.source_type).filter(Boolean) as string[])).sort(),
    [deals]
  );
  const regionOptions = useMemo(
    () => Array.from(new Set(deals.map((deal) => deal.region?.trim()).filter(Boolean) as string[])).sort(),
    [deals]
  );
  const activeStructuredFilterCount = Object.values(dealFilters).filter(Boolean).length;
  const filtered = useMemo(
    () =>
      deals.filter(
        (d) =>
          matchesKeywords(d, filterKeywords) &&
          matchesSearch(d, searchQuery) &&
          matchesDealFilters(d, dealFilters)
      ),
    [deals, filterKeywords, searchQuery, dealFilters]
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

  function toggleDealSelection(id: string) {
    setDealExportError(null);
    setSelectedDealIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExportDealInformation() {
    const dealIds = [...selectedDealIds];
    if (dealIds.length === 0) return;
    setDealExportBusy(true);
    setDealExportError(null);
    try {
      const response = await exportDealInformation(dealIds);
      await downloadGeneratedFile(response.file);
    } catch (error) {
      setDealExportError(error instanceof ApiError ? error.message : "导出项目信息失败");
    } finally {
      setDealExportBusy(false);
    }
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

  async function handlePreDDMaterialStatusChange(
    taskKey: string,
    status: PreDDMaterialCollectionStatus
  ) {
    const targetDealId = selectedDeal?.id ?? selectedDealId;
    if (!targetDealId) return;
    const previousDetail = selectedDeal;

    setPreDDMaterialStatusBusyKey(taskKey);
    setPreDDMaterialStatusError(null);
    setSelectedDeal((current) =>
      current && current.id === targetDealId
        ? updatePreDDMaterialStatusInDetail(current, taskKey, status)
        : current
    );

    try {
      await updatePreDDMaterialStatus(targetDealId, taskKey, status);
      try {
        const refreshed = await getDealDetail(targetDealId);
        setSelectedDeal(refreshed);
        setDetailError(null);
        setPreDDMaterialStatusError(null);
      } catch {
        setPreDDMaterialStatusError("状态已更新，但刷新项目详情失败，请稍后刷新页面确认。");
      }
    } catch (e) {
      setSelectedDeal((current) =>
        previousDetail && current?.id === previousDetail.id ? previousDetail : current
      );
      setPreDDMaterialStatusError(e instanceof ApiError ? e.message : "更新 Pre-DD 资料状态失败");
    } finally {
      setPreDDMaterialStatusBusyKey(null);
    }
  }

  async function handleDeleteDeal(deal: DealSummary) {
    const name = deal.company_name ?? "未命名项目";
    if (!window.confirm(`确认删除「${name}」吗？删除后将从项目库中移除。`)) {
      return;
    }
    try {
      await deleteDeal(deal.id);
      if (selectedDealId === deal.id) {
        closeDealDetail();
      }
      void refresh();
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : "删除项目失败");
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
            {!selectedDealId && (
              <button
                type="button"
                disabled={selectedDealIds.size === 0 || dealExportBusy}
                onClick={() => void handleExportDealInformation()}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                {dealExportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出项目信息{selectedDealIds.size > 0 ? ` ${selectedDealIds.size}` : ""}
              </button>
            )}
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

        {!selectedDealId && (selectedDealIds.size > 0 || dealExportError) && (
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-500">
            <span>{selectedDealIds.size > 0 ? `已选择 ${selectedDealIds.size} 个项目，可导出为 Excel。` : ""}</span>
            {selectedDealIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDealIds(new Set())}
                className="font-semibold text-indigo-600 hover:underline"
              >
                清空选择
              </button>
            )}
            {dealExportError && <span className="ml-auto text-rose-500">{dealExportError}</span>}
          </div>
        )}

        {filterKeywords.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-indigo-50/50 px-6 py-2 text-xs text-slate-600">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>筛选：{filterKeywords.join("、")}（{filtered.length} 个）</span>
            <button type="button" onClick={() => setFilterKeywords([])} className="ml-auto text-indigo-600 hover:underline">
              清除
            </button>
          </div>
        )}

        {!selectedDealId && (
          <div className="shrink-0 border-b border-slate-200 px-6 py-3">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索项目名称、画像、来源或状态"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="清空搜索"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-6">
              <label className="block">
                <span className="mb-1 block font-semibold">成立时间</span>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="month"
                    value={dealFilters.foundedFrom}
                    onChange={(event) =>
                      setDealFilters((current) => ({ ...current, foundedFrom: event.target.value }))
                    }
                    className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 outline-none focus:border-indigo-300"
                  />
                  <input
                    type="month"
                    value={dealFilters.foundedTo}
                    onChange={(event) =>
                      setDealFilters((current) => ({ ...current, foundedTo: event.target.value }))
                    }
                    className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 outline-none focus:border-indigo-300"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">入库时间</span>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="date"
                    value={dealFilters.createdFrom}
                    onChange={(event) =>
                      setDealFilters((current) => ({ ...current, createdFrom: event.target.value }))
                    }
                    className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 outline-none focus:border-indigo-300"
                  />
                  <input
                    type="date"
                    value={dealFilters.createdTo}
                    onChange={(event) =>
                      setDealFilters((current) => ({ ...current, createdTo: event.target.value }))
                    }
                    className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 outline-none focus:border-indigo-300"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">项目来源</span>
                <select
                  value={dealFilters.sourceType}
                  onChange={(event) =>
                    setDealFilters((current) => ({ ...current, sourceType: event.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-indigo-300"
                >
                  <option value="">全部来源</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {SOURCE_LABEL[source] ?? source}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">项目状态</span>
                <select
                  value={dealFilters.status}
                  onChange={(event) =>
                    setDealFilters((current) => ({ ...current, status: event.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-indigo-300"
                >
                  <option value="">全部状态</option>
                  {Object.entries(STATUS_LABEL)
                    .filter(([status]) => status !== "deleted")
                    .map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">地域</span>
                <select
                  value={dealFilters.region}
                  onChange={(event) =>
                    setDealFilters((current) => ({ ...current, region: event.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-indigo-300"
                >
                  <option value="">全部地域</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={activeStructuredFilterCount === 0}
                  onClick={() => setDealFilters(EMPTY_DEAL_FILTERS)}
                  className="h-8 rounded-lg border border-slate-200 px-3 font-semibold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  清空筛选{activeStructuredFilterCount > 0 ? ` ${activeStructuredFilterCount}` : ""}
                </button>
              </div>
            </div>
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
                  onMaterialUploaded={() => loadDealDetail(selectedDeal.id)}
                  onPreDDMaterialStatusChange={handlePreDDMaterialStatusChange}
                  preDDMaterialStatusBusyKey={preDDMaterialStatusBusyKey}
                  preDDMaterialStatusError={preDDMaterialStatusError}
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
                <div className="text-sm text-slate-400">没有匹配搜索或筛选条件的项目。</div>
              )}
              {!loading && filtered.length > 0 && (
                <div className={`grid grid-cols-1 gap-4 ${chatOpen ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
                  {filtered.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      selected={selectedDealIds.has(d.id)}
                      onClick={() => openDeal(d.id)}
                      onToggleSelect={() => toggleDealSelection(d.id)}
                      onDelete={() => void handleDeleteDeal(d)}
                    />
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
