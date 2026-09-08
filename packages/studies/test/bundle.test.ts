import { describe, it, expect } from "vitest";
import { decomposeSpec, decomposeTestingArtifacts, fromYaml, loadProject, loadTestingArtifacts, parseAgent } from "@flowstore/core/files";
import type { Spec } from "@flowstore/core/schema/v0";

// Parse one emitted markdown artifact through the loader.
const caseOf = (files: Record<string, string>, id: string) => loadTestingArtifacts({ [`tests/cases/${id}.md`]: files[`tests/cases/${id}.md`] }, []).testCases[0] as Record<string, unknown>;
const goldOf_ = (files: Record<string, string>, id: string) => loadTestingArtifacts({ [`tests/gold/${id}.md`]: files[`tests/gold/${id}.md`] }, []).golds[0] as Record<string, unknown> | undefined;
import { validateFile } from "@flowstore/core/validation/ajv";
import { GoldSchema } from "@flowstore/core/schema/files/gold";
import { TestCaseSchema } from "@flowstore/core/schema/files/testCase";
import { ResultSchema } from "@flowstore/core/schema/files/result";
import { buildStudyBundle, parseStudyBundle } from "../src/bundle";
import type { CellState, Scenario } from "../src/types";
import { cellKey } from "../src/types";

// Markdown-layout fixtures: a prompt-only agent, and a one-flow spec project.
const promptOnly = (extra: Record<string, string> = {}) => ({
  "agent.md": "---\nid: agent_p\nname: p\nidentity: P\npurpose: p\nmodality: text\nentry_flow_id: \"\"\n---\np\n",
  ...extra,
});
const specProjectSpec: Spec = {
  agent: {
    $schema: "flowstore://spec/agent/v0", id: "agent_spec", name: "spec-agent",
    meta: { identity: "Asha", purpose: "Remind patients about appointments.", modality: "voice" },
    chatbot_initiates: true, entry_flow_id: "greet",
  },
  flows: [{
    $schema: "flowstore://spec/flow/v0", id: "greet", name: "Greet", type: "happy",
    instructions: "Greet the caller and confirm the appointment.",
    exit_paths: [{ id: "xp_done", goto: "END", condition: { expression: "true", method: "direct" } }],
  }],
};
const gold = (g: Record<string, unknown>) => decomposeTestingArtifacts({ testCases: [], personas: [], rubrics: [], golds: [{ $schema: "flowstore://test/gold/v0", ...g } as never], decisions: [], ignored: [] });
const testCase = (c: Record<string, unknown>) => decomposeTestingArtifacts({ testCases: [{ $schema: "flowstore://test/case/v0", ...c } as never], personas: [], rubrics: [], golds: [], decisions: [], ignored: [] });

const u = (text: string) => ({ role: "user" as const, text });
const a = (text: string) => ({ role: "agent" as const, text });

// s1 is a full dual-party scenario (agent turns = the gold → exports a
// gold); s2 is user-only (no gold → no gold file).
const scenarios: Scenario[] = [
  {
    id: "s1",
    scenarioId: "sc-refill",
    name: "Refill request",
    language: "EN",
    turns: [u("hi"), a("Hello! I can help with your refill."), u("refill please"), a("Sure, refill coming up.")],
  },
  { id: "s2", scenarioId: "sc-refill", name: "Refill request (HI)", language: "HI", turns: [u("namaste")] },
];
const models = ["openai/gpt-4o-mini", "meta-llama/llama-3.1-8b-instruct:free"];

const doneCell = (text: string): CellState => ({
  status: "done",
  totalMs: 1234,
  usage: { inputTokens: 100, outputTokens: 40, cost: 0.0021 },
  turns: [
    { role: "user", text: "hi", ts: 0, events: [] },
    { role: "agent", text, ts: 0, events: [], latencyMs: 800 },
  ],
});

// s2 × column 1 errored — it must be absent from results and manifest.
const cells: Record<string, CellState> = {
  [cellKey("s1", 0)]: doneCell("Hello! I can help with your refill."),
  [cellKey("s1", 1)]: doneCell("Sure, refill coming up."),
  [cellKey("s2", 0)]: doneCell("Namaste! Main madad kar sakti hoon."),
  [cellKey("s2", 1)]: { status: "error", turns: [], totalMs: 0, error: "rate limited" },
};

