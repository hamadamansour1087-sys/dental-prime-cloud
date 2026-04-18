import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/workflows")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { labId } = useAuth();
  const { data: workflows } = useQuery({
    queryKey: ["workflows-full", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: wfs } = await supabase.from("workflows").select("*").order("created_at");
      const { data: stages } = await supabase.from("workflow_stages").select("*").order("order_index");
      return (wfs ?? []).map((w) => ({ ...w, stages: stages?.filter((s) => s.workflow_id === w.id) ?? [] }));
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">سير العمل</h1>
        <p className="text-sm text-muted-foreground">مراحل الإنتاج لمعملك</p>
      </div>

      {workflows?.map((wf) => (
        <Card key={wf.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {wf.name}
              {wf.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">افتراضي</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {wf.stages.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: s.color }}>
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.estimated_days != null && s.estimated_days > 0 && (
                      <span className="text-xs text-muted-foreground">({s.estimated_days} يوم)</span>
                    )}
                  </div>
                  {i < wf.stages.length - 1 && <span className="text-muted-foreground">←</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-center text-xs text-muted-foreground">تخصيص المراحل سيكون متاحًا في التحديث القادم</p>
    </div>
  );
}
