# uxflows

Visual editor for UX4 behavioral specs. Authors flow-based conversational agent specifications and exports them as UX4-compatible JSON conforming to [SCHEMA.md](./SCHEMA.md).

## Status

Bootstrap — canvas, validation, and codegen pending. See [AGENTS.md](./AGENTS.md) for architecture, planned structure, and design principles.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Docs

- [SCHEMA.md](./SCHEMA.md) — authoritative v0 + v1 spec schema (the contract between this repo and `../whatsupp2/`).
- [TRANSLATIONS.md](./TRANSLATIONS.md) — runtime translation tables (Pipecat, LiveKit, LangGraph, OpenAI Agents SDK; import sources: Voiceflow, Botpress).
- [AGENT-SPEC-PROMPT.txt](./AGENT-SPEC-PROMPT.txt) — Claude conversation prompt for parsing source material into structured spec text.
- [AGENTS.md](./AGENTS.md) — architecture, tech stack, design principles, MVP scope.
- [`../whatsupp2/AGENT-TESTING.md`](../whatsupp2/AGENT-TESTING.md) — product design doc (sibling repo).
- [`../whatsupp2/AGENT-CLAUDE.md`](../whatsupp2/AGENT-CLAUDE.md) — technical reference for the consuming application.

## Stack

Next.js 16 (Pages Router) · React 19 · TypeScript · Tailwind v4 · `@xyflow/react`
