import { validateFile, formatErrors } from "@flowstore/core/validation/ajv";
import { TestCaseSchema, type TestCase } from "@flowstore/core/schema/files/testCase";
import { PersonaSchema, type Persona } from "@flowstore/core/schema/files/persona";
import { RubricSchema, type Rubric } from "@flowstore/core/schema/files/rubric";
import { GoldSchema, type Gold, type GoldTurn } from "@flowstore/core/schema/files/gold";
import { DecisionTestSchema, type DecisionTest } from "@flowstore/core/schema/files/decisionTest";
import type { FileMap, IgnoredFile, LoadError, TestingArtifacts } from "./types";
import { findSection, fromYaml, joinFrontmatter, splitFrontmatter, splitSections, toYaml } from "./markdown";

// Testing artifacts on disk. Prose-bearing artifacts are markdown with
// frontmatter; the body holds the artifact's own prose and the frontmatter
// everything typed (FILE-MODEL § Testing artifacts):
//
//   tests/cases/<id>.md        notes as preamble; "## Turns" (- one user turn per
//                              line, "- [barge-in] text" for an interruption,
//                              "- [silence]" for an empty turn);
//                              "## Actor" = an inline user-sim prompt
//   tests/personas/<id>.md     system_prompt as preamble; "## Notes"
//   tests/rubrics/<id>.md      criteria as preamble; "## Prompt template"
//   tests/gold/<id>.md         notes as preamble; "## Transcript" of
//                              "Agent: …" / "User: …" lines (continuations
//                              indented two spaces)
//   tests/decisions/<id>.yaml  a routing matrix: all fields as YAML
//
// The pre-markdown JSON files (*.test.json, *.persona.json, *.rubric.json,
// *.gold.json, *.decision.json) are read only by the legacy loader behind
// flowstore-migrate (`legacy: true`); the product never loads or writes them.

const RES = {
  current: {
    cases: /^tests\/cases\/(.+)\.(md)$/,
    personas: /^tests\/personas\/(.+)\.(md)$/,
    rubrics: /^tests\/rubrics\/(.+)\.(md)$/,
    golds: /^tests\/gold\/(.+)\.(md)$/,
    decisions: /^tests\/decisions\/(.+)\.(ya?ml)$/,
  },
  legacy: {
    cases: /^tests\/cases\/(.+)\.(test\.json)$/,
    personas: /^tests\/personas\/(.+)\.(persona\.json)$/,
    rubrics: /^tests\/rubrics\/(.+)\.(rubric\.json)$/,
    golds: /^tests\/gold\/(.+)\.(gold\.json)$/,
    decisions: /^tests\/decisions\/(.+)\.(decision\.json)$/,
  },
};

const CASE_SCHEMA = "flowstore://test/case/v0";
const PERSONA_SCHEMA = "flowstore://test/persona/v0";
const RUBRIC_SCHEMA = "flowstore://test/rubric/v0";
const GOLD_SCHEMA = "flowstore://test/gold/v0";
const DECISION_SCHEMA = "flowstore://test/decision-test/v0";

export function loadTestingArtifacts(
  files: FileMap,
  errors: LoadError[],
  opts: { legacy?: boolean } = {},
): TestingArtifacts {
  const re = opts.legacy ? RES.legacy : RES.current;
  if (opts.legacy) files = migrateTestingFiles(files);
  const ignored: IgnoredFile[] = [];
  return {
    testCases: loadCollection<TestCase>(files, errors, ignored, re.cases, TestCaseSchema, CASE_SCHEMA, parseCase),
    personas: loadCollection<Persona>(files, errors, ignored, re.personas, PersonaSchema, PERSONA_SCHEMA, parsePersona),
    rubrics: loadCollection<Rubric>(files, errors, ignored, re.rubrics, RubricSchema, RUBRIC_SCHEMA, parseRubric),
    golds: loadCollection<Gold>(files, errors, ignored, re.golds, GoldSchema, GOLD_SCHEMA, parseGold),
    decisions: loadCollection<DecisionTest>(files, errors, ignored, re.decisions, DecisionTestSchema, DECISION_SCHEMA, parseDecision),
    ignored,
  };
}

