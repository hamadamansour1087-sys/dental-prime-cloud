import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Trash2, FileBox, ImageIcon, History, FileText, Activity, Plus } from "lucide-react";
import { toast } from "sonner";
import { QuadrantsView } from "@/components/QuadrantsView";
import { CaseLabelDialog } from "@/components/CaseLabelDialog";
import { StageTransitionDialog } from "@/components/StageTransitionDialog";
import { CaseAIAnalysis } from "@/components/CaseAIAnalysis";
import { CaseDeliveryPrediction } from "@/components/CaseDeliveryPrediction";
import { CaseHeader } from "@/components/CaseHeader";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseProgressBar } from "@/components/CaseProgressBar";
import { CaseReport } from "@/components/reports/CaseReport";
import { renderReportToPdf } from "@/lib/reportRenderer";
import { ShadeSelector } from "@/components/ShadeSelector";
import { ToothChart } from "@/components/ToothChart";

export const Route = createFileRoute("/_app/cases/$caseId")({
  component: CaseDetailsPage,
  errorComponent: ({ error }) => (
    <div className="space-y-3 p-6 text-center">
      <p className="text-destructive">خطأ: {error.message}</p>
      <Link to="/cases" className="text-primary hover:underline">عودة للحالات</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="space-y-3 p-6 text-center">
      <p>الحالة غير موجودة</p>
      <Link to="/cases" className="text-primary hover:underline">عودة للحالات</Link>
    </div>
  ),
});

