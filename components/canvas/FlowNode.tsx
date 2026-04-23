import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowType } from "@/lib/types/spec";

export interface FlowNodeData {
  name: string;
  flowType: FlowType;
  stepCount: number;
  isEntry: boolean;
  scope?: ["global"] | string[];
}

const typeStyles: Record<FlowType, { border: string; badge: string; label: string }> = {
  happy:     { border: "border-emerald-400", badge: "bg-emerald-100 text-emerald-800", label: "happy" },
  sad:       { border: "border-amber-400",   badge: "bg-amber-100 text-amber-800",     label: "sad" },
  off:       { border: "border-zinc-400",    badge: "bg-zinc-100 text-zinc-800",       label: "off" },
  utility:   { border: "border-sky-400",     badge: "bg-sky-100 text-sky-800",         label: "utility" },
  interrupt: { border: "border-violet-400",  badge: "bg-violet-100 text-violet-800",   label: "interrupt" },
};

export function FlowNode({ data }: NodeProps & { data: FlowNodeData }) {
  const style = typeStyles[data.flowType];
  const scopeLabel =
    data.flowType === "interrupt"
      ? data.scope?.[0] === "global"
        ? "scope: global"
        : `scope: ${data.scope?.length ?? 0} flow${data.scope?.length === 1 ? "" : "s"}`
      : null;

  return (
    <div
      className={`rounded-md border-2 ${style.border} bg-white shadow-sm px-3 py-2 min-w-[200px] max-w-[260px] text-left`}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${style.badge}`}>
          {style.label}
        </span>
        {data.isEntry && (
          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-black text-white">
            entry
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-zinc-900 leading-tight">{data.name}</div>
      <div className="mt-1 text-[11px] text-zinc-500">
        {data.stepCount} step{data.stepCount === 1 ? "" : "s"}
        {scopeLabel ? ` · ${scopeLabel}` : ""}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
}
