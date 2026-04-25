/**
 * Read-only quadrant view of selected teeth.
 * Renders 4 boxes (UR/UL/LR/LL) showing tooth numbers 1-8 in each.
 * Used in invoices, case details, statements, etc.
 */
import { parseTeethToQuadrants, QUADRANT_LABELS_AR, type Quadrant } from "@/lib/teeth";

export function QuadrantsView({
  selected,
  compact = false,
}: {
  selected: string | null | undefined;
  compact?: boolean;
}) {
  const q = parseTeethToQuadrants(selected);
  const total = q.UR.length + q.UL.length + q.LR.length + q.LL.length;
  if (total === 0) return <span className="text-muted-foreground">—</span>;

  const Box = ({ name }: { name: Quadrant }) => {
    const teeth = q[name];
    return (
      <div className="rounded-md border border-border bg-card p-1.5 text-center">
        <div className="text-[9px] font-semibold text-muted-foreground">
          {QUADRANT_LABELS_AR[name]}
        </div>
        <div
          dir="ltr"
          className="mt-0.5 font-mono text-sm font-bold text-foreground"
        >
          {teeth.length ? teeth.join(" ") : "—"}
        </div>
      </div>
    );
  };

  return (
    <div
      className={
        compact
          ? "inline-grid grid-cols-2 gap-1 text-xs"
          : "grid grid-cols-2 gap-2"
      }
      style={{ minWidth: compact ? "140px" : "200px" }}
    >
      <Box name="UR" />
      <Box name="UL" />
      <Box name="LR" />
      <Box name="LL" />
    </div>
  );
}
