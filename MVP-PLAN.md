# uxflows MVP plan

Operational plan for the uxflows MVP, derived from discussion on 2026-04-23. High-level principles live in [AGENTS.md](./AGENTS.md); schema contract in [SCHEMA.md](./SCHEMA.md).

## Goal

Ship an editor that authors a full Valentina-scale spec from scratch and exports JSON that [../whatsupp2/](../whatsupp2/) consumes as simulation/evaluation input.

Canvas-first, local-first, single-user.

**Definition of done:**
- Designer starts with nothing, clicks "Load example," sees Valentina on the canvas with draggable nodes.
- Can click any flow node and edit every field including the `example` transcript; changes persist across reload.
- Can click any edge and edit the exit path (type, condition, next_flow_id, assigns); changes persist.
- Can add a new flow from the toolbar, draw an edge to it, edit its content.
- Can open a flow's scripts sheet and author agent utterances in EN and ES side-by-side.
- Can edit all agent-level collections (Meta, Variables, Guardrails, FAQ, Glossary, Tables) via the sidebar.
- Can export a `.json` file that imports cleanly into whatsupp2 and survives roundtrip through this editor.
- Broken references are caught inline during authoring and at import.

---

## Design decisions

### Editor surfaces

- **Canvas (React Flow)** is the primary editor. Flows as nodes, `routing.exit_paths` as edges.
- **Sheets** are node-attached tabular editors (per-flow scripts). Not a global view over the spec.
- **Agent-level collections** (Variables, Guardrails, FAQ, Glossary, Tables, Meta) live in a sidebar; not canvas nodes in MVP.
- **No in-app doc view.** Narrative sharing happens via external Google Doc + canvas link.

### Schema decisions (landed this session)

- **`flow.example`** — plain-text transcript, v0 additive field. Annotation-only: runtimes ignore; simulation and gold-standard generation in whatsupp2 use it as a style/pacing seed. One per flow. Free-form format (`Agent: ... \n User: ...`).
- **`personas` removed from schema.** Persona definitions live downstream in whatsupp2.
- **`user_segments` moved into `meta`.** Descriptive, not behavioral config; co-locates with `name` / `purpose` / `client` / `language`.
- **Channels** (phone numbers, URLs, emails, app sections) are **plan-level variables**, not `knowledge.sources` entries. `knowledge.sources` stays as it was — reserved for actual runtime-callable capabilities (rag / tool / api).
- **Interrupt return-bridging** stays as a guardrail (`gr_interrupt_bridging`). No new typed schema field.
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

- Convert [lib/examples/valentina.ts](./lib/examples/valentina.ts) → `public/valentina.json` (plain JSON, no TS import).
- **Load example** button fetches `public/valentina.json`, validates, loads into store.
- **Export** serializes store → JSON → file download.
- **Import** reads file-picker or paste-textarea, validates, loads into store.
- **Autosave** on every store mutation (debounced) → localStorage.
- On mount: load from localStorage if present; else empty state with "Load example" / "Import" buttons.
- **TypeBox schema** in `lib/schema/v0.ts` mirroring [SCHEMA.md](./SCHEMA.md) — replaces the hand-written types currently in [lib/types/spec.ts](./lib/types/spec.ts). Single source of truth.
- **Ajv validation** on every import/load; errors listed in a panel; invalid spec is rejected (not partially loaded).

**Files:** new `lib/schema/v0.ts`, `lib/validation/ajv.ts`, `components/toolbar/ImportExport.tsx`, new `public/valentina.json`. Retire `lib/examples/valentina.ts` and `lib/types/spec.ts`.

### 4. Flow inspector (tier 1)

Right-side drawer. Opens when a flow node is selected.

Fields:
- `name`, `description`
- `type` (dropdown: happy | sad | off | utility | interrupt)
- `scope` (visible only when `type === "interrupt"`):
  - Radio: **Global** vs **Scoped to specific flows**
  - When Scoped: multi-select flow picker (chips or checkbox list). Filter out self; don't bother filtering other interrupts.
