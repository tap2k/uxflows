# uxflows MVP plan

Operational plan for the uxflows MVP, derived from discussion on 2026-04-23 and 2026-04-26. High-level principles live in [AGENTS.md](./AGENTS.md); schema contract in [SCHEMA.md](./SCHEMA.md).

## Status (2026-04-29)

All nine chunks shipped. Editor is functionally complete for v0:

- ✅ 1. Drag nodes + persist positions
- ✅ 2. Spec state management
- ✅ 3. Import / export + autosave + Ajv + TypeBox
- ✅ 4. Flow inspector
- ✅ 5. Scripts sheet (reorder deferred)
- ✅ 6. Edge inspector
- ✅ 7. Agent surfaces (split into toolbar modals, not a single sidebar — see drift note in chunk 7)
- ✅ 8. Add / delete flows + drag-to-connect
- ✅ 9. Basic graph validation

Beyond plan, also shipped: Variables editor (was post-MVP), Tables CRUD (was post-MVP), `entry_flow_id` picker in Agent sheet, delete buttons in inspectors, schema-doc sync, AGENT-SPEC-PROMPT.txt rewritten for one-shot v0 JSON output.

Real remaining gap: imperative LLM parse in-app (Settings sheet + provider dispatch + Parse modal). External LLM path already works — paste source through any frontier LLM with [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt), paste resulting JSON into Import.

## Goal

Ship an editor that authors a full real-world MVP-scale spec from scratch and exports JSON that [../whatsupp2/](../whatsupp2/) consumes as simulation/evaluation input.

Canvas-first, local-first, single-user.

**Definition of done:**
- Designer starts with nothing, clicks "Load example," sees the sample spec on the canvas with draggable nodes.
- Can click any flow node and edit every field including the `example` transcript; changes persist across reload.
- Can click any edge and edit the exit path (type, condition, next_flow_id, assigns); changes persist.
- Can add a new flow from the toolbar, draw an edge to it, edit its content.
- Can open a flow's scripts sheet and author agent utterances in EN and ES side-by-side.
- Can edit all agent-level collections (Meta, Guardrails, FAQ, Glossary, Tables) via the sidebar.
- Can export a `.json` file that imports cleanly into whatsupp2 and survives roundtrip through this editor.
- Broken references are caught inline during authoring and at import.

---

## Design decisions

### Editor surfaces

- **Canvas (React Flow)** is the primary editor. Flows as nodes, `routing.exit_paths` as edges.
- **Scripts sheet** is a node-attached tabular editor: rows = utterances, columns = languages. Not a global view over the spec.
- **Agent-level collections** (Guardrails, FAQ, Glossary, Tables, Meta) live in a sidebar; not canvas nodes in MVP.
- **No in-app doc view.** Narrative sharing happens via external Google Doc + canvas link.

### Schema decisions

