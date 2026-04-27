# uxflows MVP plan

Operational plan for the uxflows MVP, derived from discussion on 2026-04-23 and 2026-04-26. High-level principles live in [AGENTS.md](./AGENTS.md); schema contract in [SCHEMA.md](./SCHEMA.md).

## Goal

Ship an editor that authors a full Valentina-scale spec from scratch and exports JSON that [../whatsupp2/](../whatsupp2/) consumes as simulation/evaluation input.

Canvas-first, local-first, single-user.

**Definition of done:**
- Designer starts with nothing, clicks "Load example," sees Valentina on the canvas with draggable nodes.
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
- **Variables are implicit.** A variable exists because it is referenced. No upfront declaration required. Typed variable declarations with scope enrichment defer to v1.
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

### 1. Drag nodes + persist positions

- Swap current `useMemo` for `useNodesState` in [components/canvas/Canvas.tsx](./components/canvas/Canvas.tsx).
- `onNodesChange` → debounced localStorage write, keyed by `(specId, flowId)`.
- On mount: load saved positions; fall back to dagre layout for flows without saved positions.
- Positions live in localStorage for MVP. Migration to `annotations.ui.position` post-MVP when round-tripping through export earns its keep.

**Files:** `components/canvas/Canvas.tsx`, new `components/canvas/positions.ts`.

### 2. Spec state management

- Zustand store holding `spec`, `selection` (`{kind: "flow"|"edge", id: string} | null`), and mutators (`updateFlow`, `updateExitPath`, `addFlow`, `removeFlow`, etc.).
- Store is the single source of truth; canvas and inspector subscribe.
- [pages/index.tsx](./pages/index.tsx) no longer imports Valentina directly.

**Files:** new `lib/store/spec.ts`, updated `pages/index.tsx`, `components/canvas/Canvas.tsx`.

### 3. Import / export + autosave + Ajv + TypeBox

The editor becomes spec-agnostic at the end of this chunk. Biggest single unit; highest leverage.

- Convert [lib/examples/valentina.ts](./lib/examples/valentina.ts) → `public/valentina.json` (plain JSON, no TS import). Update Valentina to v0 schema shape (`instructions` + `scripts`, no steps).
- **Load example** button fetches `public/valentina.json`, validates, loads into store.
- **Export** serializes store → JSON → file download.
- **Import** reads file-picker or paste-textarea, validates, loads into store.
- **Autosave** on every store mutation (debounced) → localStorage.
- On mount: load from localStorage if present; else empty state with "Load example" / "Import" buttons.
- **TypeBox schema** in `lib/schema/v0.ts` mirroring [SCHEMA.md](./SCHEMA.md) — replaces the hand-written types currently in [lib/types/spec.ts](./lib/types/spec.ts). Single source of truth.
- **Ajv validation** on every import/load; errors listed in a panel; invalid spec is rejected (not partially loaded).

**Files:** new `lib/schema/v0.ts`, `lib/validation/ajv.ts`, `components/toolbar/ImportExport.tsx`, new `public/valentina.json`. Retire `lib/examples/valentina.ts` and `lib/types/spec.ts`.

### 4. Flow inspector

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

### 5. Scripts sheet

- Opens from FlowInspector → modal or expanded panel.
- Rows = script utterances (ordered list from `flow.scripts[lang]`); columns = languages from `agent.meta.languages`.
- Add / delete / reorder rows syncs across all language columns.
- "Add language" button adds a new language column (adds the code to `agent.meta.languages` if not present).
- Cells are plain text inputs; empty cells are valid (partial translation coverage is fine).

**Files:** new `components/sheets/ScriptsSheet.tsx`.

### 6. Edge inspector

- Same drawer shell as FlowInspector; switches content when selection is an edge.
- Fields:
  - `type` (dropdown)
  - `condition` — reusable `ConditionEditor` (method + expression)
  - `next_flow_id` — reuses `FlowPicker`
  - `assigns` — simple key-value editor ("add variable assignment")
  - `actions[]` — capability picker that adds `{capability_id}` rows. Picker is populated from `agent.capabilities[]`.
