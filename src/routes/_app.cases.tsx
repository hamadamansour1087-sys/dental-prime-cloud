import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ToothChart } from "@/components/ToothChart";

export const Route = createFileRoute("/_app/cases")({
  component: CasesPage,
});

function CasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    doctor_id: "",
    patient_name: "",
    work_type_id: "",
    shade: "",
    tooth_numbers: "",
    units: "1",
    due_date: "",
    price: "",
    notes: "",
  });

  const { data: stages } = useQuery({
    queryKey: ["stages", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("workflow_stages").select("id, name, color, order_index, is_end").order("order_index");
      return data ?? [];
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["cases", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, doctors(name), patients(name), work_types(name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-select", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("doctors").select("id, name").eq("is_active", true)).data ?? [],
  });
  const { data: workTypes } = useQuery({
    queryKey: ["worktypes-select", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_types").select("id, name").eq("is_active", true)).data ?? [],
  });

  const submit = async () => {
    if (!labId || !form.doctor_id) {
      toast.error("اختر الطبيب");
      return;
    }
    const { data: caseNum } = await supabase.rpc("generate_case_number", { _lab_id: labId });
    const { data: wf } = await supabase.from("workflows").select("id").eq("is_default", true).maybeSingle();
    const startStage = stages?.find((s) => s.order_index === 1);
    const { data: created, error } = await supabase
      .from("cases")
      .insert({
        lab_id: labId,
        case_number: caseNum as string,
        doctor_id: form.doctor_id,
        patient_id: form.patient_id || null,
        work_type_id: form.work_type_id || null,
        workflow_id: wf?.id ?? null,
        current_stage_id: startStage?.id ?? null,
        shade: form.shade || null,
        tooth_numbers: form.tooth_numbers || null,
        units: parseInt(form.units) || 1,
        due_date: form.due_date || null,
        price: form.price ? parseFloat(form.price) : null,
        notes: form.notes || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (created && startStage) {
      await supabase.from("case_stage_history").insert({
        case_id: created.id,
        lab_id: labId,
        stage_id: startStage.id,
      });
    }
    toast.success("تم إنشاء الحالة");
    setOpen(false);
    setForm({ doctor_id: "", patient_id: "", work_type_id: "", shade: "", tooth_numbers: "", units: "1", due_date: "", price: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const moveCase = async (caseId: string, toStageId: string) => {
    const { error } = await supabase.rpc("transition_case_stage", { _case_id: caseId, _to_stage_id: toStageId });
    if (error) return toast.error(error.message);
    toast.success("تم تغيير المرحلة");
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الحالات</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />حالة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>حالة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>الطبيب *</Label>
                <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
                  <SelectContent>{doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>المريض</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر مريضًا" /></SelectTrigger>
                  <SelectContent>{patients?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع العمل</Label>
                <Select value={form.work_type_id} onValueChange={(v) => setForm({ ...form, work_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                  <SelectContent>{workTypes?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>اللون</Label><Input value={form.shade} onChange={(e) => setForm({ ...form, shade: e.target.value })} placeholder="A2" /></div>
                <div><Label>عدد الوحدات</Label><Input type="number" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} /></div>
              </div>
              <div><Label>أرقام الأسنان</Label><Input value={form.tooth_numbers} onChange={(e) => setForm({ ...form, tooth_numbers: e.target.value })} placeholder="11, 12, 13" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تاريخ التسليم</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>السعر</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              </div>
              <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stages?.map((stage) => {
          const stageCases = cases?.filter((c) => c.current_stage_id === stage.id) ?? [];
          return (
            <div key={stage.id} className="rounded-lg border bg-card p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-semibold">{stage.name}</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{stageCases.length}</span>
              </div>
              <div className="space-y-2">
                {stageCases.map((c) => {
                  const overdue = c.due_date && c.due_date < today && c.status === "active";
                  const nextStage = stages?.find((s) => s.order_index === stage.order_index + 1);
                  return (
                    <Card key={c.id} className="cursor-pointer">
                      <CardContent className="p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{c.case_number}</span>
                          {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        </div>
                        <p className="font-medium">{(c as any).doctors?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{(c as any).patients?.name ?? "—"}</p>
                        {(c as any).work_types?.name && <p className="mt-1 text-xs">{(c as any).work_types.name}</p>}
                        {c.due_date && (
                          <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(c.due_date), "dd/MM/yyyy")}
                          </p>
                        )}
                        {nextStage && !stage.is_end && (
                          <Button size="sm" variant="outline" className="mt-2 w-full text-xs" onClick={() => moveCase(c.id, nextStage.id)}>
                            ← {nextStage.name}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {!stageCases.length && <p className="py-4 text-center text-xs text-muted-foreground">فارغ</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
