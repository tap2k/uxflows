# UX4 positioning

The architectural bets and what they imply for how we sell. Companion to [STRATEGY.md](./STRATEGY.md) (longer, exhaustive); this doc only carries the load-bearing structure.

## What UX4 is

A behavioral IDE for conversational agents — authoring, prototyping, and simulation for the *pre-deployment* part of the funnel. We do not host or run agents in production; we define what they should do and verify they do it before they ship.

The product is a **contract with three components built around it**:

- **Spec** (`uxflows/SCHEMA.md`) — the v0 schema. Every other component is a producer or consumer of it.
- **Editor** (`uxflows`) — visual authoring on top of the spec.
- **Runner** (`uxflows-runner`) — interprets the spec live; doubles as the simulation substrate.
- **Simulator** (`whatsupp2`) — drives personas through the runner, scores against scenario asserts and guardrails.

Editor and simulator are independently usable. The runner needs a spec to interpret.

## Architectural bets

Three load-bearing bets, ordered so each enables the next.

### 1. The spec is the contract

One schema, many producers and consumers. Authoring writes it; the runner interprets it; simulation drives it; future codegen emits from it; future observability annotates it. Keeping the spec small, stable, and unambiguously interpretable is the highest engineering invariant.

The runner's job is to prove the spec is software, not documentation. That is why owning the runner is non-negotiable while owning a codegen target is optional — codegen is just another consumer of the same contract.

### 2. Decomposition is the substrate

Regulated agents have behavior spaces too large for monolithic prompts; instruction-following degrades. The schema responds with named, addressable units — flows, nodes, ids, captures, transitions — because those are the units authoring renders, simulation replays, and audit pins metrics to.

Convergence on graph-shaped runtimes (Pipecat, LangGraph) confirms decomposition is correct; it is not the moat. The moat is what *our* schema does with it: stable ids compliance can audit, transitions a simulator can replay, captures observability can attach to.

### 3. Deterministic and probabilistic, expressed turn-by-turn

Real flows mix hard guards ("never quote a figure not in the rates table") with soft generation ("sound warm and acknowledge their concern"). The schema's `llm` / `calculation` / `direct` methods let authors put each kind where it belongs without writing glue.

The buyer pitch is not "decomposition is good" — it is "you are already mixing both kinds of logic in one prompt and watching it leak 4% of the time. We give you the primitives to express both cleanly and the canvas to see the seams."

## Business positioning implications

**The bundle is the moat, not the schema.** A schema document is publishable by anyone. What is hard to copy is a working bundle of producers and consumers tied to a specific contract: graph-canonical editor, voice-native runner, simulator wired to authored ids, all kept in sync because the contract sits between them. Each closer competitor fails one of the three bets:

- **Stately** has a real contract (XState) but it predates LLMs and is general-purpose; evolving it toward voice-native primitives breaks an existing customer base that does not need them.
- **LangGraph Studio** has a runtime contract, not a spec contract. The graph is code; review is code review.
- **Voiceflow** has a chat-first IVR contract that adapts slowly because the existing surface is the asset.
- **OpenAI / Anthropic / Google** compete on distribution and model quality, not workflow specificity. They become a threat when they bundle authoring and governance into their SDKs — but workflow specificity, partner distribution, and fit to regulated voice are things horizontal SDKs cannot prioritize without alienating their broader audience.

**Sell the workflow, not the schema.** Buyers do not pay for a JSON document; they pay for the loop it enables — ingest the prospect's own materials, simulate against personas built from their own user segments, walk a stakeholder through concrete failures of their own future agent within a week. Same loop as a sales tool pre-contract and as the iterative refinement loop post-contract.

**Voice-native and regulated is where the bets pay off.** Audit, multilingual, and compliance pressure are real there, and horizontal foundation-model SDKs are weakest there. Do not dilute MVP by chasing chat-first or generic developer use cases.

**Standalone viability of components is a sales feature.** Simulation alone lands with someone who already has a prompt; the editor alone lands with someone who wants to author a spec and hand it off. Each converts upward into the bundle as needs grow.

**The position is a window, not a moat.** Months, not years, before horizontal incumbents can ship comparable behavioral governance with broader distribution. The bundle becomes durable as customers operate inside it — until then, every quarter of internal architectural debate is a quarter of window burned. Prefer narrow shipped over broad designed.

## Go-to-market (tentative)

GTM is the least settled part of this doc. The shape we are betting on:

**Phase 1 — partner-led lighthouse engagements.** Awaaz is the first partner: regulated emerging-markets banking voice. Co-sell. MVP success is a small portfolio of working deployments through Awaaz and ideally one or two other partners. Pre-sales is the 3–5 day demo cycle: ingest the prospect's materials, parse to a spec, simulate, walk them through concrete failures of their own future agent. Banking buyers have been pitched generic AI for two years; concrete behavior of *their* agent is a different conversation.

**Phase 2 — negotiated transition to direct.** Customers manage the spec in UX4 directly; partner keeps runtime revenue but loses the spec / validation / relationship layer. Channel conflict is real and must be planned, not improvised.

**Phase 3 — direct plus horizontal via codegen.** Multi-runtime export becomes the GTM unlock — direct sales without a voice-platform partner. PLG on-ramp via BYOK simulation: paste a prompt, get findings, convert upward when value is visible.

**The on-ramp at every phase is the same shape:** simulation against a paste-in prompt. Lowest-commitment surface, highest-immediate-value moment, the natural entry point that pulls authoring and runtime in behind it.

## What this doc omits

Roadmap detail, repo layout, deferral lists, schema mechanics, risks, open questions — those live in [STRATEGY.md](./STRATEGY.md) and the per-repo design docs. This doc only carries the bets and what they mean for how we position and sell.
