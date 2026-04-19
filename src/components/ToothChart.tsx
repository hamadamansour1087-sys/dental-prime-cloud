import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// FDI numbering: quadrants 1-4 (adult permanent)
// Q1: upper-right 18-11 | Q2: upper-left 21-28
// Q4: lower-right 48-41 | Q3: lower-left 31-38
const FDI = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

// Universal numbering 1-32
// Upper: 1 (upper-right 3rd molar) → 16 (upper-left 3rd molar)
// Lower: 17 (lower-left 3rd molar) → 32 (lower-right 3rd molar)
const UNIV = {
  upperRight: [1, 2, 3, 4, 5, 6, 7, 8],
  upperLeft: [9, 10, 11, 12, 13, 14, 15, 16],
  lowerLeft: [17, 18, 19, 20, 21, 22, 23, 24],
  lowerRight: [32, 31, 30, 29, 28, 27, 26, 25],
};

type System = "FDI" | "Universal";

export interface ToothChartProps {
  value: string; // comma-separated tooth numbers
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
  const [system, setSystem] = useState<System>("FDI");
  const selected = useMemo(() => parseSelected(value), [value]);

  const toggle = (n: number) => {
    const key = String(n);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(
      Array.from(next)
        .sort((a, b) => Number(a) - Number(b))
        .join(", "),
    );
  };

  const clear = () => onChange("");

  const rows = system === "FDI" ? FDI : UNIV;

  const Tooth = ({ n }: { n: number }) => {
    const isOn = selected.has(String(n));
    return (
      <button
        type="button"
        onClick={() => toggle(n)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
          isOn
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:bg-accent",
        )}
      >
        {n}
      </button>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3" dir="ltr">
      <div className="flex items-center justify-between" dir="rtl">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={system === "FDI" ? "default" : "outline"}
            onClick={() => setSystem("FDI")}
          >
            FDI
          </Button>
          <Button
            type="button"
            size="sm"
            variant={system === "Universal" ? "default" : "outline"}
            onClick={() => setSystem("Universal")}
          >
            Universal
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selected.size} مختار</span>
          {selected.size > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              مسح
            </Button>
          )}
        </div>
      </div>

      {/* Upper jaw */}
      <div className="space-y-1">
        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Upper</p>
        <div className="flex justify-center gap-1">
          {rows.upperRight.map((n) => <Tooth key={n} n={n} />)}
          <div className="mx-1 w-px bg-border" />
          {rows.upperLeft.map((n) => <Tooth key={n} n={n} />)}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Lower jaw */}
      <div className="space-y-1">
        <div className="flex justify-center gap-1">
          {rows.lowerRight.map((n) => <Tooth key={n} n={n} />)}
          <div className="mx-1 w-px bg-border" />
          {rows.lowerLeft.map((n) => <Tooth key={n} n={n} />)}
        </div>
        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">Lower</p>
      </div>
    </div>
  );
}
