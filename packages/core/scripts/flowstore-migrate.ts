// Convert a project from the pre-markdown JSON layout to the markdown source
// layout in place, and prove the spec survived: the migrated directory is
// reloaded and compared, entity by entity, against the original.
//
//   flowstore-migrate <project-dir>
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadProjectFromPath, readDirectoryToFileMap, writeFileMapToDirectory } from "@flowstore/core/files/node";
import { decomposeSpec, isLegacyLayout, loadProject } from "@flowstore/core/files";
import type { Spec } from "@flowstore/core/schema/v0";

const dir = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(dir)) {
  console.error("usage: flowstore-migrate <project-dir>");
  process.exit(2);
}

const before = readDirectoryToFileMap(dir);
if (!isLegacyLayout(before)) {
  console.log(`${dir}: already in markdown layout`);
  process.exit(0);
}
const loaded = loadProjectFromPath(dir);
if (!loaded.spec) {
  console.error("could not load the legacy project:");
  for (const e of loaded.errors) console.error(`  ${e.path ? e.path + ": " : ""}${e.message}`);
  process.exit(1);
}
for (const e of loaded.errors) console.warn(`warning: ${e.path ? e.path + ": " : ""}${e.message}`);

const emitted = decomposeSpec(loaded.spec);
writeFileMapToDirectory(emitted, dir);

const LEGACY = [
  /^agent\.json$/, /^flowstore\.json$/, /^guardrails\.json$/, /^guardrails\/.+\.json$/,
  /^business-goals\.json$/, /^business-goals\/.+\.json$/, /^variables\.json$/, /^variables\/.+\.json$/,
  /^capabilities\/.+\.capability\.json$/, /^knowledge\/faq\.json$/, /^knowledge\/faq\/.+\.json$/,
  /^knowledge\/glossary\.json$/, /^knowledge\/tables\/.+\.(meta\.json|csv)$/,
  /^flows\/.+\.flow\.json$/, /^flows\/.+\.scripts\.csv$/,
];
const removed: string[] = [];
for (const path of Object.keys(before)) {
  if (LEGACY.some((re) => re.test(path))) {
    rmSync(join(dir, path));
    removed.push(path);
  }
}

const after = loadProject(readDirectoryToFileMap(dir));
if (!after.spec) {
  console.error("migrated project does not load:");
  for (const e of after.errors) console.error(`  ${e.path ? e.path + ": " : ""}${e.message}`);
  process.exit(1);
}
const diff = specDiff(loaded.spec, after.spec);
console.log(`${dir}: wrote ${Object.keys(emitted).length} files, removed ${removed.length}`);
// The emitter trims trailing whitespace on prose; that is the one difference
// the layout introduces on purpose. Anything else is a real loss.
const real = diff.filter((d) => !d.whitespaceOnly);
for (const d of diff.filter((x) => x.whitespaceOnly)) console.log(`  normalized trailing whitespace: ${d.path}`);
if (real.length > 0) {
  console.error("round-trip differences:");
  for (const d of real) console.error(`  ${d.path}: ${d.before} → ${d.after}`);
  process.exit(1);
}
console.log(diff.length > 0 ? "round-trip: identical modulo trailing whitespace" : "round-trip: identical");

// Structural comparison, insensitive to key order and to the fields the
// markdown layout normalizes ($schema URIs, entity order within collections).
interface Diff { path: string; before: string; after: string; whitespaceOnly: boolean }
function specDiff(a: Spec, b: Spec): Diff[] {
  const out: Diff[] = [];
  const na = canon(a), nb = canon(b);
  walk("", na, nb, out);
  return out;
}
function canon(spec: Spec): unknown {
  const s = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const agent = s.agent as Record<string, unknown>;
  delete agent.$schema;
  for (const f of s.flows as Array<Record<string, unknown>>) delete f.$schema;
  const byId = (xs: unknown) => Array.isArray(xs) ? [...xs].sort((p, q) => String(p.id).localeCompare(String(q.id))) : xs;
  agent.capabilities = byId(agent.capabilities);
  agent.guardrails = byId(agent.guardrails);
  agent.business_goals = byId(agent.business_goals);
  const k = agent.knowledge as Record<string, unknown> | undefined;
  if (k) { k.faq = byId(k.faq); k.glossary = byId(k.glossary); k.tables = byId(k.tables); }
  s.flows = byId(s.flows);
  return s;
}
function walk(path: string, a: unknown, b: unknown, out: Diff[]): void {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = a as Record<string, unknown>, kb = b as Record<string, unknown>;
    for (const k of new Set([...Object.keys(ka), ...Object.keys(kb)])) walk(`${path}/${k}`, ka[k], kb[k], out);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    a.forEach((x, i) => walk(`${path}[${i}]`, x, b[i], out));
    return;
  }
  const whitespaceOnly = typeof a === "string" && typeof b === "string" && a.replace(/\s+$/, "") === b.replace(/\s+$/, "");
  out.push({ path: path || "/", before: JSON.stringify(a)?.slice(0, 80) ?? "", after: JSON.stringify(b)?.slice(0, 80) ?? "", whitespaceOnly });
}
