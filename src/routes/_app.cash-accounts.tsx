import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cash-accounts")({ component: CashAccountsPage });

function CashAccountsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", account_type: "cash", currency: "EGP", opening_balance: 0, notes: "" });

  const { data: accounts } = useQuery({
    queryKey: ["cash-accounts", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("cash_accounts").select("*").order("name")).data ?? [],
  });

  // compute balance from movements
  const { data: balances } = useQuery({
    queryKey: ["cash-balances", labId], enabled: !!labId,
    queryFn: async () => {
      const [vch, exp, sp, pay] = await Promise.all([
        supabase.from("vouchers").select("cash_account_id, amount, voucher_type"),
        supabase.from("expenses").select("cash_account_id, amount"),
        supabase.from("supplier_payments").select("cash_account_id, amount"),
        supabase.from("payments").select("cash_account_id, amount"),
      ]);
      const map: Record<string, number> = {};
      vch.data?.forEach((v: any) => { if (!v.cash_account_id) return; map[v.cash_account_id] = (map[v.cash_account_id] ?? 0) + (v.voucher_type === "receipt" ? Number(v.amount) : -Number(v.amount)); });
      exp.data?.forEach((e: any) => { if (!e.cash_account_id) return; map[e.cash_account_id] = (map[e.cash_account_id] ?? 0) - Number(e.amount); });
      sp.data?.forEach((p: any) => { if (!p.cash_account_id) return; map[p.cash_account_id] = (map[p.cash_account_id] ?? 0) - Number(p.amount); });
      pay.data?.forEach((p: any) => { if (!p.cash_account_id) return; map[p.cash_account_id] = (map[p.cash_account_id] ?? 0) + Number(p.amount); });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      if (editing) {
        const { error } = await supabase.from("cash_accounts").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cash_accounts").insert({ ...form, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["cash-accounts"] });
      setOpen(false); setEditing(null);
      setForm({ name: "", account_type: "cash", currency: "EGP", opening_balance: 0, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("cash_accounts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["cash-accounts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الخزن والحسابات</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", account_type: "cash", currency: "EGP", opening_balance: 0, notes: "" }); } }}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> خزنة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل" : "خزنة جديدة"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>النوع</Label>
                  <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">خزنة نقدية</SelectItem>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                      <SelectItem value="wallet">محفظة إلكترونية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <div><Label>رصيد افتتاحي</Label><Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts?.map((a) => {
          const bal = Number(a.opening_balance) + (balances?.[a.id] ?? 0);
          return (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> {a.name}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setForm({ name: a.name, account_type: a.account_type, currency: a.currency, opening_balance: Number(a.opening_balance), notes: a.notes ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الخزنة؟")) del.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{bal.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{a.currency}</span></div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.account_type === "cash" ? "خزنة نقدية" : a.account_type === "bank" ? "حساب بنكي" : "محفظة"}
                </p>
              </CardContent>
            </Card>
          );
        })}
        {accounts?.length === 0 && <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">لا توجد خزن. أضف خزنة جديدة للبدء.</p>}
      </div>
    </div>
  );
}
