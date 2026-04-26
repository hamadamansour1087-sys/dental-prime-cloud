import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/delivery/delivered")({
  component: DeliveredPage,
});

function DeliveredPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["my-deliveries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: agent } = await supabase.from("delivery_agents").select("id").eq("user_id", user!.id).maybeSingle();
      if (!agent) return [];
      const { data } = await supabase
        .from("case_deliveries")
        .select("id, delivered_at, latitude, longitude, recipient_name, notes, cases(case_number, doctors(name))")
        .eq("agent_id", agent.id)
        .order("delivered_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3" dir="rtl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" /> الحالات المسلّمة
      </h1>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : deliveries.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لم تسلّم أي حالة بعد</Card>
      ) : (
        deliveries.map((d: any) => (
          <Card key={d.id} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{d.cases?.case_number}</p>
                <p className="font-semibold">{d.cases?.doctors?.name}</p>
                {d.recipient_name && <p className="text-xs text-muted-foreground">المستلم: {d.recipient_name}</p>}
              </div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(d.delivered_at), "yyyy-MM-dd HH:mm")}</span>
              {d.latitude && d.longitude && (
                <a href={`https://maps.google.com/?q=${d.latitude},${d.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <MapPin className="h-3 w-3" /> الموقع
                </a>
              )}
            </div>
            {d.notes && <p className="text-xs text-muted-foreground mt-1">ملاحظات: {d.notes}</p>}
          </Card>
        ))
      )}
      <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/delivery/dashboard" })}>
        عودة للحالات الجاهزة
      </Button>
    </div>
  );
}
