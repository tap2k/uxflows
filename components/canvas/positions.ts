export type Positions = Record<string, { x: number; y: number }>;

const KEY_PREFIX = "uxflows:positions:";

function key(specId: string) {
  return `${KEY_PREFIX}${specId}`;
}

export function loadPositions(specId: string): Positions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(specId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Positions) : {};
  } catch {
    return {};
  }
}

export function savePositions(specId: string, positions: Positions): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(specId), JSON.stringify(positions));
  } catch {
    // quota or serialization failure — drop silently; positions reset to dagre on next load
  }
}