// Paths of pre-markdown test files, so the loader can point at them.
export function legacyTestingPaths(files: FileMap): string[] {
  return Object.keys(files).filter((p) => Object.values(RES.legacy).some((re) => re.test(p)));
}

// Inverse of loadTestingArtifacts: the canonical file for each artifact.
// Merged with decomposeSpec output on save.
export function decomposeTestingArtifacts(artifacts: TestingArtifacts): FileMap {
  const out: FileMap = {};
  for (const c of artifacts.testCases) out[`tests/cases/${c.id}.md`] = emitCase(c);
  for (const p of artifacts.personas) out[`tests/personas/${p.id}.md`] = emitPersona(p);
  for (const r of artifacts.rubrics) out[`tests/rubrics/${r.id}.md`] = emitRubric(r);
  for (const g of artifacts.golds) out[`tests/gold/${g.id}.md`] = emitGold(g);
  for (const d of artifacts.decisions ?? []) out[`tests/decisions/${d.id}.yaml`] = emitDecision(d);
  return out;
}

// ---------- cases ----------

const BARGE_IN = "[barge-in] ";
const SILENCE = "[silence]";

export function emitCase(c: TestCase): string {
  const { $schema: _s, id: _id, notes, user_turns, system_prompt, ...front } = c;
  void _s; void _id;
  const parts: string[] = [];
  if (notes) parts.push(notes.trim());
  if (user_turns) {
    parts.push("## Turns", ...user_turns.map((t) => {
      const text = typeof t === "string" ? t : t.text;
      const barge = typeof t !== "string" && t.barge_in;
      const body = text === "" ? SILENCE : text.replace(/\n/g, "\n  ");
      return "- " + (barge ? BARGE_IN : "") + body;
    }));
  }
  if (system_prompt !== undefined) parts.push("## Actor", system_prompt.trim());
  return joinFrontmatter(front, parts.join("\n\n"));
}

function parseCase(id: string, text: string, path: string): TestCase {
  const doc = splitFrontmatter(text, path);
  const { preamble, sections } = splitSections(doc.body);
  const c: Record<string, unknown> = { $schema: CASE_SCHEMA, id, ...doc.meta };
  const notes = preamble.trim();
  if (notes) c.notes = notes;
  const turns = findSection(sections, "Turns");
  if (turns) {
    c.user_turns = parseTurnList(turns.body).map((t) => {
      const barge = t.startsWith(BARGE_IN);
      const raw = barge ? t.slice(BARGE_IN.length) : t;
      const text = raw === SILENCE ? "" : raw;
      return barge ? { text, barge_in: true } : text;
    });
  }
  const actor = findSection(sections, "Actor");
  if (actor) c.system_prompt = actor.body.trim();
  rejectUnknownSections(sections, ["turns", "actor"], path);
  return c as unknown as TestCase;
}

// "- text" items; a line indented two spaces continues the previous item.
function parseTurnList(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^- /.test(line)) out.push(line.slice(2));
    else if (line === "-") out.push("");
    else if (/^  /.test(line) && out.length > 0) out[out.length - 1] += "\n" + line.slice(2);
    else if (line.trim() !== "") throw new Error(`expected "- turn" lines under ## Turns; found: ${line.slice(0, 60)}`);
  }
  return out;
}

// ---------- personas ----------

export function emitPersona(p: Persona): string {
  const { $schema: _s, id: _id, system_prompt, notes, ...front } = p;
  void _s; void _id;
  const parts = [system_prompt.trim()];
  if (notes) parts.push("## Notes", notes.trim());
  return joinFrontmatter(front, parts.join("\n\n"));
}

