import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Printer, FileSpreadsheet, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import { exportElementToPdf } from "@/lib/pdf";
import { printElement, printReactElement } from "@/lib/print";
import { ReceiptVoucherPrint, type ReceiptVoucherData } from "@/components/ReceiptVoucherPrint";

export const Route = createFileRoute("/_app/vouchers")({ component: VouchersPage });

interface VoucherRow {
  id: string;
  voucher_number: string;
  voucher_type: "receipt" | "payment";
  voucher_date: string;
  amount: number | string;
  description: string | null;
  reference: string | null;
  notes: string | null;
  party_name: string | null;
  party_doctor_id: string | null;
  party_supplier_id: string | null;
  cash_account_id: string | null;
  cash_accounts: { name: string } | null;
  doctors: { name: string; governorate?: string | null } | null;
  suppliers: { name: string } | null;
}

function VouchersPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "receipt" | "payment">("all");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    voucher_type: "receipt" as "receipt" | "payment",
    voucher_number: "",
    voucher_date: new Date().toISOString().slice(0, 10),
    amount: 0,
    cash_account_id: "",
    party_type: "other" as "doctor" | "supplier" | "other",
    party_doctor_id: "",
    party_supplier_id: "",
    party_name: "",
    description: "",
    reference: "",
  });

  const { data: lab } = useQuery({
    queryKey: ["lab-vch", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("labs").select("name,phone,address,logo_url,currency").eq("id", labId!).maybeSingle()).data,
  });
  const { data: accounts } = useQuery({
    queryKey: ["cash-accs-vch", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("cash_accounts").select("id, name").order("name")).data ?? [],
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors-vch", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("doctors").select("id, name").order("name")).data ?? [],
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-vch", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });
  const { data: vouchers } = useQuery({
    queryKey: ["vouchers", labId, from, to], enabled: !!labId,
    queryFn: async () => (await supabase
      .from("vouchers")
      .select("*, cash_accounts(name), doctors:party_doctor_id(name, governorate), suppliers:party_supplier_id(name)")
      .gte("voucher_date", from)
      .lte("voucher_date", to)
      .order("voucher_date", { ascending: false })
      .limit(5000)
    ).data as VoucherRow[] | null ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (vouchers ?? []).filter((v) => {
      if (tab !== "all" && v.voucher_type !== tab) return false;
      if (!q) return true;
      const party = v.doctors?.name ?? v.suppliers?.name ?? v.party_name ?? "";
      return [v.voucher_number, v.description, v.reference, party]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [vouchers, tab, search]);

  const totals = useMemo(() => {
    const r = filtered.filter((v) => v.voucher_type === "receipt").reduce((s, v) => s + Number(v.amount), 0);
    const p = filtered.filter((v) => v.voucher_type === "payment").reduce((s, v) => s + Number(v.amount), 0);
    return { receipts: r, payments: p, net: r - p };
  }, [filtered]);

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      const payload: Record<string, unknown> = { ...form, lab_id: labId };
      if (!payload.cash_account_id) delete payload.cash_account_id;
      if (form.party_type !== "doctor" || !form.party_doctor_id) delete payload.party_doctor_id;
      if (form.party_type !== "supplier" || !form.party_supplier_id) delete payload.party_supplier_id;
      if (!payload.voucher_number) {
        const prefix = form.voucher_type === "receipt" ? "REC" : "PAY";
        payload.voucher_number = `${prefix}-${Date.now()}`;
      }
      const { error } = await supabase.from("vouchers").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["vouchers"] });
      setOpen(false);
      setForm({ voucher_type: "receipt", voucher_number: "", voucher_date: new Date().toISOString().slice(0, 10), amount: 0, cash_account_id: "", party_type: "other", party_doctor_id: "", party_supplier_id: "", party_name: "", description: "", reference: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vouchers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["vouchers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportExcel = () => {
    const rows = filtered.map((v) => ({
      "رقم السند": v.voucher_number,
      "التاريخ": v.voucher_date,
      "النوع": v.voucher_type === "receipt" ? "قبض" : "صرف",
      "الجهة": v.doctors?.name ?? v.suppliers?.name ?? v.party_name ?? "",
      "البيان": v.description ?? "",
      "المرجع": v.reference ?? "",
      "الخزنة": v.cash_accounts?.name ?? "",
      "المبلغ": Number(v.amount),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "السندات");
    XLSX.writeFile(wb, `سندات_${from}_${to}.xlsx`);
    toast.success("تم تصدير ملف Excel");
  };

  const exportPdfList = async () => {
    if (!listRef.current) return;
    try {
      toast.loading("جاري تجهيز PDF...", { id: "vch-pdf" });
      await exportElementToPdf(listRef.current, `سندات_${from}_${to}.pdf`);
      toast.success("تم التصدير", { id: "vch-pdf" });
    } catch {
      toast.error("تعذر تصدير PDF", { id: "vch-pdf" });
    }
  };

  const printList = () => {
    if (!listRef.current) return;
    printElement(listRef.current, `سندات ${from} → ${to}`);
  };

  const printOne = async (v: VoucherRow) => {
    const data: ReceiptVoucherData = {
      voucherNumber: v.voucher_number,
      voucherDate: v.voucher_date,
      voucherType: v.voucher_type,
      cashAccountName: v.cash_accounts?.name,
      notes: [v.description ?? "", v.notes ?? ""].filter(Boolean).join(" — "),
      lines: [{
        doctorName: v.doctors?.name ?? v.suppliers?.name ?? v.party_name ?? "—",
        governorate: v.doctors?.governorate ?? null,
        amount: Number(v.amount),
        method: "cash",
        reference: v.reference ?? "",
      }],
      lab: lab ?? null,
    };
    await printReactElement(<ReceiptVoucherPrint data={data} />, `${v.voucher_type === "receipt" ? "سند قبض" : "سند صرف"} ${v.voucher_number}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">سندات القبض والصرف</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={printList}><Printer className="ml-1 h-4 w-4" /> طباعة</Button>
          <Button variant="outline" size="sm" onClick={exportPdfList}><FileDown className="ml-1 h-4 w-4" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="ml-1 h-4 w-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> سند جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>سند جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>نوع السند</Label>
                  <Select value={form.voucher_type} onValueChange={(v) => setForm({ ...form, voucher_type: v as "receipt" | "payment" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">سند قبض (استلام)</SelectItem>
                      <SelectItem value="payment">سند صرف (دفع)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div><Label>التاريخ</Label><Input type="date" value={form.voucher_date} onChange={(e) => setForm({ ...form, voucher_date: e.target.value })} /></div>
                </div>
                <div>
                  <Label>الخزنة</Label>
                  <Select value={form.cash_account_id} onValueChange={(v) => setForm({ ...form, cash_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الجهة</Label>
                  <Select value={form.party_type} onValueChange={(v) => setForm({ ...form, party_type: v as "doctor" | "supplier" | "other" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">طبيب</SelectItem>
                      <SelectItem value="supplier">مورد</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.party_type === "doctor" && (
                  <Select value={form.party_doctor_id} onValueChange={(v) => setForm({ ...form, party_doctor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر طبيب" /></SelectTrigger>
                    <SelectContent>{doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {form.party_type === "supplier" && (
                  <Select value={form.party_supplier_id} onValueChange={(v) => setForm({ ...form, party_supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                    <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {form.party_type === "other" && <Input placeholder="اسم الجهة" value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />}
                <div><Label>البيان</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>مرجع</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.amount || !form.description}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div><Label className="text-xs">من تاريخ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">إلى تاريخ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">بحث (رقم/جهة/بيان)</Label><Input placeholder="ابحث..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownToLine className="h-4 w-4 text-green-600" /> إجمالي القبض</div><div className="mt-1 text-2xl font-bold text-green-600 font-mono">{totals.receipts.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowUpFromLine className="h-4 w-4 text-red-600" /> إجمالي الصرف</div><div className="mt-1 text-2xl font-bold text-red-600 font-mono">{totals.payments.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">صافي الحركة</div><div className={`mt-1 text-2xl font-bold font-mono ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>{totals.net.toFixed(2)}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "receipt" | "payment")}>
        <TabsList>
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="receipt">سندات قبض</TabsTrigger>
          <TabsTrigger value="payment">سندات صرف</TabsTrigger>
        </TabsList>
      </Tabs>

      <div ref={listRef}>
        <Card>
          <CardHeader><CardTitle>السندات ({filtered.length}) — من {from} إلى {to}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-right">رقم</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الجهة</th>
                  <th className="p-2 text-right">البيان</th>
                  <th className="p-2 text-right">الخزنة</th>
                  <th className="p-2 text-left">المبلغ</th>
                  <th className="p-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد سندات في الفترة</td></tr>}
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{v.voucher_number}</td>
                    <td className="p-2 text-xs">{format(new Date(v.voucher_date), "dd/MM/yyyy")}</td>
                    <td className="p-2">{v.voucher_type === "receipt" ? <span className="text-green-600">قبض</span> : <span className="text-red-600">صرف</span>}</td>
                    <td className="p-2">{v.doctors?.name ?? v.suppliers?.name ?? v.party_name ?? "—"}</td>
                    <td className="p-2">{v.description}</td>
                    <td className="p-2">{v.cash_accounts?.name ?? "—"}</td>
                    <td className={`p-2 text-left font-mono font-semibold ${v.voucher_type === "receipt" ? "text-green-600" : "text-red-600"}`}>{Number(v.amount).toFixed(2)}</td>
                    <td className="p-2 text-left print:hidden">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" title="طباعة السند" onClick={() => printOne(v)}><Printer className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="حذف" onClick={() => { if (confirm("حذف؟")) del.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
