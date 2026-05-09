import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToothChart } from "@/components/ToothChart";
import { ShadeSelector } from "@/components/ShadeSelector";
import type { CaseEntryFormApi } from "./useCaseEntryForm";
import type { CaseEntryItem, WorkTypeOption } from "./types";

// Materials sub-row: work type + shade
function MaterialsRow({
  item,
  workTypes,
  onWorkTypeChange,
  updateItem,
}: {
  item: CaseEntryItem;
  workTypes: WorkTypeOption[] | undefined;
  onWorkTypeChange: (id: string, workTypeId: string) => void;
  updateItem: (id: string, patch: Partial<CaseEntryItem>) => void;
}) {
  return (
    <>
      <div className="sm:col-span-2">
        <Label className="mb-1 block text-[11px] font-semibold">
          نوع العمل <span className="text-destructive">*</span>
        </Label>
        <Select value={item.work_type_id} onValueChange={(v) => onWorkTypeChange(item.id, v)}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="اختر النوع" />
          </SelectTrigger>
          <SelectContent>
            {workTypes?.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1 block text-[11px] font-semibold">اللون (Shade)</Label>
        <ShadeSelector value={item.shade} onChange={(v) => updateItem(item.id, { shade: v })} />
      </div>
    </>
  );
}

// Teeth sub-row: tooth chart + auto units
function TeethRow({
  item,
  updateItem,
}: {
  item: CaseEntryItem;
  updateItem: (id: string, patch: Partial<CaseEntryItem>) => void;
}) {
  return (
    <>
      <div className="sm:col-span-2">
        <Label className="mb-1 block text-[11px] font-semibold">الأسنان</Label>
        <ToothChart
          value={item.tooth_numbers}
          onChange={(v) => {
            const count = v.split(",").map((s) => s.trim()).filter(Boolean).length;
            updateItem(item.id, { tooth_numbers: v, units: String(Math.max(count, 1)) });
          }}
        />
      </div>
      <div>
        <Label className="mb-1 block text-[11px] font-semibold">الوحدات</Label>
        <Input
          type="number"
          min="1"
          value={item.units}
          readOnly
          className="h-10 bg-muted/50 font-mono text-center font-bold"
        />
      </div>
    </>
  );
}

export function WorkItemsSection({ api }: { api: CaseEntryFormApi }) {
  const {
    items,
    addItem,
    removeItem,
    updateItem,
    onWorkTypeChange,
    workTypes,
    noDiagnosis,
    setNoDiagnosis,
  } = api;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Briefcase className="h-4 w-4" /> عناصر العمل
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
            {items.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={noDiagnosis ? "default" : "outline"}
            onClick={() => setNoDiagnosis((v) => !v)}
            className="h-8"
            title="حفظ الحالة بدون تحديد نوع/أسنان — يتم التذكير لاحقًا"
          >
            {noDiagnosis ? "✓ بدون تشخيص" : "بدون تشخيص"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8">
            <Plus className="ml-1 h-3.5 w-3.5" /> عنصر
          </Button>
        </div>
      </div>

      {noDiagnosis && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠️ سيتم حفظ الحالة بدون نوع عمل أو أسنان. تذكّر إكمال البيانات لاحقًا من صفحة الحالة.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.id} className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                عنصر #{idx + 1}
              </span>
              {items.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => removeItem(it.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MaterialsRow
                item={it}
                workTypes={workTypes}
                onWorkTypeChange={onWorkTypeChange}
                updateItem={updateItem}
              />
              <TeethRow item={it} updateItem={updateItem} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
