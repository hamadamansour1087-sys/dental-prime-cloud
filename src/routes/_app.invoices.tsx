import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ToothChartMini } from "@/components/ToothChartMini";
import { InvoiceReport } from "@/components/reports/InvoiceReport";
import { renderReportToPdf } from "@/lib/reportRenderer";
import { printReactElement } from "@/lib/print";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { labId } = useAuth();
  const today = new Date();
  const [doctorId, setDoctorId] = useState<string>("");
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1); // 1-12

  const { data: lab } = useQuery({
    queryKey: ["lab-info", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("labs").select("name, phone, address, email, logo_url, currency").eq("id", labId!).maybeSingle()).data,
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-invoices", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("doctors").select("id, name, governorate, opening_balance, phone, clinic_name").eq("is_active", true).order("name")).data ?? [],
  });

  const doctor = doctors?.find((d) => d.id === doctorId);

  const periodStart = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const periodEnd = useMemo(() => new Date(year, month, 1), [year, month]);

  const { data: cases } = useQuery({
    queryKey: ["invoice-cases", labId, doctorId, year, month],
    enabled: !!labId && !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, date_received, tooth_numbers, units, shade, price, status, patients(name), work_types(name)")
        .eq("doctor_id", doctorId)
        .gte("date_received", periodStart.toISOString().slice(0, 10))
        .lt("date_received", periodEnd.toISOString().slice(0, 10))
        .neq("status", "cancelled")
        .order("date_received");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const itemsTotal = (cases ?? []).reduce((sum, c) => sum + Number(c.price ?? 0), 0);
    const opening = Number(doctor?.opening_balance ?? 0);
    return { itemsTotal, opening, grand: opening + itemsTotal };
  }, [cases, doctor]);

  const monthName = format(periodStart, "MMMM yyyy");

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);
  const months = [
    "يناير","فبراير","مارس","إبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold">الفواتير الشهرية</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!doctorId || !lab}
            onClick={async () => {
              if (!lab || !doctor) return;
              try {
                toast.loading("جاري إنشاء PDF...", { id: "pdf" });
                await renderReportToPdf(
                  <InvoiceReport
                    lab={lab}
                    doctor={doctor}
                    cases={cases ?? []}
                    periodLabel={`${months[month - 1]} ${year}`}
                    invoiceNo={`INV-${year}-${String(month).padStart(2, "0")}-${doctor.name?.slice(0, 3).toUpperCase() ?? "DOC"}`}
                  />,
                  `invoice-${doctor.name}-${year}-${String(month).padStart(2, "0")}.pdf`
                );
                toast.success("تم إنشاء PDF", { id: "pdf" });
              } catch (e: any) {
                toast.error(e?.message ?? "فشل إنشاء PDF", { id: "pdf" });
              }
            }}
          >
            <FileDown className="ml-1 h-4 w-4" /> PDF احترافي
          </Button>
          <Button
            disabled={!doctorId || !lab}
            onClick={async () => {
              if (!lab || !doctor) return;
              try {
                await printReactElement(
                  <InvoiceReport
                    lab={lab}
                    doctor={doctor}
                    cases={cases ?? []}
                    periodLabel={`${months[month - 1]} ${year}`}
                    invoiceNo={`INV-${year}-${String(month).padStart(2, "0")}-${doctor.name?.slice(0, 3).toUpperCase() ?? "DOC"}`}
                  />,
                  `فاتورة ${doctor.name} - ${months[month - 1]} ${year}`,
                );
              } catch (e) {
                const msg = e instanceof Error ? e.message : "فشل الطباعة";
                toast.error(msg);
              }
            }}
          >
            <Printer className="ml-1 h-4 w-4" /> طباعة
          </Button>
        </div>
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
            <Label>الشهر</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>السنة</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!doctorId && (
        <p className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground print:hidden">
          اختر طبيبًا لعرض فاتورته الشهرية
        </p>
      )}

      {doctorId && doctor && (
        <Card id="invoice-print" className="print:border-0 print:shadow-none">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">فاتورة شهرية</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{monthName}</p>
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
                    <th className="p-2 text-right">رقم</th>
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">المريض</th>
                    <th className="p-2 text-right">نوع العمل</th>
                    <th className="p-2 text-right">اللون</th>
                    <th className="p-2 text-right">الوحدات</th>
                    <th className="p-2 text-center">الأسنان</th>
                    <th className="p-2 text-left">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {cases?.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد حالات لهذا الشهر</td></tr>
                  )}
                  {cases?.map((c) => (
                    <tr key={c.id} className="border-t align-middle">
                      <td className="p-2 font-mono text-xs">{c.case_number}</td>
                      <td className="p-2 text-xs">{format(new Date(c.date_received), "dd/MM")}</td>
                      <td className="p-2">{(c as any).patients?.name ?? "—"}</td>
                      <td className="p-2">{(c as any).work_types?.name ?? "—"}</td>
                      <td className="p-2">{c.shade ?? "—"}</td>
                      <td className="p-2">{c.units ?? 1}</td>
                      <td className="p-2 text-center"><div className="flex justify-center"><ToothChartMini selected={c.tooth_numbers} /></div></td>
                      <td className="p-2 text-left font-mono">{Number(c.price ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {!!cases?.length && (
                  <tfoot className="bg-muted/30 text-sm">
                    <tr className="border-t">
                      <td colSpan={7} className="p-2 text-right font-semibold">إجمالي حالات الشهر</td>
                      <td className="p-2 text-left font-mono font-semibold">{totals.itemsTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="p-2 text-right">رصيد أول المدة</td>
                      <td className="p-2 text-left font-mono">{totals.opening.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t">
                      <td colSpan={7} className="p-2 text-right text-base font-bold text-primary">الإجمالي المستحق</td>
                      <td className="p-2 text-left font-mono text-base font-bold text-primary">{totals.grand.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: absolute; inset: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
