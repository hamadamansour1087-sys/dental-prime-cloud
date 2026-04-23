import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

function PortalCases() {
  const { user } = useAuth();

  const { data: cases } = useQuery({
    queryKey: ["portal-cases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(
          "id, case_number, status, date_received, due_date, price, shade, tooth_numbers, notes, work_types(name), workflow_stages!cases_current_stage_id_fkey(name, color)"
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">حالاتي</h1>
      {!cases?.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">لا توجد حالات بعد</p>
      )}
      {cases?.map((c: any) => {
        const s = statusLabels[c.status] ?? { label: c.status, variant: "outline" as const };
        return (
          <Card key={c.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.case_number || "— (بانتظار الرقم)"}</p>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
