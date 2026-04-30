# UX4 strategy & roadmap

**Cross-repo product design and strategy doc for UX4.** Captures positioning, architectural bets, prioritization, and risks across the three repos that compose the product. Scoped design docs and operational plans defer to this one when they conflict.

## Related Docs

- [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md) — design doc for the simulation platform (shipped).
- [MVP-PLAN.md](./MVP-PLAN.md) — uxflows editor MVP work plan (shipped).
- [`../uxflows-runner/RUNNER-PLAN.md`](../uxflows-runner/RUNNER-PLAN.md) — runner v0 operational plan (lives in the sibling `uxflows-runner` repo).
- [`../whatsupp2/AGENT-CLAUDE.md`](../whatsupp2/AGENT-CLAUDE.md) — whatsupp2 technical reference and pending list.
- [SCHEMA.md](./SCHEMA.md) — the v0/v1 spec schema, the contract every component is a producer or consumer of.
- [AGENTS.md](./AGENTS.md) — uxflows architecture and tech stack.

## What UX4 is

A **behavioral IDE for conversational agents** — a specification + authoring + prototyping + simulation framework for the *early part* of the agent-development funnel. UX4 defines what an agent should do and verifies that it does before it ships. It does not execute agents in production, host them, or monitor them after deployment. Production execution is somebody else's problem until a customer pays for a delivery format (codegen) or hosted offering.

The four components map across two repos:

| Component | Lives in | Responsibility |
|---|---|---|
| **Authoring** | `uxflows` | Visual editor on top of the v0 spec. Canvas, inspectors, sheets, validation. |
| **Specification** | `uxflows/SCHEMA.md` | The v0/v1 schema — the contract every other component is a producer or consumer of. |
| **Prototyping** | `uxflows-runner` (planned) | Native runner that interprets the spec live, drives voice (via Pipecat) or text I/O depending on `meta.modes`, emits events for the canvas to highlight. |
| **Simulation** | `whatsupp2` | Runs personas against the spec (via the runner, eventually). Owns scenario asserts, evaluator, findings reports. |

The runner has a **dual identity** by design: it is both the prototyping component (designer hits Run, talks to the agent, watches the canvas pulse) and the simulation substrate (whatsupp2 wraps it with personas to run scenarios at scale). One executor, two roles. This is why we want a runner instead of two parallel things.

UX4 is a **contract with three products built around it**, not a monolith. The contract is the v0 spec schema; each product is a producer or consumer of it. Two of those products are independently viable today:

- **The simulation platform (whatsupp2)** is standalone-viable from a *bare system prompt* — paste, simulate, get findings. No spec authoring step, no runner. That's the immediate-value entry point and the typical pre-sales motion. See [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md).
- **The visual editor (uxflows)** is standalone-viable as a spec authoring tool — a designer can author a v0 spec and hand the JSON to any downstream consumer (whatsupp2 today, customer-owned runtimes via codegen tomorrow).

The runner is not standalone — it interprets a spec, so it needs one. The schema is the contract, not a product. Standalone viability matters strategically: each component lands alone with prospects who don't need the full bundle, and converts to the full bundle as their needs grow.

## The problem we replace

Conversational agent teams maintain their behavioral contract across four to five disconnected tools: Figma for visual flow diagrams, Google Sheets for scripts and entity definitions, Google Docs for narrative specifications and business rules, a testing or monitoring platform for production observability, and an issue tracker for problems found anywhere in that pipeline. Visual but disconnected. Tabular but disconnected. Narrative but unstructured. Production-only. Disconnected from the spec.

UX4 does not replace all of these on day one. The wedge is the **testing-before-deployment gap** that none of them fills. The Sheets layer is already addressed in uxflows (scripts with translation columns, knowledge tables, glossary) — utterance management is spec-governed, not Sheets-good; assuming otherwise is the Voiceflow trap. The structural layer (Figma) is partially subsumed by the canvas. The narrative-spec layer (Docs) is the one genuinely deferred.

## The demo cycle

The MVP loop has two operating contexts. With existing customers it is iterative — each refinement of the spec produces a new round of simulations and findings that drive implementation work. With prospects it is a sales tool, used to produce a demo from the prospect's own agent.

The cycle: a discovery conversation with a banking prospect ends with materials — policies the agent will enforce, scenarios it will handle, examples of good and bad responses, voice and brand sensibilities. Most prospects do not yet have a production agent — building it is what they are hiring us or our partners to do. The prompt engineer drafts an initial system prompt from the discovery materials. UX4 ingests the prompt and supporting docs, parses them into a structured spec, runs simulations against the draft prompt on a generic LLM endpoint (or a runner-hosted voice agent, post Phase A), and assembles a client-facing document. Within 3–5 days of the original conversation, the prospect walks through what UX4 produced.

