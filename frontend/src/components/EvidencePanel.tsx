import { ExternalLink, X } from "lucide-react";
import type { EvidenceDialogState, EvidenceKind } from "../lib/evidence";

function argumentKindLabel(kind?: EvidenceKind): string {
  if (kind === "market") return "市场信号";
  if (kind === "material") return "项目材料";
  if (kind === "preference") return "投资偏好";
  return "说明";
}

export default function EvidencePanel({
  state,
  onClose,
}: {
  state: EvidenceDialogState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">{state.title} · 证据链</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[1.1fr_1.5fr] bg-slate-50 text-xs font-bold text-slate-500">
              <div className="border-r border-slate-200 px-4 py-3">论点</div>
              <div className="px-4 py-3">论据</div>
            </div>
            {state.rows.map((row, index) => (
              <div key={`${row.point}-${index}`} className="grid grid-cols-[1.1fr_1.5fr] border-t border-slate-200 text-sm">
                <div className="border-r border-slate-200 px-4 py-3 font-medium leading-6 text-slate-800">
                  {row.point}
                </div>
                <div className="space-y-2 px-4 py-3">
                  {row.arguments.map((argument, i) => {
                    const content = (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            {argumentKindLabel(argument.kind)}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{argument.title}</span>
                          {argument.href && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                        </div>
                        {argument.detail && (
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{argument.detail}</div>
                        )}
                      </>
                    );
                    const className =
                      "block w-full rounded-md bg-slate-50 px-3 py-2 text-left leading-6 text-slate-700 transition";
                    return argument.href ? (
                      <a
                        key={`${argument.title}-${i}`}
                        href={argument.href}
                        target={argument.external ? "_blank" : undefined}
                        rel={argument.external ? "noreferrer" : undefined}
                        className={`${className} hover:bg-indigo-50 hover:text-indigo-700`}
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={`${argument.title}-${i}`} className={className}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