- `guardrails[]` — list of `{id, statement}` via reusable `ListEditor`
- `success_criteria[]` — list of `{id, criterion}` via same `ListEditor`
- `max_turns` — optional integer input
- `example` — textarea (plain-text transcript, free-form)

**Files:** new `components/inspector/FlowInspector.tsx`, `components/inspector/ListEditor.tsx`, `components/inspector/FlowPicker.tsx`.

### 5. Scripts sheet

- Button in FlowInspector: "Open scripts sheet" → modal or expanded panel.
- Rows = agent turn steps; columns = languages; cells = utterance text.
- Add / delete / reorder rows = add / delete / reorder steps.
- Languages derived from existing utterances + an "add language" button.
- Structural step editing (captures, roles, per-step conditions) defers post-MVP — MVP authoring via the sheet covers the dominant case (agent utterances per language).

**Files:** new `components/sheets/ScriptsSheet.tsx`.

### 6. Edge inspector

- Same drawer shell as FlowInspector; switches content when selection is an edge.
- Fields:
  - `type` (dropdown)
  - `condition` — reusable `ConditionEditor` (method + expression)
  - `next_flow_id` — reuses `FlowPicker`
  - `assigns` — simple dict editor ("add variable assignment")
- `ConditionEditor` is the reusable unit — also used by `routing.entry_conditions`, step `condition`, `capture.method`.

**Files:** new `components/inspector/EdgeInspector.tsx`, `components/inspector/ConditionEditor.tsx`.

### 7. Agent sidebar

Persistent left drawer. Tabs:

- **Meta** — `name`, `purpose`, `client`, `language`, `user_segments`, `system_prompt`, `chatbot_initiates`
- **Variables** — dict editor (`{name → {type, scope, description, example}}`)
- **Guardrails** — `ListEditor`
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

- Runs on store mutation (cheap at Valentina scale; no memo/debounce needed for MVP).
- Checks shipped:
  - Broken `next_flow_id` references
  - Duplicate flow ids
  - `entry_flow_id` resolves to an existing flow
- Surfaces inline: red ring on offending canvas nodes, hover tooltip with reason.

**Files:** new `lib/validation/graphRules.ts`; [components/canvas/FlowNode.tsx](./components/canvas/FlowNode.tsx) reads validation status from store.

---

## Post-MVP (deferred, with reasons)

- **Positions migration to `annotations.ui.position`.** Needed for round-trip through export; not blocking single-user editing.
- **`annotations.comments[]` + async comment UI.** Asynchronous collab only. Real-time multi-cursor (CRDTs / Yjs / presence) is post-post-MVP.
- **Full steps editor** — structural step CRUD, captures editor, per-step conditions, utterance variations. MVP scripts sheet covers the dominant case.
- **Full `knowledge.tables` CRUD editor** (rows × structure). JSON-textarea fallback is MVP-sufficient.
- **Deep graph validation** — variable-reference integrity in utterances, `interrupt.scope` members exist, `exit_path.assigns` target validity, `variables_used` on steps matches actual usage.
- **v1 schema additions** — `tool` step, `call` step, `pipecat` hints. Canvas and inspector adapt when the schema lands.
- **In-app parse step** replacing the external [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt) workflow. External Claude conversation is good enough for MVP.
- **Flow id rename with cascade update.** Ids are immutable in MVP; delete-and-recreate to change.

---

## Risks

- **Scripts sheet UX is the hardest piece.** Editing a cell round-trips through nested `steps[].utterances[].variations[].text`, and not every language has the same step coverage. Expect two iterations.
- **Inspector grows fast.** ListEditor, DictEditor, ConditionEditor, FlowPicker, LanguagePicker — ~5 composable primitives that 10+ fields consume. Build the primitives first or it becomes a bespoke mess.
- **Validation timing.** Ajv on every keystroke is wasteful; on-export-only misses authoring feedback. Debounced at ~300ms.
- **LLM-parsed specs are noisy.** Schema validation at import is load-bearing — half-valid specs cascading into the store are confusing. Reject hard, surface errors clearly.
