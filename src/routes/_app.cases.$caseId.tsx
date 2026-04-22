import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Download, Trash2, FileBox, ImageIcon, Calendar, QrCode, ArrowLeftRight, History, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ToothChartMini } from "@/components/ToothChartMini";
import { CaseLabelDialog } from "@/components/CaseLabelDialog";
import { StageTransitionDialog } from "@/components/StageTransitionDialog";

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
        .select("*, work_types(name)")
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => router.history.back()}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">حالة <span className="font-mono text-primary">{caseRow.case_number}</span></h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(caseRow.date_received), "dd/MM/yyyy")}
              {caseRow.due_date && (
                <> · <Calendar className="inline h-3 w-3" /> تسليم {format(new Date(caseRow.due_date), "dd/MM/yyyy")}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage && (
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm" style={{ borderColor: stage.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
              {stage.name}
            </span>
          )}
          {caseRow.status !== "delivered" && (
            <Button size="sm" onClick={() => setStageOpen(true)}>
              <ArrowLeftRight className="ml-1 h-4 w-4" /> نقل المرحلة
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setLabelOpen(true)}>
            <QrCode className="ml-1 h-4 w-4" /> ملصق QR
          </Button>
        </div>
      </div>

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

      {/* Header info */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">الطبيب</p>
            <p className="font-medium">{(caseRow as any).doctors?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المريض</p>
            <p className="font-medium">{(caseRow as any).patients?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">إجمالي الوحدات</p>
            <p className="font-mono font-semibold">{caseRow.units ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الإجمالي</p>
            <p className="font-mono font-bold text-primary">{Number(caseRow.price ?? itemsTotal).toFixed(2)}</p>
          </div>
          {caseRow.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted-foreground">ملاحظات</p>
              <p className="whitespace-pre-wrap">{caseRow.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                      {it.tooth_numbers ? <ToothChartMini selected={it.tooth_numbers} /> : <span className="text-xs text-muted-foreground">—</span>}
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