The walkthrough is the moment that converts. The prospect opens a transcript and watches a draft of their own future agent confirm a payment commitment with the wrong person. They open another and see it dispense a balance before identity verification. They open a third and find it answering a fee question with information that directly contradicts the policy doc shared three days ago. None of it is hypothetical. None of it is generic. It is a draft agent built from the prospect's own materials, simulated against personas built from the prospect's own user segments — behaving in concrete ways the prospect can see, react to, and ask to be fixed before anything ships. Banking buyers have been pitched generic AI for two years. Concrete behavior of their own future agent is a different conversation.

The **3–5 day target** is the operating constraint that justifies the build timeline and shapes engineering priorities throughout. Parser reliability, simulation throughput, persona quality, runner readiness, and document rendering — all must be good enough to produce a demo-quality artifact in under a week, accounting for the messiness of getting endpoint access and gathering existing material.

Same product, same workflow, same artifact — the spec — that the prospect's team continues to refine after they sign. The demo shows behavior, but what gets bought is the spec. The demo is not a separate feature; it is the loop, used in pre-sales.

## Strategic posture

The load-bearing claims that drive prioritization:

- **The position is a window, not a moat.** ~X months before OpenAI or other horizontal incumbents ship comparable behavioral governance with broader distribution. The work in the window determines whether the position holds.
- **Partner-led GTM in Phase 1.** Awaaz is the lighthouse partner — regulated emerging-markets banking voice. MVP success is a small portfolio of working deployments through Awaaz and ideally one or two other partners.
- **Negotiated transition in Phase 2.** Customers manage the spec in UX4 directly; partner keeps runtime revenue but loses the spec/validation/relationship layer. Channel conflict is real and must be planned, not improvised.
- **Direct + horizontal in Phase 3.** Multi-runtime export (codegen) becomes a strategic GTM capability — direct sales without a voice-platform partner. PLG with BYOK simulation as the on-ramp.
- **The OpenAI threat is greenfield, not displacement.** The risk is that OpenAI's developer-first governance reaches new deals before UX4 does, not that they take existing customers. Defense is partner distribution, workflow specificity, and architectural fit — not the schema as artifact (anyone can publish one), not approval mechanics, not multilingual depth (the last only if substantiated concretely). The spec contract operating across a working bundle is durable; a schema document on its own is not.

## Architectural bets

Three load-bearing principles, in the order they generate each other.

### 1. The spec is the contract

Every component is a producer or consumer of the v0 spec. Authoring produces it; running consumes it; simulation consumes it; codegen (when paid for) generates from it; future observability annotates it. Keeping it small, stable, portable, and unambiguously interpretable is the highest-priority engineering invariant.

The runner's specific role: prove the spec is interpretable. Until the runner exists, the spec is documentation. Once it exists, the spec is software. That is the structural reason owning the runner is non-negotiable while owning a codegen target is optional — codegen is just another consumer of the same contract.

This is the single most durable bet because decomposition is converging across the runtime layer; spec design is not. A specific spec is hard to copy and harder to evolve toward without breaking existing customers — competitors cannot acquire it by adopting the same architectural shape. The known risk is governance: "small and stable" is in tension with "expressive enough for real regulated voice," and the hardest engineering problem is not shipping v0 but deciding what enters v1 without breaking what shipped on v0.

### 2. Decomposition is what the spec requires

Regulated conversational agents have large behavior spaces that break monolithic-prompt architectures through instruction-following degradation. The spec responds by making decomposition the substrate — flows, nodes, ids, captures, transitions — because those are the units that can be authored, rendered, simulated, and audited as named artifacts.

Convergence on graph-shaped runtimes (Pipecat, LangGraph) confirms decomposition is correct; it does not make decomposition the moat. The moat is what the spec does with decomposition: stable ids compliance can audit, transitions a simulator can replay, captures observability can pin metrics to. Horizontal alternatives committed to instructions-and-tool architectures (LiveKit, OpenAI Agents SDK) work a different surface — their contract, to the extent they have one, is shaped by general-purpose distribution, not by what auditability requires.

### 3. Hybrid deterministic + probabilistic is what the spec lets authors express

