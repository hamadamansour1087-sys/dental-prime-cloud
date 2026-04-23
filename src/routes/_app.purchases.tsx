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
import { Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/purchases")({ component: PurchasesPage });

type Line = { item_id: string | null; description: string; quantity: number; unit_cost: number };

function PurchasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any>(null);
  const [form, setForm] = useState({
    supplier_id: "", invoice_number: "", invoice_date: new Date().toISOString().slice(0, 10),
    discount: 0, tax: 0, paid: 0, notes: "",
  });
  const [lines, setLines] = useState<Line[]>([{ item_id: null, description: "", quantity: 1, unit_cost: 0 }]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });
  const { data: items } = useQuery({
    queryKey: ["items-list", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("inventory_items").select("id, name, unit_cost").order("name")).data ?? [],
  });
  const { data: invoices } = useQuery({
    queryKey: ["purchase-invoices", labId], enabled: !!labId,
    queryFn: async () => (await supabase.from("purchase_invoices").select("*, suppliers(name)").order("invoice_date", { ascending: false })).data ?? [],
  });
  const { data: viewItems } = useQuery({
    queryKey: ["pinv-items", view?.id], enabled: !!view,
    queryFn: async () => (await supabase.from("purchase_invoice_items").select("*, inventory_items(name)").eq("invoice_id", view.id)).data ?? [],
  });

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
    const total = subtotal - Number(form.discount || 0) + Number(form.tax || 0);
    return { subtotal, total };
  }, [lines, form.discount, form.tax]);

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      if (!form.supplier_id) throw new Error("اختر المورد");
      const { data: inv, error: e1 } = await supabase.from("purchase_invoices").insert({
        lab_id: labId, supplier_id: form.supplier_id, invoice_number: form.invoice_number,
        invoice_date: form.invoice_date, subtotal: totals.subtotal, discount: form.discount,
        tax: form.tax, total: totals.total, paid: form.paid, notes: form.notes,
      }).select("id").single();
      if (e1) throw e1;

      const rows = lines.filter((l) => l.quantity > 0).map((l) => ({
        lab_id: labId, invoice_id: inv.id, item_id: l.item_id, description: l.description,
        quantity: l.quantity, unit_cost: l.unit_cost, total: l.quantity * l.unit_cost,
      }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("purchase_invoice_items").insert(rows);
        if (e2) throw e2;
        // create inventory IN movements for items
        const mvs = rows.filter((r) => r.item_id).map((r) => ({
          lab_id: labId, item_id: r.item_id!, movement_type: "in" as const,
          quantity: r.quantity, unit_cost: r.unit_cost, reference_type: "purchase_invoice", reference_id: inv.id,
        }));
        if (mvs.length) {
          const { error: e3 } = await supabase.from("inventory_movements").insert(mvs);
          if (e3) throw e3;
        }
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الفاتورة");
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
      setForm({ supplier_id: "", invoice_number: "", invoice_date: new Date().toISOString().slice(0, 10), discount: 0, tax: 0, paid: 0, notes: "" });
      setLines([{ item_id: null, description: "", quantity: 1, unit_cost: 0 }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("purchase_invoices").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["purchase-invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">فواتير المشتريات</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> فاتورة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>فاتورة شراء جديدة</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>المورد</Label>
                  <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>رقم الفاتورة</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
                <div><Label>التاريخ</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
              </div>

              <div className="rounded border">
                <div className="grid grid-cols-12 gap-1 bg-muted/50 p-2 text-xs font-semibold">
                  <div className="col-span-4">الصنف</div>
                  <div className="col-span-3">الوصف</div>
                  <div className="col-span-2">الكمية</div>
                  <div className="col-span-2">سعر الوحدة</div>
                  <div className="col-span-1"></div>
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 border-t p-2">
                    <div className="col-span-4">
                      <Select value={l.item_id ?? "none"} onValueChange={(v) => {
                        const item = items?.find((x) => x.id === v);
                        const next = [...lines];
                        next[i] = { ...l, item_id: v === "none" ? null : v, unit_cost: item ? Number(item.unit_cost) : l.unit_cost };
                        setLines(next);
                      }}>
                        <SelectTrigger><SelectValue placeholder="اختر صنف" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— بدون صنف —</SelectItem>
                          {items?.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input value={l.description} onChange={(e) => { const n = [...lines]; n[i] = { ...l, description: e.target.value }; setLines(n); }} /></div>
                    <div className="col-span-2"><Input type="number" value={l.quantity} onChange={(e) => { const n = [...lines]; n[i] = { ...l, quantity: Number(e.target.value) }; setLines(n); }} /></div>
                    <div className="col-span-2"><Input type="number" value={l.unit_cost} onChange={(e) => { const n = [...lines]; n[i] = { ...l, unit_cost: Number(e.target.value) }; setLines(n); }} /></div>
                    <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
                <div className="border-t p-2"><Button variant="outline" size="sm" onClick={() => setLines([...lines, { item_id: null, description: "", quantity: 1, unit_cost: 0 }])}><Plus className="ml-1 h-3 w-3" /> بند</Button></div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div><Label>الإجمالي</Label><Input value={totals.subtotal.toFixed(2)} disabled /></div>
                <div><Label>خصم</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></div>
                <div><Label>ضريبة</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} /></div>
                <div><Label>المدفوع</Label><Input type="number" value={form.paid} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} /></div>
              </div>
              <div className="text-left text-lg font-bold text-primary">المستحق: {totals.total.toFixed(2)}</div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.supplier_id}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>الفواتير</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">رقم</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">المورد</th>
                <th className="p-2 text-left">الإجمالي</th>
                <th className="p-2 text-left">المدفوع</th>
                <th className="p-2 text-left">المتبقي</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد فواتير</td></tr>}
              {invoices?.map((inv: any) => (
                <tr key={inv.id} className="border-t">
                  <td className="p-2 font-mono">{inv.invoice_number}</td>
                  <td className="p-2 text-xs">{format(new Date(inv.invoice_date), "dd/MM/yyyy")}</td>
                  <td className="p-2">{inv.suppliers?.name ?? "—"}</td>
                  <td className="p-2 text-left font-mono">{Number(inv.total).toFixed(2)}</td>
                  <td className="p-2 text-left font-mono">{Number(inv.paid).toFixed(2)}</td>
                  <td className="p-2 text-left font-mono font-semibold">{(Number(inv.total) - Number(inv.paid)).toFixed(2)}</td>
                  <td className="p-2 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => setView(inv)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الفاتورة؟")) del.mutate(inv.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>فاتورة #{view?.invoice_number}</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">الوصف</th><th className="p-2 text-left">الكمية</th><th className="p-2 text-left">السعر</th><th className="p-2 text-left">الإجمالي</th></tr></thead>
            <tbody>
              {viewItems?.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.inventory_items?.name ?? "—"}</td>
                  <td className="p-2">{r.description ?? "—"}</td>
                  <td className="p-2 text-left font-mono">{Number(r.quantity)}</td>
                  <td className="p-2 text-left font-mono">{Number(r.unit_cost).toFixed(2)}</td>
                  <td className="p-2 text-left font-mono">{Number(r.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
