import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";

type Stage = { id: string; name: string; code: string; color: string; order_index: number; is_end: boolean };

export function StageTransitionDialog({
  open,
  onOpenChange,
  caseId,
  workflowId,
  currentStageId,
  initialToStageId,
  onTransitioned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  workflowId: string | null;
  currentStageId: string | null;
  initialToStageId?: string;
  onTransitioned?: () => void;
}) {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [toStageId, setToStageId] = useState<string>("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: stages } = useQuery({
    queryKey: ["wf-stages", workflowId, labId],
    enabled: !!workflowId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_stages")
        .select("id, name, code, color, order_index, is_end")
        .eq("workflow_id", workflowId!)
        .order("order_index");
      return (data ?? []) as Stage[];
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians-active", labId],
    enabled: !!labId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const currentStage = useMemo(() => stages?.find((s) => s.id === currentStageId), [stages, currentStageId]);
  const toStage = useMemo(() => stages?.find((s) => s.id === toStageId), [stages, toStageId]);

  // Stages strictly after current (forward only)
  const forwardStages = useMemo(() => {
    if (!stages) return [];
    const currOrder = currentStage?.order_index ?? 0;
    return stages.filter((s) => s.order_index > currOrder);
  }, [stages, currentStage]);

  // Skipped stages = stages strictly between current and target
  const skipped = useMemo(() => {
    if (!stages || !toStage) return [] as Stage[];
    const from = currentStage?.order_index ?? 0;
    return stages.filter((s) => s.order_index > from && s.order_index < toStage.order_index);
  }, [stages, currentStage, toStage]);

  const requiresTechnician = toStage?.code === "ready";

  useEffect(() => {
    if (!open) {
      setToStageId("");
      setTechnicianId("");
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setToStageId(initialToStageId ?? "");
    }
  }, [open, initialToStageId]);

  // Auto-select technician if only one available
  useEffect(() => {
    if (requiresTechnician && technicians?.length === 1 && !technicianId) {
      setTechnicianId(technicians[0].id);
    }
  }, [requiresTechnician, technicians, technicianId]);

  const submit = async () => {
    if (!toStageId) return toast.error("اختر المرحلة التالية");
    if (requiresTechnician && !technicianId) return toast.error("اختر اسم الفني");
    setSubmitting(true);
    const { error } = await supabase.rpc("transition_case_stage", {
      _case_id: caseId,
      _to_stage_id: toStageId,
      _notes: notes || undefined,
      _technician_id: technicianId || undefined,
      _skipped_stage_ids: skipped.length ? skipped.map((s) => s.id) : undefined,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم نقل المرحلة");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["case-detail", caseId] });
    qc.invalidateQueries({ queryKey: ["case-stage-history", caseId] });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stages"] });
    qc.invalidateQueries({ queryKey: ["technician-production"] });
    onTransitioned?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> نقل المرحلة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {currentStage && (
            <div className="rounded-md border bg-muted/30 p-2 text-sm">
              المرحلة الحالية:{" "}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: currentStage.color + "20", color: currentStage.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                {currentStage.name}
              </span>
            </div>
          )}

          <div>
            <Label>المرحلة التالية *</Label>
            <Select value={toStageId} onValueChange={setToStageId}>
              <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
              <SelectContent>
                {forwardStages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
                {!forwardStages.length && <div className="p-2 text-sm text-muted-foreground">لا توجد مراحل تالية</div>}
              </SelectContent>
            </Select>
          </div>

          {skipped.length > 0 && (
            <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              سيتم تخطي: {skipped.map((s) => s.name).join("، ")}
            </div>
          )}

          {requiresTechnician && (
            <div>
              <Label>الفني المسؤول *</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger><SelectValue placeholder="اختر الفني" /></SelectTrigger>
                <SelectContent>
                  {technicians?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {!technicians?.length && <div className="p-2 text-sm text-muted-foreground">لا يوجد فنيون. أضف أولًا من صفحة الفنيين.</div>}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">سيتم تسجيل وحدات هذه الحالة باسمه</p>
            </div>
          )}

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting || !toStageId || (requiresTechnician && !technicianId)}>
            {submitting ? "جارٍ..." : "نقل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
