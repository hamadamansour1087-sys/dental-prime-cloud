import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", opening_balance: 0, notes: "" });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      if (editing) {
        const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...form, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false); setEditing(null);
      setForm({ name: "", phone: "", email: "", address: "", opening_balance: 0, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الموردون</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", phone: "", email: "", address: "", opening_balance: 0, notes: "" }); } }}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> مورد جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل مورد" : "مورد جديد"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>رصيد افتتاحي</Label><Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
              <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>قائمة الموردين</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-right">الهاتف</th>
                <th className="p-2 text-right">العنوان</th>
                <th className="p-2 text-left">الرصيد الافتتاحي</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا يوجد موردون</td></tr>}
              {suppliers?.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="p-2">{s.address ?? "—"}</td>
                  <td className="p-2 text-left font-mono">{Number(s.opening_balance).toFixed(2)}</td>
                  <td className="p-2 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", opening_balance: Number(s.opening_balance), notes: s.notes ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف المورد؟")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