- **v0 flows use `instructions` + `scripts`**, not structured steps. `instructions` is behavioral prose that compiles into a system prompt fragment. `scripts` is a per-language list of utterances for this flow.
- **Steps moved to v1.** Turn-level sequencing, per-turn captures, and utterance variations are v1 depth. MVP authoring via `instructions` + scripts sheet covers the dominant case.
- **Variables are implicit, optionally enriched.** A variable exists because it is referenced; no upfront declaration required. v0 carries an optional `variables` dictionary at agent and flow level for `type` / `description` — kept tight to match what whatsupp2 actually consumes. Scope is determined by runtime value-bucket location, not by a spec field; example values are generated at value-entry time. The schema ships with `variables` in MVP so import/export preserve type info.
- **`flow.example`** — plain-text transcript, annotation-only. Runtimes ignore it; simulation uses it as a seeding hint.
- **`personas` removed from schema.** Persona definitions live downstream in whatsupp2.
- **`meta.languages`** — list of language codes. Drives translation table columns on each flow's scripts sheet.
- **User segments removed from spec.** Population context lives at project level in the consuming repo (whatsupp2's `project.stakeholders`), not in the spec — same scope as personas and execution config.
- **Channels** (phone numbers, URLs, emails) are plan-level variables, not capability entries.
- **Interrupt return-bridging** stays as a guardrail. No new typed schema field.
- **v1 `annotations` namespace** planned for node positions, colors, comments. Runtimes MUST ignore. Two export modes (authoring = includes annotations; runtime = strips them).

### Principles applied (from AGENTS.md)

- Schema defines behavior. UI defines rendering.
- Execution separate from spec.
- Flows are modular and reusable across agents.
- Findings are evidence, not certifications.

---

## Work chunks

Ordered. Each leaves the editor strictly more complete than before.

### 1. Drag nodes + persist positions ✅

- Swap current `useMemo` for `useNodesState` in [components/canvas/Canvas.tsx](./components/canvas/Canvas.tsx).
- `onNodesChange` → debounced localStorage write, keyed by `(specId, flowId)`.
- On mount: load saved positions; fall back to dagre layout for flows without saved positions.
- Positions live in localStorage for MVP. Migration to `annotations.ui.position` post-MVP when round-tripping through export earns its keep.

**Files:** `components/canvas/Canvas.tsx`, new `components/canvas/positions.ts`.

**Drift:** localStorage key is `uxflows:positions:${specId}` — keyed by spec id, not `(specId, flowId)`. The value is a `Record<flowId, {x,y}>` so it functions equivalently.

### 2. Spec state management ✅

- Zustand store holding `spec`, `selection` (`{kind: "flow"|"edge", id: string} | null`), and mutators (`updateFlow`, `updateExitPath`, `addFlow`, `removeFlow`, etc.).
- Store is the single source of truth; canvas and inspector subscribe.
- [pages/index.tsx](./pages/index.tsx) no longer imports the sample spec directly.

**Files:** new `lib/store/spec.ts`, updated `pages/index.tsx`, `components/canvas/Canvas.tsx`.

### 3. Import / export + autosave + Ajv + TypeBox ✅

The editor becomes spec-agnostic at the end of this chunk. Biggest single unit; highest leverage.

- Ship a v0-shaped sample spec at `public/example.json` (plain JSON, no TS import).
- **Load example** button fetches `public/example.json`, validates, loads into store.
- **Export** serializes store → JSON → file download.
- **Import** reads file-picker or paste-textarea, validates, loads into store.
- **Declarative text import** — second paste-textarea path: schema-shaped outline (YAML/markdown matching the schema) parses mechanically into the same store. One-way; no live mirror. Re-import replaces; confirm if there are unsaved changes.
- **Autosave** on every store mutation (debounced) → localStorage.
- On mount: load from localStorage if present; else empty state with "Load example" / "Import" buttons.
- **TypeBox schema** in `lib/schema/v0.ts` mirroring [SCHEMA.md](./SCHEMA.md) — replaces the hand-written types currently in [lib/types/spec.ts](./lib/types/spec.ts). Single source of truth.
- **Ajv validation** on every import/load; errors listed in a panel; invalid spec is rejected (not partially loaded).

**Files:** new `lib/schema/v0.ts`, `lib/validation/ajv.ts`, `components/toolbar/ImportExport.tsx`, new `public/example.json`.

**Drift:**
- The sample spec is at `public/valentina.json` (not yet renamed to `public/example.json`).
- "Load example" button removed from the toolbar per design preference — the empty state is just a blank canvas with the toolbar visible. Designer imports a spec or clicks New flow to start.
- Import accepts both JSON and YAML in one modal (drop-zone + paste textarea); the "declarative text" pathway is folded into the same Import modal rather than being a second path.

### 4. Flow inspector ✅

Right-side drawer. Opens when a flow node is selected.

Fields:
- `name`, `description`
- `type` (dropdown: happy | sad | off | utility | interrupt)
- `scope` (visible only when `type === "interrupt"`):
  - Radio: **Global** vs **Scoped to specific flows**
  - When Scoped: multi-select flow picker (chips or checkbox list). Filter out self.
- `instructions` — textarea (behavioral prose)
- `guardrails[]` — list of `{id, statement}` via reusable `ListEditor`
- `max_turns` — optional integer input
- `example` — textarea (plain-text transcript, free-form)
- `knowledge.faq[]` — flow-scoped FAQ entries; same editor as agent-level FAQ. 
- Button: "Open scripts sheet"

**Files:** new `components/inspector/FlowInspector.tsx`, `components/inspector/ListEditor.tsx`, `components/inspector/FlowPicker.tsx`.

**Drift / additions:**
- Variables editor for flow-scoped variables also shipped here (was post-MVP).
- Entry condition editor exposed for interrupt flows.
- Delete-flow button at the bottom.

### 5. Scripts sheet ✅

- Opens from FlowInspector → modal or expanded panel.
- Rows = script utterances (ordered list from `flow.scripts[lang]`); columns = languages from `agent.meta.languages`.
- Add / delete / reorder rows syncs across all language columns.
- "Add language" button adds a new language column (adds the code to `agent.meta.languages` if not present).
- Cells are plain text inputs; empty cells are valid (partial translation coverage is fine).

**Files:** new `components/sheets/ScriptsSheet.tsx`.

**Drift:** row reorder (up/down arrows) not shipped — add/delete/edit only. Reorder is a watchlist UX item.

### 6. Edge inspector ✅

- Same drawer shell as FlowInspector; switches content when selection is an edge.
- Fields:
  - `type` (dropdown)
  - `condition` — reusable `ConditionEditor` (method + expression)
  - `next_flow_id` — reuses `FlowPicker`
  - `assigns` — simple key-value editor ("add variable assignment")
  - `actions[]` — capability picker that adds `{capability_id}` rows. Picker is populated from `agent.capabilities[]`.
- `ConditionEditor` is the reusable unit — also used by `routing.entry_condition` (interrupt flows).

**Files:** new `components/inspector/EdgeInspector.tsx`, `components/inspector/ConditionEditor.tsx`.

### 7. Agent surfaces ✅

Originally specced as a persistent left sidebar with tabs. Implementation split into separate toolbar buttons opening dedicated modals (Agent / Variables / Guardrails / Capabilities / Knowledge), reusing the existing `SheetShell` modal pattern. Functionally equivalent — every collection has an editor — and the modal-per-concern UX matched the rest of the editor better than a sibling sidebar would have.

- **Agent** modal — `name`, `purpose`, `client`, `languages` (comma-separated), `entry_flow_id` (flow picker), `system_prompt`, `chatbot_initiates`. Agent id displayed inline.
- **Variables** modal — agent-level variable declarations (`type?`, `description?`, `values?` for enums).
- **Guardrails** modal — `ListEditor` of `{id, statement}`.
- **Capabilities** modal — per-entry editor: `name` (snake_case), `description`, `kind` (function/retrieval), `inputs[]`, `outputs[]`.
- **Knowledge** modal — sections for FAQ, Glossary, and Tables. Tables CRUD shipped (was post-MVP): add/remove tables, edit name/purpose/structure/scaling_rule; rows still edit-as-JSON-textarea per the schema's `Record<string, unknown>[]` shape.

**Files:** `components/sheets/{AgentSheet,VariablesSheet,GuardrailsSheet,CapabilitiesSheet,KnowledgeSheet,SheetShell}.tsx`, `components/inspector/primitives.tsx` (shared `Field`/`Section`/`StringListEditor`).

### 8. Add / delete flows + drag-to-connect ✅

- Toolbar **New flow** → creates empty flow with generated id, places at viewport center, focuses inspector.
- Delete key on selected flow or edge → removes from store.
- React Flow `onConnect` → creates a new `exit_path` on the source flow with defaults (`type: "happy"`, `method: "llm"`, empty expression).

**Files:** `components/canvas/Canvas.tsx` (onConnect handler), `components/toolbar/FlowActions.tsx`.

**Drift:**
- New flow + Agent sheet buttons live in `components/toolbar/ImportExport.tsx` rather than a separate `FlowActions.tsx`. Worth renaming the file to `Toolbar.tsx` in cleanup.
- New flow places at dagre-laid-out position (cheap), not viewport-center; user drags as needed.
- Delete buttons also surface in FlowInspector and EdgeInspector with confirm prompts.

### 9. Basic graph validation ✅

- Runs on store mutation (cheap at MVP scale; no debounce needed for MVP).
- Checks shipped:
  - Broken `next_flow_id` references
  - Duplicate flow ids
  - `entry_flow_id` resolves to an existing flow
  - `exit_path.actions[].capability_id` resolves to an existing `agent.capabilities[]` entry
- Surfaces inline: red ring on offending canvas nodes, hover tooltip with reason. Edges with broken capability refs render in red.

**Files:** new `lib/validation/graphRules.ts`; [components/canvas/FlowNode.tsx](./components/canvas/FlowNode.tsx) reads validation status from data.

---

## Post-MVP (deferred, with reasons)

- **Positions migration to `annotations.ui.position`.** Needed for round-trip through export; not blocking single-user editing.
- **`annotations.comments[]` + async comment UI.** Asynchronous collab only.
- **v1 steps editor** — structured turn sequencing, captures, per-turn conditions, utterance variations. `instructions` + scripts sheet is the MVP authoring surface.
- **Deep graph validation** — variable-reference integrity, `interrupt.scope` members exist, `exit_path.assigns` target validity.
- **v1 schema additions** — `tool` step (mid-conversation capability dispatch), `call` step (sub-flow invocation), `pipecat` hints. Canvas and inspector adapt when the schema lands; expect a capability picker on tool steps. Capability catalog (`agent.capabilities[]`) and post-exit dispatch (`exit_path.actions[]`) are already in v0.
- **Imperative text import (in-app parse step)** — paste a script/process doc, LLM converts directly to v0 JSON in one shot, schema-constrained. One-way; lands in the same store as the existing import path. Same prompt content as [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt); the in-app version skips the round-trip through an external LLM and uses a user-provided API key. The two coexist (external = no key needed, in-app = one click).
- **Generate example transcript button.** The parse prompt only extracts example transcripts verbatim when present in the source; it does not invent them. Add a "Generate example" button in [FlowInspector](./components/inspector/FlowInspector.tsx) (next to "Open scripts sheet") that calls the LLM provider with the current flow's `instructions` / `scripts` / `routing` and populates `flow.example`. Reuses the same LLM plumbing as imperative import; lands after that ships.
- **Export as declarative text** — on-demand stringification of the spec for skim and stakeholder share. Read-only output; not a live mirror.
- **Flow id rename with cascade update.** Ids are immutable in MVP; delete-and-recreate to change.
- **Skip dagre re-layout when topology hasn't changed.** Today every spec mutation (including each keystroke in any inspector field) re-runs `buildGraph` + `dagre.layout` + `setNodes`/`setEdges` in [Canvas.tsx](./components/canvas/Canvas.tsx). Fine at MVP scale; will lag at 100+ flows. Surgical fix: re-layout only when flow ids or edge connectivity changes; for pure data updates (name, instructions, condition text), update node `data` in place, keep positions. Preserves live-preview while killing the hot-path cost.

---

## Risks

- **Scripts sheet UX needs care.** Row ordering must stay consistent across language columns. Empty cells (partial translation coverage) must be handled gracefully.
- **Inspector grows fast.** ListEditor, ConditionEditor, FlowPicker — build the primitives first or it becomes a bespoke mess.
- **Validation timing.** Ajv on every keystroke is wasteful; on-export-only misses authoring feedback. Debounced at ~300ms.
- **LLM-parsed specs are noisy.** Schema validation at import is load-bearing — half-valid specs cascading into the store are confusing. Reject hard, surface errors clearly.