function CaseDetailsPage() {
  const { caseId } = Route.useParams();
  const { labId } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState({
    work_type_id: "",
    shade: "",
    tooth_numbers: "",
    units: "1",
    unit_price: "",
  });

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case-detail", caseId],
    enabled: !!labId && !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, doctors(name, phone), patients(name, phone), workflow_stages(name, color)")
        .eq("id", caseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: stageHistory } = useQuery({
    queryKey: ["case-stage-history", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_stage_history")
        .select("id, entered_at, exited_at, duration_minutes, skipped, notes, workflow_stages(name, color), technicians(name)")
        .eq("case_id", caseId)
        .order("entered_at");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["case-items", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_items")
        .select("*, work_types(name, work_type_categories(name, avg_delivery_days))")
        .eq("case_id", caseId)
        .order("position");
      return data ?? [];
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["case-attachments", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_attachments")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at");
      const withUrls = (data ?? []).map((a) => {
        const { data: pub } = supabase.storage.from("case-media").getPublicUrl(a.storage_path);
        return { ...a, url: pub.publicUrl };
      });
      return withUrls;
    },
  });

  const { data: workflowStages } = useQuery({
    queryKey: ["case-workflow-stages", (caseRow as any)?.workflow_id],
    enabled: !!(caseRow as any)?.workflow_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_stages")
        .select("id, name, color, order_index, is_end")
        .eq("workflow_id", (caseRow as any).workflow_id)
        .order("order_index");
      return data ?? [];
    },
  });

  const { data: workTypes } = useQuery({
    queryKey: ["work-types-detail", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("work_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const deleteAttachment = async (id: string, path: string) => {
    if (!confirm("حذف هذا الملف؟")) return;
    const { error: stErr } = await supabase.storage.from("case-media").remove([path]);
    if (stErr) return toast.error(stErr.message);
    const { error } = await supabase.from("case_attachments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["case-attachments", caseId] });
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const resetItemDraft = () => {
    setItemDraft({
      work_type_id: "",
      shade: "",
      tooth_numbers: "",
      units: "1",
      unit_price: "",
    });
  };

  const addCaseItem = async () => {
    if (!caseRow || !labId) return;
    if (!itemDraft.work_type_id) return toast.error("اختر نوع العمل أولاً");

    setAddingItem(true);
    try {
      let unitPrice = itemDraft.unit_price ? Number(itemDraft.unit_price) : null;
      if (unitPrice == null) {
        const { data } = await supabase.rpc("resolve_case_price", {
          _lab_id: caseRow.lab_id,
          _work_type_id: itemDraft.work_type_id,
          _doctor_id: caseRow.doctor_id ?? "00000000-0000-0000-0000-000000000000",
        });
        unitPrice = data ?? 0;
      }

      const units = Math.max(1, Number(itemDraft.units) || 1);
      const totalPrice = Number(unitPrice ?? 0) * units;

      const { error: itemError } = await supabase.from("case_items").insert({
        case_id: caseRow.id,
        lab_id: caseRow.lab_id,
        work_type_id: itemDraft.work_type_id,
        tooth_numbers: itemDraft.tooth_numbers || null,
        shade: itemDraft.shade || null,
        units,
        unit_price: unitPrice,
        total_price: totalPrice,
        position: items?.length ?? 0,
      });

      if (itemError) throw itemError;

      const mergedItems = [
        ...(items ?? []).map((item: any) => ({
          work_type_id: item.work_type_id,
          tooth_numbers: item.tooth_numbers,
          shade: item.shade,
          units: Number(item.units) || 0,
          total_price: Number(item.total_price) || 0,
        })),
        {
          work_type_id: itemDraft.work_type_id,
          tooth_numbers: itemDraft.tooth_numbers,
          shade: itemDraft.shade,
          units,
          total_price: totalPrice,
        },
      ];

      const allTeeth = Array.from(
        new Set(
          mergedItems.flatMap((item) =>
            String(item.tooth_numbers ?? "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ),
      ).join(",");

      const allShades = Array.from(
        new Set(mergedItems.map((item) => String(item.shade ?? "").trim()).filter(Boolean)),
      ).join(", ");

      await supabase
        .from("cases")
        .update({
          work_type_id: mergedItems[0]?.work_type_id ?? itemDraft.work_type_id,
          tooth_numbers: allTeeth || null,
          shade: allShades || null,
          units: mergedItems.reduce((sum, item) => sum + (Number(item.units) || 0), 0),
          price: mergedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
        })
        .eq("id", caseRow.id);

      toast.success("تمت إضافة الشغل الجديد وتحديث التكلفة");
      resetItemDraft();
      qc.invalidateQueries({ queryKey: ["case-items", caseId] });
      qc.invalidateQueries({ queryKey: ["case-detail", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    } catch (error: any) {
      toast.error(error.message ?? "تعذر إضافة الشغل الجديد");
    } finally {
      setAddingItem(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!caseRow) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p>الحالة غير موجودة</p>
        <Link to="/cases" className="text-primary hover:underline">عودة للحالات</Link>
      </div>
    );
  }

  const photos = attachments?.filter((a) => a.kind === "photo") ?? [];
  const scans = attachments?.filter((a) => a.kind !== "photo") ?? [];
  const itemsTotal = items?.reduce((s, it) => s + (Number(it.total_price) || 0), 0) ?? 0;
  const stage = (caseRow as any).workflow_stages;

  return (
    <div className="space-y-4">
      <CaseHeader
        caseRow={caseRow}
        stage={stage}
        onBack={() => router.history.back()}
        onMoveStage={() => setStageOpen(true)}
        onLabel={() => setLabelOpen(true)}
        onPdf={async () => {
          try {
            toast.loading("جاري إنشاء PDF...", { id: "pdf" });
            const { data: lab } = await supabase
              .from("labs")
              .select("name, phone, address, email, logo_url, currency")
              .eq("id", labId!)
              .maybeSingle();
            await renderReportToPdf(
              <CaseReport
                lab={lab ?? { name: "Lab" }}
                caseRow={caseRow}
                items={items ?? []}
                stageHistory={stageHistory ?? []}
              />,
              `case-${caseRow.case_number}.pdf`
            );
            toast.success("تم إنشاء PDF", { id: "pdf" });
          } catch (e: any) {
            toast.error(e?.message ?? "فشل إنشاء PDF", { id: "pdf" });
          }
        }}
      />

      <StageTransitionDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        caseId={caseRow.id}
        workflowId={caseRow.workflow_id}
        currentStageId={caseRow.current_stage_id}
      />

      <CaseLabelDialog
        open={labelOpen}
        onOpenChange={setLabelOpen}
        caseNumber={caseRow.case_number}
        caseId={caseRow.id}
        doctorName={(caseRow as any).doctors?.name}
        patientName={(caseRow as any).patients?.name}
        dateReceived={caseRow.date_received}
        dueDate={caseRow.due_date}
        stageName={stage?.name}
      />

      {/* Workflow progress bar */}
      {workflowStages && workflowStages.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> تقدم سير العمل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CaseProgressBar
              stages={workflowStages}
              currentStageId={caseRow.current_stage_id}
              completedStageIds={new Set((stageHistory ?? []).filter((h: any) => h.exited_at && !h.skipped).map((h: any) => h.stage_id).filter(Boolean))}
            />
          </CardContent>
        </Card>
      )}

      {caseRow.notes && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">ملاحظات الحالة</p>
                <p className="whitespace-pre-wrap text-sm">{caseRow.notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {caseRow.parent_case_id && caseRow.case_type !== "new" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> إضافة شغل جديد للحالة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>نوع العمل</Label>
                <Select value={itemDraft.work_type_id} onValueChange={(value) => setItemDraft((prev) => ({ ...prev, work_type_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع العمل" />
                  </SelectTrigger>
                  <SelectContent>
                    {workTypes?.map((workType) => (
                      <SelectItem key={workType.id} value={workType.id}>
                        {workType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>الوحدات</Label>
                <Input
                  type="number"
                  min="1"
                  value={itemDraft.units}
                  onChange={(event) => setItemDraft((prev) => ({ ...prev, units: event.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>اللون</Label>
                <ShadeSelector
                  value={itemDraft.shade}
                  onChange={(value) => setItemDraft((prev) => ({ ...prev, shade: value }))}
                  placeholder="اختر اللون"
                />
              </div>

              <div className="md:col-span-2">
                <Label>الأسنان</Label>
                <ToothChart
                  value={itemDraft.tooth_numbers}
                  onChange={(value) => setItemDraft((prev) => ({ ...prev, tooth_numbers: value }))}
                />
              </div>

              <div>
                <Label>سعر الوحدة</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemDraft.unit_price}
                  onChange={(event) => setItemDraft((prev) => ({ ...prev, unit_price: event.target.value }))}
                  placeholder="اتركه فارغًا للسعر التلقائي"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addCaseItem} disabled={addingItem} className="w-full md:w-auto">
                  <Plus className="h-4 w-4" />
                  {addingItem ? "جارٍ الإضافة..." : "إضافة الشغل"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Smart Analysis + Delivery Prediction */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CaseAIAnalysis
          caseData={{
            case_number: caseRow.case_number,
            status: caseRow.status,
            date_received: caseRow.date_received,
            due_date: caseRow.due_date,
            current_stage: stage?.name,
            doctor: (caseRow as any).doctors?.name,
            patient: (caseRow as any).patients?.name,
            units: caseRow.units,
            price: caseRow.price,
            notes: caseRow.notes,
            items_count: items?.length ?? 0,
            stages_done: stageHistory?.filter((h: any) => h.exited_at).length ?? 0,
            stages_total: stageHistory?.length ?? 0,
          }}
        />
        <CaseDeliveryPrediction
          caseData={{
            case_number: caseRow.case_number,
            date_received: caseRow.date_received,
            due_date: caseRow.due_date,
            current_stage: stage?.name,
            current_stage_entered_at: caseRow.stage_entered_at,
            categories: Array.from(
              new Map(
                (items ?? [])
                  .map((it: any) => it.work_types?.work_type_categories)
                  .filter(Boolean)
                  .map((c: any) => [c.name, c]),
              ).values(),
            ),
            workflow_stages: workflowStages?.map((s: any) => ({
              name: s.name,
              order: s.order_index,
              estimated_days: s.estimated_days,
              is_end: s.is_end,
            })) ?? [],
            stages_completed: (stageHistory ?? []).filter((h: any) => h.exited_at && !h.skipped).length,
            stages_total: workflowStages?.length ?? 0,
            avg_stage_duration_minutes:
              (stageHistory ?? []).filter((h: any) => h.duration_minutes).reduce((s: number, h: any) => s + h.duration_minutes, 0) /
                Math.max(1, (stageHistory ?? []).filter((h: any) => h.duration_minutes).length) || 0,
          }}
        />
      </div>

      {/* Items table */}
      <Card>
        <CardHeader><CardTitle className="text-base">عناصر العمل ({items?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!items?.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد عناصر</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>نوع العمل</TableHead>
                  <TableHead>اللون</TableHead>
                  <TableHead>الأسنان</TableHead>
                  <TableHead className="text-center">الوحدات</TableHead>
                  <TableHead className="text-left">سعر الوحدة</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{(it as any).work_types?.name ?? "—"}</TableCell>
                    <TableCell>
                      {it.shade ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold">{it.shade}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {it.tooth_numbers ? <QuadrantsView selected={it.tooth_numbers} compact /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center font-mono">{it.units}</TableCell>
                    <TableCell className="text-left font-mono">{it.unit_price != null ? Number(it.unit_price).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{it.total_price != null ? Number(it.total_price).toFixed(2) : "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={6} className="text-left font-semibold">إجمالي العناصر</TableCell>
                  <TableCell className="text-left font-mono font-bold text-primary">{itemsTotal.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> الصور ({photos.length})</CardTitle></CardHeader>
        <CardContent>
          {!photos.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد صور</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-md border bg-background">
                  <button type="button" onClick={() => setPreviewUrl(a.url)} className="block w-full">
                    <img src={a.url} alt={a.file_name} className="h-32 w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </button>
                  <div className="flex items-center justify-between gap-1 border-t bg-card p-1.5">
                    <span className="line-clamp-1 text-[10px] text-muted-foreground" dir="ltr">{a.file_name}</span>
                    <div className="flex gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadFile(a.url, a.file_name)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteAttachment(a.id, a.storage_path)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scans */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileBox className="h-4 w-4" /> الإسكانات والملفات ({scans.length})</CardTitle></CardHeader>
        <CardContent>
          {!scans.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد ملفات</p>
          ) : (
            <div className="space-y-2">
              {scans.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border bg-card p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileBox className="h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium" dir="ltr">{a.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.kind === "scan" ? "إسكان" : "ملف"}
                        {a.file_size ? ` · ${(a.file_size / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadFile(a.url, a.file_name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAttachment(a.id, a.storage_path)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage history timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> الخط الزمني للمراحل ({stageHistory?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CaseTimeline history={stageHistory ?? []} currentStageId={caseRow.current_stage_id} />
        </CardContent>
      </Card>
      {/* Image preview overlay */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={previewUrl} alt="preview" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
