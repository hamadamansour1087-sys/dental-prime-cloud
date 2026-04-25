/**
 * Invoice tooth diagram — renders only the worked-on teeth as small
 * tooth-shaped icons (crown + roots) with their FDI number underneath.
 * No full arch — just the selected teeth, large and clear for print/PDF.
 */

const QUAD_TO_FDI: Record<string, number> = {
  UR1: 11, UR2: 12, UR3: 13, UR4: 14, UR5: 15, UR6: 16, UR7: 17, UR8: 18,
  UL1: 21, UL2: 22, UL3: 23, UL4: 24, UL5: 25, UL6: 26, UL7: 27, UL8: 28,
  LL1: 31, LL2: 32, LL3: 33, LL4: 34, LL5: 35, LL6: 36, LL7: 37, LL8: 38,
  LR1: 41, LR2: 42, LR3: 43, LR4: 44, LR5: 45, LR6: 46, LR7: 47, LR8: 48,
};

function parseSelected(selected: string | null | undefined): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  (selected ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      let n: number | null = null;
      const num = Number(s);
      if (!isNaN(num)) n = num;
      else if (QUAD_TO_FDI[s]) n = QUAD_TO_FDI[s];
      if (n !== null && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    });
  // Sort: upper first (10–28), then lower (30–48); within each, ascending FDI
  return out.sort((a, b) => {
    const aUpper = a < 30 ? 0 : 1;
    const bUpper = b < 30 ? 0 : 1;
    if (aUpper !== bUpper) return aUpper - bUpper;
    return a - b;
  });
}

/** Single tooth icon — molar-ish silhouette with two roots. Upper teeth point down (roots up). */
function ToothIcon({ isUpper }: { isUpper: boolean }) {
  // Crown (rounded top) + two roots tapering down. For upper, flip vertically.
  const path =
    "M6 2 C3 2 1 4 1 8 C1 11 2 13 4 14 L4 20 C4 22 5 23 6 23 C7 23 8 22 8 20 L8 14 C8 14 8.5 14 9 14 L9 20 C9 22 10 23 11 23 C12 23 13 22 13 20 L13 14 C15 13 17 11 17 8 C17 4 15 2 12 2 Z";
  return (
    <svg
      viewBox="0 0 18 25"
      width="22"
      height="30"
      style={{ display: "block", transform: isUpper ? "scaleY(-1)" : "none" }}
    >
      <path
        d={path}
        fill="#ffffff"
        stroke="#0c4a6e"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* subtle crown shading */}
      <path
        d="M3 6 C5 4 13 4 15 6"
        fill="none"
        stroke="#0e7490"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function InvoiceToothDiagram({
  selected,
}: {
  selected: string | null | undefined;
  size?: number;
}) {
  const teeth = parseSelected(selected);
  if (teeth.length === 0) return <span style={{ color: "#94a3b8" }}>—</span>;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      {teeth.map((n) => {
        const isUpper = n < 30;
        return (
          <div
            key={n}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <ToothIcon isUpper={isUpper} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "#0c4a6e",
                fontFamily: "'Cairo', monospace",
                lineHeight: 1,
              }}
            >
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}
