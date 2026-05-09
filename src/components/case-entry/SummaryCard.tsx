import { Keyboard } from "lucide-react";
import type { CaseEntryFormApi } from "./useCaseEntryForm";

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold">{k}</kbd>
    </div>
  );
}

// Acts as PricingSection — shows totals (items, units, files).
export function SummaryCard({ api }: { api: CaseEntryFormApi }) {
  const { validItemsCount, totalUnits, files, existingAttachments, mode } = api;
  const allFilesCount = existingAttachments.length + files.length;

  return (
    <>
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 shadow-xs">
        <h3 className="mb-2 text-xs font-bold text-muted-foreground">ملخص</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-black text-primary">{validItemsCount}</div>
            <div className="text-[10px] text-muted-foreground">عناصر</div>
          </div>
          <div>
            <div className="text-2xl font-black text-primary">{totalUnits}</div>
            <div className="text-[10px] text-muted-foreground">وحدات</div>
          </div>
          <div>
            <div className="text-2xl font-black text-primary">{allFilesCount}</div>
            <div className="text-[10px] text-muted-foreground">ملفات</div>
          </div>
        </div>
      </div>

      <div className="hidden rounded-xl border bg-muted/20 p-3 lg:block">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" /> اختصارات
        </h3>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <Shortcut k="Ctrl+S" label="حفظ" />
          <Shortcut k="Ctrl+Enter" label="حفظ + حالة جديدة" />
          {mode === "admin" && <Shortcut k="Ctrl+P" label="حفظ + طباعة" />}
          <Shortcut k="Esc" label="رجوع" />
        </div>
      </div>
    </>
  );
}
