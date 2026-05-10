import { Search } from "lucide-react";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import type { CaseStage } from "./types";

export type CasesView = "table" | "kanban";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  stageFilter: string;
  onStageFilterChange: (v: string) => void;
  dateFilter: string;
  onDateFilterChange: (v: string) => void;
  stages: CaseStage[] | undefined;
  count: number;
  view: CasesView;
  onViewChange: (v: CasesView) => void;
}

export function CasesToolbar({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  dateFilter,
  onDateFilterChange,
  stages,
  count,
  view,
  onViewChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card border border-border/60 p-2.5 shadow-xs">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث برقم الحالة، الطبيب، المريض، نوع العمل..."
          className="pr-9 border-0 bg-muted/50 rounded-xl focus-visible:ring-1"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={stageFilter} onValueChange={onStageFilterChange}>
        <SelectTrigger className="w-[180px] rounded-xl border-border/60">
          <SelectValue placeholder="كل المراحل" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل المراحل</SelectItem>
          {stages?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DatePickerInput
        value={dateFilter}
        onChange={onDateFilterChange}
        placeholder="فلتر التاريخ"
        title="تصفية حسب تاريخ دخول المرحلة الحالية"
        className="w-[200px] rounded-xl"
      />
      <span className="text-xs text-muted-foreground tabular-nums bg-muted/50 px-2.5 py-1 rounded-lg">
        {count} حالة
      </span>
      <div className="ms-auto flex gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-0.5">
        <Button
          size="sm"
          variant={view === "table" ? "default" : "ghost"}
          onClick={() => onViewChange("table")}
          className="h-8 rounded-lg gap-1.5"
        >
          <TableIcon className="h-3.5 w-3.5" /> جدول
        </Button>
        <Button
          size="sm"
          variant={view === "kanban" ? "default" : "ghost"}
          onClick={() => onViewChange("kanban")}
          className="h-8 rounded-lg gap-1.5"
        >
          <LayoutGrid className="h-3.5 w-3.5" /> بطاقات
        </Button>
      </div>
    </div>
  );
}
