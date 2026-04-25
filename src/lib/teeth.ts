/**
 * Tooth utilities — convert stored tooth identifiers (FDI like 16, 24, 36
 * or quadrant codes like UR1..LL8) into a quadrant-based view where every
 * tooth is displayed as a number 1-8 inside one of the four quadrants:
 *   UR (upper-right) | UL (upper-left)
 *   LR (lower-right) | LL (lower-left)
 */

export type Quadrant = "UR" | "UL" | "LR" | "LL";

/** Map an FDI tooth number (11..48) to {quadrant, position 1-8}. */
function fdiToQuadrant(n: number): { q: Quadrant; pos: number } | null {
  if (n < 11 || n > 48) return null;
  const q = Math.floor(n / 10);
  const pos = n % 10;
  if (pos < 1 || pos > 8) return null;
  if (q === 1) return { q: "UR", pos };
  if (q === 2) return { q: "UL", pos };
  if (q === 3) return { q: "LL", pos };
  if (q === 4) return { q: "LR", pos };
  return null;
}

/** Parse a stored value into the four quadrants with numbers 1-8 (sorted). */
export function parseTeethToQuadrants(value: string | null | undefined): Record<Quadrant, number[]> {
  const out: Record<Quadrant, number[]> = { UR: [], UL: [], LR: [], LL: [] };
  const seen: Record<Quadrant, Set<number>> = {
    UR: new Set(), UL: new Set(), LR: new Set(), LL: new Set(),
  };

  (value ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((tok) => {
      // Quadrant code: UR1..LL8
      const m = tok.match(/^(UR|UL|LR|LL)([1-8])$/i);
      if (m) {
        const q = m[1].toUpperCase() as Quadrant;
        const pos = Number(m[2]);
        if (!seen[q].has(pos)) {
          seen[q].add(pos);
          out[q].push(pos);
        }
        return;
      }
      // FDI number
      const num = Number(tok);
      if (!isNaN(num)) {
        const r = fdiToQuadrant(num);
        if (r && !seen[r.q].has(r.pos)) {
          seen[r.q].add(r.pos);
          out[r.q].push(r.pos);
        }
      }
    });

  (Object.keys(out) as Quadrant[]).forEach((q) => out[q].sort((a, b) => a - b));
  return out;
}

export const QUADRANT_LABELS_AR: Record<Quadrant, string> = {
  UR: "علوي يمين",
  UL: "علوي يسار",
  LR: "سفلي يمين",
  LL: "سفلي يسار",
};
