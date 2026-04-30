# UX4 strategy & roadmap

**Cross-repo product design and strategy doc for UX4.** Captures positioning, architectural bets, prioritization, and risks across the three repos that compose the product. Scoped design docs and operational plans defer to this one when they conflict.

## Related Docs

- [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md) — design doc for the simulation platform (shipped).
- [MVP-PLAN.md](./MVP-PLAN.md) — uxflows editor MVP work plan (shipped).
- [RUNNER-PLAN.md](./RUNNER-PLAN.md) — runner v0 operational plan.
- [`../whatsupp2/AGENT-CLAUDE.md`](../whatsupp2/AGENT-CLAUDE.md) — whatsupp2 technical reference and pending list.
- [SCHEMA.md](./SCHEMA.md) — the v0/v1 spec schema, the contract every component is a producer or consumer of.
- [AGENTS.md](./AGENTS.md) — uxflows architecture and tech stack.

## What UX4 is

A **behavioral IDE for conversational agents** — an authoring + specification + prototyping + simulation framework for the *early part* of the agent-development funnel. UX4 defines what an agent should do and verifies that it does before it ships. It does not execute agents in production, host them, or monitor them after deployment. Production execution is somebody else's problem until a customer pays for a delivery format (codegen) or hosted offering.

The four components map across two repos:

| Component | Lives in | Responsibility |
|---|---|---|
| **Authoring** | `uxflows` | Visual editor on top of the v0 spec. Canvas, inspectors, sheets, validation. |
| **Specification** | `uxflows/SCHEMA.md` | The v0/v1 schema — the contract every other component is a producer or consumer of. |
| **Prototyping** | `uxflows-runner` (planned) | Native runner that interprets the spec live, drives voice (via Pipecat) or text I/O depending on `meta.modes`, emits events for the canvas to highlight. |
| **Simulation** | `whatsupp2` | Runs personas against the spec (via the runner, eventually). Owns scenario asserts, evaluator, findings reports. |

The runner has a **dual identity** by design: it is both the prototyping component (designer hits Run, talks to the agent, watches the canvas pulse) and the simulation substrate (whatsupp2 wraps it with personas to run scenarios at scale). One executor, two roles. This is why we want a runner instead of two parallel things.

UX4 is a **bundle of products plus a contract**, not a monolith. The contract is the v0 spec schema. Within the bundle, two products are independently viable today:

- **The simulation platform (whatsupp2)** is standalone-viable from a *bare system prompt* — paste, simulate, get findings. No spec authoring step, no runner. That's the immediate-value entry point and the typical pre-sales motion. See [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md).
- **The visual editor (uxflows)** is standalone-viable as a spec authoring tool — a designer can author a v0 spec and hand the JSON to any downstream consumer (whatsupp2 today, customer-owned runtimes via codegen tomorrow).

The runner is not standalone — it interprets a spec, so it needs one. The schema is the contract, not a product. Standalone viability matters strategically: each component lands alone with prospects who don't need the full bundle, and converts to the full bundle as their needs grow.

## The problem we replace

Conversational agent teams maintain their behavioral contract across four to five disconnected tools: Figma for visual flow diagrams, Google Sheets for scripts and entity definitions, Google Docs for narrative specifications and business rules, a testing or monitoring platform for production observability, and an issue tracker for problems found anywhere in that pipeline. Visual but disconnected. Tabular but disconnected. Narrative but unstructured. Production-only. Disconnected from the spec.

UX4 does not replace all of these on day one. The current product replaces the **testing-before-deployment gap** that none of them fills. Medium-term work picks up the spec layer (Docs) and the structural layer (Figma). The Sheets layer comes last because utterance management is genuinely tabular and Sheets is good at it.

## The demo cycle

The MVP loop has two operating contexts. With existing customers it is iterative — each refinement of the spec produces a new round of simulations and findings that drive implementation work. With prospects it is a sales tool, used to produce a demo from the prospect's own agent.

The cycle: a discovery conversation with a banking prospect ends with materials — policies the agent will enforce, scenarios it will handle, examples of good and bad responses, voice and brand sensibilities. Most prospects do not yet have a production agent — building it is what they are hiring us or our partners to do. The prompt engineer drafts an initial system prompt from the discovery materials. UX4 ingests the prompt and supporting docs, parses them into a structured spec, runs simulations against the draft prompt on a generic LLM endpoint (or a runner-hosted voice agent, post Phase A), and assembles a client-facing document. Within 3–5 days of the original conversation, the prospect walks through what UX4 produced.