function parsePersona(id: string, text: string, path: string): Persona {
  const doc = splitFrontmatter(text, path);
  const { preamble, sections } = splitSections(doc.body);
  const p: Record<string, unknown> = { $schema: PERSONA_SCHEMA, id, ...doc.meta, system_prompt: preamble.trim() };
  const notes = findSection(sections, "Notes");
  if (notes) p.notes = notes.body.trim();
  rejectUnknownSections(sections, ["notes"], path);
  return p as unknown as Persona;
}

// ---------- rubrics ----------

export function emitRubric(r: Rubric): string {
  const { $schema: _s, id: _id, criteria, prompt_template, ...front } = r;
  void _s; void _id;
  return joinFrontmatter(front, [criteria.trim(), "## Prompt template", prompt_template.trim()].join("\n\n"));
}

function parseRubric(id: string, text: string, path: string): Rubric {
  const doc = splitFrontmatter(text, path);
  const { preamble, sections } = splitSections(doc.body);
  const tpl = findSection(sections, "Prompt template");
  if (!tpl) throw new Error(`${path}: missing "## Prompt template"`);
  rejectUnknownSections(sections, ["prompt template"], path);
  return { $schema: RUBRIC_SCHEMA, id, ...doc.meta, criteria: preamble.trim(), prompt_template: tpl.body.trim() } as unknown as Rubric;
}

// ---------- golds ----------

export function emitGold(g: Gold): string {
  const { $schema: _s, id: _id, notes, turns, ...front } = g;
  void _s; void _id;
  const parts: string[] = [];
  if (notes) parts.push(notes.trim());
  parts.push("## Transcript", turns.map(formatTurn).join("\n"));
  return joinFrontmatter(front, parts.join("\n\n"));
}

function formatTurn(t: GoldTurn): string {
  const who = t.role === "agent" ? "Agent" : "User";
  return `${who}: ${t.text.replace(/\n/g, "\n  ")}`;
}

function parseGold(id: string, text: string, path: string): Gold {
  const doc = splitFrontmatter(text, path);
  const { preamble, sections } = splitSections(doc.body);
  const transcript = findSection(sections, "Transcript");
  if (!transcript) throw new Error(`${path}: missing "## Transcript"`);
  rejectUnknownSections(sections, ["transcript"], path);
  const g: Record<string, unknown> = { $schema: GOLD_SCHEMA, id, ...doc.meta };
  const notes = preamble.trim();
  if (notes) g.notes = notes;
  g.turns = parseTranscript(transcript.body, path);
  return g as unknown as Gold;
}

// Same line grammar as compare's scenario textarea (turnText.ts): a role
// marker starts a turn, case-insensitive, space optional; any other
// non-blank line continues the current turn. The emitter indents
// continuations two spaces; the parser strips that indent if present.
const TURN_RE = /^(agent|user):\s?(.*)$/i;

export function parseTranscript(body: string, path: string): GoldTurn[] {
  const turns: GoldTurn[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = TURN_RE.exec(line);
    if (m) turns.push({ role: m[1].toLowerCase() === "agent" ? "agent" : "user", text: m[2] });
    else if (turns.length > 0 && line.trim() !== "") turns[turns.length - 1].text += "\n" + line.replace(/^  /, "");
    else if (line.trim() !== "") throw new Error(`${path}: expected "Agent:" / "User:" lines; found: ${line.slice(0, 60)}`);
  }
  return turns;
}

// ---------- decisions ----------

export function emitDecision(d: DecisionTest): string {
  const { $schema: _s, id: _id, ...rest } = d;
  void _s; void _id;
  return toYaml(rest);
}

function parseDecision(id: string, text: string, path: string): DecisionTest {
  const data = fromYaml<Record<string, unknown> | null>(text, path) ?? {};
  return { $schema: DECISION_SCHEMA, id, ...data } as unknown as DecisionTest;
}

// ---------- shared ----------

function rejectUnknownSections(sections: Array<{ title: string }>, known: string[], path: string): void {
  for (const s of sections) {
    if (!known.includes(s.title.toLowerCase())) throw new Error(`${path}: unknown section "## ${s.title}"`);
  }
}

