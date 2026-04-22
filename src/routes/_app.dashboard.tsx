import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ClipboardList, AlertTriangle, CheckCircle2, Stethoscope, LayoutGrid, Workflow } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { labId, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", labId],
    enabled: !!labId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [active, overdue, deliveredToday, doctors] = await Promise.all([
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "active").lt("due_date", today),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "delivered").gte("date_delivered", today),
        supabase.from("doctors").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        active: active.count ?? 0,
        overdue: overdue.count ?? 0,
        deliveredToday: deliveredToday.count ?? 0,
        doctors: doctors.count ?? 0,
      };
    },
  });

  const { data: stageStats } = useQuery({
    queryKey: ["dashboard-stages", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: stages } = await supabase.from("workflow_stages").select("id, name, color, order_index").order("order_index");
      const { data: cases } = await supabase.from("cases").select("current_stage_id").eq("status", "active");
      const counts = new Map<string, number>();
      cases?.forEach((c) => {
        if (c.current_stage_id) counts.set(c.current_stage_id, (counts.get(c.current_stage_id) ?? 0) + 1);
      });
      return (stages ?? []).map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
    },
  });

  const cards = [
    { label: "حالات نشطة", value: stats?.active ?? 0, icon: ClipboardList, color: "text-primary" },
    { label: "متأخرة", value: stats?.overdue ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: "تسليمات اليوم", value: stats?.deliveredToday ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "أطباء نشطون", value: stats?.doctors ?? 0, icon: Stethoscope, color: "text-chart-3" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">أهلاً، {profile?.full_name ?? ""}</h1>
        <p className="text-sm text-muted-foreground">نظرة سريعة على حالة المعمل</p>
      </div>

      <Tabs defaultValue="overview" dir="rtl">
        <TabsList>
          <TabsTrigger value="overview"><LayoutGrid className="ml-1 h-4 w-4" />نظرة عامة</TabsTrigger>
          <TabsTrigger value="stages"><Workflow className="ml-1 h-4 w-4" />توزيع المراحل</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="mt-1 text-2xl font-bold">{c.value}</p>
                  </div>
                  <c.icon className={`h-8 w-8 ${c.color}`} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stages">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع الحالات على المراحل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stageStats?.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
              {!stageStats?.length && <p className="text-sm text-muted-foreground">لا توجد بيانات</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
