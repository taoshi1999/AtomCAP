import { useState, type KeyboardEvent } from "react";
import { ArrowUp, Bot, Brain, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { sendMessage, type SseHandlers, type TokenUsage } from "../lib/api";

type PageAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  usage?: TokenUsage;
  pending?: boolean;
  streaming?: boolean;
  error?: boolean;
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请确认后端服务已启动。";
}

function updateMessage(
  messages: PageAssistantMessage[],
  id: string,
  updater: (message: PageAssistantMessage) => PageAssistantMessage
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

export default function PageAssistant({
  contextLabel,
  contextSummary,
  placeholder,
}: {
  contextLabel: string;
  contextSummary: string;
  placeholder: string;
}) {
  const [conversationId] = useState(() => makeId());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<PageAssistantMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function submit() {
    const content = input.trim();
    if (!content || isSending) return;

    const assistantId = makeId();
    const contextualContent = [
      `当前页面：${contextLabel}`,
      `页面上下文：${contextSummary}`,
      `用户需求：${content}`,
    ].join("\n");

    setInput("");
    setIsSending(true);
    setProgress("正在处理");
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content },
      { id: assistantId, role: "assistant", content: "", pending: true, streaming: true },
    ]);

    const handlers: SseHandlers = {
      onProgress(next) {
        setProgress(next);
        setMessages((current) =>
          updateMessage(current, assistantId, (message) => ({
            ...message,
            content: next,
            pending: true,
          }))
        );
      },
      onToken(token) {
        setProgress(null);
        setMessages((current) =>
          updateMessage(current, assistantId, (message) => ({
            ...message,
            content: `${message.pending ? "" : message.content}${token}`,
            pending: false,
            streaming: true,
          }))
        );
      },
      onReasoning(delta) {
        setMessages((current) =>
          updateMessage(current, assistantId, (message) => ({
            ...message,
            reasoning: (message.reasoning ?? "") + delta,
            streaming: true,
          }))
        );
      },
      onUsage(usage) {
        setMessages((current) =>
          updateMessage(current, assistantId, (message) => ({
            ...message,
            usage,
          }))
        );
      },
      onError(message) {
        setProgress(null);
        setMessages((current) =>
          updateMessage(current, assistantId, (item) => ({
            ...item,
            content: message,
            pending: false,
            streaming: false,
            error: true,
          }))
        );
      },
      onDone() {
        setProgress(null);
        setMessages((current) =>
          updateMessage(current, assistantId, (message) => ({
            ...message,
            content: message.content || "已完成。",
            pending: false,
            streaming: false,
          }))
        );
      },
    };

    try {
      await sendMessage(conversationId, contextualContent, handlers);
    } catch (error) {
      setProgress(null);
      setMessages((current) =>
        updateMessage(current, assistantId, (message) => ({
          ...message,
          content: compactError(error),
          pending: false,
          streaming: false,
          error: true,
        }))
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="shrink-0 rounded-lg border border-indigo-200 bg-white p-3 shadow-sm">
      {messages.length > 0 && (
        <div className="mb-3 max-h-44 space-y-2 overflow-y-auto pr-1">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[86%]">
                  {!isUser && message.reasoning && (
                    <AssistantReasoning text={message.reasoning} streaming={!!message.streaming} />
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm leading-6 ${
                      isUser
                        ? "bg-indigo-600 text-white"
                        : message.error
                          ? "border border-red-200 bg-red-50 text-red-700"
                          : "border border-slate-200 bg-slate-50 text-slate-800"
                    }`}
                  >
                    {!isUser && (
                      <Bot className="mr-1.5 inline h-4 w-4 align-[-2px] text-indigo-600" />
                    )}
                    {message.pending && (
                      <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin align-[-2px]" />
                    )}
                    {message.content}
                  </div>
                  {!isUser && message.usage && (
                    <div className="mt-1 px-1 text-[11px] text-slate-400">
                      {formatTokens(message.usage)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex h-6 items-center gap-2 text-xs font-semibold text-slate-500">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>{progress ?? contextLabel}</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="block w-full resize-none bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          title="发送"
          onClick={() => void submit()}
          disabled={isSending || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
