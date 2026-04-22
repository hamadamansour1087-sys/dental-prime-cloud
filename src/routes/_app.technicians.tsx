import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Phone, Wrench, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/technicians")({
  component: TechniciansPage,
});

type Tech = { id: string; name: string; phone: string | null; specialty: string | null; notes: string | null; is_active: boolean };

function TechniciansPage() {
  const { labId, hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin") || hasRole("manager");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tech | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", notes: "", is_active: true });

  const { data: techs } = useQuery({
    queryKey: ["technicians", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tech[];
    },
  });

  const reset = () => {
    setForm({ name: "", phone: "", specialty: "", notes: "", is_active: true });
    setEditing(null);
  };

  const openEdit = (t: Tech) => {
    setEditing(t);
    setForm({ name: t.name, phone: t.phone ?? "", specialty: t.specialty ?? "", notes: t.notes ?? "", is_active: t.is_active });
    setOpen(true);
  };

  const submit = async () => {
    if (!labId || !form.name.trim()) return toast.error("الاسم مطلوب");
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      specialty: form.specialty || null,
      notes: form.notes || null,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("technicians").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("technicians").insert({ ...payload, lab_id: labId });
      if (error) return toast.error(error.message);
      toast.success("تمت الإضافة");
    }
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["technicians"] });
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الفني؟")) return;
    const { error } = await supabase.from("technicians").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["technicians"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">الفنيون</h1>
          <p className="text-sm text-muted-foreground">قائمة فنيي المعمل لتتبع الإنتاج</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="ml-1 h-4 w-4" />فني جديد</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>{editing ? "تعديل فني" : "إضافة فني"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>التخصص</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="زيركون، بورسلين..." /></div>
                </div>
                <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <Label>نشط</Label>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {techs?.map((t) => (
          <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{t.name}</span>
                {!t.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">غير نشط</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {t.specialty && <p className="flex items-center gap-1"><Wrench className="h-3 w-3" />{t.specialty}</p>}
              {t.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</p>}
              {canManage && (
                <div className="flex justify-end gap-1 pt-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!techs?.length && <p className="col-span-full py-8 text-center text-muted-foreground">لا يوجد فنيون بعد</p>}
      </div>
    </div>
  );
}
