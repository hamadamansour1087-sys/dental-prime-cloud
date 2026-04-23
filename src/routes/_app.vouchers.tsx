import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/vouchers")({ component: VouchersPage });

function VouchersPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "receipt" | "payment">("all");
  const [open, setOpen] = useState(false);
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
    queryKey: ["vouchers", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("vouchers").select("*, cash_accounts(name), doctors:party_doctor_id(name), suppliers:party_supplier_id(name)").order("voucher_date", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => (vouchers ?? []).filter((v: any) => tab === "all" || v.voucher_type === tab), [vouchers, tab]);
  const totals = useMemo(() => {
    const r = (vouchers ?? []).filter((v: any) => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
    const p = (vouchers ?? []).filter((v: any) => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
    return { receipts: r, payments: p, net: r - p };
  }, [vouchers]);

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      const payload: any = { ...form, lab_id: labId };
      if (!payload.cash_account_id) delete payload.cash_account_id;
      if (form.party_type !== "doctor") delete payload.party_doctor_id;
      else if (!payload.party_doctor_id) delete payload.party_doctor_id;
      if (form.party_type !== "supplier") delete payload.party_supplier_id;
      else if (!payload.party_supplier_id) delete payload.party_supplier_id;
      if (!payload.voucher_number) {
        const prefix = form.voucher_type === "receipt" ? "REC" : "PAY";
        payload.voucher_number = `${prefix}-${Date.now()}`;
      }
      const { error } = await supabase.from("vouchers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["vouchers"] });
      setOpen(false);
      setForm({ voucher_type: "receipt", voucher_number: "", voucher_date: new Date().toISOString().slice(0, 10), amount: 0, cash_account_id: "", party_type: "other", party_doctor_id: "", party_supplier_id: "", party_name: "", description: "", reference: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vouchers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["vouchers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">سندات القبض والصرف</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> سند جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>سند جديد</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>نوع السند</Label>
                <Select value={form.voucher_type} onValueChange={(v: any) => setForm({ ...form, voucher_type: v })}>
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
                <Select value={form.party_type} onValueChange={(v: any) => setForm({ ...form, party_type: v })}>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownToLine className="h-4 w-4 text-green-600" /> إجمالي القبض</div><div className="mt-1 text-2xl font-bold text-green-600 font-mono">{totals.receipts.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowUpFromLine className="h-4 w-4 text-red-600" /> إجمالي الصرف</div><div className="mt-1 text-2xl font-bold text-red-600 font-mono">{totals.payments.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">صافي الحركة</div><div className={`mt-1 text-2xl font-bold font-mono ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>{totals.net.toFixed(2)}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="receipt">سندات قبض</TabsTrigger>
          <TabsTrigger value="payment">سندات صرف</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>السندات</CardTitle></CardHeader>
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
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد سندات</td></tr>}
              {filtered.map((v: any) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{v.voucher_number}</td>
                  <td className="p-2 text-xs">{format(new Date(v.voucher_date), "dd/MM/yyyy")}</td>
                  <td className="p-2">{v.voucher_type === "receipt" ? <span className="text-green-600">قبض</span> : <span className="text-red-600">صرف</span>}</td>
                  <td className="p-2">{v.doctors?.name ?? v.suppliers?.name ?? v.party_name ?? "—"}</td>
                  <td className="p-2">{v.description}</td>
                  <td className="p-2">{v.cash_accounts?.name ?? "—"}</td>
                  <td className={`p-2 text-left font-mono font-semibold ${v.voucher_type === "receipt" ? "text-green-600" : "text-red-600"}`}>{Number(v.amount).toFixed(2)}</td>
                  <td className="p-2 text-left"><Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