const files = buildStudyBundle({ agentId: "agent-test", prompt: "You are Asha, a clinic assistant.", models, scenarios, cells });

describe("buildStudyBundle", () => {
  it("every emitted file parses as JSON", () => {
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith(".json")) expect(() => JSON.parse(content), path).not.toThrow();
    }
    expect(files["agent.md"]).toBeDefined();
  });

  it("agent.md carries the verbatim prompt as a full override with a stub entry flow", () => {
    const agent = parseAgent(files["agent.md"]);
    expect(agent.system_prompt).toBe("You are Asha, a clinic assistant.");
    expect(agent.entry_flow_id).toBe("");
    expect(agent.meta.languages).toEqual(["EN", "HI"]);
  });

  it("scenarios serialize as valid test cases — user turns only, with language and scenario_id", () => {
    for (const s of scenarios) {
      const parsed = caseOf(files, s.id);
      const { valid, errors } = validateFile(TestCaseSchema, parsed);
      expect(valid, JSON.stringify(errors)).toBe(true);
      expect(parsed.scenario_id).toBe("sc-refill");
      expect(parsed.language).toBe(s.language);
    }
    expect(caseOf(files, "s1").user_turns).toEqual(["hi", "refill please"]);
  });

  it("only done cells become results, each valid with usage mapped to unit-typed fields", () => {
    const resultPaths = Object.keys(files).filter((p) => p.endsWith(".result.json"));
    expect(resultPaths).toHaveLength(3);
    for (const p of resultPaths) {
      const parsed = JSON.parse(files[p]);
      const { valid, errors } = validateFile(ResultSchema, parsed);
      expect(valid, JSON.stringify(errors)).toBe(true);
      expect(parsed.usage).toEqual({ text_in: 100, text_out: 40, cost: 0.0021 });
      expect(parsed.transcript.at(-1).latency_ms).toBe(800);
      expect(parsed.prompt_source).toMatch(/imported override/);
    }
  });

  it("model ids are sanitized in result paths", () => {
    const paths = Object.keys(files).filter((p) => p.endsWith(".result.json"));
    expect(paths.some((p) => p.includes("meta-llama_llama-3.1-8b-instruct_free"))).toBe(true);
    for (const p of paths) {
      expect(p.split("/").length, p).toBe(4); // tests/runs/<dir>/<file> — no stray slashes from model ids
    }
  });

  it("the manifest indexes exactly the emitted results and names the incumbent", () => {
    const manifestPath = Object.keys(files).find((p) => p.endsWith("manifest.json"))!;
    const manifest = JSON.parse(files[manifestPath]);
    expect(manifest.incumbent).toBe(models[0]);
    expect(manifest.scenario_ids).toEqual(["s1", "s2"]);
    expect(manifest.results).toHaveLength(3);
    for (const p of manifest.results) expect(files[p], p).toBeDefined();
  });

  it("a scenario with agent turns exports a valid gold — never freshly blessed", () => {
    const parsed = goldOf_(files, "s1")!;
    const { valid, errors } = validateFile(GoldSchema, parsed);
    expect(valid, JSON.stringify(errors)).toBe(true);
    // Compare never mints a blessing — blessed_at only survives an
    // untouched round-trip of an imported gold.
    expect(parsed.blessed_at).toBeUndefined();
    expect(parsed.source_pointer).toBe("compare-study:agent-test");
    expect(parsed.scenario_id).toBe("sc-refill");
    expect(parsed.language).toBe("EN");
    expect(parsed.turns).toEqual(scenarios[0].turns);
    // The user-only scenario writes no gold.
    expect(files["tests/gold/s2.md"]).toBeUndefined();
  });

  it("placeholder-fill vars ship as provided declarations + case fixtures, prompt untouched", () => {
    const withVars = buildStudyBundle({
      agentId: "agent-test",
      prompt: "You are Asha at {{clinic_name}}.",
      models,
      scenarios,
      cells,
      vars: { clinic_name: "Sunrise Clinic", empty_one: "  " },
    });
    const agent = parseAgent(withVars["agent.md"]);
    // The prompt stays byte-verbatim — fill is a session bag, never a rewrite.
    expect(agent.system_prompt).toBe("You are Asha at {{clinic_name}}.");
    expect(fromYaml(withVars["variables.yaml"], "variables.yaml")).toEqual({ clinic_name: { type: "string", provided: true } });
    for (const s of scenarios) {
      const c = caseOf(withVars, s.id);
      expect(c.vars).toEqual({ clinic_name: "Sunrise Clinic" });
      expect(validateFile(TestCaseSchema, c).valid).toBe(true);
    }
    // No vars → no declarations, no fixtures.
    expect(files["variables.yaml"]).toBeUndefined();
  });

  it("re-exporting an untouched imported gold preserves identity and blessing at its original path", () => {
    // The imported gold lives at a path unrelated to the scenario id; the
    // scenario's goldPath (recorded at import) targets it, so export
    // overwrites the original instead of minting a duplicate file.
    const origGold = gold({
      id: "gold-orig",
      name: "Refill request",
      turns: scenarios[0].turns,
      language: "EN",
      scenario_id: "sc-refill",
      notes: "customer-approved",
      blessed_at: "2026-07-01T00:00:00Z",
      source_pointer: "call-recording-2026-06-30",
    });
    const roundTrip = buildStudyBundle({
      agentId: "agent-test",
      prompt: "p",
      models,
      scenarios: [{ ...scenarios[0], goldPath: "tests/gold/gold-orig.md" }],
      cells,
      sourceFiles: origGold,
    });
    expect(roundTrip["tests/gold/s1.md"]).toBeUndefined();
    const parsed = goldOf_(roundTrip, "gold-orig")!;
    expect(parsed.id).toBe("gold-orig");
    expect(parsed.blessed_at).toBe("2026-07-01T00:00:00Z");
    expect(parsed.source_pointer).toBe("call-recording-2026-06-30");
    expect(parsed.notes).toBe("customer-approved");
  });

  it("editing an imported gold's turns drops its blessing on export", () => {
    const origGold = gold({
      id: "gold-orig",
      turns: [u("hi"), a("Original reply.")],
      blessed_at: "2026-07-01T00:00:00Z",
    });
    const edited = buildStudyBundle({
      agentId: "agent-test",
      prompt: "p",
      models,
      scenarios: [
        {
          ...scenarios[0],
          turns: [u("hi"), a("Edited reply."), u("refill please"), a("Sure.")],
          goldPath: "tests/gold/gold-orig.md",
        },
      ],
      cells,
      sourceFiles: origGold,
    });
    const parsed = goldOf_(edited, "gold-orig")!;
    expect(parsed.blessed_at).toBeUndefined();
    expect(parsed.id).toBe("gold-orig");
  });

  it("loads as a project in the editor's loader — the graduation contract", () => {
    const { spec, testingArtifacts, errors } = loadProject(files);
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(spec?.agent.system_prompt).toBe("You are Asha, a clinic assistant.");
    expect(spec?.flows).toEqual([]); // flowless imported project — accepted
    expect(testingArtifacts?.testCases).toHaveLength(2);
    expect(testingArtifacts?.golds).toHaveLength(1);
  });

  it("round-trips through parseStudyBundle — the writer's inverse", () => {
    const withVars = buildStudyBundle({
      agentId: "agent-test",
      prompt: "You are Asha at {{clinic_name}}.",
      models,
      scenarios,
      cells,
      vars: { clinic_name: "Sunrise Clinic" },
    });
    const parsed = parseStudyBundle(withVars);
    expect(parsed.prompt).toBe("You are Asha at {{clinic_name}}.");
    // s1's gold merges back in (its user turns match the case script) and
    // records where it came from; s2 stays user-only.
    expect(parsed.scenarios).toEqual([
      { ...scenarios[0], goldPath: "tests/gold/s1.md" },
      scenarios[1],
    ]);
    expect(parsed.vars).toEqual({ clinic_name: "Sunrise Clinic" });
  });

  it("a gold whose user turns mismatch the case passes through untouched — scenario stays user-only", () => {
    const mismatch = promptOnly({
      ...testCase({ id: "s1", user_turns: ["hi"], language: "EN" }),
      ...gold({ id: "s1", turns: [u("DIFFERENT SCRIPT"), a("reply")], blessed_at: "2026-07-01T00:00:00Z" }),
    });
    const parsed = parseStudyBundle(mismatch);
    expect(parsed.scenarios[0].turns).toEqual([u("hi")]);
    expect(parsed.scenarios[0].goldPath).toBeUndefined();
    // Re-export: no agent turns → no gold write → the original file
    // survives byte-identical from sourceFiles.
    const out = buildStudyBundle({
      agentId: "x",
      prompt: "p",
      models,
      scenarios: parsed.scenarios,
      cells: {},
      sourceFiles: mismatch,
    });
    expect(out["tests/gold/s1.md"]).toBe(mismatch["tests/gold/s1.md"]);
  });

  it("compiles the prompt from the spec when a project has no manual system_prompt", () => {
    const specProject = decomposeSpec(specProjectSpec);
    const parsed = parseStudyBundle(specProject);
    expect(parsed.prompt).toContain("Asha");
    expect(parsed.prompt).toContain("Greet the caller and confirm the appointment.");
    expect(parsed.agentId).toBe("agent_spec");
  });

  it("derives full dual-party scenarios from golds when a project has no cases", () => {
    const goldOnly = promptOnly(gold({
      id: "g1",
      name: "From gold",
      language: "HI",
      scenario_id: "sc-1",
      turns: [u("namaste"), a("hello"), u("haan")],
    }));
    const parsed = parseStudyBundle(goldOnly);
    expect(parsed.scenarios).toEqual([
      {
        id: "g1",
        scenarioId: "sc-1",
        name: "From gold",
        language: "HI",
        turns: [u("namaste"), a("hello"), u("haan")],
        goldPath: "tests/gold/g1.md",
      },
    ]);
  });

  it("writes no gold files when no scenario has agent turns", () => {
    const userOnly = scenarios.map((s) => ({
      ...s,
      turns: s.turns.filter((t) => t.role === "user"),
    }));
    const bare = buildStudyBundle({ agentId: "agent-test", prompt: "p", models, scenarios: userOnly, cells });
    expect(Object.keys(bare).some((p) => p.startsWith("tests/gold/"))).toBe(false);
  });
});

