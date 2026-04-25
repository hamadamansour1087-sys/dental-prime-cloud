import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Paperclip } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pending-cases")({
  component: PendingCasesPage,
});

function PendingCasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();

  const { data: cases } = useQuery({
    queryKey: ["pending-cases", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(
          "id, created_at, shade, tooth_numbers, units, due_date, notes, work_types(name), doctors(name), patients(name), case_attachments(id, file_name, storage_path)"
        )
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = async (id: string) => {
    // Ensure session is fresh before calling SECURITY DEFINER RPC that checks auth.uid()
    await supabase.auth.getSession();
    const { error } = await supabase.rpc("approve_pending_case", { _case_id: id });
    if (error) {
      const msg = error.message?.includes("Forbidden")
        ? "ليس لديك صلاحية لقبول الحالات (يتطلب صلاحية مدير أو مشرف)"
        : error.message;
      return toast.error(msg);
    }
    toast.success("تم قبول الحالة وبدء التشغيل");
    qc.invalidateQueries({ queryKey: ["pending-cases"] });
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const reject = async (id: string) => {
    const reason = prompt("سبب الرفض (اختياري):");
    if (reason === null) return;
    const { error } = await supabase.rpc("reject_pending_case", { _case_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("تم رفض الحالة");
    qc.invalidateQueries({ queryKey: ["pending-cases"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">طلبات الأطباء (بانتظار الموافقة)</h1>
        <Badge variant="secondary">{cases?.length ?? 0}</Badge>
      </div>

      {!cases?.length && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            لا توجد طلبات معلّقة حاليًا
          </CardContent>
        </Card>
      )}

      {cases?.map((c: any) => (
        <Card key={c.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  د. {c.doctors?.name} — {c.patients?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.work_types?.name} • {new Date(c.created_at).toLocaleString("ar-EG")}
                </p>
              </div>
              <Badge variant="outline">بانتظار الموافقة</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              {c.shade && <div><span className="text-muted-foreground">شيد:</span> {c.shade}</div>}
              {c.tooth_numbers && <div><span className="text-muted-foreground">أسنان:</span> {c.tooth_numbers}</div>}
              {c.units && <div><span className="text-muted-foreground">وحدات:</span> {c.units}</div>}
              {c.due_date && <div><span className="text-muted-foreground">تسليم:</span> {c.due_date}</div>}
            </div>

            {c.notes && <p className="rounded bg-muted/40 p-2 text-xs">📝 {c.notes}</p>}

            {c.case_attachments?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {c.case_attachments.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from("case-attachments")
                        .createSignedUrl(a.storage_path, 60);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-secondary/80"
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.file_name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => reject(c.id)}>
                <X className="ml-1 h-4 w-4" />
                رفض
              </Button>
              <Button size="sm" onClick={() => approve(c.id)}>
                <Check className="ml-1 h-4 w-4" />
                قبول وبدء التشغيل
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
