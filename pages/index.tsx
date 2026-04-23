import Head from "next/head";
import { Canvas } from "@/components/canvas/Canvas";
import { valentinaSpec } from "@/lib/examples/valentina";

export default function Home() {
  const spec = valentinaSpec;
  const flowCount = spec.flows.length;
  const interruptCount = spec.flows.filter((f) => f.type === "interrupt").length;

  return (
    <>
      <Head>
        <title>{`uxflows — ${spec.agent.meta.name}`}</title>
      </Head>
      <div className="flex flex-col h-screen bg-zinc-50">
        <header className="flex items-baseline gap-4 border-b border-zinc-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold text-zinc-900">{spec.agent.meta.name}</h1>
          <span className="text-xs text-zinc-500">
            {spec.agent.meta.client} · {spec.agent.meta.language} · v{spec.agent.version}
          </span>
          <span className="ml-auto text-xs text-zinc-500">
            {flowCount} flow{flowCount === 1 ? "" : "s"} ({interruptCount} interrupt{interruptCount === 1 ? "" : "s"})
          </span>
        </header>
        <main className="flex-1 min-h-0">
          <Canvas spec={spec} />
        </main>
      </div>
    </>
  );
}
