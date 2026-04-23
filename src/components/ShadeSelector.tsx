import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Predefined shade palettes (VITA Classical + Bleach + 3D Master common)
const SHADE_GROUPS: { label: string; shades: { code: string; hex: string }[] }[] = [
  {
    label: "VITA Classical",
    shades: [
      { code: "A1", hex: "#F5E6C8" },
      { code: "A2", hex: "#EED8AE" },
      { code: "A3", hex: "#E5C893" },
      { code: "A3.5", hex: "#DDB877" },
      { code: "A4", hex: "#C9A05C" },
      { code: "B1", hex: "#F4E4C0" },
      { code: "B2", hex: "#EAD3A0" },
      { code: "B3", hex: "#DCBE82" },
      { code: "B4", hex: "#C9A767" },
      { code: "C1", hex: "#E8DAB8" },
      { code: "C2", hex: "#D8C396" },
      { code: "C3", hex: "#C2A878" },
      { code: "C4", hex: "#A88B5E" },
      { code: "D2", hex: "#E2D0A6" },
      { code: "D3", hex: "#CFB988" },
      { code: "D4", hex: "#B89D6E" },
    ],
  },
  {
    label: "Bleach",
    shades: [
      { code: "BL1", hex: "#FDFBF1" },
      { code: "BL2", hex: "#FAF5E2" },
      { code: "BL3", hex: "#F7EFD3" },
      { code: "BL4", hex: "#F3E9C5" },
    ],
  },
];

const ALL_SHADES = SHADE_GROUPS.flatMap((g) => g.shades);

function shadeHex(code: string): string {
  return ALL_SHADES.find((s) => s.code.toLowerCase() === code.toLowerCase())?.hex ?? "#E5E7EB";
}

interface Props {
  value: string; // comma-separated
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ShadeSelector({ value, onChange, placeholder = "اختر اللون" }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const selected = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const toggle = (code: string) => {
    const has = selected.some((s) => s.toLowerCase() === code.toLowerCase());
    const next = has ? selected.filter((s) => s.toLowerCase() !== code.toLowerCase()) : [...selected, code];
    onChange(next.join(", "));
  };

  const remove = (code: string) => {
    onChange(selected.filter((s) => s !== code).join(", "));
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.some((s) => s.toLowerCase() === v.toLowerCase())) {
      onChange([...selected, v].join(", "));
    }
    setCustom("");
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start font-normal"
          >
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="text-xs">
                {selected.length} لون{selected.length > 1 ? " مختار" : ""}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="start">
          <div className="space-y-3">
            {SHADE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {group.shades.map((s) => {
                    const isSel = selected.some((x) => x.toLowerCase() === s.code.toLowerCase());
                    return (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => toggle(s.code)}
                        className={cn(
                          "relative flex h-12 flex-col items-center justify-center rounded-md border-2 text-[10px] font-bold transition-all",
                          isSel ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                        )}
                        style={{ backgroundColor: s.hex, color: "#3a2a14" }}
                      >
                        {s.code}
                        {isSel && (
                          <Check className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-primary p-0.5 text-primary-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                لون مخصص
              </p>
              <div className="flex gap-1">
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="مثال: OM3"
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" onClick={addCustom} className="h-8 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: shadeHex(code) }}
            >
              <span style={{ color: "#3a2a14" }}>{code}</span>
              <button
                type="button"
                onClick={() => remove(code)}
                className="rounded-full hover:bg-black/10"
              >
                <X className="h-3 w-3" style={{ color: "#3a2a14" }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
