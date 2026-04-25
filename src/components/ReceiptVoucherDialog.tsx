import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Plus, Trash2, Printer, FileDown, FileSpreadsheet, Receipt } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { renderReportToPdf } from "@/lib/reportRenderer";
import { printElement } from "@/lib/print";
import { ReceiptVoucherPrint, type ReceiptVoucherData, type ReceiptLine } from "@/components/ReceiptVoucherPrint";

interface DraftLine {
  id: string;
  doctor_id: string;
  amount: string;
  method: string;
  reference: string;
  notes: string;
}

const newLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  doctor_id: "",
  amount: "",
  method: "cash",
  reference: "",
  notes: "",
});

export function ReceiptVoucherDialog({
  defaultDoctorId,
  trigger,
}: {
  defaultDoctorId?: string;
  trigger?: React.ReactNode;
}) {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [voucherDate, setVoucherDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cashAccountId, setCashAccountId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [
    { ...newLine(), doctor_id: defaultDoctorId ?? "" },
  ]);
  const [preview, setPreview] = useState<ReceiptVoucherData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: doctors } = useQuery({
    queryKey: ["doctors-receipt-voucher", labId],
    enabled: !!labId && open,
    queryFn: async () =>
      (await supabase.from("doctors").select("id, name, governorate, phone").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: accounts } = useQuery({
    queryKey: ["cash-accs-receipt-voucher", labId],
    enabled: !!labId && open,
    queryFn: async () =>
      (await supabase.from("cash_accounts").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: lab } = useQuery({
    queryKey: ["lab-receipt-voucher", labId],
    enabled: !!labId && open,
    queryFn: async () =>
      (await supabase.from("labs").select("name, phone, address, logo_url, currency").eq("id", labId!).maybeSingle()).data,
  });

  const total = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [lines],
  );

  const reset = () => {
    setLines([{ ...newLine(), doctor_id: defaultDoctorId ?? "" }]);
    setVoucherDate(format(new Date(), "yyyy-MM-dd"));
    setCashAccountId("");
    setNotes("");
    setPreview(null);
  };

  const buildVoucherData = (voucherNumber: string): ReceiptVoucherData => {
    const accountName = accounts?.find((a) => a.id === cashAccountId)?.name;
    const out: ReceiptLine[] = lines
      .filter((l) => l.doctor_id && parseFloat(l.amount) > 0)
      .map((l) => {
        const d = doctors?.find((x) => x.id === l.doctor_id);
        return {
          doctorName: d?.name ?? "—",
          governorate: d?.governorate,
          phone: d?.phone,
          amount: parseFloat(l.amount),
          method: l.method,
          reference: l.reference,
          notes: l.notes,
        };
      });
    return {
      voucherNumber,
      voucherDate,
      cashAccountName: accountName,
      notes,
      lines: out,
      lab: lab ?? null,
    };
  };

  const validate = () => {
    if (!labId) return "لا يوجد معمل نشط";
    const valid = lines.filter((l) => l.doctor_id && parseFloat(l.amount) > 0);
    if (!valid.length) return "أضف دفعة واحدة على الأقل بطبيب ومبلغ صحيح";
    const seen = new Set<string>();
    for (const l of valid) {
      const key = `${l.doctor_id}-${l.method}-${l.reference}`;
      if (seen.has(key) && !l.reference) {
        // duplicate same doctor+method without reference — warn only
      }
      seen.add(key);
    }
    return null;
  };

  const save = async (): Promise<{ voucherNumber: string } | null> => {
    const err = validate();
    if (err) { toast.error(err); return null; }
    const valid = lines.filter((l) => l.doctor_id && parseFloat(l.amount) > 0);
    const voucherNumber = `REC-${format(new Date(), "yyyyMMdd")}-${Date.now().toString().slice(-6)}`;

    // 1) Insert payments rows
    const paymentsPayload = valid.map((l) => ({
      lab_id: labId!,
      doctor_id: l.doctor_id,
      amount: parseFloat(l.amount),
      payment_date: voucherDate,
      method: l.method || null,
      reference: l.reference ? `${voucherNumber} | ${l.reference}` : voucherNumber,
      notes: l.notes || (notes ? `سند ${voucherNumber}: ${notes}` : `سند ${voucherNumber}`),
      cash_account_id: cashAccountId || null,
    }));
    const { error: payErr } = await supabase.from("payments").insert(paymentsPayload);
    if (payErr) { toast.error(payErr.message); return null; }

    // 2) Insert one voucher record (aggregate total) for the receipt voucher trail
    const totalAmount = valid.reduce((s, l) => s + parseFloat(l.amount), 0);
    const firstDoctor = doctors?.find((d) => d.id === valid[0].doctor_id);
    const description =
      valid.length === 1
        ? `سند قبض من ${firstDoctor?.name ?? "طبيب"}`
        : `سند قبض مجمّع — ${valid.length} أطباء`;
    const { error: vErr } = await supabase.from("vouchers").insert({
      lab_id: labId!,
      voucher_type: "receipt",
      voucher_number: voucherNumber,
      voucher_date: voucherDate,
      amount: totalAmount,
      cash_account_id: cashAccountId || null,
      party_type: valid.length === 1 ? "doctor" : "other",
      party_doctor_id: valid.length === 1 ? valid[0].doctor_id : null,
      party_name: valid.length === 1 ? null : `${valid.length} أطباء`,
      description,
      notes: notes || null,
    });
    if (vErr) { /* غير حرج للطبيب */ console.warn(vErr); }

    qc.invalidateQueries({ queryKey: ["statement-payments"] });
    qc.invalidateQueries({ queryKey: ["vouchers"] });
    toast.success(`تم حفظ السند ${voucherNumber}`);
    return { voucherNumber };
  };

  const handleSaveAndPreview = async () => {
    const res = await save();
    if (!res) return;
    setPreview(buildVoucherData(res.voucherNumber));
  };

  const handlePrint = () => {
    if (!preview || !printRef.current) return;
    printElement(printRef.current, `سند قبض ${preview.voucherNumber}`);
  };

  const handlePdf = async () => {
    if (!preview) return;
    try {
      toast.loading("جاري إنشاء PDF...", { id: "voucher-pdf" });
      await renderReportToPdf(
        <ReceiptVoucherPrint data={preview} />,
        `receipt-${preview.voucherNumber}.pdf`,
      );
      toast.success("تم إنشاء PDF", { id: "voucher-pdf" });
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إنشاء PDF", { id: "voucher-pdf" });
    }
  };

  const handleExcel = () => {
    if (!preview) return;
    const currency = preview.lab?.currency || "EGP";
    const labName = preview.lab?.name || "المعمل";
    const dateFmt = (() => {
      try { return format(new Date(preview.voucherDate), "dd/MM/yyyy"); } catch { return preview.voucherDate; }
    })();

    // Build AOA (array of arrays) for full control over header & layout
    const aoa: any[][] = [];
    aoa.push([labName]);
    if (preview.lab?.phone) aoa.push([`هاتف: ${preview.lab.phone}`]);
    if (preview.lab?.address) aoa.push([preview.lab.address]);
    aoa.push([]);
    aoa.push(["سند قبض"]);
    aoa.push(["رقم السند", preview.voucherNumber, "", "التاريخ", dateFmt]);
    if (preview.cashAccountName) aoa.push(["الخزنة المستلمة", preview.cashAccountName]);
    aoa.push([]);
    // table header
    const headers = ["م", "اسم الطبيب", "المحافظة", "طريقة الدفع", "المرجع", `المبلغ (${currency})`, "ملاحظات"];
    aoa.push(headers);
    const dataStartRow = aoa.length; // 1-based for next push
    preview.lines.forEach((l, i) => {
      aoa.push([
        i + 1,
        l.doctorName,
        l.governorate ?? "",
        l.method === "cash" ? "نقدي" : l.method === "transfer" ? "تحويل" : l.method === "cheque" ? "شيك" : l.method === "card" ? "بطاقة" : l.method,
        l.reference ?? "",
        Number(l.amount.toFixed(2)),
        l.notes ?? "",
      ]);
    });
    const total = preview.lines.reduce((s, l) => s + l.amount, 0);
    aoa.push(["", "الإجمالي", "", "", "", Number(total.toFixed(2)), ""]);
    if (preview.notes) {
      aoa.push([]);
      aoa.push(["ملاحظات", preview.notes]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // RTL sheet view
    (ws as any)["!views"] = [{ RTL: true }];
    // Column widths
    ws["!cols"] = [
      { wch: 5 }, { wch: 26 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 14 }, { wch: 28 },
    ];
    // Merge title rows across columns
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // lab name
      { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, // سند قبض
    ];
    // Format amount column as number with 2 decimals
    const amountCol = 5;
    for (let r = dataStartRow; r < aoa.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: amountCol });
      if (ws[cellRef] && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "#,##0.00";
      }
    }

    const wb = XLSX.utils.book_new();
    if (!wb.Workbook) wb.Workbook = {};
    wb.Workbook.Views = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, "سند قبض");
    XLSX.writeFile(wb, `receipt-${preview.voucherNumber}.xlsx`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="default">
            <Receipt className="ml-1 h-4 w-4" /> سند قبض جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preview ? `سند القبض ${preview.voucherNumber}` : "إنشاء سند قبض"}</DialogTitle>
        </DialogHeader>

        {!preview && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>تاريخ السند</Label>
                <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
              </div>
              <div>
                <Label>الخزنة المستلمة</Label>
                <Select value={cashAccountId} onValueChange={setCashAccountId}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lines */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <h3 className="text-sm font-semibold">دفعات السند ({lines.length})</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLines((ls) => [...ls, newLine()])}
                >
                  <Plus className="ml-1 h-3.5 w-3.5" /> إضافة دفعة
                </Button>
              </div>
              <div className="divide-y">
                {lines.map((l, idx) => (
                  <div key={l.id} className="grid grid-cols-12 items-end gap-2 p-3">
                    <div className="col-span-12 sm:col-span-4">
                      <Label className="text-xs">الطبيب</Label>
                      <Select
                        value={l.doctor_id}
                        onValueChange={(v) =>
                          setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, doctor_id: v } : x)))
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="اختر طبيب" /></SelectTrigger>
                        <SelectContent>
                          {doctors?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}{d.governorate ? ` — ${d.governorate}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">المبلغ</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.amount}
                        onChange={(e) =>
                          setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">طريقة الدفع</Label>
                      <Select
                        value={l.method}
                        onValueChange={(v) =>
                          setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, method: v } : x)))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">نقدي</SelectItem>
                          <SelectItem value="transfer">تحويل</SelectItem>
                          <SelectItem value="cheque">شيك</SelectItem>
                          <SelectItem value="card">بطاقة</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-10 sm:col-span-3">
                      <Label className="text-xs">المرجع / رقم العملية</Label>
                      <Input
                        value={l.reference}
                        onChange={(e) =>
                          setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, reference: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <span className="col-span-12 text-xs text-muted-foreground">دفعة #{idx + 1}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-sm">
                <span className="font-semibold">إجمالي السند</span>
                <span className="font-mono text-lg font-bold text-primary">{total.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label>ملاحظات السند</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <p className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
              تم حفظ السند بنجاح. يمكنك الآن طباعته أو تصديره.
            </p>
            {/* Live preview (scaled to fit dialog) */}
            <div className="overflow-auto rounded border bg-white">
              <div style={{ transform: "scale(0.55)", transformOrigin: "top right", width: "210mm" }}>
                <ReceiptVoucherPrint ref={printRef} data={preview} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:flex-row">
          {!preview && (
            <Button onClick={handleSaveAndPreview} disabled={total <= 0}>
              حفظ السند وعرض المعاينة
            </Button>
          )}
          {preview && (
            <>
              <Button variant="outline" onClick={handleExcel}>
                <FileSpreadsheet className="ml-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" onClick={handlePdf}>
                <FileDown className="ml-1 h-4 w-4" /> PDF
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="ml-1 h-4 w-4" /> طباعة
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>إغلاق</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
