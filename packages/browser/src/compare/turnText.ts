import type { ScenarioTurn } from "@flowstore/studies";
import { formatTranscript, parseTranscript } from "@flowstore/core/files";

// The scenario textarea's line grammar. Two forms, one parser:
//
// - compact (no role marker anywhere): one turn per line, every line a user
//   turn. The cheap typing path for a user-only script.
// - transcript (any marker present): the grammar shared with a gold's
//   ## Transcript and a case's ## Turns (core parseTranscript) — a
//   `User:` / `Agent:` marker starts a turn, any other non-blank line
//   continues it. This is how multi-line replies blessed via save-as-gold
//   survive the round trip; it is also byte-for-byte what the project files
//   hold, so a transcript pastes between a gold file and here unchanged.
//
// turnsToText emits the transcript form whenever an agent turn or a
// multi-line turn exists, else compact.
//
// serialize∘parse is a NORMALIZER, not the identity (marker spacing and
// case, mode selection). The textarea must therefore hold its own draft
// and never echo the normalized form back mid-edit — see TurnsTextarea.
const MARKER = /^(agent|user)(?:\s*\[[a-z-]+\])?:/im;

export const turnsToText = (turns: ScenarioTurn[]): string => {
  const transcript = turns.some((t) => t.role === "agent" || t.text.includes("\n"));
  return transcript ? formatTranscript(turns) : turns.map((t) => t.text).join("\n");
};

export const textToTurns = (text: string): ScenarioTurn[] => {
  if (!MARKER.test(text)) return text.split("\n").map((line) => ({ role: "user", text: line }));
  // Plain lines before the first marker coalesce into one user turn.
  const lines = text.split("\n");
  const first = lines.findIndex((l) => MARKER.test(l));
  const lead = lines.slice(0, first).join("\n");
  const body = lines.slice(first).join("\n");
  const turns: ScenarioTurn[] = lead === "" ? [] : [{ role: "user", text: lead }];
  try {
    for (const t of parseTranscript(body, "scenario")) turns.push({ role: t.role, text: t.text });
  } catch {
    // Mid-typing garbage (e.g. an unknown flag): keep what parsed so far.
  }
  return turns;
};
