import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer, FileDown, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { QuadrantsView } from "@/components/QuadrantsView";
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
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

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
        .select("id, case_number, date_received, date_delivered, tooth_numbers, units, shade, price, status, patients(name), work_types(name)")
        .eq("doctor_id", doctorId)
        .eq("status", "delivered")
        .gte("date_delivered", periodStart.toISOString())
        .lt("date_delivered", periodEnd.toISOString())
        .order("date_delivered");
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
  const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);
  const months = [
    "يناير","فبراير","مارس","إبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">الفواتير الشهرية</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إنشاء وطباعة الفواتير لكل طبيب</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!doctorId || !lab}
            className="rounded-xl gap-2"
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
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button
            disabled={!doctorId || !lab}
            className="rounded-xl gap-2"
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
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-xs print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">الطبيب</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.governorate ? ` — ${d.governorate}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">الشهر</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">السنة</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!doctorId && (
        <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-12 text-center print:hidden">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">اختر طبيبًا لعرض فاتورته الشهرية</p>
        </div>
      )}

      {doctorId && doctor && (
        <>
          {/* Summary KPIs */}
          {cases && cases.length > 0 && (
            <div className="grid grid-cols-3 gap-3 print:hidden">
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="size-4" />
                  </div>
                  <span className="text-xs text-muted-foreground">عدد الحالات</span>
                </div>
                <p className="text-2xl font-medium tabular-nums">{fmtNum(cases.length)}</p>
              </div>
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                  <span className="text-xs text-muted-foreground">إجمالي الشهر</span>
                </div>
                <p className="text-2xl font-medium tabular-nums">{fmtNum(totals.itemsTotal)}</p>
              </div>
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                    <Calendar className="size-4" />
                  </div>
                  <span className="text-xs text-muted-foreground">الفترة</span>
                </div>
                <p className="text-lg font-medium">{months[month - 1]} {year}</p>
              </div>
            </div>
          )}

          {/* Invoice Table */}
          <div id="invoice-print" className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden print:border-0 print:shadow-none">
            {/* Invoice header */}
            <div className="border-b border-border/40 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">فاتورة شهرية</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{monthName}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{doctor.name}</p>
                  {doctor.governorate && <p className="text-xs text-muted-foreground">{doctor.governorate}</p>}
                  {doctor.phone && <p className="text-xs text-muted-foreground" dir="ltr">{doctor.phone}</p>}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3 text-right">رقم</th>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">المريض</th>
                    <th className="p-3 text-right">نوع العمل</th>
                    <th className="p-3 text-right">اللون</th>
                    <th className="p-3 text-right">الوحدات</th>
                    <th className="p-3 text-center">الأسنان</th>
                    <th className="p-3 text-left">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {cases?.length === 0 && (
                    <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">لا توجد حالات لهذا الشهر</td></tr>
                  )}
                  {cases?.map((c) => (
                    <tr key={c.id} className="border-t border-border/40 align-middle hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-xs">{c.case_number}</td>
                      <td className="p-3 text-xs text-muted-foreground">{format(new Date(c.date_received), "dd/MM")}</td>
                      <td className="p-3">{(c as any).patients?.name ?? "—"}</td>
                      <td className="p-3">{(c as any).work_types?.name ?? "—"}</td>
                      <td className="p-3">{c.shade ?? "—"}</td>
                      <td className="p-3 tabular-nums">{c.units ?? 1}</td>
                      <td className="p-3 text-center"><div className="flex justify-center"><QuadrantsView selected={c.tooth_numbers} compact /></div></td>
                      <td className="p-3 text-left font-mono tabular-nums font-medium">{Number(c.price ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {!!cases?.length && (
                  <tfoot>
                    <tr className="border-t border-border/40 bg-muted/20">
                      <td colSpan={7} className="p-3 text-right font-medium text-sm">إجمالي حالات الشهر</td>
                      <td className="p-3 text-left font-mono font-semibold tabular-nums">{totals.itemsTotal.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-muted/10">
                      <td colSpan={7} className="p-3 text-right text-sm text-muted-foreground">رصيد أول المدة</td>
                      <td className="p-3 text-left font-mono tabular-nums text-muted-foreground">{totals.opening.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t-2 border-primary/20 bg-primary/5">
                      <td colSpan={7} className="p-3 text-right text-base font-semibold text-primary">الإجمالي المستحق</td>
                      <td className="p-3 text-left font-mono text-base font-bold text-primary tabular-nums">{totals.grand.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
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
