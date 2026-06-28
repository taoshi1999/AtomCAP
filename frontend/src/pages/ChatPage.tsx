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
  ChevronDown,
  ChevronRight,
  FileText,
  FolderKanban,
  GraduationCap,
  History,
  Library,
  LogOut,
  Loader2,
  Minus,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  Target,
  Trash2,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { DeliverableView } from "../components/objects/registry";
import TrackManager from "../components/TrackManager";
import DealManager from "../components/DealManager";
import PreferenceManager from "../components/PreferenceManager";
import {
  getConversationMessages,
  getDealDetail,
  getDeliverable,
  getHome,
  getModels,
  deleteConversation,
  listConversations,
  pinConversation,
  triggerDealAction,
  type ConversationMessage,
  type HomeConversation,
  type HomeData,
  type MessageBlock,
  type ModelOption,
  type ReactStep,
  type TokenUsage,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { useChatSession, type ChatMessage } from "../lib/chatSession";
import type { DealDetail, Deliverable } from "../lib/types";
import {
  getMarketSignalSearchDepth,
  MAX_MARKET_SIGNAL_SEARCH_DEPTH,
  setMarketSignalSearchDepth,
} from "../lib/userSettings";

type HomeMode = "chat" | "tracks" | "preference" | "deals";

type RecentItem =
  | {
      kind: "conversation";
      id: string;
      title: string;
      subtitle?: string | null;
      updated_at: string;
      conversation_type?: "normal" | "project_workspace" | string;
      source_deal_id?: string | null;
      is_pinned?: boolean;
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

function recentItemKey(item: Pick<RecentItem, "kind" | "id">) {
  return `${item.kind}-${item.id}`;
}

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
  const text = blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (text) return text;
  const deal = blocks.find((block) => block.type === "deal_ref" && block.deal_id);
  return deal ? `[项目工作台 ${deal.deal_id}]` : "";
}

function usageFromBlocks(blocks: MessageBlock[]): TokenUsage | undefined {
  const block = blocks.find((b) => b.type === "usage") as
    | (MessageBlock & { usage?: TokenUsage })
    | undefined;
  return block?.usage;
}

function reactStepsFromBlocks(blocks: MessageBlock[]): ReactStep[] | undefined {
  const block = blocks.find((b) => b.type === "react_steps");
  if (!Array.isArray(block?.steps)) return undefined;
  return block.steps.filter(
    (step): step is ReactStep =>
      !!step &&
      typeof step === "object" &&
      typeof step.summary === "string" &&
      typeof step.phase === "string" &&
      typeof step.loop === "number"
  );
}

function getStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type PreferenceDimensionKey = "sectors" | "stages" | "regions";

function preferenceList(home: HomeData | null, key: PreferenceDimensionKey) {
  const preference = home?.preference.preference ?? {};
  const declared = getRecord(preference.declared_strategy);
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

function antiPreferenceList(home: HomeData | null, key: PreferenceDimensionKey) {
  const preference = home?.preference.preference ?? {};
  const declared = getRecord(preference.declared_strategy);
  const anti = getRecord(preference.anti_preference);
  if (key === "sectors") {
    return [
      ...getStringList(declared.anti_focus_sectors),
      ...getStringList(anti.disliked_sectors),
      ...getStringList(preference.excluded_tracks),
    ];
  }
  if (key === "stages") {
    return [
      ...getStringList(declared.anti_focus_stages),
      ...getStringList(anti.disliked_stages),
    ];
  }
  return [
    ...getStringList(declared.anti_focus_regions),
    ...getStringList(anti.disliked_regions),
  ];
}

function displayList(items: string[], empty = "未设置") {
  const normalized = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(" / ") : empty;
}

function displayNotes(items: string[], empty = "未设置") {
  const normalized = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized.join("；") : empty;
}

function displayPreferenceValue(value: unknown, empty = "未设置") {
  if (typeof value === "string") {
    return value.trim() || empty;
  }
  return displayList(getStringList(value), empty);
}

function optionalPreferenceText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentPreferenceName(home: HomeData | null) {
  return optionalPreferenceText(home?.preference.preference?.name) ?? "未命名偏好";
}

type PreferenceDisplayLine = {
  label: string;
  preferenceValue?: string;
  antiValue?: string;
  value?: string;
};

function hasPreferenceValue(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  return getStringList(value).length > 0;
}

function preferenceDisplayLines(home: HomeData | null): PreferenceDisplayLine[] {
  const preference = home?.preference.preference ?? {};
  const declared = getRecord(preference.declared_strategy);
  const anti = getRecord(preference.anti_preference);
  const customDimensions = getRecord(declared.custom_dimensions);
  const antiCustomDimensions = getRecord(declared.anti_custom_dimensions);
  const supplementalNotes = [
    ...getStringList(declared.supplemental_notes),
    ...getStringList(preference.supplemental_notes),
  ];
  const legacyNotes = optionalPreferenceText(preference.notes) ?? optionalPreferenceText(declared.description);
  const lines: PreferenceDisplayLine[] = [
    {
      label: "赛道",
      preferenceValue: displayList(preferenceList(home, "sectors")),
      antiValue: displayList(antiPreferenceList(home, "sectors")),
    },
    {
      label: "阶段",
      preferenceValue: displayList(preferenceList(home, "stages")),
      antiValue: displayList(antiPreferenceList(home, "stages")),
    },
    {
      label: "地域",
      preferenceValue: displayList(preferenceList(home, "regions")),
      antiValue: displayList(antiPreferenceList(home, "regions")),
    },
    {
      label: "风险",
      preferenceValue: displayPreferenceValue(preference.risk_appetite),
      antiValue: displayList([
        ...getStringList(declared.anti_risk_levels),
        ...getStringList(anti.disliked_risk_levels),
      ]),
    },
    {
      label: "规模",
      preferenceValue: displayPreferenceValue(preference.check_size),
      antiValue: displayList([
        ...getStringList(declared.anti_check_sizes),
        ...getStringList(anti.disliked_check_sizes),
      ]),
    },
  ];

  const customLabels = new Set([
    ...Object.keys(customDimensions),
    ...Object.keys(antiCustomDimensions),
  ]);
  for (const label of customLabels) {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) continue;
    const preferenceValue = customDimensions[label];
    const antiValue = antiCustomDimensions[label];
    if (!hasPreferenceValue(preferenceValue) && !hasPreferenceValue(antiValue)) continue;
    lines.push({
      label: normalizedLabel,
      preferenceValue: displayPreferenceValue(preferenceValue),
      antiValue: displayPreferenceValue(antiValue),
    });
  }

  if (supplementalNotes.length > 0 || legacyNotes) {
    lines.push({
      label: "补充说明",
      value: supplementalNotes.length > 0 ? displayNotes(supplementalNotes) : legacyNotes ?? "",
    });
  }

  return lines;
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
    pre_dd: "尽调中",
    ic_ready: "待上会",
    approved: "进行中",
    rejected: "已否决",
    exited: "已退出",
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
    return view === "tracks" || view === "preference" || view === "deals" ? view : "chat";
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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [marketSignalSearchDepth, setMarketSignalSearchDepthState] = useState(
    getMarketSignalSearchDepth
  );
  const [activeRecentKey, setActiveRecentKey] = useState<string | null>(null);
  const [openRecentMenuKey, setOpenRecentMenuKey] = useState<string | null>(null);
  const [busyConversationAction, setBusyConversationAction] = useState<string | null>(null);
  const [hiddenConversationIds, setHiddenConversationIds] = useState<Set<string>>(
    () => new Set()
  );
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

  useEffect(() => {
    if (!openRecentMenuKey) return;
    const close = () => setOpenRecentMenuKey(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openRecentMenuKey]);

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
      ...conversations.filter((item) => !hiddenConversationIds.has(item.id)).map((item) => ({
        kind: "conversation" as const,
        id: item.id,
        title: item.title,
        subtitle: item.preview,
        updated_at: item.updated_at,
        conversation_type: item.conversation_type,
        source_deal_id: item.source_deal_id,
        is_pinned: item.is_pinned,
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
      .sort((a, b) => {
        const leftPinned = a.kind === "conversation" && a.is_pinned ? 1 : 0;
        const rightPinned = b.kind === "conversation" && b.is_pinned ? 1 : 0;
        if (leftPinned !== rightPinned) return rightPinned - leftPinned;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 5);
  }, [home, recentConversationOverrides, hiddenConversationIds]);

  const userName = home?.user.name || "你好";
  const userSubtitle = home?.user.email || home?.institution.name || "";
  const newConversationActive = mode === "chat" && messages.length === 0;

  function switchMode(nextMode: HomeMode) {
    setActiveRecentKey(null);
    setMode(nextMode);
    navigate(nextMode === "chat" ? "/" : `/?view=${nextMode}`);
  }

  function isRecentActive(item: RecentItem) {
    if (mode !== "chat") return false;
    if (activeRecentKey) return activeRecentKey === recentItemKey(item);
    return item.kind === "conversation" && item.id === conversationId && messages.length > 0;
  }

  function handleNewConversation() {
    setActiveRecentKey(null);
    startNewConversation();
    setInput("");
    setMode("chat");
    navigate("/");
  }

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  function openSettingsDialog() {
    setMarketSignalSearchDepthState(getMarketSignalSearchDepth());
    setSettingsDialogOpen(true);
  }

  function saveSettings() {
    setMarketSignalSearchDepth(marketSignalSearchDepth);
    setSettingsDialogOpen(false);
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

  async function fetchMessageDeals(blocks: MessageBlock[]) {
    const refs = blocks
      .filter((block) => block.type === "deal_ref" && block.deal_id)
      .map((block) => block.deal_id as string);
    const deals = await Promise.all(refs.map((id) => getDealDetail(id).catch(() => null)));
    return deals.filter((item): item is DealDetail => item !== null);
  }

  function openProjectWorkspaceFromConversation(dealId: string) {
    setActiveRecentKey(null);
    setMode("deals");
    navigate(`/?view=deals&dealId=${dealId}`);
  }

  async function loadConversation(id: string) {
    setActiveRecentKey(null);
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
      if (
        data.conversation.conversation_type === "project_workspace" &&
        data.conversation.source_deal_id
      ) {
        openProjectWorkspaceFromConversation(data.conversation.source_deal_id);
        return;
      }
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
              deals: await fetchMessageDeals(blocks),
              reactSteps: reactStepsFromBlocks(blocks),
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
    setActiveRecentKey(`deliverable-${id}`);
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
    setOpenRecentMenuKey(null);
    if (item.kind === "conversation") {
      if (item.conversation_type === "project_workspace" && item.source_deal_id) {
        openProjectWorkspaceFromConversation(item.source_deal_id);
      } else {
        void loadConversation(item.id);
      }
    } else if (item.kind === "deliverable") {
      void openDeliverable(item.id);
    } else {
      setActiveRecentKey(recentItemKey(item));
      navigate(`/workspace/${item.id}`);
    }
  }

  async function handleToggleConversationPin(item: Extract<RecentItem, { kind: "conversation" }>) {
    const actionKey = `${item.id}:pin`;
    try {
      setBusyConversationAction(actionKey);
      setOpenRecentMenuKey(null);
      await pinConversation(item.id, !item.is_pinned);
      setHistoryItems((current) =>
        current.map((conversation) =>
          conversation.id === item.id
            ? { ...conversation, is_pinned: !item.is_pinned }
            : conversation
        )
      );
      await refreshHome();
      if (historyDialogOpen) await refreshConversationHistory();
    } catch (error) {
      window.alert(compactError(error));
    } finally {
      setBusyConversationAction(null);
    }
  }

  async function handleDeleteConversation(item: Extract<RecentItem, { kind: "conversation" }>) {
    if (
      !window.confirm(
        `确认删除「${item.title}」吗？删除后会从会话列表隐藏，但历史消息仍会保留。`
      )
    ) {
      return;
    }
    const actionKey = `${item.id}:delete`;
    try {
      setBusyConversationAction(actionKey);
      setOpenRecentMenuKey(null);
      await deleteConversation(item.id);
      setHiddenConversationIds((current) => new Set([...current, item.id]));
      setHistoryItems((current) => current.filter((conversation) => conversation.id !== item.id));
      if (conversationId === item.id) {
        handleNewConversation();
      }
      await refreshHome();
      if (historyDialogOpen) await refreshConversationHistory();
    } catch (error) {
      window.alert(compactError(error));
    } finally {
      setBusyConversationAction(null);
    }
  }

  function handleHistoryClick(item: HomeConversation) {
    setHistoryDialogOpen(false);
    if (item.conversation_type === "project_workspace" && item.source_deal_id) {
      openProjectWorkspaceFromConversation(item.source_deal_id);
    } else {
      void loadConversation(item.id);
    }
  }

  async function handleSend(text: string) {
    const content = text.trim();
    if (!content || isSending) return;
    setActiveRecentKey(null);
    setMode("chat");
    setInput("");
    await startTextMessage(content, modelTier);
  }

  async function handleUpload(file: File) {
    if (isSending) return;
    setActiveRecentKey(null);
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
          <NavButton icon={Plus} label="新对话" active={newConversationActive} primary onClick={handleNewConversation} />
          <NavButton icon={FolderKanban} label="项目库" meta={String(home?.deals.length ?? 0)} active={mode === "deals"} onClick={() => switchMode("deals")} />
          <NavButton icon={Library} label="赛道库" meta={String(home?.deliverables.filter((item) => item.type === "thesis").length ?? 0)} active={mode === "tracks"} onClick={() => switchMode("tracks")} />
          <NavButton
            icon={Target}
            label="投资偏好"
            meta={String(home?.stats.preference_profile_count ?? 0)}
            active={mode === "preference"}
            onClick={() => switchMode("preference")}
          />
        </nav>

        <section className="mt-5 flex min-h-0 flex-1 flex-col border-t border-slate-200 pt-4">
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
          <div className="preference-card-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {isHomeLoading && <SidebarHint>正在读取数据库...</SidebarHint>}
            {homeError && <SidebarHint tone="error">{homeError}</SidebarHint>}
            {!isHomeLoading && !homeError && recentItems.length === 0 && (
              <SidebarHint>暂无最近记录</SidebarHint>
            )}
            {recentItems.map((item) => (
              <RecentButton
                key={recentItemKey(item)}
                item={item}
                active={isRecentActive(item)}
                streaming={item.kind === "conversation" && streamingConversationIds.has(item.id)}
                menuOpen={openRecentMenuKey === recentItemKey(item)}
                busyAction={item.kind === "conversation" ? busyConversationAction : null}
                onClick={() => handleRecentClick(item)}
                onMenuToggle={() =>
                  setOpenRecentMenuKey((current) =>
                    current === recentItemKey(item) ? null : recentItemKey(item)
                  )
                }
                onTogglePin={
                  item.kind === "conversation"
                    ? () => void handleToggleConversationPin(item)
                    : undefined
                }
                onDelete={
                  item.kind === "conversation"
                    ? () => void handleDeleteConversation(item)
                    : undefined
                }
              />
            ))}
          </div>
        </section>

        <div className="mt-3 shrink-0 space-y-3">
          <PreferenceCard home={home} loading={isHomeLoading} onOpen={() => switchMode("preference")} />
          <button
            type="button"
            onClick={openSettingsDialog}
            title="账户设置"
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-900">{userName}</div>
              <div className="truncate text-xs text-slate-500">{userSubtitle}</div>
            </div>
            <Settings className="h-5 w-5 text-slate-500" />
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

        {mode === "deals" ? (
          <DealManager />
        ) : mode === "tracks" ? (
          <TrackManager
            theses={(home?.deliverables ?? []).filter((item) => item.type === "thesis")}
            loading={isHomeLoading}
            onChanged={() => void refreshHome()}
            currentPreference={home?.preference.preference ?? {}}
          />
        ) : mode === "preference" ? (
          <PreferenceManager onPreferenceApplied={() => void refreshHome()} />
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
              models={modelOptions}
              modelTier={modelTier}
              onModelChange={setModelTier}
              onChange={setInput}
              onKeyDown={handleComposerKeyDown}
              onUploadClick={() => fileInputRef.current?.click()}
              onSend={() => void handleSend(input)}
            />
          </section>
        ) : (
          <>
            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-8">
              <div className="mx-auto flex max-w-4xl flex-col gap-5">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentPreference={home?.preference.preference ?? {}}
                  />
                ))}
              </div>
            </section>
            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-5 lg:px-8">
              <Composer
                value={input}
                progress={progress}
                isSending={isSending}
                compact
                models={modelOptions}
                modelTier={modelTier}
                onModelChange={setModelTier}
                onChange={setInput}
                onKeyDown={handleComposerKeyDown}
                onUploadClick={() => fileInputRef.current?.click()}
                onSend={() => void handleSend(input)}
              />
            </div>
          </>
        )}
      </main>
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
      {settingsDialogOpen && (
        <UserSettingsDialog
          userName={userName}
          userSubtitle={userSubtitle}
          searchDepth={marketSignalSearchDepth}
          onSearchDepthChange={setMarketSignalSearchDepthState}
          onSave={saveSettings}
          onSignOut={handleSignOut}
          onClose={() => setSettingsDialogOpen(false)}
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
  const primaryActive = primary && active;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 rounded-lg px-4 text-left text-sm font-semibold transition ${
        primaryActive
          ? "justify-center bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
          : active
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${primaryActive ? "" : "text-current"}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && !primaryActive && <span className="text-xs text-slate-400">{meta}</span>}
    </button>
  );
}

function UserSettingsDialog({
  userName,
  userSubtitle,
  searchDepth,
  onSearchDepthChange,
  onSave,
  onSignOut,
  onClose,
}: {
  userName: string;
  userSubtitle: string;
  searchDepth: number;
  onSearchDepthChange: (value: number) => void;
  onSave: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  function changeDepth(delta: number) {
    onSearchDepthChange(
      Math.max(1, Math.min(MAX_MARKET_SIGNAL_SEARCH_DEPTH, searchDepth + delta))
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="账户设置"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-slate-950">{userName}</h2>
              <p className="truncate text-xs text-slate-500">{userSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900">市场信号搜索深度</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                限制 ReAct 搜索最多执行的轮次。测试阶段默认为 1。
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
              {searchDepth} 轮
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              title="减少搜索深度"
              disabled={searchDepth <= 1}
              onClick={() => changeDepth(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_MARKET_SIGNAL_SEARCH_DEPTH}
              step={1}
              value={searchDepth}
              aria-label="市场信号搜索深度"
              onChange={(event) => onSearchDepthChange(Number(event.target.value))}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-indigo-600"
            />
            <button
              type="button"
              title="增加搜索深度"
              disabled={searchDepth >= MAX_MARKET_SIGNAL_SEARCH_DEPTH}
              onClick={() => changeDepth(1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </footer>
      </section>
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
  active,
  streaming,
  menuOpen,
  busyAction,
  onClick,
  onMenuToggle,
  onTogglePin,
  onDelete,
}: {
  item: RecentItem;
  active?: boolean;
  streaming?: boolean;
  menuOpen?: boolean;
  busyAction?: string | null;
  onClick: () => void;
  onMenuToggle: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
}) {
  const Icon =
    item.kind === "conversation"
      ? MessageSquare
      : item.kind === "deliverable"
        ? FileText
        : GraduationCap;
  const isConversation = item.kind === "conversation";
  const pinBusy = isConversation && busyAction === `${item.id}:pin`;
  const deleteBusy = isConversation && busyAction === `${item.id}:delete`;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={`relative grid h-10 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold transition ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
        } ${isConversation ? "pr-8" : ""}`}
      >
        {streaming && (
          <span className="absolute left-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.14)]" />
        )}
        <Icon className={`h-5 w-5 ${active || streaming ? "text-indigo-600" : "text-slate-800"}`} />
        <span className="min-w-0 truncate">
          {isConversation && item.is_pinned && (
            <Pin className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" />
          )}
          {item.title}
        </span>
        <span className={`text-[11px] font-medium ${active ? "text-indigo-400" : "text-slate-400"}`}>
          {formatDate(item.updated_at)}
        </span>
      </button>
      {isConversation && (
        <button
          type="button"
          title="更多操作"
          aria-label={`更多操作：${item.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onMenuToggle();
          }}
          disabled={pinBusy || deleteBusy}
          className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
      {isConversation && menuOpen && (
        <div
          className="absolute right-1 top-9 z-30 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/70"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onTogglePin}
            disabled={pinBusy || deleteBusy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {pinBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : item.is_pinned ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
            {item.is_pinned ? "取消置顶" : "置顶"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pinBusy || deleteBusy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            删除
          </button>
        </div>
      )}
    </div>
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
  const lines = preferenceDisplayLines(home);
  const preferenceName = currentPreferenceName(home);
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
        <>
          <div className="mb-2 truncate text-xs font-semibold text-slate-700" title={preferenceName}>
            {preferenceName}
          </div>
          <div className="preference-card-scrollbar max-h-48 divide-y divide-slate-100 overflow-y-auto overscroll-contain pr-1 text-xs leading-5 text-slate-800">
            {lines.map((line, index) => (
              <PreferenceLine key={`${line.label}-${index}`} line={line} />
            ))}
          </div>
        </>
      )}
    </button>
  );
}

function PreferenceLine({ line }: { line: PreferenceDisplayLine }) {
  if (line.value !== undefined) {
    return (
      <div className="grid grid-cols-[8px_64px_minmax(0,1fr)] items-start gap-2 py-2 first:pt-0 last:pb-0">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span className="font-semibold text-slate-500">{line.label}</span>
        <span className="min-w-0 break-words text-slate-700">{line.value}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[8px_64px_minmax(0,1fr)] items-start gap-2 py-2 first:pt-0 last:pb-0">
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-600" />
      <span className="font-semibold text-slate-500">{line.label}</span>
      <span className="min-w-0 space-y-1">
        <span className="flex min-w-0 items-start gap-1.5">
          <span className="mt-0.5 shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-indigo-600">
            偏好
          </span>
          <span className="min-w-0 break-words">{line.preferenceValue ?? "未设置"}</span>
        </span>
        <span className="flex min-w-0 items-start gap-1.5">
          <span className="mt-0.5 shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-rose-600">
            反偏好
          </span>
          <span className="min-w-0 break-words text-slate-700">{line.antiValue ?? "未设置"}</span>
        </span>
      </span>
    </div>
  );
}




function Composer({
  value,
  progress,
  isSending,
  compact,
  models,
  modelTier,
  onModelChange,
  onChange,
  onKeyDown,
  onUploadClick,
  onSend,
}: {
  value: string;
  progress: string | null;
  isSending: boolean;
  compact?: boolean;
  models?: ModelOption[];
  modelTier?: string;
  onModelChange?: (tier: string) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onUploadClick: () => void;
  onSend: () => void;
}) {
  return (
    <div className="relative shrink-0 rounded-lg border border-indigo-300 bg-white p-4 shadow-sm">
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

type ReactLoopGroup = {
  loop: number;
  steps: ReactStep[];
};

function stepTime(step: ReactStep) {
  const value = step.created_at ?? step.received_at;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) return restSeconds ? `${minutes}m ${restSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

function reactDurationLabel(steps: ReactStep[]) {
  const times = steps.map(stepTime).filter((value): value is number => value !== null);
  if (times.length === 0) return "";
  return formatDuration(Math.max(...times) - Math.min(...times));
}

function groupReactSteps(steps: ReactStep[]): ReactLoopGroup[] {
  const groups = new Map<number, ReactStep[]>();
  for (const step of steps) {
    groups.set(step.loop, [...(groups.get(step.loop) ?? []), step]);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([loop, loopSteps]) => ({ loop, steps: loopSteps }));
}

function displayStepSummary(summary: string) {
  return summary
    .replace(/^下一步工作计划[:：]\s*/, "")
    .replace(/^第\s*[\d一二三四五六七八九十]+\s*轮\s*ReAct\s*已完成[:：]\s*/, "")
    .replace(/^本轮\s*ReAct\s*已完成[:：]\s*/, "")
    .trim();
}

function StepDetailList({ details }: { details: string[] }) {
  if (details.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-500">
      {details.map((detail, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          <span>{detail}</span>
        </li>
      ))}
    </ul>
  );
}

function TraceDisclosure({
  step,
  observation,
  active,
}: {
  step: ReactStep;
  observation?: ReactStep;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const resultDetails = observation ? [displayStepSummary(observation.summary), ...observation.details] : [];
  const hasDetails = step.details.length > 0 || resultDetails.length > 0;
  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-sm text-slate-500 transition hover:text-slate-700"
      >
        {hasDetails ? (
          open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-[11px]">
          <Wrench className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {active ? "正在调用工具" : "已调用工具"}：{step.tool_name || "系统工具"}
        </span>
      </button>
      {open && hasDetails && (
        <div className="ml-11 mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-semibold text-slate-500">执行操作</div>
          <div className="mt-1 text-sm leading-6 text-slate-700">{displayStepSummary(step.summary)}</div>
          <StepDetailList details={step.details} />
          {resultDetails.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="text-xs font-semibold text-slate-500">执行结果</div>
              <StepDetailList details={resultDetails} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineTextStep({ step }: { step: ReactStep }) {
  const [open, setOpen] = useState(false);
  const hasDetails = step.details.length > 0;
  return (
    <div className="py-2">
      <div className="text-base leading-8 text-slate-900">{displayStepSummary(step.summary)}</div>
      {hasDetails && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>展开查看计划依据</span>
          </button>
          {open && <StepDetailList details={step.details} />}
        </>
      )}
    </div>
  );
}

function ReactLoopSection({
  group,
  latestStep,
  streaming,
}: {
  group: ReactLoopGroup;
  latestStep?: ReactStep;
  streaming: boolean;
}) {
  return (
    <div className="relative border-l border-slate-200 pl-5">
      <span className="absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
      <div className="space-y-1">
        {group.steps.map((step, index) => {
          const key = step.id || `${step.loop}-${step.phase}-${index}`;
          const active = streaming && latestStep === step && step.status === "running";
          if (step.phase === "observation") {
            return null;
          }
          if (step.phase === "action" && (step.tool_id || step.tool_name)) {
            const observation = group.steps.slice(index + 1).find((next) => next.phase === "observation");
            return (
              <TraceDisclosure
                key={key}
                step={step}
                observation={observation}
                active={active}
              />
            );
          }
          return <TimelineTextStep key={key} step={step} />;
        })}
      </div>
    </div>
  );
}

function AgentExecutionTimeline({
  steps,
  streaming,
}: {
  steps: ReactStep[];
  streaming: boolean;
}) {
  const groups = groupReactSteps(steps);
  const latestStep = steps[steps.length - 1];
  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>正在分析任务并规划下一步动作...</span>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <ReactLoopSection
          key={group.loop}
          group={group}
          latestStep={latestStep}
          streaming={streaming}
        />
      ))}
    </div>
  );
}

function DealReferenceCard({ deal }: { deal: DealDetail }) {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const extraction = deal.data.extraction;
  const analysis = deal.data.analysis;
  const companyName = deal.company?.name || extraction.company_name || "未命名项目";
  const fit = typeof analysis.overall_fit === "number" ? Math.round(analysis.overall_fit) : null;
  return (
    <button
      type="button"
      disabled={opening}
      onClick={async () => {
        setOpening(true);
        try {
          await triggerDealAction(deal.id, "create_workspace");
        } catch {
          // 进入详情页后仍可在项目 AI 助手中补建项目工作台会话。
        } finally {
          navigate(`/workspace/${deal.id}`);
        }
      }}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <FolderKanban className="h-4 w-4" />
            项目工作台
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-slate-950">{companyName}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {dealStatusLabel(deal.status)}
        </span>
      </div>
      {analysis.portrait && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {analysis.portrait}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        {extraction.track && <span className="rounded-full bg-slate-100 px-2.5 py-1">{extraction.track}</span>}
        {extraction.funding_stage && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{extraction.funding_stage}</span>
        )}
        {fit !== null && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600">匹配度 {fit}</span>}
      </div>
    </button>
  );
}

function isTimelineEcho(content: string, steps: ReactStep[]) {
  const normalized = content.trim();
  if (!normalized) return false;
  return steps.some((step) => step.summary.trim() === normalized);
}

function AgentExecutionMessage({
  message,
  currentPreference,
}: {
  message: ChatMessage;
  currentPreference?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(true);
  const steps = message.reactSteps ?? [];
  const duration = reactDurationLabel(steps);
  const stateLabel = message.streaming ? "正在处理" : "已处理";
  const content = message.content.trim();
  const showFinalContent = !!content && (message.error || !isTimelineEcho(content, steps));
  const deals = message.deals ?? [];

  return (
    <article className="w-full">
      <div className="rounded-lg bg-white">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 border-b border-slate-200 py-3 text-left text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          {message.streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>{stateLabel}</span>
          {duration && <span>{duration}</span>}
        </button>
        {open && (
          <div className="py-5">
            <AgentExecutionTimeline steps={steps} streaming={!!message.streaming} />
          </div>
        )}
      </div>
      {showFinalContent && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
            message.error
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
      {message.usage && (
        <div className="mt-1 px-1 text-[11px] text-slate-400">
          {formatTokens(message.usage)}
        </div>
      )}
      {message.deliverables.length > 0 && (
        <div className="mt-4 space-y-4">
          {message.deliverables.map((deliverable) => (
            <DeliverableView
              key={deliverable.id}
              deliverable={deliverable}
              currentPreference={currentPreference}
            />
          ))}
        </div>
      )}
      {deals.length > 0 && (
        <div className="mt-4 space-y-3">
          {deals.map((deal) => (
            <DealReferenceCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </article>
  );
}

function MessageBubble({
  message,
  currentPreference,
}: {
  message: ChatMessage;
  currentPreference?: Record<string, unknown>;
}) {
  const isUser = message.role === "user";
  const showUsage = !isUser && !!message.usage;
  const deals = message.deals ?? [];
  const reactSteps = message.reactSteps ?? [];
  if (!isUser && reactSteps.length > 0) {
    return <AgentExecutionMessage message={message} currentPreference={currentPreference} />;
  }
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
        {showUsage && message.usage && (
          <div className="mt-1 px-1 text-[11px] text-slate-400">
            {formatTokens(message.usage)}
          </div>
        )}
        {message.deliverables.length > 0 && (
          <div className="mt-4 space-y-4">
            {message.deliverables.map((deliverable) => (
              <DeliverableView
                key={deliverable.id}
                deliverable={deliverable}
                currentPreference={currentPreference}
              />
            ))}
          </div>
        )}
        {deals.length > 0 && (
          <div className="mt-4 space-y-3">
            {deals.map((deal) => (
              <DealReferenceCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