- `ConditionEditor` is the reusable unit — also used by `routing.entry_conditions`.

**Files:** new `components/inspector/EdgeInspector.tsx`, `components/inspector/ConditionEditor.tsx`.

### 7. Agent sidebar

Persistent left drawer. Tabs:

- **Meta** — `name`, `purpose`, `client`, `languages` (list), `system_prompt`, `chatbot_initiates`
- **Guardrails** — `ListEditor`
- **Capabilities** — per-entry editor: `name` (snake_case), `description`, `kind` (radio: retrieval | function), `inputs[]`, `outputs[]` (optional). v0 catalog is informational; the picker on EdgeInspector / tool steps is v1.
- **FAQ** — per-entry editor with optional `scripts.{lang}` per-language columns
- **Glossary** — `ListEditor`-shaped
- **Tables** — read-only view + JSON-textarea fallback for row edits; full CRUD defers post-MVP

**Files:** new `components/sidebar/AgentSidebar.tsx` + one tab component per section.

### 8. Add / delete flows + drag-to-connect

- Toolbar **New flow** → creates empty flow with generated id, places at viewport center, focuses inspector.
- Delete key on selected flow or edge → removes from store.
- React Flow `onConnect` → creates a new `exit_path` on the source flow with defaults (`type: "happy"`, `method: "llm"`, empty expression).

**Files:** `components/canvas/Canvas.tsx` (onConnect handler), `components/toolbar/FlowActions.tsx`.

### 9. Basic graph validation

- Runs on store mutation (cheap at Valentina scale; no debounce needed for MVP).
- Checks shipped:
  - Broken `next_flow_id` references
  - Duplicate flow ids
  - `entry_flow_id` resolves to an existing flow
  - `exit_path.actions[].capability_id` resolves to an existing `agent.capabilities[]` entry
- Surfaces inline: red ring on offending canvas nodes, hover tooltip with reason.

**Files:** new `lib/validation/graphRules.ts`; [components/canvas/FlowNode.tsx](./components/canvas/FlowNode.tsx) reads validation status from store.

---

## Post-MVP (deferred, with reasons)

- **Positions migration to `annotations.ui.position`.** Needed for round-trip through export; not blocking single-user editing.
- **`annotations.comments[]` + async comment UI.** Asynchronous collab only.
- **v1 steps editor** — structured turn sequencing, captures, per-turn conditions, utterance variations. `instructions` + scripts sheet is the MVP authoring surface.
- **v1 typed variable declarations** — type, scope, description enrichment on variables. Variables are implicit in v0.
- **Full `knowledge.tables` CRUD editor** (rows × structure). JSON-textarea fallback is MVP-sufficient.
- **Deep graph validation** — variable-reference integrity, `interrupt.scope` members exist, `exit_path.assigns` target validity.
- **v1 schema additions** — `tool` step (mid-conversation capability dispatch), `call` step (sub-flow invocation), `pipecat` hints. Canvas and inspector adapt when the schema lands; expect a capability picker on tool steps. Capability catalog (`agent.capabilities[]`) and post-exit dispatch (`exit_path.actions[]`) are already in v0.
- **In-app parse step** replacing the external [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt) workflow.
- **Flow id rename with cascade update.** Ids are immutable in MVP; delete-and-recreate to change.

---

## Risks

- **Scripts sheet UX needs care.** Row ordering must stay consistent across language columns. Empty cells (partial translation coverage) must be handled gracefully.
- **Inspector grows fast.** ListEditor, ConditionEditor, FlowPicker — build the primitives first or it becomes a bespoke mess.
- **Validation timing.** Ajv on every keystroke is wasteful; on-export-only misses authoring feedback. Debounced at ~300ms.
- **LLM-parsed specs are noisy.** Schema validation at import is load-bearing — half-valid specs cascading into the store are confusing. Reject hard, surface errors clearly.
