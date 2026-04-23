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
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [form, setForm] = useState({
    category_id: "", cash_account_id: "", amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    description: "", reference: "", notes: "",
  });

  const { data: cats } = useQuery({
    queryKey: ["expense-cats", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });
  const { data: accounts } = useQuery({
    queryKey: ["cash-accs-list", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("cash_accounts").select("id, name").order("name")).data ?? [],
  });
  const { data: expenses } = useQuery({
    queryKey: ["expenses", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("expenses").select("*, expense_categories(name), cash_accounts(name)").order("expense_date", { ascending: false })).data ?? [],
  });

  const total = useMemo(() => (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount), 0), [expenses]);

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      const payload: any = { ...form, lab_id: labId };
      if (!payload.category_id) delete payload.category_id;
      if (!payload.cash_account_id) delete payload.cash_account_id;
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      setForm({ category_id: "", cash_account_id: "", amount: 0, expense_date: new Date().toISOString().slice(0, 10), description: "", reference: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCat = useMutation({
    mutationFn: async () => {
      if (!labId || !catName) return;
      const { error } = await supabase.from("expense_categories").insert({ lab_id: labId, name: catName });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الإضافة"); qc.invalidateQueries({ queryKey: ["expense-cats"] }); setCatName(""); setCatOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المصروفات</h1>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild><Button variant="outline"><Tag className="ml-1 h-4 w-4" /> فئة جديدة</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>فئة مصروفات</DialogTitle></DialogHeader>
              <Input placeholder="اسم الفئة" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <DialogFooter><Button onClick={() => addCat.mutate()}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> مصروف جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>الفئة</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الخزنة</Label>
                    <Select value={form.cash_account_id} onValueChange={(v) => setForm({ ...form, cash_account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div><Label>التاريخ</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                </div>
                <div><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>مرجع</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.amount || !form.description}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>قائمة المصروفات</CardTitle>
          <div className="text-lg font-bold text-destructive">الإجمالي: {total.toFixed(2)}</div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">الفئة</th>
                <th className="p-2 text-right">الوصف</th>
                <th className="p-2 text-right">الخزنة</th>
                <th className="p-2 text-left">المبلغ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses?.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد مصروفات</td></tr>}
              {expenses?.map((e: any) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2 text-xs">{format(new Date(e.expense_date), "dd/MM/yyyy")}</td>
                  <td className="p-2">{e.expense_categories?.name ?? "—"}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2">{e.cash_accounts?.name ?? "—"}</td>
                  <td className="p-2 text-left font-mono font-semibold">{Number(e.amount).toFixed(2)}</td>
                  <td className="p-2 text-left"><Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
