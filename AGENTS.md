<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Do not keep agent memory for this project

Do not write to the agent memory system for this project. If prior memories exist, ignore them. Persistent guidance, principles, and project context belong in this file (and the related docs listed below), not in per-conversation memory files. When the user tells you something worth remembering across conversations, propose adding it here instead.

# uxflows

Visual editor for UX4 behavioral specs. A Next.js app that authors, simulates, and exports spec JSON conforming to [SCHEMA.md](./SCHEMA.md).

## Product Context

uxflows is the authoring surface of the broader UX4 product. The consuming application (simulation, evaluation) lives in the sibling repo at `../whatsupp2/`. Read these before making non-obvious architectural decisions:

- [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md) — product design doc (v0.9): vision, MVP scope, workflows, schema rationale, strategy, roadmap.
- [`../whatsupp2/AGENT-CLAUDE.md`](../whatsupp2/AGENT-CLAUDE.md) — technical reference for the existing agent-testing implementation in whatsupp2. Useful for understanding how specs are consumed today.

The schema is the contract between uxflows and whatsupp2. Both repos defer to [SCHEMA.md](./SCHEMA.md) in this repo.

## Mission

Author a behavioral spec on a **canvas** — a flow graph with nodes for flows and edges for routing (React Flow). The canvas is the primary editor surface. The spec is the product; the canvas is its rendering.

**Sheets** are a secondary surface: tabular editors attached to specific canvas nodes for capturing data that is naturally rectangular — glossary, knowledge base entries, function stubs, and (most importantly) scripts, potentially with translation columns. Sheets are not a standalone view over the whole spec; they hang off the node they belong to.

Narrative sharing with stakeholders is expected to happen *outside* the app for now — e.g., embedding a canvas link inside a Google Doc — rather than by building an in-app doc view. A built-in narrative/doc view is not MVP and may never ship.

## Tech Stack

- **Next.js 16.2** (Pages Router), React 19, TypeScript
- **Tailwind v4** (PostCSS plugin, no config file)
- **ESLint** flat config
- **`@xyflow/react`** — canvas
- *(just-in-time)* **`zustand`** — shared editor state, when `useState` gets painful
- *(just-in-time)* **`@sinclair/typebox` + `ajv` + `ajv-formats`** — schema-as-code + runtime validation, when import/export lands
- **localStorage** for autosave; local-first; no server persistence in MVP

Don't add infrastructure before the need. The design doc's MVP discipline is the rule.

## Reference Designs

