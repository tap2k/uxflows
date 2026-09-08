// Compare a migrated working tree against a git revision that still carries
// the JSON layout: load both through the same loader and diff entity by
// entity (key-order- and trailing-whitespace-insensitive).
//
//   verify-migration <project-dir> [<git-rev>]
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { loadProject } from "@flowstore/core/files";
import { readDirectoryToFileMap } from "@flowstore/core/files/node";
import type { FileMap } from "@flowstore/core/files";

const dir = resolve(process.argv[2] ?? "");
const rev = process.argv[3] ?? "HEAD";
const git = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
const paths = git("ls-tree", "-r", "--name-only", rev).split("\n").filter((p) => p && /\.(json|csv|md|ya?ml)$/.test(p) && !p.startsWith("tests/runs/"));
const before: FileMap = {};
for (const p of paths) before[p] = git("show", `${rev}:${p}`);
const a = loadProject(before);
const b = loadProject(readDirectoryToFileMap(dir));
const errs = (r: typeof a) => r.errors.filter((e) => !/^warning:/.test(e.message)).map((e) => `${e.path ?? ""}: ${e.message}`);
if (!a.spec || !b.spec) { console.error("load failed", errs(a), errs(b)); process.exit(1); }
const canon = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).filter((k) => k !== "$schema" && o[k] !== undefined).sort().map((k) => [k, canon(o[k])]));
  }
  return typeof v === "string" ? v.replace(/\s+$/, "") : v;
};
const byId = (xs: Array<{ id: string }>) => [...xs].sort((p, q) => p.id.localeCompare(q.id));
const pick = (r: typeof a) => canon({
  agent: { ...r.spec!.agent, capabilities: byId(r.spec!.agent.capabilities ?? []), guardrails: byId(r.spec!.agent.guardrails ?? []), business_goals: byId(r.spec!.agent.business_goals ?? []),
    knowledge: r.spec!.agent.knowledge && { faq: byId(r.spec!.agent.knowledge.faq ?? []), glossary: byId(r.spec!.agent.knowledge.glossary ?? []), tables: byId(r.spec!.agent.knowledge.tables ?? []) } },
  flows: byId(r.spec!.flows),
  cases: byId(r.testingArtifacts.testCases), personas: byId(r.testingArtifacts.personas), rubrics: byId(r.testingArtifacts.rubrics), golds: byId(r.testingArtifacts.golds), decisions: byId(r.testingArtifacts.decisions),
  models: r.modelsConfig,
});
const diffs: string[] = [];
const walk = (path: string, x: unknown, y: unknown) => {
  if (JSON.stringify(x) === JSON.stringify(y)) return;
  if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x) && !Array.isArray(y)) {
    const kx = x as Record<string, unknown>, ky = y as Record<string, unknown>;
    for (const k of new Set([...Object.keys(kx), ...Object.keys(ky)])) walk(`${path}/${k}`, kx[k], ky[k]);
    return;
  }
  if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) { x.forEach((v, i) => walk(`${path}[${i}]`, v, y[i])); return; }
  diffs.push(`${path}: ${JSON.stringify(x)?.slice(0, 100)} → ${JSON.stringify(y)?.slice(0, 100)}`);
};
walk("", pick(a), pick(b));
const ign = [...a.testingArtifacts.ignored, ...b.testingArtifacts.ignored].map((i) => `${i.path}: ${i.reason}`);
const la = errs(a), lb = errs(b);
console.log(`${dir}: ${diffs.length === 0 ? "identical" : diffs.length + " differences"}` + (la.length ? `; ${la.length} load errors at ${rev}` : "") + (lb.length ? `; ${lb.length} load errors in working tree` : "") + (ign.length ? `; ignored: ${ign.length}` : ""));
for (const d of diffs) console.log("  " + d);
for (const e of la) console.log("  [rev] " + e);
for (const e of lb) console.log("  [tree] " + e);
process.exit(diffs.length === 0 && lb.length === 0 ? 0 : 1);
