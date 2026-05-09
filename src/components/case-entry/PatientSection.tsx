import { type ChangeEvent } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronsUpDown, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatArabicDate } from "./utils";
import type { CaseEntryFormApi } from "./useCaseEntryForm";

export function PatientSection({ api }: { api: CaseEntryFormApi }) {
  const {
    mode,
    form,
    setForm,
    firstFieldRef,
    doctors,
    selectedDoctor,
    doctorPickerOpen,
    setDoctorPickerOpen,
    dueAuto,
    setDueAuto,
    predictedDate,
    baseLeadDays,
    extraDays,
    predictedDays,
  } = api;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <User className="h-4 w-4" /> بيانات أساسية
      </h2>
      <div className="space-y-3">
        {mode === "admin" && (
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              الطبيب <span className="text-destructive">*</span>
            </Label>
            <Popover open={doctorPickerOpen} onOpenChange={setDoctorPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={doctorPickerOpen}
                  className={cn(
                    "h-11 w-full justify-between rounded-lg font-normal",
                    !selectedDoctor && "text-muted-foreground",
                  )}
                >
                  {selectedDoctor
                    ? `${selectedDoctor.name}${selectedDoctor.governorate ? ` — ${selectedDoctor.governorate}` : ""}`
                    : "ابحث عن طبيب..."}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) => {
                    const v = value.toLowerCase();
                    const s = search.toLowerCase().trim();
                    if (!s) return 1;
                    return v.includes(s) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="ابحث بالاسم أو المحافظة..." className="h-10" />
                  <CommandList>
                    <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                    <CommandGroup>
                      {doctors?.map((d) => {
                        const searchValue = `${d.name} ${d.governorate ?? ""}`.trim();
                        return (
                          <CommandItem
                            key={d.id}
                            value={searchValue}
                            onSelect={() => {
                              setForm({ ...form, doctor_id: d.id, clinic_id: "" });
                              setDoctorPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                form.doctor_id === d.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="flex-1">{d.name}</span>
                            {d.governorate && (
                              <span className="text-xs text-muted-foreground">{d.governorate}</span>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {selectedDoctor?.doctor_clinics && selectedDoctor.doctor_clinics.length > 0 && (
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">العيادة</Label>
            <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder="اختر العيادة" />
              </SelectTrigger>
              <SelectContent>
                {selectedDoctor.doctor_clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label className="mb-1.5 block text-xs font-semibold">اسم المريض</Label>
          <Input
            ref={firstFieldRef}
            className="h-11 rounded-lg"
            value={form.patient_name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, patient_name: e.target.value })
            }
            placeholder="اكتب اسم المريض"
            autoComplete="off"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs font-semibold">تاريخ التسليم المتوقع</Label>
            {dueAuto && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                <Sparkles className="h-3 w-3" /> توقع تلقائي
              </span>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-between rounded-lg px-3 text-start text-sm font-normal"
              >
                <span className={form.due_date ? "" : "text-muted-foreground"}>
                  {formatArabicDate(form.due_date)}
                </span>
                <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0" dir="rtl">
              <DateCalendar
                mode="single"
                selected={form.due_date ? new Date(`${form.due_date}T00:00:00`) : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  setDueAuto(false);
                  setForm({ ...form, due_date: format(date, "yyyy-MM-dd") });
                }}
              />
            </PopoverContent>
          </Popover>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            تقدير: {baseLeadDays} يوم + حجم العمل (+{extraDays}) ={" "}
            <span className="font-bold text-foreground">{predictedDays} يوم</span>
          </p>
          {!dueAuto && (
            <button
              type="button"
              onClick={() => {
                setDueAuto(true);
                setForm({ ...form, due_date: predictedDate });
              }}
              className="mt-1 text-[11px] font-medium text-primary hover:underline"
            >
              ↺ العودة للتوقع التلقائي
            </button>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-semibold">ملاحظات</Label>
          <Textarea
            className="min-h-24 rounded-lg"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="ملاحظات الطبيب أو تعليمات خاصة..."
          />
        </div>
      </div>
    </div>
  );
}
