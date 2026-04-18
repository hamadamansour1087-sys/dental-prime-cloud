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
import { Plus, Search, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/doctors")({
  component: DoctorsPage,
});

function DoctorsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", clinic_name: "", address: "", notes: "" });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", labId, search],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase.from("doctors").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!labId || !form.name) return;
    const { error } = await supabase.from("doctors").insert({ lab_id: labId, ...form });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة الطبيب");
    setOpen(false);
    setForm({ name: "", phone: "", email: "", clinic_name: "", address: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الأطباء</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />طبيب جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة طبيب جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>اسم العيادة</Label><Input value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} /></div>
              <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
        {doctors?.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{d.name}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {d.clinic_name && <p>{d.clinic_name}</p>}
              {d.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</p>}
              {d.email && <p className="flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{d.email}</p>}
            </CardContent>
          </Card>
        ))}
        {!doctors?.length && <p className="col-span-full py-8 text-center text-muted-foreground">لا يوجد أطباء بعد</p>}
      </div>
    </div>
  );
}
