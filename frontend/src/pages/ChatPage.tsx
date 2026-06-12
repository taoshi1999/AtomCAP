/**
 * 首页 —— 默认“新对话”状态（设计文档：最近对话、当前投资偏好、推荐对话）。
 * Phase 0 验收：mock Thesis 对象的六区 UI 完整渲染。
 */
import { useState } from "react";
import ThesisView from "../components/objects/ThesisView";
import { mockThesis } from "../mocks/thesis";
import { sendMessage } from "../lib/api";

const SUGGESTED = [
  "帮我找找 AI 硬件这个赛道有什么值得关注的方向？",
  "帮我找一批近一年获得融资的具身智能公司",
  "扫一扫今天有哪些值得关注的市场信号",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [showMock, setShowMock] = useState(true); // Phase 0：默认展示 mock Thesis

  async function handleSend(text: string) {
    if (!text.trim()) return;
    setProgress("…");
    await sendMessage("00000000-0000-0000-0000-000000000001", text, {
      onProgress: (p) => setProgress(p),
      onToken: (t) => setProgress(t),
      onObject: () => setShowMock(true),
      onDone: () => setProgress(null),
    }).catch(() => setProgress("后端未启动（uvicorn app.main:app）"));
    setInput("");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 侧边栏：最近对话 / 项目工作台入口 / 关注赛道 / 偏好（骨架占位） */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="text-lg font-bold text-slate-900">AtomCAP</div>
        <nav className="mt-6 space-y-2 text-sm text-slate-600">
          <div className="rounded-md bg-slate-100 px-3 py-2 font-medium">新对话</div>
          <a href="/workspace" className="block rounded-md px-3 py-2 hover:bg-slate-50">
            项目工作台
          </a>
          <div className="rounded-md px-3 py-2 hover:bg-slate-50">关注赛道</div>
          <div className="rounded-md px-3 py-2 hover:bg-slate-50">投资偏好</div>
        </nav>
      </aside>

      {/* 主区 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {progress && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              {progress}
            </div>
          )}
          {showMock && <ThesisView thesis={mockThesis} onAction={(a) => alert(`action: ${a}（骨架占位）`)} />}
        </div>

        {/* 输入区 + 推荐对话 */}
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              placeholder="输入投资方向询问，将触发赛道前瞻 Agent…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={() => handleSend(input)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              发送
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
