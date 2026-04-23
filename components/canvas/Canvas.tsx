import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { Spec } from "@/lib/types/spec";
import { FlowNode, type FlowNodeData } from "./FlowNode";
import { autoLayout } from "./layout";

const nodeTypes = { flow: FlowNode };

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function buildGraph(spec: Spec): { nodes: Node[]; edges: Edge[] } {
  const flowIds = new Set(spec.flows.map((f) => f.id));
  const entryId = spec.agent.entry_flow_id;

  const nodes: Node[] = spec.flows.map((f) => ({
    id: f.id,
    type: "flow",
    position: { x: 0, y: 0 }, // dagre will overwrite
    data: {
      name: f.name,
      flowType: f.type,
      stepCount: f.steps?.length ?? 0,
      isEntry: f.id === entryId,
      scope: f.scope,
    } satisfies FlowNodeData,
  }));

  const edges: Edge[] = [];
  for (const f of spec.flows) {
    for (const xp of f.routing.exit_paths) {
      if (!xp.next_flow_id || !flowIds.has(xp.next_flow_id)) continue;
      const labelSrc = xp.condition?.expression ?? xp.type;
      edges.push({
        id: `${f.id}__${xp.id}`,
        source: f.id,
        target: xp.next_flow_id,
        label: truncate(labelSrc, 48),
        labelStyle: { fontSize: 11, fill: "#52525b" },
        labelBgStyle: { fill: "#fafafa" },
        style: { stroke: xp.type === "happy" ? "#34d399" : "#fbbf24", strokeWidth: 1.5 },
      });
    }
  }

  return { nodes, edges };
}

export function Canvas({ spec }: { spec: Spec }) {
  const { nodes, edges } = useMemo(() => {
    const g = buildGraph(spec);
    return { nodes: autoLayout(g.nodes, g.edges), edges: g.edges };
  }, [spec]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e4e4e7" />
        <Controls position="bottom-right" />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
