import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  getDeliverable,
  getDealDetail,
  sendMessage,
  uploadMaterial,
  type HomeConversation,
  type SseHandlers,
  type TokenUsage,
} from "./api";
import type { DealDetail, Deliverable } from "./types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  deliverables: Deliverable[];
  deals?: DealDetail[];
  reasoning?: string;
  usage?: TokenUsage;
  pending?: boolean;
  streaming?: boolean;
  error?: boolean;
};

type ChatSession = {
  messages: ChatMessage[];
  progress: string | null;
  isSending: boolean;
};

type ChatSessionContextValue = {
  conversationId: string;
  messages: ChatMessage[];
  progress: string | null;
  isSending: boolean;
  recentConversationOverrides: HomeConversation[];
  streamingConversationIds: Set<string>;
  completionSeq: number;
  startNewConversation: () => void;
  setActiveConversationId: (id: string) => void;
  setConversationMessages: (id: string, messages: ChatMessage[]) => void;
  setConversationProgress: (id: string, progress: string | null) => void;
  setConversationSending: (id: string, sending: boolean) => void;
  clearRecentOverrides: (ids: string[]) => void;
  startTextMessage: (content: string, modelTier?: string) => Promise<void>;
  startUpload: (file: File) => Promise<void>;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptySession(): ChatSession {
  return { messages: [], progress: null, isSending: false };
}

function compactError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请确认服务已启动。";
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState(() => makeId());
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [recentConversationOverrides, setRecentConversationOverrides] = useState<
    HomeConversation[]
  >([]);
  const [streamingConversationIds, setStreamingConversationIds] = useState<Set<string>>(
    () => new Set()
  );
  const [completionSeq, setCompletionSeq] = useState(0);
  const runningRef = useRef<Set<string>>(new Set());

  const activeSession = sessions[conversationId] ?? emptySession();

  function updateSession(id: string, updater: (session: ChatSession) => ChatSession) {
    setSessions((current) => {
      const existing = current[id] ?? emptySession();
      return { ...current, [id]: updater(existing) };
    });
  }

  function setConversationMessages(id: string, messages: ChatMessage[]) {
    updateSession(id, (session) => ({ ...session, messages }));
  }

  function setConversationProgress(id: string, progress: string | null) {
    updateSession(id, (session) => ({ ...session, progress }));
  }

  function setConversationSending(id: string, sending: boolean) {
    updateSession(id, (session) => ({ ...session, isSending: sending }));
  }

  function updateAssistant(
    id: string,
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    updateSession(id, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === assistantId ? updater(message) : message
      ),
    }));
  }

  function upsertRecentConversation(conversation: HomeConversation) {
    setRecentConversationOverrides((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
  }

  function clearRecentOverrides(ids: string[]) {
    if (ids.length === 0) return;
    const synced = new Set(ids);
    setRecentConversationOverrides((current) =>
      current.filter((item) => !synced.has(item.id))
    );
  }

  function startNewConversation() {
    const nextId = makeId();
    setConversationId(nextId);
    updateSession(nextId, () => emptySession());
  }

  function markStreaming(id: string, streaming: boolean) {
    setStreamingConversationIds((current) => {
      const next = new Set(current);
      if (streaming) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function runAssistantFlow(
    id: string,
    userContent: string,
    run: (handlers: SseHandlers) => Promise<void>
  ) {
    if (runningRef.current.has(id)) return;

    const assistantId = makeId();
    runningRef.current.add(id);
    upsertRecentConversation({
      id,
      title: "未命名对话",
      preview: userContent,
      updated_at: new Date().toISOString(),
      conversation_type: "normal",
      source_deal_id: null,
    });
    markStreaming(id, true);
    updateSession(id, (session) => ({
      ...session,
      progress: "正在理解你的问题",
      isSending: true,
      messages: [
        ...session.messages,
        { id: makeId(), role: "user", content: userContent, deliverables: [] },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          deliverables: [],
          pending: true,
          streaming: true,
        },
      ],
    }));

    try {
      await run({
        onProgress(next) {
          updateSession(id, (session) => ({ ...session, progress: next }));
          updateAssistant(id, assistantId, (message) => ({
            ...message,
            content: next,
            pending: true,
            streaming: true,
          }));
        },
        onToken(token) {
          updateSession(id, (session) => ({ ...session, progress: null }));
          updateAssistant(id, assistantId, (message) => ({
            ...message,
            content: `${message.pending ? "" : message.content}${token}`,
            pending: false,
            streaming: true,
          }));
        },
        onReasoning(delta) {
          updateAssistant(id, assistantId, (message) => ({
            ...message,
            reasoning: (message.reasoning ?? "") + delta,
            streaming: true,
          }));
        },
        onObject(ref) {
          if (ref.type === "deal" && ref.deal_id) {
            void getDealDetail(ref.deal_id)
              .then((deal) => {
                updateAssistant(id, assistantId, (message) => ({
                  ...message,
                  content:
                    message.content && !message.pending
                      ? message.content
                      : "项目分析完成，已进入项目工作台。",
                  deals: [...(message.deals ?? []), deal],
                  pending: false,
                  streaming: message.streaming,
                }));
              })
              .catch((error) => {
                updateAssistant(id, assistantId, (message) => ({
                  ...message,
                  content: `项目已生成，但拉取工作台详情失败：${compactError(error)}`,
                  pending: false,
                  streaming: false,
                  error: true,
                }));
              });
            return;
          }
          if (!ref.deliverable_id) return;
          void getDeliverable(ref.deliverable_id)
            .then((deliverable) => {
              updateAssistant(id, assistantId, (message) => ({
                ...message,
                content:
                  message.content && !message.pending
                    ? message.content
                    : "已生成交付结果。",
                deliverables: [...message.deliverables, deliverable],
                pending: false,
                streaming: message.streaming,
              }));
            })
            .catch((error) => {
              updateAssistant(id, assistantId, (message) => ({
                ...message,
                content: `交付结果已生成，但拉取详情失败：${compactError(error)}`,
                pending: false,
                streaming: false,
                error: true,
              }));
            });
        },
        onUsage(usage) {
          updateAssistant(id, assistantId, (message) => ({
            ...message,
            usage,
            streaming: message.streaming,
          }));
        },
        onError(message) {
          updateSession(id, (session) => ({ ...session, progress: null }));
          updateAssistant(id, assistantId, (current) => ({
            ...current,
            content: message,
            pending: false,
            streaming: false,
            error: true,
          }));
        },
        onDone() {
          updateSession(id, (session) => ({ ...session, progress: null }));
          updateAssistant(id, assistantId, (message) => ({
            ...message,
            content:
              message.content ||
              message.deliverables.length > 0 ||
              (message.deals?.length ?? 0) > 0
                ? message.content
                : "已完成。",
            pending: false,
            streaming: false,
          }));
          setCompletionSeq((value) => value + 1);
        },
      });
    } catch (error) {
      updateSession(id, (session) => ({ ...session, progress: null }));
      updateAssistant(id, assistantId, (message) => ({
        ...message,
        content: compactError(error),
        pending: false,
        streaming: false,
        error: true,
      }));
    } finally {
      runningRef.current.delete(id);
      markStreaming(id, false);
      updateSession(id, (session) => ({ ...session, isSending: false }));
    }
  }

  async function startTextMessage(content: string, modelTier?: string) {
    const id = conversationId;
    await runAssistantFlow(id, content, (handlers) =>
      sendMessage(id, content, handlers, undefined, modelTier)
    );
  }

  async function startUpload(file: File) {
    const id = conversationId;
    await runAssistantFlow(id, `上传文件：${file.name}`, (handlers) =>
      uploadMaterial(id, file, handlers)
    );
  }

  const value: ChatSessionContextValue = {
    conversationId,
    messages: activeSession.messages,
    progress: activeSession.progress,
    isSending: activeSession.isSending,
    recentConversationOverrides,
    streamingConversationIds,
    completionSeq,
    startNewConversation,
    setActiveConversationId: setConversationId,
    setConversationMessages,
    setConversationProgress,
    setConversationSending,
    clearRecentOverrides,
    startTextMessage,
    startUpload,
  };

  return (
    <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("useChatSession 必须在 ChatSessionProvider 内使用");
  return context;
}
