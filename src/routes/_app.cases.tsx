import { createFileRoute, Link } from "@tanstack/react-router";
void Link;
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, AlertTriangle, Trash2, Camera, Upload, FileBox, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ToothChart } from "@/components/ToothChart";

export const Route = createFileRoute("/_app/cases")({
  component: CasesPage,
});

interface CaseItemDraft {
  id: string; // local id
  work_type_id: string;
  tooth_numbers: string;
  shade: string;
  units: string;
  unit_price: string;
}

interface PendingFile {
  id: string;
  file: File;
  kind: "photo" | "scan";
  previewUrl?: string;
}

const SCAN_EXT = /\.(stl|ply|obj|zip|3mf|dcm)$/i;

function newItem(): CaseItemDraft {
  return { id: crypto.randomUUID(), work_type_id: "", tooth_numbers: "", shade: "", units: "1", unit_price: "" };
}

function CasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    doctor_id: "",
    clinic_id: "",
    patient_name: "",
    due_date: "",
    notes: "",
  });
  const [items, setItems] = useState<CaseItemDraft[]>([newItem()]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ doctor_id: "", clinic_id: "", patient_name: "", due_date: "", notes: "" });
    setItems([newItem()]);
    files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  };

  const { data: nextCaseNumber } = useQuery({
    queryKey: ["next-case-number", labId, open],
    enabled: !!labId && open,
    queryFn: async () => {
      const { data } = await supabase.rpc("generate_case_number", { _lab_id: labId! });
      return data as string;
    },
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
    queryFn: async () =>
      (await supabase
        .from("doctors")
        .select("id, name, governorate, doctor_clinics(id, name)")
        .eq("is_active", true)).data ?? [],
  });
  const selectedDoctor = doctors?.find((d: any) => d.id === form.doctor_id) as any;
  const { data: workTypes } = useQuery({
    queryKey: ["worktypes-select", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_types").select("id, name").eq("is_active", true)).data ?? [],
  });

  const updateItem = (id: string, patch: Partial<CaseItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const resolvePrice = async (workTypeId: string) => {
    if (!labId || !workTypeId) return null;
    const { data } = await supabase.rpc("resolve_case_price", {
      _lab_id: labId,
      _work_type_id: workTypeId,
      _doctor_id: (form.doctor_id || null) as string,
    });
    return data as number | null;
  };

  const onWorkTypeChange = async (id: string, workTypeId: string) => {
    updateItem(id, { work_type_id: workTypeId });
    const price = await resolvePrice(workTypeId);
    if (price != null) updateItem(id, { unit_price: String(price) });
  };

  const addFiles = (fileList: FileList | null, defaultKind: "photo" | "scan") => {
    if (!fileList) return;
    const additions: PendingFile[] = Array.from(fileList).map((file) => {
      const isScan = SCAN_EXT.test(file.name);
      const isImg = file.type.startsWith("image/");
      const kind: "photo" | "scan" = isScan ? "scan" : isImg ? "photo" : defaultKind;
      return {
        id: crypto.randomUUID(),
        file,
        kind,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      };
    });
    setFiles((prev) => [...prev, ...additions]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const submit = async () => {
    if (!labId || !form.doctor_id) return toast.error("اختر الطبيب");
    const validItems = items.filter((it) => it.work_type_id);
    if (!validItems.length) return toast.error("أضف نوع عمل واحد على الأقل");

    setSubmitting(true);
    try {
      // Patient
      let patientId: string | null = null;
      const trimmedName = form.patient_name.trim();
      if (trimmedName) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .ilike("name", trimmedName)
          .maybeSingle();
        if (existing) patientId = existing.id;
        else {
          const { data: newP, error: pErr } = await supabase
            .from("patients")
            .insert({ lab_id: labId, name: trimmedName })
            .select("id")
            .single();
          if (pErr) throw pErr;
          patientId = newP.id;
        }
      }

      const { data: caseNum } = await supabase.rpc("generate_case_number", { _lab_id: labId });
      const { data: wf } = await supabase.from("workflows").select("id").eq("is_default", true).maybeSingle();
      const startStage = stages?.find((s) => s.order_index === 1);

      // Aggregate roll-up fields on the case (first item's work_type/shade for legacy display + sum units, concat teeth)
      const first = validItems[0];
      const allTeeth = Array.from(new Set(validItems.flatMap((it) => it.tooth_numbers.split(",").map((s) => s.trim()).filter(Boolean)))).join(",");
      const totalUnits = validItems.reduce((s, it) => s + (parseInt(it.units) || 1), 0);
      const totalPrice = validItems.reduce((s, it) => {
        const u = parseInt(it.units) || 1;
        const p = parseFloat(it.unit_price) || 0;
        return s + u * p;
      }, 0);
      const allShades = Array.from(new Set(validItems.map((it) => it.shade.trim()).filter(Boolean))).join(", ");

      const { data: created, error } = await supabase
        .from("cases")
        .insert({
          lab_id: labId,
          case_number: caseNum as string,
          doctor_id: form.doctor_id,
          patient_id: patientId,
          work_type_id: first.work_type_id || null,
          workflow_id: wf?.id ?? null,
          current_stage_id: startStage?.id ?? null,
          shade: allShades || null,
          tooth_numbers: allTeeth || null,
          units: totalUnits,
          price: totalPrice || null,
          due_date: form.due_date || null,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Insert case items
      if (created) {
        const itemRows = validItems.map((it, idx) => {
          const u = parseInt(it.units) || 1;
          const p = it.unit_price ? parseFloat(it.unit_price) : null;
          return {
            lab_id: labId,
            case_id: created.id,
            work_type_id: it.work_type_id,
            tooth_numbers: it.tooth_numbers || null,
            shade: it.shade || null,
            units: u,
            unit_price: p,
            total_price: p != null ? p * u : null,
            position: idx,
          };
        });
        const { error: itemsErr } = await supabase.from("case_items").insert(itemRows);
        if (itemsErr) throw itemsErr;

        if (startStage) {
          await supabase.from("case_stage_history").insert({
            case_id: created.id,
            lab_id: labId,
            stage_id: startStage.id,
          });
        }

        // Upload files
        for (const pf of files) {
          const safeName = pf.file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${labId}/${created.id}/${pf.kind}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage.from("case-media").upload(path, pf.file, {
            contentType: pf.file.type || undefined,
            upsert: false,
          });
          if (upErr) {
            toast.error(`فشل رفع ${pf.file.name}: ${upErr.message}`);
            continue;
          }
          await supabase.from("case_attachments").insert({
            lab_id: labId,
            case_id: created.id,
            storage_path: path,
            file_name: pf.file.name,
            file_size: pf.file.size,
            mime_type: pf.file.type || null,
            kind: pf.kind,
          });
        }
      }

      toast.success(`تم تسجيل الحالة رقم ${created?.case_number ?? caseNum}`);
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["next-case-number"] });
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const moveCase = async (caseId: string, toStageId: string) => {
    const { error } = await supabase.rpc("transition_case_stage", { _case_id: caseId, _to_stage_id: toStageId });
    if (error) return toast.error(error.message);
    toast.success("تم تغيير المرحلة");
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  const grandTotal = items.reduce((s, it) => {
    const u = parseInt(it.units) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return s + u * p;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الحالات</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />حالة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span>حالة جديدة</span>
                {nextCaseNumber && (
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-sm text-primary">{nextCaseNumber}</span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Doctor + clinic + patient */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>الطبيب *</Label>
                  <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v, clinic_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
                    <SelectContent>
                      {doctors?.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}{d.governorate ? ` — ${d.governorate}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDoctor?.governorate && (
                    <p className="mt-1 text-xs text-muted-foreground">المحافظة: {selectedDoctor.governorate}</p>
                  )}
                </div>
                {selectedDoctor?.doctor_clinics?.length > 0 && (
                  <div>
                    <Label>العيادة</Label>
                    <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر العيادة" /></SelectTrigger>
                      <SelectContent>
                        {selectedDoctor.doctor_clinics.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>اسم المريض</Label>
                  <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} placeholder="اكتب اسم المريض" />
                </div>
                <div>
                  <Label>تاريخ التسليم</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>

              {/* Items */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">عناصر العمل</h3>
                  <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, newItem()])}>
                    <Plus className="ml-1 h-3.5 w-3.5" /> إضافة عنصر
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const lineTotal = (parseInt(it.units) || 0) * (parseFloat(it.unit_price) || 0);
                    return (
                      <div key={it.id} className="rounded-md border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">عنصر #{idx + 1}</span>
                          {items.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label className="text-xs">نوع العمل *</Label>
                            <Select value={it.work_type_id} onValueChange={(v) => onWorkTypeChange(it.id, v)}>
                              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                              <SelectContent>{workTypes?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">اللون</Label>
                            <Input value={it.shade} onChange={(e) => updateItem(it.id, { shade: e.target.value })} placeholder="A2" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">الوحدات</Label>
                              <Input type="number" min="1" value={it.units} onChange={(e) => updateItem(it.id, { units: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">سعر الوحدة</Label>
                              <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(it.id, { unit_price: e.target.value })} />
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-xs">الأسنان (خاصة بهذا العنصر)</Label>
                            <ToothChart value={it.tooth_numbers} onChange={(v) => updateItem(it.id, { tooth_numbers: v })} />
                          </div>
                        </div>
                        <div className="mt-2 text-left text-xs text-muted-foreground">
                          الإجمالي: <span className="font-mono font-semibold text-foreground">{lineTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2 text-sm">
                  <span className="font-semibold">إجمالي الحالة</span>
                  <span className="font-mono text-base font-bold text-primary">{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Files */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">صور وملفات الإسكان</h3>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }}
                    />
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }}
                    />
                    <input
                      ref={scanRef}
                      type="file"
                      accept=".stl,.ply,.obj,.zip,.3mf,.dcm"
                      multiple
                      hidden
                      onChange={(e) => { addFiles(e.target.files, "scan"); e.target.value = ""; }}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()}>
                      <Camera className="ml-1 h-3.5 w-3.5" /> كاميرا
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => photoRef.current?.click()}>
                      <ImageIcon className="ml-1 h-3.5 w-3.5" /> صور
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => scanRef.current?.click()}>
                      <FileBox className="ml-1 h-3.5 w-3.5" /> إسكان
                    </Button>
                  </div>
                </div>
                {files.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">لم يتم إضافة ملفات بعد</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {files.map((f) => (
                      <div key={f.id} className="group relative overflow-hidden rounded-md border bg-background">
                        {f.previewUrl ? (
                          <img src={f.previewUrl} alt={f.file.name} className="h-24 w-full object-cover" />
                        ) : (
                          <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center">
                            <FileBox className="h-6 w-6 text-muted-foreground" />
                            <span className="line-clamp-1 text-[10px] text-muted-foreground" dir="ltr">{f.file.name}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 p-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${f.kind === "scan" ? "bg-blue-500/10 text-blue-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                            {f.kind === "scan" ? "إسكان" : "صورة"}
                          </span>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(f.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? (
                  <><Upload className="ml-1 h-4 w-4 animate-pulse" /> جاري الحفظ...</>
                ) : "حفظ"}
              </Button>
            </DialogFooter>
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
                    <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary">
                      <CardContent className="p-3 text-sm">
                        <Link to="/cases/$caseId" params={{ caseId: c.id }} className="block">
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
                        </Link>
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