// A study opened from an existing project graduates back as THAT project —
// flows and agent spec intact — with the study's artifacts overlaid.
describe("buildStudyBundle with sourceFiles", () => {
  const source = {
    ...decomposeSpec(specProjectSpec),
    ...testCase({ id: "s1", name: "Refill request", user_turns: ["hi"], language: "EN", scenario_id: "sc-refill", gold_id: "g-orig", tags: ["from-repo"] }),
  };

  it("keeps flows and agent.md byte-identical when the prompt is unedited", () => {
    const compiled = parseStudyBundle(source).prompt;
    const out = buildStudyBundle({
      agentId: "x", prompt: compiled, models, scenarios, cells, sourceFiles: source,
    });
    expect(out["agent.md"]).toBe(source["agent.md"]);
    expect(out["flows/greet.md"]).toBe(source["flows/greet.md"]);
    expect(out["flowstore.yaml"]).toBe(source["flowstore.yaml"]);
    const { spec, errors } = loadProject(out);
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(spec?.flows).toHaveLength(1);
    expect(spec?.agent.entry_flow_id).toBe("greet");
  });

  it("an edited prompt becomes a full override on the source agent; flows still carry", () => {
    const out = buildStudyBundle({
      agentId: "x", prompt: "Edited prompt.", models, scenarios, cells, sourceFiles: source,
    });
    const agent = parseAgent(out["agent.md"]);
    expect(agent.system_prompt).toBe("Edited prompt.");
    expect(agent.entry_flow_id).toBe("greet");
    expect(agent.id).toBe("agent_spec");
    expect(out["flows/greet.md"]).toBe(source["flows/greet.md"]);
  });

  it("source case files keep extra fields under the study's edits", () => {
    const out = buildStudyBundle({
      agentId: "x", prompt: "p", models, scenarios, cells, sourceFiles: source,
    });
    const c = caseOf(out, "s1");
    expect(c.gold_id).toBe("g-orig");
    expect(c.tags).toEqual(["from-repo"]);
    // Compare-owned fields win — the study's (possibly edited) turns ship.
    expect(c.user_turns).toEqual(["hi", "refill please"]);
    // A scenario with no source counterpart still gets a fresh case file.
    expect(caseOf(out, "s2").tags).toEqual(["src:compare"]);
  });
});