Real flows have both kinds of behavior turn-by-turn — deterministic guards ("never quote a dollar figure not in the rates table") and probabilistic generation ("sound warm and acknowledge their concern"). The schema's llm / calculation / direct methods let authors put each kind where it belongs without writing glue.

The buyer pitch is not "decomposition is good" (debatable) — it's "you're already mixing deterministic and probabilistic logic in your production prompts; we give you the right primitives to express both, and the right canvas to see the seams." Every honest practitioner has felt the pain of jamming a deterministic constraint into a system prompt and watching the LLM violate it 4% of the time. The open question is whether the three-method partition is exhaustive enough for v0; pressure-testing it against ten real customer flows is the highest-leverage product investment in the next two quarters.

## Competitive positioning

The right way to read the landscape is to ask what each player's contract is — the artifact that holds their authoring, runtime, and observability layers together — and whether it admits the properties UX4's spec does.

- **Closer competitors — different contracts.** Stately Studio has a real contract (XState's machine definition) but it is general-purpose and predates LLMs; evolving it toward voice-native primitives means breaking a customer base that does not need them. LangGraph Studio has a runtime contract, not a spec contract — the graph is defined in code, authoring is programming, review is code review. Voiceflow's chat-first IVR contract predates conversational LLMs and adapts slowly because the existing surface is the asset. Figma's eventual agent product doesn't exist; if it ships, design-files-as-contract is structurally closer to UX4's framing than any current competitor.

- **Foundation model providers — distribution against contract.** OpenAI, Anthropic, and Google compete on distribution and model quality, not workflow specificity. They become a threat when they bundle governance and authoring into their SDKs. Google has the closest existing surface (Dialogflow CX, Vertex AI Agent Builder — IVR-flavored and chat-first respectively, tied to their cloud). OpenAI is the named strategic threat in Strategic posture; Agents SDK + Realtime API plus an authoring surface and stable spec would compress UX4's moat fastest. Anthropic's claude-agent-sdk is loop machinery without authoring UI — less direct today, moves fast. Defense is not feature parity; it is that workflow specificity, partner distribution, and architectural fit to regulated voice are things horizontal SDKs cannot prioritize without alienating their broader audience.

- **Not direct competitors despite voice overlap.** Vapi, Retell, Bland — their contract is the API call. UX4 wins by exporting to whatever wins deployment, not competing on production telephony.
Not a competitor at all: Pipecat. We rent its audio infrastructure. Friend, not foe.

The differentiator is the bundle: graph-canonical visual editor + voice-native execution + spec as runtime source of truth + live canvas illumination keyed to authored ids. No existing tooling bundles all four — and the reason is structural: without the spec contract, the other three cannot be kept in sync.

## Cross-repo roadmap

One AI-accelerated developer, three repos. Discipline is to serialize aggressively and finish each phase before starting the next. Phase plans lie about future certainty, so revisit B–E once A is shipping.

| Phase | Repo | Work | Cal time | Why now |
|---|---|---|---|---|
| **A** | `uxflows-runner` | RUNNER-PLAN Phases 0–3: hello-world bot → v0 dispatcher → editor wiring → polish | ~3 weeks | Until the runner exists, the spec is documentation; once it exists, the spec is software. Largest leverage move: defines the live canvas demo *and* unblocks two whatsupp2 features (capability eval, voice testing). |
| **B** | `uxflows-runner` | v0.5: runtime guardrail enforcement + session event log persistence | ~1–2 weeks | The "auditable behavior" pitch needs guardrails to *do something* at runtime. Persisted event logs unlock replay nearly free. |
| **C** | `whatsupp2` | Capability invocation evaluation (now unblocked by runner action events) | ~2 weeks | First whatsupp2 feature unlocked by the runner. Meaningful upgrade for the regulated buyer. |
| **D** | `whatsupp2` | Voice agent testing (runner wrapped in simulation loop) | ~2–3 weeks | Closes the loop: text simulation today, voice simulation after this phase. The funnel becomes voice-native end-to-end. AGENT-TESTING.md flags this as the highest-priority post-MVP investment. |

Total: ~3 months serial. Each phase leaves the funnel measurably better; no phase depends on one further than the immediately preceding.

## Aggressive deferrals

Per "super tight and manageable" with one developer and a wide active surface — defer hard, revisit only when something forces the issue.

Almost every item below is one of two things: a feature of a consumer of the spec that doesn't change the contract, or a v1 schema feature that would change the contract before v0 is proven. That's the test for new scope, too — both forms are deferrable until v0 is load-bearing in customer engagements.

**uxflows:** positions migration to `annotations.ui.position`, generate-example-transcript button, export as declarative text, flow id rename with cascade, dagre re-layout optimization, `annotations.comments[]`, deep graph validation, v1 steps editor.

**uxflows-runner:** phone telephony / Patter, codegen for any target, bidirectional control plane, replay UI, multi-language code-switching, multi-session/multi-user, cost dashboard, all v1 schema features, dispatcher reuse in whatsupp2 text simulator (until phase E forces it).

**whatsupp2:** Scorecard/RunView shareable link, flow accounting UI, stale gold-standard detection, spec-edit invalidation surfacing, structured failure-to-guardrail attribution, CI/CD, run comparison, scenario-persona affinity, chat log import, real user testing.

**Whole-product layers deferred:** observability (production telemetry, dashboards, alerts), deployment infrastructure, multi-tenancy, PLG entry, approval/versioning workflow, open-standard publication.

Most of these are good ideas. None are load-bearing for the funnel-as-product story landing with Awaaz banking deployments. They become priorities when a customer signals the gap; not before.

## Risks worth tracking

The risks that should change behavior in the next 3 months — a mix of strategic risks from the operating environment and engineering risks specific to current work:

- **Awaaz dependency.** Phase 1 is single-partner. Mitigation is diversifying in Phase 2 *using MVP success as proof* — which means Phase 1 must produce demoable success.
- **Parser quality.** The MVP loop depends on the parser producing a usable spec from messy inputs. Single biggest engineering risk in the whatsupp2 MVP build. 
- **3–5 day demo budget.** Any phase that adds friction to that timeline (slow simulation, manual onboarding, parser misses) attacks the wedge.
- **OpenAI stabilizes a contract first.** The threat isn't that they ship comparable functionality; it's that they stabilize a contract that becomes the default. Watch for OpenAI publishing a spec, not just shipping features. The window is finite — every week of internal architectural debate is a week of window burned. Prefer narrow shipped over broad designed.
- **Spec governance.** "Small and stable" pulls against "expressive enough for real regulated voice." The hardest engineering problem in the next 6 months is not shipping v0 but deciding what enters v1 without breaking what shipped on v0. Pressure-testing the schema against ten real customer flows is the highest-leverage product investment to surface this early.
- **Channel conflict in Phase 2.** Real, planned-not-improvised. Not a Phase A–E concern, but track explicitly so Phase 2 commercial conversations have a runway.
- **LLM-judge variance in regulated review.** Banking compliance teams will eventually ask "how do you know this evaluation is accurate?" Current answer is informal (human review, gold standards, multiple runs). A more rigorous answer becomes required for enterprise sales — not v1 but track.

## Where each concept lives

The boundaries decide where things go. Get this wrong and the schema bloats, repos drift, or layers leak.

- Behaviors the agent should *always* uphold → spec-level **guardrails** (authoring).
- Routing decisions during a turn → spec-level **exit_paths** (authoring).
- Assertions about a specific scenario's expected outcome → simulation-layer scenario asserts (`should_happen` / `should_not_happen`). **Not in the spec** — properties of a test, not the agent.
- Persona definitions, user segment descriptions → simulation-layer. Same reason.
- API keys, endpoints, voice IDs, model choice → execution config (sibling to spec, never inside).
- Capability backends (HTTP/MCP), knowledge backends (retrieval) → customer-owned infrastructure. UX4 ships the contract (spec declaration + execution config endpoint), not the implementation.
- Live runtime events → emitted by the runner; consumed by the editor today, the simulator next, observability eventually. One contract, multiple subscribers in time order.
- UI metadata (positions, colors, comments) → `annotations` namespace; runtimes ignore. Editor-side, not behavior.

## Open strategic questions

Not engineering questions — these inform Phase 2+ planning:

- **When and whether to publish the schema as an open standard.** Closer to a strategic bet than an open question — the answer shapes UX4's long-run position, and we genuinely don't know which direction is right yet. What signals tell us we're there?
- What's the right separation between UX4 and Awaaz commercially? Equity, revenue share, exclusivity? Phase 2 hinges on this.
- What's the multilingual story we can substantiate? Is per-language scripts in the schema (table stakes) plus dialect-aware evaluation (real work) enough to defend, or do we need code-switching depth?
- When does the hosted-runner-as-a-service offering become a real product surface vs. always referring customers to deploy themselves? Likely Phase 3, but worth tracking.
- How much does the runner's code-emit (codegen) eventually need to ship? Demand-driven so far. The first customer to demand "give us a Pipecat project we own" forces it.
