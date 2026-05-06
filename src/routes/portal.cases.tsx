import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RotateCcw, Wrench, Eye, Download, FileBox, ImageIcon, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { ScanPreviewDialog } from "@/components/ScanPreviewDialog";

export const Route = createFileRoute("/portal/cases")({
  component: PortalCases,
});

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "بانتظار الموافقة", variant: "outline" },
  active: { label: "تحت التشغيل", variant: "default" },
  on_hold: { label: "موقوفة", variant: "secondary" },
  delivered: { label: "تم التسليم", variant: "secondary" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

type FollowupTarget = {
  caseId: string;
  caseNumber: string;
  type: "remake" | "repair";
} | null;

function PortalCases() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [followup, setFollowup] = useState<FollowupTarget>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanPreview, setScanPreview] = useState<{ url: string; name: string } | null>(null);

  const { data: doctor } = useQuery({
    queryKey: ["portal-doctor-cases-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["portal-cases", doctor?.id],
    enabled: !!doctor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(
          "id, case_number, status, date_received, due_date, price, shade, tooth_numbers, notes, case_type, parent_case_id, work_types(name), workflow_stages!cases_current_stage_id_fkey(name, color)"
        )
        .eq("doctor_id", doctor!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch attachments for the expanded case
  const { data: attachments } = useQuery({
    queryKey: ["portal-case-attachments", expandedCase],
    enabled: !!expandedCase,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_attachments")
        .select("*")
        .eq("case_id", expandedCase!)
        .order("created_at");
      const rows = data ?? [];
      const withUrls = await Promise.all(
        rows.map(async (a: any) => {
          let signedUrl = "";
          for (const bucket of ["case-attachments", "case-media"]) {
            const { data: signed } = await supabase.storage
              .from(bucket)
              .createSignedUrl(a.storage_path, 60 * 60);
            if (signed?.signedUrl) { signedUrl = signed.signedUrl; break; }
          }
          return { ...a, url: signedUrl };
        })
      );
      return withUrls;
    },
  });

  const photos = attachments?.filter((a: any) => a.kind === "photo") ?? [];
  const scans = attachments?.filter((a: any) => a.kind !== "photo") ?? [];

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

  const openFollowup = (caseId: string, caseNumber: string, type: "remake" | "repair") => {
    setFollowup({ caseId, caseNumber, type });
    setNotes("");
  };

  const submitFollowup = async () => {
    if (!followup) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("request_followup_case_from_portal", {
      _parent_case_id: followup.caseId,
      _case_type: followup.type,
      _notes: notes || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      followup.type === "remake"
        ? "تم إرسال طلب الإعادة للمعمل"
        : "تم إرسال طلب التصليح للمعمل",
    );
    setFollowup(null);
    qc.invalidateQueries({ queryKey: ["portal-cases", doctor?.id] });
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">حالاتي</h1>
      {!cases?.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">لا توجد حالات بعد</p>
      )}
      {cases?.map((c: any) => {
        const s = statusLabels[c.status] ?? { label: c.status, variant: "outline" as const };
        const canRequestFollowup =
          c.status === "delivered" && (c.case_type ?? "new") === "new";
        const isExpanded = expandedCase === c.id;
        return (
          <Card key={c.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {c.case_number?.startsWith("PENDING-") ? "— (بانتظار الرقم)" : c.case_number || "— (بانتظار الرقم)"}
                    {c.case_type === "remake" && (
                      <Badge variant="secondary" className="ms-2">إعادة</Badge>
                    )}
                    {c.case_type === "repair" && (
                      <Badge variant="secondary" className="ms-2">تصليح</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.work_types?.name ?? "—"} • {c.date_received}
                  </p>
                </div>
                <Badge variant={s.variant}>{s.label}</Badge>
              </div>
              {c.workflow_stages && (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.workflow_stages.color }}
                  />
                  <span>{c.workflow_stages.name}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.shade && <span>الشيد: {c.shade}</span>}
                {c.tooth_numbers && <span>الأسنان: {c.tooth_numbers}</span>}
                {c.due_date && <span>التسليم: {c.due_date}</span>}
                {c.price != null && <span className="font-mono text-foreground">{Number(c.price).toFixed(2)} ج.م</span>}
              </div>
              {c.notes && <p className="text-xs text-muted-foreground">📝 {c.notes}</p>}

              {/* Toggle attachments */}
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-center gap-1 text-xs"
                onClick={() => setExpandedCase(isExpanded ? null : c.id)}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {isExpanded ? "إخفاء الملفات" : "عرض الملفات والإسكانات"}
              </Button>

              {isExpanded && (
                <div className="space-y-3 border-t pt-3">
                  {/* Photos */}
                  {photos.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" /> الصور ({photos.length})
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {photos.map((a: any) => (
                          <div key={a.id} className="group relative overflow-hidden rounded-md border bg-background">
                            <button type="button" onClick={() => setPreviewUrl(a.url)} className="block w-full">
                              <img src={a.url} alt={a.file_name} className="h-24 w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                            </button>
                            <div className="flex items-center justify-between border-t bg-card p-1">
                              <span className="line-clamp-1 text-[10px] text-muted-foreground" dir="ltr">{a.file_name}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadFile(a.url, a.file_name)}>
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scans */}
                  {scans.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <FileBox className="h-3.5 w-3.5" /> الإسكانات ({scans.length})
                      </p>
                      <div className="space-y-1.5">
                        {scans.map((a: any) => {
                          const ext = a.file_name?.split(".").pop()?.toLowerCase() ?? "";
                          const is3D = ["stl", "ply", "obj", "3mf", "zip"].includes(ext);
                          return (
                            <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border bg-card p-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <FileBox className="h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-xs font-medium" dir="ltr">{a.file_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {a.kind === "scan" ? "إسكان" : "ملف"}
                                    {a.file_size ? ` · ${(a.file_size / 1024).toFixed(0)} KB` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {is3D && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="معاينة 3D"
                                    onClick={() => setScanPreview({ url: a.url, name: a.file_name })}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadFile(a.url, a.file_name)}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!photos.length && !scans.length && (
                    <p className="py-3 text-center text-xs text-muted-foreground">لا توجد ملفات مرفقة</p>
                  )}
                </div>
              )}

              {canRequestFollowup && (
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFollowup(c.id, c.case_number, "remake")}
                  >
                    <RotateCcw className="me-1 h-3.5 w-3.5" />
                    طلب إعادة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFollowup(c.id, c.case_number, "repair")}
                  >
                    <Wrench className="me-1 h-3.5 w-3.5" />
                    طلب تصليح
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Image preview overlay */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={previewUrl} alt="preview" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}

      {/* 3D Scan preview */}
      <ScanPreviewDialog
        open={!!scanPreview}
        onOpenChange={(v) => !v && setScanPreview(null)}
        url={scanPreview?.url}
        fileName={scanPreview?.name}
      />

      <Dialog open={!!followup} onOpenChange={(v) => !v && setFollowup(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {followup?.type === "remake" ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Wrench className="h-4 w-4" />
              )}
              {followup?.type === "remake" ? "طلب إعادة الحالة" : "طلب تصليح الحالة"}
            </DialogTitle>
            <DialogDescription>
              مرتبط بالحالة:{" "}
              <span className="font-mono font-semibold">{followup?.caseNumber}</span>
              <br />
              سيُرسل الطلب إلى المعمل وسيتم مراجعته قبل البدء.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>تفاصيل الطلب / السبب</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={
                  followup?.type === "remake"
                    ? "اشرح سبب الإعادة (مثلاً: مشكلة في المقاس، الشكل، اللون...)"
                    : "اشرح المطلوب تصليحه..."
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowup(null)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={submitFollowup} disabled={submitting}>
              {submitting ? "جارٍ الإرسال..." : "إرسال للمعمل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