The walkthrough is the moment that converts. The prospect opens a transcript and watches a draft of their own future agent confirm a payment commitment with the wrong person. They open another and see it dispense a balance before identity verification. They open a third and find it answering a fee question with information that directly contradicts the policy doc shared three days ago. None of it is hypothetical. None of it is generic. It is a draft agent built from the prospect's own materials, simulated against personas built from the prospect's own user segments — behaving in concrete ways the prospect can see, react to, and ask to be fixed before anything ships. Banking buyers have been pitched generic AI for two years. Concrete behavior of their own future agent is a different conversation.

The **3–5 day target** is the operating constraint that justifies the build timeline and shapes engineering priorities throughout. Parser reliability, simulation throughput, persona quality, runner readiness, and document rendering — all must be good enough to produce a demo-quality artifact in under a week, accounting for the messiness of getting endpoint access and gathering existing material.

Same product, same workflow, same artifact the prospect continues to refine after they sign. The demo is not a separate feature — it is the loop, used in pre-sales.

## Strategic posture

The load-bearing claims that drive prioritization:

- **The position is a window, not a moat.** ~X months before OpenAI or other horizontal incumbents ship comparable behavioral governance with broader distribution. The work in the window determines whether the position holds.
- **Partner-led GTM in Phase 1.** Awaaz is the lighthouse partner — regulated emerging-markets banking voice. MVP success is a small portfolio of working deployments through Awaaz and ideally one or two other partners.
- **Negotiated transition in Phase 2.** Customers manage the spec in UX4 directly; partner keeps runtime revenue but loses the spec/validation/relationship layer. Channel conflict is real and must be planned, not improvised.
- **Direct + horizontal in Phase 3.** Multi-runtime export (codegen) becomes a strategic GTM capability — direct sales without a voice-platform partner. PLG with BYOK simulation as the on-ramp.
- **The OpenAI threat is greenfield, not displacement.** The risk is that OpenAI's developer-first governance reaches new deals before UX4 does, not that they take existing customers. Defense is partner distribution, workflow specificity, and architectural fit — not the schema, not approval mechanics, not multilingual depth (the last only if substantiated concretely).

## Architectural bets

Three load-bearing principles that decide what UX4 builds and what it doesn't:

### 1. Decomposition is the substrate, not a feature

Regulated conversational agents have large behavior spaces that break monolithic-prompt architectures through instruction-following degradation. Modular flows are the architectural response, and the runtime layer (Pipecat node-graph, LangGraph state graphs) is converging independently. Horizontal tools that commit to instructions-and-tool architectures (LiveKit, OpenAI Agents SDK) underperform in regulated voice even with broader distribution, because their architectural direction does not match the behavior surface the segment requires.

This is the single most durable architectural bet. Workflow specificity holds only as long as the focus does; partner distribution holds only as long as the partners do; architectural fit holds as long as the segment exists.

### 2. Hybrid deterministic + probabilistic via three-method substrate

Real flows have both kinds of behavior turn-by-turn — deterministic guards ("never quote a dollar figure not in the rates table") and probabilistic generation ("sound warm and acknowledge their concern"). The schema's `llm` / `calculation` / `direct` methods let authors put each kind where it belongs without writing glue.

The buyer pitch is not "decomposition is good" (debatable) — it's *"you're already mixing deterministic and probabilistic logic in your production prompts; we give you the right primitives to express both, and the right canvas to see the seams."* That is much harder to dismiss. Every honest practitioner has felt the pain of jamming a deterministic constraint into a system prompt and watching the LLM violate it 4% of the time.

### 3. The spec is the contract

Every component is a producer or consumer of the v0 spec. Authoring produces it; running consumes it; simulation consumes it; codegen (when paid for) generates from it; future observability annotates it. The spec is what holds the stack together. Keeping it small, stable, portable, and unambiguously interpretable is the highest-priority engineering invariant.

The runner's specific role: *prove the spec is interpretable*. Until the runner exists, the spec is documentation. Once it exists, the spec is software. That is the structural reason owning the runner is non-negotiable while owning a codegen target is optional — codegen is just another consumer of the same contract.

## Competitive positioning

UX4 is benchmarked against a different set than "voice agent platform":

