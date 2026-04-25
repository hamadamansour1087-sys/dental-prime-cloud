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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Phone, Mail, MapPin, Trash2, User, Building2, FileText, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";
import { PortalAccountButton } from "@/components/PortalAccountButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/doctors")({
  component: DoctorsPage,
});

type ClinicInput = { name: string; address: string; phone: string };

function DoctorsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    governorate: "",
    address: "",
    notes: "",
    opening_balance: "0",
  });
  const [clinics, setClinics] = useState<ClinicInput[]>([{ name: "", address: "", phone: "" }]);

  const { data: doctors } = useQuery({
    queryKey: ["doctors", labId, search, showInactive],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("doctors")
        .select("*, doctor_clinics(id, name, address, phone)")
        .order("created_at", { ascending: false });
      if (!showInactive) q = q.eq("is_active", true);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("doctors").update({ is_active: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(current ? "تم تعطيل الطبيب" : "تم تفعيل الطبيب");
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  const deleteDoctor = async (id: string) => {
    const { count } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", id);
    if (count && count > 0) {
      toast.error(`لا يمكن الحذف - يوجد ${count} حالة مرتبطة. يمكنك تعطيل الطبيب بدلاً من ذلك.`);
      return;
    }
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الطبيب");
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  const reset = () => {
    setForm({ name: "", phone: "", email: "", governorate: "", address: "", notes: "", opening_balance: "0" });
    setClinics([{ name: "", address: "", phone: "" }]);
  };

  const submit = async () => {
    if (!labId || !form.name || !form.governorate) {
      toast.error("الاسم والمحافظة مطلوبان");
      return;
    }
    const { data: doc, error } = await supabase
      .from("doctors")
      .insert({
        lab_id: labId,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        governorate: form.governorate,
        address: form.address || null,
        notes: form.notes || null,
        opening_balance: parseFloat(form.opening_balance) || 0,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    const validClinics = clinics.filter((c) => c.name.trim());
    if (validClinics.length) {
      const { error: cErr } = await supabase.from("doctor_clinics").insert(
        validClinics.map((c, i) => ({
          lab_id: labId,
          doctor_id: doc.id,
          name: c.name,
          address: c.address || null,
          phone: c.phone || null,
          is_primary: i === 0,
        }))
      );
      if (cErr) return toast.error(cErr.message);
    }

    toast.success("تمت إضافة الطبيب");
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الأطباء</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />طبيب جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:w-full">
            <DialogHeader><DialogTitle>إضافة طبيب جديد</DialogTitle></DialogHeader>
            <Tabs defaultValue="info" dir="rtl" className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info"><User className="ml-1 h-4 w-4" />البيانات</TabsTrigger>
                <TabsTrigger value="clinics"><Building2 className="ml-1 h-4 w-4" />العيادات</TabsTrigger>
                <TabsTrigger value="notes"><FileText className="ml-1 h-4 w-4" />ملاحظات</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3">
                <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>المحافظة *</Label>
                    <Select value={form.governorate} onValueChange={(v) => setForm({ ...form, governorate: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                      <SelectContent>
                        {EGYPT_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>رصيد أول المدة</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </TabsContent>

              <TabsContent value="clinics">
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="font-semibold">العيادات</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setClinics([...clinics, { name: "", address: "", phone: "" }])}>
                      <Plus className="ml-1 h-3 w-3" />إضافة عيادة
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {clinics.map((c, i) => (
                      <div key={i} className="space-y-2 rounded border bg-muted/30 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">عيادة {i + 1}{i === 0 && " (رئيسية)"}</span>
                          {clinics.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setClinics(clinics.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <Input placeholder="اسم العيادة" value={c.name} onChange={(e) => setClinics(clinics.map((cl, idx) => idx === i ? { ...cl, name: e.target.value } : cl))} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="العنوان" value={c.address} onChange={(e) => setClinics(clinics.map((cl, idx) => idx === i ? { ...cl, address: e.target.value } : cl))} />
                          <Input placeholder="الهاتف" value={c.phone} onChange={(e) => setClinics(clinics.map((cl, idx) => idx === i ? { ...cl, phone: e.target.value } : cl))} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes">
                <div><Label>ملاحظات</Label><Textarea rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </TabsContent>
            </Tabs>
            <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {doctors?.map((d: any) => (
          <Card key={d.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{d.name}</CardTitle>
              {d.governorate && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{d.governorate}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {d.doctor_clinics?.length > 0 && (
                <p className="text-xs">{d.doctor_clinics.length} عيادة</p>
              )}
              {d.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</p>}
              {d.email && <p className="flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{d.email}</p>}
              {Number(d.opening_balance) !== 0 && (
                <p className="text-xs">رصيد أول المدة: {Number(d.opening_balance).toFixed(2)}</p>
              )}
              <PortalAccountButton doctor={d} onDone={() => qc.invalidateQueries({ queryKey: ["doctors"] })} />
            </CardContent>
          </Card>
        ))}
        {!doctors?.length && <p className="col-span-full py-8 text-center text-muted-foreground">لا يوجد أطباء بعد</p>}
      </div>
    </div>
  );
}