**[pipecat-ai/pipecat-flows-editor](https://github.com/pipecat-ai/pipecat-flows-editor)** (Next.js 16 + React Flow + TypeBox + Ajv + Zustand, BSD-2-Clause) — visual editor for Pipecat Flows. We evaluated forking it and chose to build from scratch because its schema is tightly coupled to Pipecat's `NodeConfig`, which violates our "execution separate from spec" principle. Still a useful reference — steal patterns, not code. Worth reading before inventing:

- **Routing lives on functions, not edges.** Edges in the canvas are derived from function metadata (`next_node_id` / `decision`), never persisted as standalone entities. Maps cleanly onto our `routing.exit_paths`.
- **Decisions as visualization-helper nodes.** Inline decision nodes render on the canvas but persist as metadata on the parent function, not as separate graph nodes. Keeps the schema clean while giving users the visual they expect.
- **Ajv + TypeBox validation pipeline** (`lib/validation/`) — two layers: schema validation, then custom graph rules (unique IDs, valid references).
- **Codegen structure** (`lib/codegen/pythonGenerator.ts`) — clean separation of schema-walking from code-emitting.
- **Schema-driven inspector form pattern** (`components/inspector/forms/`) — one form component per schema shape.
- **Local-first persistence** — autosave to `localStorage`, debounced. No server calls. Good model for our MVP.

## Planned Repository Layout

Directional, not prescriptive. Most of this is not built yet.

```
/pages/             Next.js Pages Router entrypoints
  /index.tsx        editor shell
  /api/             API routes (minimal; export/import helpers if needed)
/components/
  /canvas/          React Flow nodes, edges, controls
  /inspector/       schema-driven editor forms
  /sheets/          tabular editors attached to canvas nodes (scripts, glossary, KB, function stubs)
/lib/
  /schema/          TypeBox schema definitions mirroring SCHEMA.md
  /store/           zustand stores
  /validation/      Ajv validators + graph rules
  /codegen/         export targets (UX4 JSON first; later Pipecat, LiveKit, etc.)
  /examples/        sample specs for development and "Load Example"
/styles/            globals.css, Tailwind
/public/
```

## Design Principles

From the product design doc. The ones that most affect editor decisions:

- **Schema defines behavior. UI defines rendering.** Node positions, color coding, panel state are UI concerns — not in exported spec JSON.
- **Execution is separate from spec.** Endpoint, headers, model live in a separate `execution` object outside the spec so sharing never leaks credentials. `system_prompt` and `chatbot_initiates` live *inside* the spec because they describe behavior.
- **Three methods everywhere.** `llm` / `calculation` / `direct` apply uniformly in captures, conditions, assigns, entry conditions.
- **Symmetric turns.** Agent and user turns share the same structure. Role determines interpretation.
- **The flow is the atom.** Everything is a flow. Authored flows and simulated conversation flows share the same schema.
- **Flows are modular and reusable across agents.** A flow authored for one agent should be droppable into another. Flow-specific data (including translatable scripts) lives inside the flow, not at the agent level. Prefer flow-level schema fields for anything that should travel with a reused flow; agent-level is for things genuinely shared across the whole deployment (plan-level variables, guardrails, glossary). When flows need to interoperate with different callers, use variable mapping (v1 call-step `input_mapping` / `output_mapping`) rather than hard-coded variable names or agent-specific enum values in flow routing.
- **Anything referenceable has a stable `id`.** Editor-generated, never authored.
- **Optional by default.** Valid schema with minimal fields. Depth added incrementally.
- **Findings are evidence, not certifications.** Simulation results show what failed and why — do not present scores with implied precision the evaluator does not support.
- **Decomposition is the substrate.** Monolithic prompts hit an instruction-following ceiling in regulated behavior spaces; modular flows are how agents stay reliable at scale.

## MVP Scope

From AGENT-TESTING.md — the five-step loop uxflows supports end-to-end:

1. **Ingest** — paste a system prompt and attach supporting docs (PDFs, spreadsheets, Word, Figma exports, plain text).
2. **Parse** — a behavioral parser (LLM-assisted) converts inputs to a structured v0 spec. Today this is [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt), a Claude conversation prompt run outside the app. The designer pastes source material in and a structured-text spec comes out. In-app "Parse into spec" will replace this.
3. **Review and configure** — user reviews the parsed spec, answers the parser's open questions.
4. **Simulate** — run personas against the agent endpoint. Evaluator scores each conversation against guardrails and scenario-level success criteria (defined per test in whatsupp2, not on the flow). (in whatsupp2)
5. **Share** — internal findings report + client-facing shareable document. (in whatsupp2)

## Related Docs in This Repo

- [SCHEMA.md](./SCHEMA.md) — authoritative v0 + v1 spec schema
- [MVP-PLAN.md](./MVP-PLAN.md) — ordered work plan to reach MVP, with design decisions and deferred items
- [TRANSLATIONS.md](./TRANSLATIONS.md) — runtime translation tables (Pipecat, LiveKit, LangGraph, OpenAI Agents SDK; import: Voiceflow, Botpress)
- [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt) — Claude conversation prompt for converting source material into spec structured-text

## Running

```bash
npm install
npm run dev
```

Opens at http://localhost:3000.

## Style

- Only add comments when the *why* is non-obvious. Never docstring-style multi-paragraph comments.
- Prefer editing existing files over creating new ones.
- Don't add backwards-compat shims. It's early — break freely.
- Match conventions in whatsupp2 where reasonable. Specs authored here eventually flow there.
- Keep the spec schema evolution discussions in SCHEMA.md. The product vision lives in AGENT-TESTING.md.
