import { createFileRoute } from "@tanstack/react-router";
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
import { RotateCcw, Wrench } from "lucide-react";

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
  const [followup, setFollowup] = useState<FollowupTarget>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        // Only allow requesting remake/repair for delivered cases that are themselves "new"
        // (avoid R-R-R chains from the portal). The lab can still chain via the admin UI.
        const canRequestFollowup =
          c.status === "delivered" && (c.case_type ?? "new") === "new";
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
