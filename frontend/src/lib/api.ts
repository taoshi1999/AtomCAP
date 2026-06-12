/**
 * API 客户端 + SSE 订阅。
 * 事件协议与 backend/app/api/conversations.py 对应：
 * token / progress / object / done
 */
import { fetchEventSource } from "@microsoft/fetch-event-source";

export interface SseHandlers {
  onToken?: (text: string) => void;
  onProgress?: (text: string) => void;
  onObject?: (ref: { type: string; deliverable_id: string | null }) => void;
  onDone?: () => void;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  handlers: SseHandlers,
  signal?: AbortSignal
) {
  await fetchEventSource(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
    onmessage(ev) {
      switch (ev.event) {
        case "token":
          handlers.onToken?.(ev.data);
          break;
        case "progress":
          handlers.onProgress?.(ev.data);
          break;
        case "object":
          handlers.onObject?.(JSON.parse(ev.data));
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    },
  });
}
