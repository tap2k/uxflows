import { describe, expect, it } from "vitest";
import { textToTurns, turnsToText } from "./turnText";

const u = (text: string) => ({ role: "user" as const, text });
const a = (text: string) => ({ role: "agent" as const, text });

describe("turnText grammar", () => {
  it("compact: plain lines are user turns", () => {
    expect(textToTurns("hi\nthanks")).toEqual([u("hi"), u("thanks")]);
  });

  it("a user-only script round-trips compact; any agent turn switches to the transcript form", () => {
    expect(turnsToText([u("hi"), u("thanks")])).toBe("hi\nthanks");
    const turns = [u("hi"), a("hello"), u("thanks")];
    expect(turnsToText(turns)).toBe("User: hi\nAgent: hello\nUser: thanks");
    expect(textToTurns(turnsToText(turns))).toEqual(turns);
  });

  it("a multi-line turn serializes as a transcript — every turn marked, continuations indented", () => {
    const turns = [u("hi"), a("line one\nline two"), u("bye")];
    expect(turnsToText(turns)).toBe("User: hi\nAgent: line one\n  line two\nUser: bye");
    expect(textToTurns(turnsToText(turns))).toEqual(turns);
  });

  it("explicit: unprefixed lines continue the current turn", () => {
    expect(textToTurns("user: hi\nagent: first\nsecond\nuser: ok")).toEqual([
      u("hi"),
      a("first\nsecond"),
      u("ok"),
    ]);
  });

  it("explicit: plain lines before the first marker coalesce into one user turn", () => {
    expect(textToTurns("hello\nthere\nuser: next\nagent: reply")).toEqual([
      u("hello\nthere"),
      u("next"),
      a("reply"),
    ]);
  });

  it("typing a trailing newline survives the round trip in compact mode", () => {
    // The empty line is an empty user turn (the next line being typed).
    expect(turnsToText(textToTurns("hi\n"))).toBe("hi\n");
  });

  it("marker prefixes are case-insensitive and tolerate the following space", () => {
    expect(textToTurns("Agent:reply")).toEqual([a("reply")]);
    expect(textToTurns("USER: hi\nAGENT: yo")).toEqual([u("hi"), a("yo")]);
  });

  // serialize∘parse is a normalizer, not the identity — the textarea holds
  // its own draft for exactly this reason (see TurnsTextarea). The contract
  // worth pinning is that normalization is idempotent: one pass reaches a
  // fixed point, so store-derived text never re-normalizes.
  it("normalization is idempotent, including on marker-typing prefixes", () => {
    const norm = (t: string) => turnsToText(textToTurns(t));
    const samples = [
      "hi\nagent: hello\nthanks",
      "user:", // mid-typing a marker
      "user: hi\nagent: a\nb",
      "User [barge-in]: cut in",
      "hello\nthere\nuser: next",
      "Agent:reply",
      "hi\n",
      "",
    ];
    for (const s of samples) expect(norm(norm(s)), s).toBe(norm(s));
  });
});
