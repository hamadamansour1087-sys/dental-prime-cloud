import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/statements")({
  component: StatementsPage,
});

function StatementsPage() {
  const { labId } = useAuth();
  const [doctorId, setDoctorId] = useState<string>("");
  const [from, setFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 5)));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));

  const { data: doctors } = useQuery({
    queryKey: ["doctors-statements", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("doctors").select("id, name, governorate, opening_balance, phone").eq("is_active", true).order("name")).data ?? [],
  });
  const doctor = doctors?.find((d) => d.id === doctorId);

  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");

  const { data: cases } = useQuery({
    queryKey: ["statement-cases", labId, doctorId, fromStr, toStr],
    enabled: !!labId && !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, date_received, price, status")
        .eq("doctor_id", doctorId)
        .gte("date_received", fromStr)
        .lte("date_received", toStr)
        .neq("status", "cancelled")
        .order("date_received");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group cases by month
  const monthly = useMemo(() => {
    const map = new Map<string, { year: number; month: number; total: number; count: number }>();
    (cases ?? []).forEach((c) => {
      const d = new Date(c.date_received);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { year: d.getFullYear(), month: d.getMonth() + 1, total: 0, count: 0 };
      cur.total += Number(c.price ?? 0);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }));
  }, [cases]);

  const opening = Number(doctor?.opening_balance ?? 0);
  const periodTotal = monthly.reduce((s, m) => s + m.total, 0);
  const grand = opening + periodTotal;

  // Cumulative running balance starting from opening
  let running = opening;
  const rows = monthly.map((m) => {
    running += m.total;
    return { ...m, cumulative: running };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold">كشف حساب الطبيب</h1>
        <Button onClick={() => window.print()} disabled={!doctorId}>
          <Printer className="ml-1 h-4 w-4" /> طباعة
        </Button>
      </div>

      <Card className="print:hidden">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label>الطبيب</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.governorate ? ` — ${d.governorate}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>من تاريخ</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !from && "text-muted-foreground")}>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {from ? format(from, "dd/MM/yyyy") : "اختر تاريخ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={from} onSelect={(d) => d && setFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !to && "text-muted-foreground")}>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {to ? format(to, "dd/MM/yyyy") : "اختر تاريخ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={to} onSelect={(d) => d && setTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {!doctorId && (
        <p className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground print:hidden">
          اختر طبيبًا لعرض كشف الحساب
        </p>
      )}

      {doctorId && doctor && (
        <Card id="statement-print" className="print:border-0 print:shadow-none">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">كشف حساب</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  من {format(from, "dd/MM/yyyy")} إلى {format(to, "dd/MM/yyyy")}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{doctor.name}</p>
                {doctor.governorate && <p className="text-muted-foreground">{doctor.governorate}</p>}
                {doctor.phone && <p className="text-muted-foreground" dir="ltr">{doctor.phone}</p>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="p-2 text-right">الشهر</th>
                    <th className="p-2 text-right">عدد الحالات</th>
                    <th className="p-2 text-left">إجمالي الشهر</th>
                    <th className="p-2 text-left">الرصيد المتراكم</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t bg-muted/20">
                    <td className="p-2 font-medium">رصيد أول المدة</td>
                    <td className="p-2">—</td>
                    <td className="p-2 text-left font-mono">—</td>
                    <td className="p-2 text-left font-mono font-semibold">{opening.toFixed(2)}</td>
                  </tr>
                  {rows.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد حالات في هذه الفترة</td></tr>
                  )}
                  {rows.map((r) => {
                    const monthDate = new Date(r.year, r.month - 1, 1);
                    return (
                      <tr key={r.key} className="border-t">
                        <td className="p-2">{format(monthDate, "MMMM yyyy")}</td>
                        <td className="p-2">{r.count}</td>
                        <td className="p-2 text-left font-mono">{r.total.toFixed(2)}</td>
                        <td className="p-2 text-left font-mono font-semibold">{r.cumulative.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 text-sm">
                  <tr className="border-t">
                    <td className="p-2 text-right font-semibold">إجمالي الفترة</td>
                    <td className="p-2">{(cases ?? []).length}</td>
                    <td className="p-2 text-left font-mono font-semibold">{periodTotal.toFixed(2)}</td>
                    <td className="p-2"></td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={3} className="p-2 text-right text-base font-bold text-primary">الإجمالي المستحق</td>
                    <td className="p-2 text-left font-mono text-base font-bold text-primary">{grand.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #statement-print, #statement-print * { visibility: visible; }
          #statement-print { position: absolute; inset: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
