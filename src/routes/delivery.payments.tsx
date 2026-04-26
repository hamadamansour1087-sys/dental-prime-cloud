import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, XCircle, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/delivery/payments")({
  component: AgentPayments,
});

function AgentPayments() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agent-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: agent } = await supabase.from("delivery_agents").select("id").eq("user_id", user!.id).maybeSingle();
      if (!agent) return [];
      const { data } = await supabase
        .from("pending_payments")
        .select("id, amount, method, status, collected_at, rejection_reason, doctors(name)")
        .eq("agent_id", agent.id)
        .order("collected_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3" dir="rtl">
      <h1 className="text-xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> سندات القبض</h1>

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
