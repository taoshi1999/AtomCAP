/**
 * 对象渲染注册表 —— deliverable.type → React 组件。
 * 消息流中的 object_ref 块经 DeliverableView 分发渲染；新增对象类型时在此注册。
 */
import type { ComponentType } from "react";
import type { Deliverable, DeliverableType, Thesis } from "../../lib/types";
import ThesisView from "./ThesisView";
import DealListView from "./DealListView";

const REGISTRY: Partial<Record<DeliverableType, ComponentType<{ payload: never }>>> = {};

export function DeliverableView({
  deliverable,
  currentPreference,
}: {
  deliverable: Deliverable;
  currentPreference?: Record<string, unknown>;
}) {
  switch (deliverable.type) {
    case "thesis":
      return (
        <ThesisView
          thesis={deliverable.payload as Thesis}
          deliverableId={deliverable.id}
          currentPreference={currentPreference}
        />
      );
    case "deal_list":
      return <DealListView payload={deliverable.payload} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-400">
          未注册的对象类型：{deliverable.type}
        </div>
      );
  }
}

export default REGISTRY;
