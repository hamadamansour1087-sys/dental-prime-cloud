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
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/patients")({
  component: PatientsPage,
});

function PatientsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", age: "", gender: "", notes: "" });

  const { data: patients } = useQuery({
    queryKey: ["patients", labId, search],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!labId || !form.name) return;
    const { error } = await supabase.from("patients").insert({
      lab_id: labId,
      name: form.name,
      phone: form.phone || null,
      age: form.age ? parseInt(form.age) : null,
      gender: form.gender || null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة");
    setOpen(false);
    setForm({ name: "", phone: "", age: "", gender: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["patients"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">المرضى</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />مريض جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة مريض</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>السن</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              </div>
              <div><Label>النوع</Label><Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} placeholder="ذكر / أنثى" /></div>
              <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {patients?.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {p.phone && <p>📞 {p.phone}</p>}
              {p.age && <p>السن: {p.age}</p>}
              {p.gender && <p>{p.gender}</p>}
            </CardContent>
          </Card>
        ))}
        {!patients?.length && <p className="col-span-full py-8 text-center text-muted-foreground">لا يوجد مرضى بعد</p>}
      </div>
    </div>
  );
}