function loadCollection<T extends { $schema: string; id: string }>(
  files: FileMap,
  errors: LoadError[],
  ignored: IgnoredFile[],
  pathRe: RegExp,
  schema: Parameters<typeof validateFile>[0],
  expectedSchema: string,
  parseSource: (id: string, text: string, path: string) => T,
): T[] {
  const out: T[] = [];
  for (const path of Object.keys(files).filter((p) => pathRe.test(p)).sort()) {
    const [, baseId, ext] = pathRe.exec(path)!;
    let parsed: T;
    try {
      parsed = ext.endsWith("json") ? (JSON.parse(files[path]) as T) : parseSource(baseId, files[path], path);
    } catch (e) {
      errors.push({ path, message: e instanceof Error ? e.message : String(e) });
      continue;
    }
    // Forward-compat: a recognized path carrying an unrecognized $schema URI
    // is skipped and surfaced, not hard-errored.
    const uri = (parsed as { $schema?: unknown }).$schema;
    if (typeof uri === "string" && uri !== expectedSchema) {
      ignored.push({ path, schema: uri, reason: `unrecognized $schema "${uri}" (this loader understands "${expectedSchema}")` });
      continue;
    }
    const check = validateFile(schema, parsed);
    if (!check.valid) {
      for (const msg of formatErrors(check.errors)) errors.push({ path, message: msg });
      continue;
    }
    if (parsed.id !== baseId) errors.push({ path, message: `id "${parsed.id}" does not match filename "${baseId}"` });
    out.push(parsed);
  }
  return out;
}

// Behavior-preserving, idempotent migration of the legacy JSON "persona owns
// the world" model to "persona = actor with intrinsic fixture; case carries
// situational fixture". Only the pre-markdown JSON files can carry the old
// shape, so this touches nothing else.
function migrateTestingFiles(files: FileMap): FileMap {
  const PERSONA_PATH_RE = /^tests\/personas\/(.+)\.persona\.json$/;
  const CASE_PATH_RE = /^tests\/cases\/(.+)\.test\.json$/;
  type Obj = Record<string, unknown>;
  const parseObj = (text: string): Obj | null => {
    try {
      const v = JSON.parse(text) as unknown;
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
    } catch {
      return null;
    }
  };
  const personaPaths = Object.keys(files).filter((p) => PERSONA_PATH_RE.test(p));
  const casePaths = Object.keys(files).filter((p) => CASE_PATH_RE.test(p));
  if (personaPaths.length === 0) return files;

  const personaById = new Map<string, Obj>();
  for (const path of personaPaths) {
    const obj = parseObj(files[path]);
    if (obj && typeof obj.id === "string") personaById.set(obj.id, obj);
  }
  const isWorldOnly = (p: Obj): boolean => typeof p.system_prompt !== "string";
  const asRecord = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

  const out: FileMap = { ...files };
  let mutated = false;
  for (const path of casePaths) {
    const c = parseObj(files[path]);
    if (!c) continue;
    const pid = typeof c.persona_id === "string" ? c.persona_id : null;
    if (!pid) continue;
    const persona = personaById.get(pid);
    if (!persona) continue;
    if (!isWorldOnly(persona) && !Array.isArray(c.user_turns)) continue;
    const mergedVars = { ...asRecord(persona.vars), ...asRecord(c.vars) };
    const mergedMocks = { ...asRecord(persona.mocks), ...asRecord(c.mocks) };
    if (Object.keys(mergedVars).length > 0) c.vars = mergedVars;
    if (Object.keys(mergedMocks).length > 0) c.mocks = mergedMocks;
    delete c.persona_id;
    out[path] = JSON.stringify(c, null, 2) + "\n";
    mutated = true;
  }
  for (const path of personaPaths) {
    const obj = parseObj(files[path]);
    if (obj && isWorldOnly(obj)) {
      delete out[path];
      mutated = true;
    }
  }
  return mutated ? out : files;
}
