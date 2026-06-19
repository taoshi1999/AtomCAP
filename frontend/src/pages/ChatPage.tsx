/**
 * 首页 —— 数据驱动的新对话工作台。
 *
 * 首屏数据来自 /api/home：用户/机构、投资偏好、最近会话、交付物、项目摘要。
 * 不在前端硬编码 mock Thesis 或假最近记录。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Atom,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderKanban,
  GraduationCap,
  History,
  Library,
  LogOut,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { DeliverableView } from "../components/objects/registry";
import PageAssistant from "../components/PageAssistant";
import PreferenceManager from "../components/PreferenceManager";
import {
  createManualThesis,
  getConversationMessages,
  getDeliverable,
  getHome,
  getModels,
  listConversations,
  type ConversationMessage,
  type HomeConversation,
  type HomeData,
  type HomeDeliverable,
  type MessageBlock,
  type ModelOption,
  type TokenUsage,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { useChatSession, type ChatMessage } from "../lib/chatSession";
import type { Deliverable } from "../lib/types";

type HomeMode = "chat" | "tracks" | "preference";

type RecentItem =
  | {
      kind: "conversation";
      id: string;
      title: string;
      subtitle?: string | null;
      updated_at: string;
    }
  | {
      kind: "deliverable";
      id: string;
      title: string;
      subtitle?: string | null;
      updated_at: string;
    }
  | {
      kind: "deal";
      id: string;
      title: string;
      subtitle?: string | null;
      updated_at: string;
    };

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请确认服务已启动。";
}

function normalizeBlocks(content: ConversationMessage["content"]): MessageBlock[] {
  if (Array.isArray(content)) return content;
  return content.blocks ?? [];
}

function blocksToText(blocks: MessageBlock[]) {
  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

function usageFromBlocks(blocks: MessageBlock[]): TokenUsage | undefined {
  const block = blocks.find((b) => b.type === "usage") as
    | (MessageBlock & { usage?: TokenUsage })
    | undefined;
  return block?.usage;
}

function getStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function preferenceList(home: HomeData | null, key: "sectors" | "stages" | "regions") {
  const preference = home?.preference.preference ?? {};
  const declared = preference.declared_strategy as Record<string, unknown> | undefined;
  if (key === "sectors") {
    return [
      ...getStringList(declared?.focus_sectors),
      ...getStringList(preference.track_preferences),
    ];
  }
  if (key === "stages") {
    return [
      ...getStringList(declared?.focus_stages),
      ...getStringList(preference.stages),
    ];
  }
  return [
    ...getStringList(declared?.focus_regions),
    ...getStringList(preference.geographies),
  ];
}

function displayList(items: string[], empty = "未设置") {
  return items.length > 0 ? items.slice(0, 3).join(" / ") : empty;
}

function parseListInput(value: string) {
  return value
    .split(/[,，、/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function dealStatusLabel(status: string) {
  const labels: Record<string, string> = {
    sourced: "已获取",
    screening: "初筛中",
    pre_dd: "待尽调",
    ic_ready: "待上会",
    approved: "已通过",
    rejected: "已否决",
  };
  return labels[status] ?? status;
}

function visibleModelOptions(options: ModelOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const model = option.model.trim();
    if (!option.available || !model || seen.has(model)) return false;
    seen.add(model);
    return true;
  });
}

export default function ChatPage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [mode, setMode] = useState<HomeMode>(() => {
    // 支持其它页面（如投资偏好页侧边栏）经 ?view= 深链到指定模式
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "tracks" || view === "preference" ? view : "chat";
  });
  const [input, setInput] = useState("");
  const {
    conversationId,
    messages,
    progress,
    isSending,
    recentConversationOverrides,
    streamingConversationIds,
    completionSeq,
    startNewConversation,
    setActiveConversationId,
    setConversationMessages,
    setConversationProgress,
    setConversationSending,
    clearRecentOverrides,
    startTextMessage,
    startUpload,
  } = useChatSession();
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [modelTier, setModelTier] = useState<string>("standard");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyItems, setHistoryItems] = useState<HomeConversation[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getModels()
      .then((info) => {
        if (!active) return;
        const options = visibleModelOptions(info.options);
        setModelOptions(options);
        setModelTier((current) =>
          options.some((option) => option.tier === current)
            ? current
            : options.find((option) => option.tier === info.default_tier)?.tier ??
              options[0]?.tier ??
              info.default_tier
        );
      })
      .catch(() => {
        /* 模型自检失败不阻塞对话，沿用后端默认档位 */
      });
    return () => {
      active = false;
    };
  }, []);
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackDraft, setTrackDraft] = useState({
    thesis_name: "",
    one_line_view: "",
    opportunity_level: "中",
    risk_level: "中",
    advice: "",
    sub_directions: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function refreshHome() {
    try {
      setHomeError(null);
      const data = await getHome();
      setHome(data);
      clearRecentOverrides(data.conversations.map((item) => item.id));
    } catch (error) {
      setHomeError(compactError(error));
    } finally {
      setIsHomeLoading(false);
    }
  }

  useEffect(() => {
    void refreshHome();
  }, []);

  useEffect(() => {
    if (completionSeq > 0) void refreshHome();
  }, [completionSeq]);

  useEffect(() => {
    if (!historyDialogOpen) return;
    const timer = window.setTimeout(() => {
      void refreshConversationHistory(historyQuery);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [historyDialogOpen, historyQuery]);

  async function refreshConversationHistory(query = historyQuery) {
    try {
      setIsHistoryLoading(true);
      setHistoryError(null);
      const data = await listConversations({
        limit: 100,
        q: query.trim() || undefined,
      });
      setHistoryItems(data.items);
      setHistoryTotal(data.total);
    } catch (error) {
      setHistoryError(compactError(error));
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function openHistoryDialog() {
    setHistoryDialogOpen(true);
  }

  const recentItems = useMemo<RecentItem[]>(() => {
    const homeConversations = home?.conversations ?? [];
    const overrideIds = new Set(recentConversationOverrides.map((item) => item.id));
    const conversations = [
      ...recentConversationOverrides,
      ...homeConversations.filter((item) => !overrideIds.has(item.id)),
    ];

    return [
      ...conversations.map((item) => ({
        kind: "conversation" as const,
        id: item.id,
        title: item.title,
        subtitle: item.preview,
        updated_at: item.updated_at,
      })),
      ...(home?.deliverables ?? []).map((item) => ({
        kind: "deliverable" as const,
        id: item.id,
        title: item.title,
        subtitle: item.status,
        updated_at: item.updated_at,
      })),
      ...(home?.deals ?? []).map((item) => ({
        kind: "deal" as const,
        id: item.id,
        title: item.company_name ?? "未命名项目",
        subtitle: item.portrait ?? dealStatusLabel(item.status),
        updated_at: item.updated_at,
      })),
    ]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [home, recentConversationOverrides]);

  const suggested = useMemo(() => {
    const [sector] = preferenceList(home, "sectors");
    const [stage] = preferenceList(home, "stages");
    if (sector) {
      return [
        `帮我梳理 ${sector} 最近值得关注的方向`,
        `基于我的偏好，找一批 ${sector} 相关项目`,
        `扫描一个 ${sector} 项目的关键风险`,
      ];
    }
    if (stage) {
      return [
        `帮我找一些 ${stage} 阶段的优质项目`,
        "帮我梳理一个新赛道的机会和风险",
        "粘贴项目材料后帮我做初步分析",
      ];
    }
    return [
      "帮我梳理一个新赛道的机会和风险",
      "帮我发现一批匹配机构偏好的项目",
      "粘贴项目材料后帮我做初步分析",
    ];
  }, [home]);

  const userName = home?.user.name || "你好";
  const userSubtitle = home?.user.email || home?.institution.name || "";
  const trackContextSummary = useMemo(() => {
    const theses = (home?.deliverables ?? []).filter((item) => item.type === "thesis");
    if (theses.length === 0) return "赛道库暂无赛道。";
    return theses
      .slice(0, 6)
      .map((item) => `${item.title}（${item.status}）`)
      .join("；");
  }, [home]);

  async function handleCreateThesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const thesisName = trackDraft.thesis_name.trim();
    if (!thesisName) return;
    try {
      setActionError(null);
      await createManualThesis({
        thesis_name: thesisName,
        one_line_view: trackDraft.one_line_view.trim() || null,
        opportunity_level: trackDraft.opportunity_level,
        risk_level: trackDraft.risk_level,
        advice: trackDraft.advice.trim() || null,
        sub_directions: parseListInput(trackDraft.sub_directions),
      });
      setTrackDialogOpen(false);
      setTrackDraft({
        thesis_name: "",
        one_line_view: "",
        opportunity_level: "中",
        risk_level: "中",
        advice: "",
        sub_directions: "",
      });
      await refreshHome();
      setMode("tracks");
    } catch (error) {
      setActionError(compactError(error));
    }
  }

  function handleNewConversation() {
    startNewConversation();
    setInput("");
    setMode("chat");
  }

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  async function fetchMessageDeliverables(blocks: MessageBlock[]) {
    const refs = blocks
      .filter((block) => block.type === "object_ref" && block.deliverable_id)
      .map((block) => block.deliverable_id as string);
    const deliverables = await Promise.all(
      refs.map((id) => getDeliverable(id).catch(() => null))
    );
    return deliverables.filter((item): item is Deliverable => item !== null);
  }

  async function loadConversation(id: string) {
    setMode("chat");
    setActiveConversationId(id);
    if (streamingConversationIds.has(id)) return;
    setConversationProgress(id, null);
    setConversationSending(id, false);
    setConversationMessages(id, [
      {
        id: makeId(),
        role: "assistant",
        content: "正在加载历史会话...",
        deliverables: [],
        pending: true,
      },
    ]);
    try {
      const data = await getConversationMessages(id);
      const loaded = await Promise.all(
        data.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map(async (message): Promise<ChatMessage> => {
            const blocks = normalizeBlocks(message.content);
            return {
              id: message.id,
              role: message.role === "user" ? "user" : "assistant",
              content: blocksToText(blocks),
              deliverables: await fetchMessageDeliverables(blocks),
              usage: usageFromBlocks(blocks),
            };
          })
      );
      setConversationMessages(id, loaded);
    } catch (error) {
      setConversationMessages(id, [
        {
          id: makeId(),
          role: "assistant",
          content: compactError(error),
          deliverables: [],
          error: true,
        },
      ]);
    }
  }

  async function openDeliverable(id: string) {
    setMode("chat");
    setConversationProgress(conversationId, null);
    setConversationSending(conversationId, false);
    try {
      const deliverable = await getDeliverable(id);
      setConversationMessages(conversationId, [
        {
          id: makeId(),
          role: "assistant",
          content: "",
          deliverables: [deliverable],
        },
      ]);
    } catch (error) {
      setConversationMessages(conversationId, [
        {
          id: makeId(),
          role: "assistant",
          content: compactError(error),
          deliverables: [],
          error: true,
        },
      ]);
    }
  }

  function handleRecentClick(item: RecentItem) {
    if (item.kind === "conversation") {
      void loadConversation(item.id);
    } else if (item.kind === "deliverable") {
      void openDeliverable(item.id);
    } else {
      navigate(`/workspace/${item.id}`);
    }
  }

  function handleHistoryClick(item: HomeConversation) {
    setHistoryDialogOpen(false);
    void loadConversation(item.id);
  }

  async function handleSend(text: string) {
    const content = text.trim();
    if (!content || isSending) return;
    setMode("chat");
    setInput("");
    await startTextMessage(content, modelTier);
  }

  async function handleUpload(file: File) {
    if (isSending) return;
    setMode("chat");
    await startUpload(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleUpload(file);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend(input);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbfcff] text-slate-950">
      <aside className="hidden h-screen w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <div className="mb-5 flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 items-center justify-center text-indigo-600">
            <Atom className="h-9 w-9" strokeWidth={2.4} />
          </div>
          <div className="text-2xl font-bold tracking-normal">AtomCAP</div>
        </div>

        <nav className="space-y-1">
          <NavButton icon={Plus} label="新对话" active={mode === "chat" && messages.length === 0} primary onClick={handleNewConversation} />
          <NavButton icon={FolderKanban} label="项目库" meta={String(home?.deals.length ?? 0)} onClick={() => navigate("/workspace")} />
          <NavButton icon={Library} label="赛道库" meta={String(home?.deliverables.filter((item) => item.type === "thesis").length ?? 0)} active={mode === "tracks"} onClick={() => setMode("tracks")} />
          <NavButton icon={Target} label="投资偏好" active={mode === "preference"} onClick={() => setMode("preference")} />
        </nav>

        <section className="mt-5 min-h-0 flex-1 border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="text-sm font-semibold text-slate-500">最近</div>
            <button
              type="button"
              title="历史会话"
              onClick={openHistoryDialog}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1 overflow-hidden">
            {isHomeLoading && <SidebarHint>正在读取数据库...</SidebarHint>}
            {homeError && <SidebarHint tone="error">{homeError}</SidebarHint>}
            {!isHomeLoading && !homeError && recentItems.length === 0 && (
              <SidebarHint>暂无最近记录</SidebarHint>
            )}
            {recentItems.map((item) => (
              <RecentButton
                key={`${item.kind}-${item.id}`}
                item={item}
                streaming={item.kind === "conversation" && streamingConversationIds.has(item.id)}
                onClick={() => handleRecentClick(item)}
              />
            ))}
          </div>
        </section>

        <div className="mt-3 space-y-3">
          <PreferenceCard home={home} loading={isHomeLoading} onOpen={() => setMode("preference")} />
          <button
            type="button"
            onClick={handleSignOut}
            title="退出登录"
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
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

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,text/plain,application/pdf"
          onChange={handleFileChange}
        />
        <header className="flex h-16 shrink-0 items-center justify-between px-5 lg:justify-end lg:px-8">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white lg:hidden"
          >
            <Plus className="h-5 w-5" />
            新对话
          </button>
        </header>

        {mode === "tracks" ? (
          <DataPanel
            title="赛道库"
            subtitle="来自数据库中的赛道前瞻交付物"
            actions={
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setTrackDialogOpen(true);
                }}
                className="flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                新建赛道
              </button>
            }
            footer={
              <PageAssistant
                contextLabel="赛道库"
                contextSummary={trackContextSummary}
                placeholder="基于当前赛道库提出需求..."
              />
            }
          >
            <TrackList
              items={(home?.deliverables ?? []).filter((item) => item.type === "thesis")}
              onOpen={(id) => void openDeliverable(id)}
            />
          </DataPanel>
        ) : mode === "preference" ? (
          <PreferenceManager />
        ) : messages.length === 0 ? (
          <section className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5 pb-5 lg:px-8">
            <div className="flex min-h-0 flex-1 items-center justify-center pb-10">
              <div className="text-center">
                <h1 className="text-4xl font-black leading-tight tracking-normal text-slate-950 md:text-5xl">
                  Hi，{userName} <span aria-hidden="true">👋</span>
                </h1>
                <p className="mt-6 text-3xl font-black leading-tight tracking-normal text-slate-950 md:text-4xl">
                  今天想让{" "}
                  <span className="text-indigo-600">AtomCAP</span>{" "}
                  帮你做什么？
                </p>
              </div>
            </div>
            <Composer
              value={input}
              progress={progress}
              isSending={isSending}
              suggested={suggested}
              models={modelOptions}
              modelTier={modelTier}
              onModelChange={setModelTier}
              onChange={setInput}
              onKeyDown={handleComposerKeyDown}
              onUploadClick={() => fileInputRef.current?.click()}
              onSend={() => void handleSend(input)}
              onSuggested={(text) => void handleSend(text)}
            />
          </section>
        ) : (
          <>
            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-8">
              <div className="mx-auto flex max-w-4xl flex-col gap-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </section>
            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-5 lg:px-8">
              <Composer
                value={input}
                progress={progress}
                isSending={isSending}
                suggested={suggested}
                compact
                models={modelOptions}
                modelTier={modelTier}
                onModelChange={setModelTier}
                onChange={setInput}
                onKeyDown={handleComposerKeyDown}
                onUploadClick={() => fileInputRef.current?.click()}
                onSend={() => void handleSend(input)}
                onSuggested={(text) => void handleSend(text)}
              />
            </div>
          </>
        )}
      </main>
      {trackDialogOpen && (
        <CreateTrackDialog
          draft={trackDraft}
          error={actionError}
          onChange={setTrackDraft}
          onClose={() => setTrackDialogOpen(false)}
          onSubmit={handleCreateThesis}
        />
      )}
      {historyDialogOpen && (
        <ConversationHistoryDialog
          query={historyQuery}
          items={historyItems}
          total={historyTotal}
          loading={isHistoryLoading}
          error={historyError}
          onQueryChange={setHistoryQuery}
          onRefresh={() => void refreshConversationHistory()}
          onOpen={handleHistoryClick}
          onClose={() => setHistoryDialogOpen(false)}
        />
      )}
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  primary,
  meta,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  primary?: boolean;
  meta?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 rounded-lg px-4 text-left text-sm font-semibold transition ${
        primary
          ? "justify-center bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
          : active
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${primary ? "" : "text-current"}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && !primary && <span className="text-xs text-slate-400">{meta}</span>}
    </button>
  );
}

function DialogShell({
  title,
  error,
  onClose,
  children,
}: {
  title: string;
  error: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        {children}
      </div>
    </div>
  );
}

function ConversationHistoryDialog({
  query,
  items,
  total,
  loading,
  error,
  onQueryChange,
  onRefresh,
  onOpen,
  onClose,
}: {
  query: string;
  items: HomeConversation[];
  total: number;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onOpen: (item: HomeConversation) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="历史会话"
        className="flex max-h-[78vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950">历史会话</h2>
            <p className="mt-1 text-xs text-slate-500">共 {total} 条会话记录</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="刷新历史会话"
              onClick={onRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              title="关闭"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="shrink-0 px-5 py-4">
          <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-indigo-300">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索标题或消息内容"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          {loading && items.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm font-semibold text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在读取历史会话...
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-400">
              未找到匹配的历史会话
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onOpen(item)}
                  className="grid w-full grid-cols-[28px_1fr_auto] items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <MessageSquare className="mt-0.5 h-5 w-5 text-slate-700" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {item.title}
                    </span>
                    {item.preview && (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {item.preview}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatDate(item.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {rows ? (
        <textarea
          value={value}
          required={required}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300"
        />
      ) : (
        <input
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-indigo-300"
        />
      )}
    </label>
  );
}

function CreateTrackDialog({
  draft,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: {
    thesis_name: string;
    one_line_view: string;
    opportunity_level: string;
    risk_level: string;
    advice: string;
    sub_directions: string;
  };
  error: string | null;
  onChange: (next: typeof draft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogShell title="新建赛道" error={error} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="赛道名称"
          value={draft.thesis_name}
          required
          placeholder="例如：端侧 AI 芯片"
          onChange={(value) => onChange({ ...draft, thesis_name: value })}
        />
        <Field
          label="一句话判断"
          value={draft.one_line_view}
          placeholder="这个赛道为什么值得被纳入观察"
          onChange={(value) => onChange({ ...draft, one_line_view: value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="机会等级"
            value={draft.opportunity_level}
            onChange={(value) => onChange({ ...draft, opportunity_level: value })}
          />
          <Field
            label="风险等级"
            value={draft.risk_level}
            onChange={(value) => onChange({ ...draft, risk_level: value })}
          />
        </div>
        <Field
          label="子方向"
          value={draft.sub_directions}
          rows={2}
          placeholder="用逗号或换行分隔"
          onChange={(value) => onChange({ ...draft, sub_directions: value })}
        />
        <Field
          label="建议"
          value={draft.advice}
          rows={2}
          placeholder="下一步如何跟进"
          onChange={(value) => onChange({ ...draft, advice: value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            取消
          </button>
          <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
            创建
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function SidebarHint({ children, tone }: { children: ReactNode; tone?: "error" }) {
  return (
    <div
      className={`rounded-lg px-2 py-2 text-xs ${
        tone === "error" ? "bg-red-50 text-red-600" : "text-slate-400"
      }`}
    >
      {children}
    </div>
  );
}

function RecentButton({
  item,
  streaming,
  onClick,
}: {
  item: RecentItem;
  streaming?: boolean;
  onClick: () => void;
}) {
  const Icon =
    item.kind === "conversation"
      ? MessageSquare
      : item.kind === "deliverable"
        ? FileText
        : GraduationCap;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid h-10 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {streaming && (
        <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.14)] animate-pulse" />
      )}
      <Icon className={`h-5 w-5 ${streaming ? "text-indigo-600" : "text-slate-800"}`} />
      <span className="min-w-0 truncate">{item.title}</span>
      <span className="text-[11px] font-medium text-slate-400">{formatDate(item.updated_at)}</span>
    </button>
  );
}

function PreferenceCard({
  home,
  loading,
  onOpen,
}: {
  home: HomeData | null;
  loading: boolean;
  onOpen: () => void;
}) {
  const sectors = preferenceList(home, "sectors");
  const stages = preferenceList(home, "stages");
  const regions = preferenceList(home, "regions");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">当前投资偏好</h2>
        {home?.preference.exists && (
          <span className="text-xs font-semibold text-indigo-600">v{home.preference.version}</span>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-slate-400">正在读取偏好...</div>
      ) : !home?.preference.exists ? (
        <div className="text-xs leading-5 text-slate-500">数据库暂无偏好记录</div>
      ) : (
        <div className="space-y-1.5 text-xs leading-5 text-slate-800">
          <PreferenceLine label="赛道" value={displayList(sectors)} />
          <PreferenceLine label="阶段" value={displayList(stages)} />
          <PreferenceLine label="地域" value={displayList(regions)} />
        </div>
      )}
    </button>
  );
}

function PreferenceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8px_36px_1fr] items-start gap-2">
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-600" />
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function DataPanel({
  title,
  subtitle,
  actions,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden px-5 pb-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 pb-4 pt-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {children}
        </div>
        {footer && <div className="mt-3 shrink-0">{footer}</div>}
      </div>
    </section>
  );
}

function TrackList({
  items,
  onOpen,
}: {
  items: HomeDeliverable[];
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="数据库暂无赛道前瞻" />;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onOpen(item.id)}
          className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          <div className="text-base font-bold text-slate-900">{item.title}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{item.status}</span>
            <span>{formatDate(item.updated_at)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-400">
      {title}
    </div>
  );
}

function Composer({
  value,
  progress,
  isSending,
  suggested,
  compact,
  models,
  modelTier,
  onModelChange,
  onChange,
  onKeyDown,
  onUploadClick,
  onSend,
  onSuggested,
}: {
  value: string;
  progress: string | null;
  isSending: boolean;
  suggested: string[];
  compact?: boolean;
  models?: ModelOption[];
  modelTier?: string;
  onModelChange?: (tier: string) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onUploadClick: () => void;
  onSend: () => void;
  onSuggested: (value: string) => void;
}) {
  return (
    <div className="shrink-0 rounded-lg border border-indigo-300 bg-white p-4 shadow-sm">
      {!compact && (
        <div className="mb-3 grid max-w-xl gap-2">
          {suggested.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onSuggested(item)}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="输入你的问题，或粘贴项目/公司信息..."
        rows={compact ? 2 : 3}
        className="block w-full resize-none bg-transparent text-base leading-7 text-slate-900 outline-none placeholder:text-slate-500"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-slate-600">
          <button
            type="button"
            title="上传材料"
            onClick={onUploadClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {models && models.length > 0 && onModelChange && (
            <select
              value={modelTier}
              onChange={(event) => onModelChange(event.target.value)}
              title="选择对话模型"
              className="h-9 max-w-[12rem] truncate rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 outline-none hover:border-indigo-300"
            >
              {models.map((option) => (
                <option key={option.tier} value={option.tier} disabled={!option.available}>
                  {option.model}
                </option>
              ))}
            </select>
          )}
          {progress && (
            <span className="hidden truncate text-sm font-medium text-indigo-600 sm:block">
              {progress}
            </span>
          )}
        </div>

        <button
          type="button"
          title="发送"
          onClick={onSend}
          disabled={isSending || !value.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
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

function ReasoningCard({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-700"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Brain className="h-3.5 w-3.5" />
        <span>思考过程{streaming ? "（生成中…）" : ""}</span>
      </button>
      {open && (
        <div className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500">
          {text}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const showReasoning = !isUser && !!message.reasoning;
  const showUsage = !isUser && !!message.usage;
  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot className="h-5 w-5" />
        </div>
      )}
      <div className={`min-w-0 ${isUser ? "max-w-[72%]" : "max-w-full flex-1"}`}>
        {showReasoning && (
          <ReasoningCard text={message.reasoning ?? ""} streaming={!!message.streaming} />
        )}
        {message.content && (
          <div
            className={`rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
              isUser
                ? "bg-indigo-600 text-white"
                : message.error
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-white text-slate-800"
            }`}
          >
            {message.pending && (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-[-2px]" />
            )}
            {message.content}
          </div>
        )}
        {showUsage && message.usage && (
          <div className="mt-1 px-1 text-[11px] text-slate-400">
            {formatTokens(message.usage)}
          </div>
        )}
        {message.deliverables.length > 0 && (
          <div className="mt-4 space-y-4">
            {message.deliverables.map((deliverable) => (
              <DeliverableView key={deliverable.id} deliverable={deliverable} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
