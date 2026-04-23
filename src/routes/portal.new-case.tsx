import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { ToothChart } from "@/components/ToothChart";

export const Route = createFileRoute("/portal/new-case")({
  component: NewCasePortal,
});

function NewCasePortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: doctor } = useQuery({
    queryKey: ["portal-doctor-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, lab_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: workTypes } = useQuery({
    queryKey: ["portal-worktypes", doctor?.lab_id],
    enabled: !!doctor?.lab_id,
    queryFn: async () =>
      (await supabase.from("work_types").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });

  const [form, setForm] = useState({
    patient_name: "",
    work_type_id: "",
    shade: "",
    tooth_numbers: "",
    units: "1",
    due_date: "",
    notes: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!doctor) return toast.error("لم يتم تحميل بيانات الطبيب");
    if (!form.patient_name || !form.work_type_id) return toast.error("اسم المريض ونوع العمل مطلوبان");

    setBusy(true);
    try {
      // Upsert patient
      const { data: patient, error: pErr } = await supabase
        .from("patients")
        .insert({ lab_id: doctor.lab_id, name: form.patient_name })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // Insert pending case (no case_number yet — will be assigned on approval)
      const { data: caseRow, error: cErr } = await supabase
        .from("cases")
        .insert({
          lab_id: doctor.lab_id,
          doctor_id: doctor.id,
          patient_id: patient.id,
          work_type_id: form.work_type_id,
          shade: form.shade || null,
          tooth_numbers: form.tooth_numbers || null,
          units: form.units ? parseInt(form.units) : 1,
          due_date: form.due_date || null,
          notes: form.notes || null,
          status: "pending_approval",
          case_number: `PND-${Date.now()}`,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;

      // Upload attachments
      for (const f of files) {
        const path = `${doctor.lab_id}/${caseRow.id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("case-attachments").upload(path, f);
        if (upErr) {
          console.error(upErr);
          continue;
        }
        await supabase.from("case_attachments").insert({
          lab_id: doctor.lab_id,
          case_id: caseRow.id,
          file_name: f.name,
          file_size: f.size,
          mime_type: f.type,
          storage_path: path,
          kind: "file",
        });
      }

      toast.success("تم رفع الحالة بنجاح، بانتظار موافقة المعمل");
      navigate({ to: "/portal/cases" });
    } catch (e: any) {
      toast.error(e.message ?? "فشل رفع الحالة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">حالة جديدة</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات الحالة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>اسم المريض *</Label>
            <Input
              value={form.patient_name}
              onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
            />
          </div>
          <div>
            <Label>نوع العمل *</Label>
            <Select value={form.work_type_id} onValueChange={(v) => setForm({ ...form, work_type_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {workTypes?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الشيد</Label>
              <Input value={form.shade} onChange={(e) => setForm({ ...form, shade: e.target.value })} />
            </div>
            <div>
              <Label>عدد الوحدات</Label>
              <Input
                type="number"
                min="1"
                value={form.units}
                onChange={(e) => setForm({ ...form, units: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>أرقام الأسنان</Label>
            <div className="mt-1">
              <ToothChart
                value={form.tooth_numbers}
                onChange={(v) => setForm({ ...form, tooth_numbers: v })}
              />
            </div>
          </div>
          <div>
            <Label>تاريخ التسليم المطلوب</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>

          <div>
            <Label>الملفات (صور / STL / PDF)</Label>
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary">
              <Upload className="h-5 w-5" />
              اضغط لاختيار الملفات
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "جارٍ الإرسال..." : "إرسال الحالة للمعمل"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
