import { Filter, FileSpreadsheet, FileText, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";
import type { CategoryRef, DateRange, DoctorRef, Preset, WorkTypeRef } from "./types";

interface Props {
  preset: Preset;
  onPresetChange: (p: Preset) => void;
  range: DateRange;
  setRange: (r: DateRange) => void;
  setPreset: (p: Preset) => void;
  doctorFilter: string;
  setDoctorFilter: (v: string) => void;
  workTypeFilter: string;
  setWorkTypeFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  governorateFilter: string;
  setGovernorateFilter: (v: string) => void;
  doctors: DoctorRef[];
  workTypes: WorkTypeRef[];
  categories: CategoryRef[];
  onRefresh: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onExcel: () => void;
}

const PRESETS: Array<[Preset, string]> = [
  ["today", "اليوم"],
  ["week", "آخر 7 أيام"],
  ["month", "هذا الشهر"],
  ["last_month", "الشهر الماضي"],
  ["ytd", "منذ بداية السنة"],
  ["custom", "مخصص"],
];

export function ReportsToolbar(props: Props) {
  const { preset, onPresetChange, range, setRange, setPreset } = props;
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">التقارير والتحليلات</h1>
          <p className="text-sm text-muted-foreground mt-1">تقارير شاملة عن الإنتاج والمالية مع فلاتر ذكية وتصدير احترافي</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={props.onRefresh}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button>
          <Button variant="outline" size="sm" onClick={props.onPrint}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
          <Button variant="outline" size="sm" onClick={props.onPdf}><FileText className="ml-2 h-4 w-4" />PDF</Button>
          <Button size="sm" onClick={props.onExcel}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" />فلاتر ذكية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([k, label]) => (
              <Button key={k} size="sm" variant={preset === k ? "default" : "outline"} onClick={() => onPresetChange(k)}>{label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <DatePickerInput value={range.from} onChange={(v: string) => { setRange({ ...range, from: v }); setPreset("custom"); }} placeholder="من تاريخ" className="w-full" />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <DatePickerInput value={range.to} onChange={(v: string) => { setRange({ ...range, to: v }); setPreset("custom"); }} placeholder="إلى تاريخ" className="w-full" />
            </div>
            <div>
              <Label className="text-xs">الطبيب</Label>
              <Select value={props.doctorFilter} onValueChange={props.setDoctorFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأطباء</SelectItem>
                  {props.doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">نوع العمل</Label>
              <Select value={props.workTypeFilter} onValueChange={props.setWorkTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {props.workTypes.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الفئة</Label>
              <Select value={props.categoryFilter} onValueChange={props.setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {props.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">المحافظة</Label>
              <Select value={props.governorateFilter} onValueChange={props.setGovernorateFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المحافظات</SelectItem>
                  {EGYPT_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
