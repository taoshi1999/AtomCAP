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
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Atom,
  Bot,
  FileText,
  FolderKanban,
  GraduationCap,
  Library,
  LogOut,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DeliverableView } from "../components/objects/registry";
import {
  getConversationMessages,
  getDeliverable,
  getHome,
  sendMessage,
  uploadMaterial,
  type ConversationMessage,
  type HomeData,
  type HomeDeliverable,
  type MessageBlock,
  type SseHandlers,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Deliverable } from "../lib/types";

type HomeMode = "chat" | "tracks" | "preference";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  deliverables: Deliverable[];
  pending?: boolean;
  error?: boolean;
};

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

export default function ChatPage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [mode, setMode] = useState<HomeMode>("chat");
  const [conversationId, setConversationId] = useState(() => makeId());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function refreshHome() {
    try {
      setHomeError(null);
      const data = await getHome();
      setHome(data);
    } catch (error) {
      setHomeError(compactError(error));
    } finally {
      setIsHomeLoading(false);
    }
  }

  useEffect(() => {
    void refreshHome();
  }, []);

  const recentItems = useMemo<RecentItem[]>(() => {
    if (!home) return [];
    return [
      ...home.conversations.map((item) => ({
        kind: "conversation" as const,
        id: item.id,
        title: item.title,
        subtitle: item.preview,
        updated_at: item.updated_at,
      })),
      ...home.deliverables.map((item) => ({
        kind: "deliverable" as const,
        id: item.id,
        title: item.title,
        subtitle: item.status,
        updated_at: item.updated_at,
      })),
      ...home.deals.map((item) => ({
        kind: "deal" as const,
        id: item.id,
        title: item.company_name ?? "未命名项目",
        subtitle: item.portrait ?? dealStatusLabel(item.status),
        updated_at: item.updated_at,
      })),
    ]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [home]);

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

  function handleNewConversation() {
    setConversationId(makeId());
    setMessages([]);
    setInput("");
    setProgress(null);
    setIsSending(false);
    setMode("chat");
  }

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  function updateAssistant(
    id: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? updater(message) : message))
    );
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
    setConversationId(id);
    setMessages([
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
            };
          })
      );
      setMessages(loaded);
    } catch (error) {
      setMessages([
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
    try {
      const deliverable = await getDeliverable(id);
      setMessages([
        {
          id: makeId(),
          role: "assistant",
          content: "",
          deliverables: [deliverable],
        },
      ]);
    } catch (error) {
      setMessages([
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

  async function runAssistantFlow(
    userContent: string,
    run: (handlers: SseHandlers) => Promise<void>
  ) {
    const assistantId = makeId();
    setMode("chat");
    setInput("");
    setIsSending(true);
    setProgress("正在理解你的问题");
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: userContent, deliverables: [] },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        deliverables: [],
        pending: true,
      },
    ]);

    try {
      await run({
        onProgress: (next) => {
          setProgress(next);
          updateAssistant(assistantId, (message) => ({
            ...message,
            content: next,
            pending: true,
          }));
        },
        onToken: (token) => {
          setProgress(null);
          updateAssistant(assistantId, (message) => ({
            ...message,
            content: `${message.pending ? "" : message.content}${token}`,
            pending: false,
          }));
        },
        onObject: (ref) => {
          if (!ref.deliverable_id) return;
          void getDeliverable(ref.deliverable_id)
            .then((deliverable) => {
              updateAssistant(assistantId, (message) => ({
                ...message,
                content:
                  message.content && !message.pending
                    ? message.content
                    : "已生成交付结果。",
                deliverables: [...message.deliverables, deliverable],
                pending: false,
              }));
            })
            .catch((error) => {
              updateAssistant(assistantId, (message) => ({
                ...message,
                content: `交付结果已生成，但拉取详情失败：${compactError(error)}`,
                pending: false,
                error: true,
              }));
            });
        },
        onError: (message) => {
          setProgress(null);
          updateAssistant(assistantId, (current) => ({
            ...current,
            content: message,
            pending: false,
            error: true,
          }));
        },
        onDone: () => {
          setProgress(null);
          updateAssistant(assistantId, (message) => ({
            ...message,
            content:
              message.content || message.deliverables.length > 0
                ? message.content
                : "已完成。",
            pending: false,
          }));
          void refreshHome();
        },
      });
    } catch (error) {
      setProgress(null);
      updateAssistant(assistantId, (message) => ({
        ...message,
        content: compactError(error),
        pending: false,
        error: true,
      }));
    } finally {
      setIsSending(false);
    }
  }

  async function handleSend(text: string) {
    const content = text.trim();
    if (!content || isSending) return;
    await runAssistantFlow(content, (handlers) =>
      sendMessage(conversationId, content, handlers)
    );
  }

  async function handleUpload(file: File) {
    if (isSending) return;
    await runAssistantFlow(`上传文件：${file.name}`, (handlers) =>
      uploadMaterial(conversationId, file, handlers)
    );
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
              title="刷新"
              onClick={() => void refreshHome()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <RefreshCcw className="h-4 w-4" />
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              title="刷新首页数据"
              onClick={() => void refreshHome()}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
        </header>

        {mode === "tracks" ? (
          <DataPanel title="赛道库" subtitle="来自数据库中的赛道前瞻交付物">
            <TrackList
              items={(home?.deliverables ?? []).filter((item) => item.type === "thesis")}
              onOpen={(id) => void openDeliverable(id)}
            />
          </DataPanel>
        ) : mode === "preference" ? (
          <DataPanel title="投资偏好" subtitle="当前机构生效偏好">
            <PreferenceDetail home={home} loading={isHomeLoading} />
          </DataPanel>
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

function RecentButton({ item, onClick }: { item: RecentItem; onClick: () => void }) {
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
      className="grid h-10 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-5 w-5 text-slate-800" />
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
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden px-5 pb-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="shrink-0 pb-4 pt-2">
          <h1 className="text-2xl font-black text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {children}
        </div>
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

function PreferenceDetail({
  home,
  loading,
}: {
  home: HomeData | null;
  loading: boolean;
}) {
  if (loading) return <EmptyState title="正在读取投资偏好..." />;
  if (!home?.preference.exists) return <EmptyState title="数据库暂无投资偏好记录" />;

  const sectors = preferenceList(home, "sectors");
  const stages = preferenceList(home, "stages");
  const regions = preferenceList(home, "regions");
  const preference = home.preference.preference;
  const risk = typeof preference.risk_appetite === "string" ? preference.risk_appetite : "未设置";
  const checkSize = typeof preference.check_size === "string" ? preference.check_size : "未设置";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InfoTile title="偏好赛道" value={displayList(sectors)} />
      <InfoTile title="偏好阶段" value={displayList(stages)} />
      <InfoTile title="地域偏好" value={displayList(regions)} />
      <InfoTile title="风险偏好" value={risk} />
      <InfoTile title="单笔规模" value={checkSize} />
      <InfoTile title="版本" value={`v${home.preference.version}`} />
    </div>
  );
}

function InfoTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-sm font-bold text-slate-900">{value}</div>
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
          <div className="flex h-9 items-center gap-2 px-2 text-sm font-semibold text-slate-700">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span>智能体</span>
          </div>
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot className="h-5 w-5" />
        </div>
      )}
      <div className={`min-w-0 ${isUser ? "max-w-[72%]" : "max-w-full flex-1"}`}>
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
