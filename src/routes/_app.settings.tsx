import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const { data: lab } = useQuery({
    queryKey: ["lab", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("labs").select("*").eq("id", labId!).single()).data,
  });

  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", currency: "EGP", case_number_prefix: "C" });
  useEffect(() => {
    if (lab) setForm({
      name: lab.name,
      phone: lab.phone ?? "",
      email: lab.email ?? "",
      address: lab.address ?? "",
      currency: lab.currency,
      case_number_prefix: lab.case_number_prefix,
    });
  }, [lab]);

  const save = async () => {
    if (!labId) return;
    const { error } = await supabase.from("labs").update(form).eq("id", labId);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    qc.invalidateQueries({ queryKey: ["lab"] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">بيانات المعمل</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>اسم المعمل</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
          </div>
          <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            <div><Label>بادئة رقم الحالة</Label><Input value={form.case_number_prefix} onChange={(e) => setForm({ ...form, case_number_prefix: e.target.value })} /></div>
          </div>
          <Button onClick={save}>حفظ</Button>
        </CardContent>
      </Card>
    </div>
  );
}
