import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type System = "FDI" | "Universal" | "Quadrant";

// FDI: full numbers (e.g. 18, 11, 21, 28)
const FDI = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

// Universal 1-32
const UNIV = {
  upperRight: [1, 2, 3, 4, 5, 6, 7, 8],
  upperLeft: [9, 10, 11, 12, 13, 14, 15, 16],
  lowerLeft: [17, 18, 19, 20, 21, 22, 23, 24],
  lowerRight: [32, 31, 30, 29, 28, 27, 26, 25],
};

// Quadrant: each quadrant numbered 1-8 from midline outward
// We store with quadrant prefix to keep uniqueness: UR1..UR8, UL1..UL8, LR1..LR8, LL1..LL8
// But display only the number 1-8.
const QUAD = {
  upperRight: ["UR8", "UR7", "UR6", "UR5", "UR4", "UR3", "UR2", "UR1"],
  upperLeft: ["UL1", "UL2", "UL3", "UL4", "UL5", "UL6", "UL7", "UL8"],
  lowerRight: ["LR8", "LR7", "LR6", "LR5", "LR4", "LR3", "LR2", "LR1"],
  lowerLeft: ["LL1", "LL2", "LL3", "LL4", "LL5", "LL6", "LL7", "LL8"],
};

export interface ToothChartProps {
  value: string;
  onChange: (value: string) => void;
}

function parseSelected(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function ToothChart({ value, onChange }: ToothChartProps) {
  const [system, setSystem] = useState<System>("Quadrant");
  const selected = useMemo(() => parseSelected(value), [value]);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const arr = Array.from(next);
    // Sort numerically for FDI/Universal, alphabetically for Quadrant codes
    arr.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    onChange(arr.join(", "));
  };

  const clear = () => onChange("");

  const rows = system === "FDI" ? FDI : system === "Universal" ? UNIV : QUAD;

  const setSelection = (keys: (string | number)[]) => {
    const arr = keys.map(String);
    arr.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    onChange(arr.join(", "));
  };

  const selectAllUpper = () => setSelection([...rows.upperRight, ...rows.upperLeft]);
  const selectAllLower = () => setSelection([...rows.lowerRight, ...rows.lowerLeft]);
  const selectAll = () =>
    setSelection([
      ...rows.upperRight,
      ...rows.upperLeft,
      ...rows.lowerRight,
      ...rows.lowerLeft,
    ]);

  const Tooth = ({ value: v }: { value: string | number }) => {
    const key = String(v);
    const isOn = selected.has(key);
    // For Quadrant display, strip the prefix (UR/UL/LR/LL)
    const display = system === "Quadrant" ? key.replace(/^(UR|UL|LR|LL)/, "") : key;
    return (
      <button
        type="button"
        onClick={() => toggle(key)}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors sm:h-9 sm:w-9 sm:text-xs sm:font-semibold",
          isOn
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:bg-accent",
        )}
      >
        {display}
      </button>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-2 sm:p-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-2" dir="rtl">
        <div className="flex flex-wrap gap-1">
          {(["FDI", "Universal", "Quadrant"] as System[]).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={system === s ? "default" : "outline"}
              onClick={() => setSystem(s)}
              className="h-7 px-2 text-xs sm:h-8 sm:px-3"
            >
              {s === "Quadrant" ? "ربع (1-8)" : s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selected.size} مختار</span>
          {selected.size > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={clear} className="h-7 px-2 text-xs">
              مسح
            </Button>
          )}
        </div>
      </div>

      {/* Quick-select buttons */}
      <div className="flex flex-wrap gap-1" dir="rtl">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={selectAllUpper}
          className="h-7 px-2 text-xs"
        >
          فك علوي كامل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={selectAllLower}
          className="h-7 px-2 text-xs"
        >
          فك سفلي كامل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={selectAll}
          className="h-7 px-2 text-xs"
        >
          كل الأسنان
        </Button>
      </div>

      {/* Upper jaw */}
      <div className="space-y-1">
        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Upper</p>
        <div className="flex justify-center gap-0.5 sm:gap-1">
          {rows.upperRight.map((n) => <Tooth key={String(n)} value={n} />)}
          <div className="mx-px w-px bg-border sm:mx-1" />
          {rows.upperLeft.map((n) => <Tooth key={String(n)} value={n} />)}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Lower jaw */}
      <div className="space-y-1">
        <div className="flex justify-center gap-px sm:gap-1">
          {rows.lowerRight.map((n) => <Tooth key={String(n)} value={n} />)}
          <div className="mx-px w-px bg-border sm:mx-1" />
          {rows.lowerLeft.map((n) => <Tooth key={String(n)} value={n} />)}
        </div>
        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Lower</p>
      </div>
    </div>
  );
}