- **Closer competitors:** Stately Studio (live state-machine highlighting, but general-purpose, no voice, no agent-specific concepts), LangGraph Studio (graph + execution viz, but text-only and lacks UX4 schema substrate), Voiceflow's design surface (chat-first IVR mental model, slow to adapt), Figma's eventual agent product (doesn't exist yet but plausible).
- **Foundation model providers — a different competitive class.** OpenAI, Anthropic, Google compete on distribution and model quality, not workflow specificity. They become a threat when they bundle governance/authoring/eval primitives into their SDKs. **OpenAI** is the named strategic threat in *Strategic posture* (Agents SDK + Realtime API). **Google** has the closest existing surface: Dialogflow CX and Vertex AI Agent Builder are visual agent designers in the same shape, though IVR-flavored and chat-first respectively. **Anthropic**'s claude-agent-sdk is loop machinery without authoring UI — less direct today but moves fast. Defense is workflow specificity, partner distribution, and the architectural fit to regulated voice that horizontal SDKs underprioritize.
- **Not direct competitors despite voice overlap:** Vapi, Retell, Bland — these are deployment plays optimizing "voice agent in 5 minutes via API." UX4 wins by exporting *to* whatever wins deployment, not competing on production telephony.
- **Not a competitor at all:** Pipecat. We rent its audio infrastructure. Friend, not foe.

The differentiator is the *bundle*: graph-canonical visual editor + voice-native execution + spec as runtime source of truth + live canvas illumination keyed to authored ids. No existing tooling bundles all four.

## Cross-repo roadmap

One AI-accelerated developer, three repos. Discipline is to serialize aggressively and finish each phase before starting the next. Phase plans lie about future certainty, so revisit B–E once A is shipping.

| Phase | Repo | Work | Cal time | Why now |
|---|---|---|---|---|
| **A** | `uxflows-runner` | RUNNER-PLAN Phases 0–3: hello-world bot → v0 dispatcher → editor wiring → polish | ~3 weeks | Largest leverage move. Defines the live canvas demo *and* unblocks two whatsupp2 features (capability eval, voice testing). |
| **B** | `whatsupp2` | Voice-flavored text simulation — extend persona `interaction_style` with voice-natural patterns (disfluencies, repetition, ASR-error garble, backchannels, code-switching, terse replies, topic shifts) so bare-prompt mode probes a meaningful subset of voice failure modes. No annotations or runtime instrumentation; works against the agent as deployed. | ~1 week | Direct value for current Awaaz prompt-brittleness debugging. Independent of the runner. Silence, real barge-in timing, and DTMF wait for runner integration. |
| **C** | `uxflows-runner` | v0.5: runtime guardrail enforcement + session event log persistence | ~1–2 weeks | The "auditable behavior" pitch needs guardrails to *do something* at runtime. Persisted event logs unlock replay nearly free. |
| **D** | `whatsupp2` | Capability invocation evaluation (now unblocked by runner action events) | ~2 weeks | First whatsupp2 feature unlocked by the runner. Meaningful upgrade for the regulated buyer. |
| **E** | `whatsupp2` | Voice agent testing (runner wrapped in simulation loop) | ~2–3 weeks | Closes the loop: text simulation today, voice simulation after this phase. The funnel becomes voice-native end-to-end. AGENT-TESTING.md flags this as the highest-priority post-MVP investment. |

Total: ~3 months serial. Each phase leaves the funnel measurably better; no phase depends on one further than the immediately preceding.

## Aggressive deferrals

Per "super tight and manageable" with one developer and a wide active surface — defer hard, revisit only when something forces the issue.

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
- **OpenAI ships first.** The window is finite. Every week of internal architectural debate is a week of window burned. Prefer narrow shipped over broad designed.
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

- What's the right separation between UX4 and Awaaz commercially? Equity, revenue share, exclusivity? Phase 2 hinges on this.
- When is the right moment to publish the schema as an open standard? AGENT-TESTING.md says "after PMF, when there's a body of specs that benefit from portability." What signals tell us we're there?
- What's the multilingual story we can substantiate? Is per-language scripts in the schema (table stakes) plus dialect-aware evaluation (real work) enough to defend, or do we need code-switching depth?
- When does the hosted-runner-as-a-service offering become a real product surface vs. always referring customers to deploy themselves? Likely Phase 3, but worth tracking.
- How much does the runner's code-emit (codegen) eventually need to ship? Demand-driven so far. The first customer to demand "give us a Pipecat project we own" forces it.
