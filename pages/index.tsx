import { useEffect, useState } from "react";
import Head from "next/head";
import { Canvas } from "@/components/canvas/Canvas";
import { FlowInspector } from "@/components/inspector/FlowInspector";
import { EdgeInspector } from "@/components/inspector/EdgeInspector";
import { ImportExportToolbar } from "@/components/toolbar/ImportExport";
import { useSpecStore } from "@/lib/store/spec";
import {
  clearSavedSpec,
  loadSavedSpec,
  startSpecPersistence,
} from "@/lib/store/persistence";
import { validateSpec } from "@/lib/validation/ajv";

export default function Home() {
  const spec = useSpecStore((s) => s.spec);
  const setSpec = useSpecStore((s) => s.setSpec);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => startSpecPersistence(), []);

  useEffect(() => {
    const saved = loadSavedSpec();
    if (saved) {
      const result = validateSpec(saved);
      if (result.valid) setSpec(result.spec);
      else clearSavedSpec();
    }
    setHydrating(false);
  }, [setSpec]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      const state = useSpecStore.getState();
      const sel = state.selection;
      if (sel?.kind === "flow") {
        const f = state.spec?.flows.find((x) => x.id === sel.id);
        const name = f?.name ?? sel.id;
        if (window.confirm(`Delete flow "${name}"?`)) state.removeFlow(sel.id);
      } else if (sel?.kind === "edge") {
        if (window.confirm("Delete this exit path?")) state.removeExitPath(sel.flowId, sel.exitPathId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (hydrating) return null;

  const flowCount = spec?.flows.length ?? 0;
  const interruptCount = spec?.flows.filter((f) => f.type === "interrupt").length ?? 0;

  return (
    <>
      <Head>
        <title>{spec ? `uxflows — ${spec.agent.meta.name}` : "uxflows"}</title>
      </Head>
      <div className="flex flex-col h-screen bg-zinc-50">
        <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold text-zinc-900">
              {spec ? spec.agent.meta.name : "uxflows"}
            </h1>
            {spec && (
              <span className="text-xs text-zinc-500">
                {spec.agent.meta.client} · {(spec.agent.meta.languages ?? []).join(", ")} · v{spec.agent.version}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <ImportExportToolbar />
            {spec && (
              <span className="text-xs text-zinc-500">
                {flowCount} flow{flowCount === 1 ? "" : "s"} ({interruptCount} interrupt{interruptCount === 1 ? "" : "s"})
              </span>
            )}
          </div>
        </header>
        <main className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0">
            <Canvas />
          </div>
          <FlowInspector />
          <EdgeInspector />
        </main>
      </div>
    </>
  );
}
