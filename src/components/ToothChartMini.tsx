import { cn } from "@/lib/utils";

const FDI = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

/**
 * Read-only miniature tooth chart for invoices.
 * Highlights the teeth contained in `selected` (comma-separated string of FDI numbers
 * or quadrant codes like UR1..LL8). Renders compactly so multiple charts fit on a page.
 */
export function ToothChartMini({ selected }: { selected: string | null | undefined }) {
  const set = new Set(
    (selected ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  // Quadrant code mapping to FDI for highlighting
  const quadToFdi: Record<string, number> = {
    UR1: 11, UR2: 12, UR3: 13, UR4: 14, UR5: 15, UR6: 16, UR7: 17, UR8: 18,
    UL1: 21, UL2: 22, UL3: 23, UL4: 24, UL5: 25, UL6: 26, UL7: 27, UL8: 28,
    LL1: 31, LL2: 32, LL3: 33, LL4: 34, LL5: 35, LL6: 36, LL7: 37, LL8: 38,
    LR1: 41, LR2: 42, LR3: 43, LR4: 44, LR5: 45, LR6: 46, LR7: 47, LR8: 48,
  };
  const normalized = new Set<number>();
  set.forEach((s) => {
    const n = Number(s);
    if (!isNaN(n)) normalized.add(n);
    else if (quadToFdi[s]) normalized.add(quadToFdi[s]);
  });

  const Tooth = ({ n }: { n: number }) => {
    const isOn = normalized.has(n);
    return (
      <div
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-sm border text-[7px] font-semibold leading-none",
          isOn
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground/40",
        )}
      >
        {n}
      </div>
    );
  };

  return (
    <div dir="ltr" className="inline-block space-y-0.5 rounded border bg-muted/20 p-1">
      <div className="flex gap-px">
        {FDI.upperRight.map((n) => <Tooth key={n} n={n} />)}
        <div className="mx-px w-px bg-border" />
        {FDI.upperLeft.map((n) => <Tooth key={n} n={n} />)}
      </div>
      <div className="flex gap-px">
        {FDI.lowerRight.map((n) => <Tooth key={n} n={n} />)}
        <div className="mx-px w-px bg-border" />
        {FDI.lowerLeft.map((n) => <Tooth key={n} n={n} />)}
      </div>
    </div>
  );
}
