import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Clock, Calendar, Plus, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/delivery/payments")({
  component: AgentPayments,
});

function AgentPayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: agent } = useQuery({
    queryKey: ["delivery-agent-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("delivery_agents")
        .select("id, name, lab_id, route_id, governorates, is_active, labs(name)").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agent-payments", user?.id],
    enabled: !!agent,
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_payments")
        .select("id, amount, method, status, collected_at, rejection_reason, doctors(name)")
        .eq("agent_id", agent!.id)
        .order("collected_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!agent?.id || !user?.id) return;
    const ch = supabase
      .channel(`agent-payments-${agent.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_payments", filter: `agent_id=eq.${agent.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agent-payments", user.id] });
          queryClient.invalidateQueries({ queryKey: ["agent-daily-summary", agent.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [agent?.id, queryClient, user?.id]);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> سندات القبض</h1>
        <Button asChild size="sm">
          <Link to="/delivery/doctors"><Plus className="ml-1 h-4 w-4" /> سند جديد</Link>
        </Button>
      </div>
      <Card className="p-2.5 text-xs text-muted-foreground bg-muted/40">
        لإنشاء سند: اختر الطبيب من <Link to="/delivery/doctors" className="text-primary font-semibold mx-1">قائمة الأطباء</Link> ثم اضغط "سند قبض جديد".
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لم تحصّل أي سند بعد</Card>
      ) : (
        items.map((it: any) => (
          <Card key={it.id} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">{Number(it.amount).toFixed(2)} <span className="text-xs text-muted-foreground">ج.م</span></p>
                <p className="text-sm">{it.doctors?.name}</p>
              </div>
              {it.status === "pending" && <Badge variant="secondary"><Clock className="ml-1 h-3 w-3" />بانتظار المراجعة</Badge>}
              {it.status === "approved" && <Badge><CheckCircle2 className="ml-1 h-3 w-3" />معتمد</Badge>}
              {it.status === "rejected" && <Badge variant="destructive"><XCircle className="ml-1 h-3 w-3" />مرفوض</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(it.collected_at), "yyyy-MM-dd HH:mm")}</span>
              {it.method && <span>{it.method}</span>}
            </div>
            {it.rejection_reason && <p className="text-xs text-destructive mt-1">سبب الرفض: {it.rejection_reason}</p>}
          </Card>
        ))
      )}
    </div>
  );
}
