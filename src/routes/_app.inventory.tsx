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
import { Plus, Pencil, Trash2, ArrowDownUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/inventory")({ component: InventoryPage });

function InventoryPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", sku: "", unit: "قطعة", category: "", min_stock: 0, unit_cost: 0 });
  const [mvOpen, setMvOpen] = useState<any>(null);
  const [mvForm, setMvForm] = useState({ movement_type: "in" as "in" | "out" | "adjust", quantity: 0, unit_cost: 0, notes: "" });

  const { data: items } = useQuery({
    queryKey: ["inventory", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("inventory_items").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      if (editing) {
        const { error } = await supabase.from("inventory_items").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert({ ...form, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false); setEditing(null);
      setForm({ name: "", sku: "", unit: "قطعة", category: "", min_stock: 0, unit_cost: 0 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("inventory_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["inventory"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveItem = useMutation({
    mutationFn: async () => {
      if (!labId || !mvOpen) return;
      const { error } = await supabase.from("inventory_movements").insert({
        lab_id: labId, item_id: mvOpen.id,
        movement_type: mvForm.movement_type, quantity: mvForm.quantity,
        unit_cost: mvForm.unit_cost, notes: mvForm.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الحركة"); qc.invalidateQueries({ queryKey: ["inventory"] });
      setMvOpen(null); setMvForm({ movement_type: "in", quantity: 0, unit_cost: 0, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المخزون</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", sku: "", unit: "قطعة", category: "", min_stock: 0, unit_cost: 0 }); } }}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> صنف جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل صنف" : "صنف جديد"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>كود SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div><Label>التصنيف</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>الوحدة</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>الحد الأدنى</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
                <div><Label>تكلفة الوحدة</Label><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>الأصناف</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">الصنف</th>
                <th className="p-2 text-right">SKU</th>
                <th className="p-2 text-right">الوحدة</th>
                <th className="p-2 text-left">الرصيد</th>
                <th className="p-2 text-left">الحد الأدنى</th>
                <th className="p-2 text-left">التكلفة</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد أصناف</td></tr>}
              {items?.map((it) => {
                const low = Number(it.current_stock) <= Number(it.min_stock);
                return (
                  <tr key={it.id} className="border-t">
                    <td className="p-2 font-medium">{it.name}{it.category && <span className="ml-2 text-xs text-muted-foreground">({it.category})</span>}</td>
                    <td className="p-2 font-mono text-xs">{it.sku ?? "—"}</td>
                    <td className="p-2">{it.unit}</td>
                    <td className="p-2 text-left font-mono">
                      {Number(it.current_stock).toFixed(2)}
                      {low && <Badge variant="destructive" className="mr-1"><AlertTriangle className="h-3 w-3" /></Badge>}
                    </td>
                    <td className="p-2 text-left font-mono">{Number(it.min_stock).toFixed(2)}</td>
                    <td className="p-2 text-left font-mono">{Number(it.unit_cost).toFixed(2)}</td>
                    <td className="p-2 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setMvOpen(it); setMvForm({ movement_type: "in", quantity: 0, unit_cost: Number(it.unit_cost), notes: "" }); }}><ArrowDownUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setForm({ name: it.name, sku: it.sku ?? "", unit: it.unit, category: it.category ?? "", min_stock: Number(it.min_stock), unit_cost: Number(it.unit_cost) }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الصنف؟")) del.mutate(it.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!mvOpen} onOpenChange={(o) => !o && setMvOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>حركة مخزون — {mvOpen?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>نوع الحركة</Label>
              <Select value={mvForm.movement_type} onValueChange={(v: any) => setMvForm({ ...mvForm, movement_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">إدخال</SelectItem>
                  <SelectItem value="out">إخراج</SelectItem>
                  <SelectItem value="adjust">تسوية رصيد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>الكمية</Label><Input type="number" value={mvForm.quantity} onChange={(e) => setMvForm({ ...mvForm, quantity: Number(e.target.value) })} /></div>
              <div><Label>تكلفة الوحدة</Label><Input type="number" value={mvForm.unit_cost} onChange={(e) => setMvForm({ ...mvForm, unit_cost: Number(e.target.value) })} /></div>
            </div>
            <div><Label>ملاحظات</Label><Input value={mvForm.notes} onChange={(e) => setMvForm({ ...mvForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => moveItem.mutate()} disabled={!mvForm.quantity}>حفظ الحركة</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
