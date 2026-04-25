import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Printer, Trash2, FileDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { renderReportToPdf } from "@/lib/reportRenderer";
import { printReactElement } from "@/lib/print";
import { ReceiptVoucherDialog } from "@/components/ReceiptVoucherDialog";
import { StatementReport } from "@/components/reports/StatementReport";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_app/statements")({
  component: StatementsPage,
});

type RowKind = "opening" | "cases" | "payment";
interface Row {
  key: string;
  kind: RowKind;
  date: Date;
  label: string;
  debit: number; // increases what doctor owes (cases)
  credit: number; // decreases what doctor owes (payments)
  cumulative: number;
  paymentId?: string;
}

// Print helper now lives in src/lib/print.ts (printElement)

function StatementsPage() {
  const { labId, hasRole } = useAuth();
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState<string>("");
  const [from, setFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 5)));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    method: "cash",
    reference: "",
    notes: "",
  });

  const { data: lab } = useQuery({
    queryKey: ["lab-info", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("labs").select("name, phone, address, logo_url, currency").eq("id", labId!).maybeSingle()).data,
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-statements", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("doctors").select("id, name, governorate, opening_balance, phone, clinic_name").eq("is_active", true).order("name")).data ?? [],
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
        .select("id, case_number, date_received, price, status, notes, tooth_numbers, patients(name), work_types(name)")
        .eq("doctor_id", doctorId)
        .gte("date_received", fromStr)
        .lte("date_received", toStr)
        .neq("status", "cancelled")
        .order("date_received");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["statement-payments", labId, doctorId, fromStr, toStr],
    enabled: !!labId && !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, payment_date, amount, method, reference, notes")
        .eq("doctor_id", doctorId)
        .gte("payment_date", fromStr)
        .lte("payment_date", toStr)
        .order("payment_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build rows: opening + per-month cases totals + per-payment lines, sorted by date
  const { rows, totals } = useMemo(() => {
    const opening = Number(doctor?.opening_balance ?? 0);

    // Group cases by month
    const monthMap = new Map<string, { date: Date; total: number; count: number }>();
    (cases ?? []).forEach((c) => {
      const d = new Date(c.date_received);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = monthMap.get(key) ?? { date: new Date(d.getFullYear(), d.getMonth(), 1), total: 0, count: 0 };
      cur.total += Number(c.price ?? 0);
      cur.count += 1;
      monthMap.set(key, cur);
    });

    type Item = { kind: RowKind; date: Date; label: string; debit: number; credit: number; sortKey: string; paymentId?: string };
    const items: Item[] = [];

    // Cases per month — sort to end of month so payments within same month appear before next month's cases? 
    // Better: cases at start of month, payments at their actual date.
    monthMap.forEach((m, key) => {
      items.push({
        kind: "cases",
        date: m.date,
        label: `حالات ${format(m.date, "MMMM yyyy")} (${m.count})`,
        debit: m.total,
        credit: 0,
        sortKey: `${key}-0-cases`,
      });
    });

    (payments ?? []).forEach((p) => {
      const d = new Date(p.payment_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const methodLabel = p.method === "cash" ? "نقدي" : p.method === "transfer" ? "تحويل" : p.method === "cheque" ? "شيك" : (p.method ?? "دفعة");
      items.push({
        kind: "payment",
        date: d,
        label: `دفعة (${methodLabel})${p.reference ? ` — ${p.reference}` : ""}`,
        debit: 0,
        credit: Number(p.amount),
        sortKey: `${key}-1-${p.payment_date}-${p.id}`,
        paymentId: p.id,
      });
    });

    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let running = opening;
    const built: Row[] = [
      {
        key: "opening",
        kind: "opening",
        date: from,
        label: "رصيد أول المدة",
        debit: 0,
        credit: 0,
        cumulative: opening,
      },
    ];
    items.forEach((it, i) => {
      running += it.debit - it.credit;
      built.push({
        key: `${it.sortKey}-${i}`,
        kind: it.kind,
        date: it.date,
        label: it.label,
        debit: it.debit,
        credit: it.credit,
        cumulative: running,
        paymentId: it.paymentId,
      });
    });

    const totalDebit = items.reduce((s, i) => s + i.debit, 0);
    const totalCredit = items.reduce((s, i) => s + i.credit, 0);
    return {
      rows: built,
      totals: { opening, debit: totalDebit, credit: totalCredit, balance: opening + totalDebit - totalCredit },
    };
  }, [cases, payments, doctor, from]);

  const submitPayment = async () => {
    if (!labId || !doctorId) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) return toast.error("أدخل مبلغًا صحيحًا");
    const { error } = await supabase.from("payments").insert({
      lab_id: labId,
      doctor_id: doctorId,
      amount,
      payment_date: payForm.payment_date,
      method: payForm.method || null,
      reference: payForm.reference || null,
      notes: payForm.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الدفعة");
    setPayOpen(false);
    setPayForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), method: "cash", reference: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["statement-payments"] });
  };

  const deletePayment = async (id: string) => {
    if (!confirm("حذف هذه الدفعة؟")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["statement-payments"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold">كشف حساب الطبيب</h1>
        <div className="flex gap-2">
          <ReceiptVoucherDialog
            defaultDoctorId={doctorId || undefined}
            trigger={
              <Button variant="default">
                <Receipt className="ml-1 h-4 w-4" /> سند قبض
              </Button>
            }
          />
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!doctorId}>
                <Plus className="ml-1 h-4 w-4" /> دفعة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>تسجيل دفعة — {doctor?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>المبلغ *</Label>
                  <Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                </div>
                <div>
                  <Label>تاريخ الدفع</Label>
                  <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
                </div>
                <div>
                  <Label>طريقة الدفع</Label>
                  <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="transfer">تحويل</SelectItem>
                      <SelectItem value="cheque">شيك</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>مرجع / رقم العملية</Label>
                  <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={submitPayment}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            disabled={!doctorId || !lab || !doctor}
            onClick={async () => {
              if (!lab || !doctor) return;
              try {
                toast.loading("جاري إنشاء PDF...", { id: "statement-pdf" });
                const reportCases = (cases ?? []).map((c: any) => ({
                  id: c.id,
                  case_number: c.case_number,
                  date_received: c.date_received,
                  patient_name: c.patients?.name ?? null,
                  notes: c.notes,
                  work_type_name: c.work_types?.name ?? null,
                  tooth_numbers: c.tooth_numbers,
                  price: c.price,
                }));
                await renderReportToPdf(
                  <StatementReport
                    lab={lab}
                    doctor={doctor}
                    cases={reportCases}
                    payments={(payments ?? []) as any}
                    fromDate={from}
                    toDate={to}
                  />,
                  `statement-${doctor.name}-${fromStr}_${toStr}.pdf`,
                );
                toast.success("تم إنشاء PDF", { id: "statement-pdf" });
              } catch (error: any) {
                toast.error(error?.message ?? "فشل إنشاء PDF", { id: "statement-pdf" });
              }
            }}
          >
            <FileDown className="ml-1 h-4 w-4" /> PDF
          </Button>
          <Button
            disabled={!doctorId || !lab || !doctor}
            onClick={async () => {
              if (!lab || !doctor) return;
              try {
                const reportCases = (cases ?? []).map((c: any) => ({
                  id: c.id,
                  case_number: c.case_number,
                  date_received: c.date_received,
                  patient_name: c.patients?.name ?? null,
                  notes: c.notes,
                  work_type_name: c.work_types?.name ?? null,
                  tooth_numbers: c.tooth_numbers,
                  price: c.price,
                }));
                await printReactElement(
                  <StatementReport
                    lab={lab}
                    doctor={doctor}
                    cases={reportCases}
                    payments={(payments ?? []) as any}
                    fromDate={from}
                    toDate={to}
                  />,
                  `كشف حساب ${doctor.name}`,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "فشل الطباعة");
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
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">البيان</th>
                    <th className="p-2 text-left">مدين (له)</th>
                    <th className="p-2 text-left">دائن (دفعات)</th>
                    <th className="p-2 text-left">الرصيد</th>
                    <th className="p-2 text-center print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.key}
                      className={cn(
                        "border-t align-middle",
                        r.kind === "opening" && "bg-muted/20 font-medium",
                        r.kind === "payment" && "bg-emerald-500/5",
                      )}
                    >
                      <td className="p-2 text-xs">{r.kind === "opening" ? "—" : format(r.date, "dd/MM/yyyy")}</td>
                      <td className="p-2">{r.label}</td>
                      <td className="p-2 text-left font-mono">{r.debit > 0 ? r.debit.toFixed(2) : "—"}</td>
                      <td className="p-2 text-left font-mono text-emerald-700 dark:text-emerald-400">{r.credit > 0 ? r.credit.toFixed(2) : "—"}</td>
                      <td className="p-2 text-left font-mono font-semibold">{r.cumulative.toFixed(2)}</td>
                      <td className="p-2 text-center print:hidden">
                        {r.paymentId && hasRole("admin") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePayment(r.paymentId!)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 1 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد حركات في هذه الفترة</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/30 text-sm">
                  <tr className="border-t">
                    <td colSpan={2} className="p-2 text-right font-semibold">إجمالي الفترة</td>
                    <td className="p-2 text-left font-mono font-semibold">{totals.debit.toFixed(2)}</td>
                    <td className="p-2 text-left font-mono font-semibold text-emerald-700 dark:text-emerald-400">{totals.credit.toFixed(2)}</td>
                    <td className="p-2"></td>
                    <td className="p-2 print:hidden"></td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={4} className="p-2 text-right text-base font-bold text-primary">الرصيد المستحق</td>
                    <td className={cn("p-2 text-left font-mono text-base font-bold", totals.balance > 0 ? "text-primary" : "text-emerald-700 dark:text-emerald-400")}>
                      {totals.balance.toFixed(2)}
                    </td>
                    <td className="p-2 print:hidden"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden !important; }
          #statement-print, #statement-print * { visibility: visible !important; }
          #statement-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
        }
      `}</style>
    </div>
  );
}
