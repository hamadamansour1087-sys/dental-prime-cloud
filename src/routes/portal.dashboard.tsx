import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, Wallet } from "lucide-react";

export const Route = createFileRoute("/portal/dashboard")({
  component: PortalDashboard,
});

function PortalDashboard() {
  const { user } = useAuth();

  const { data: doctor } = useQuery({
    queryKey: ["portal-doctor-stats-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, opening_balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["portal-stats", doctor?.id],
    enabled: !!doctor?.id,
    queryFn: async () => {
      const [cases, payments] = await Promise.all([
        supabase.from("cases").select("id, status, price").eq("doctor_id", doctor!.id),
        supabase.from("payments").select("amount").eq("doctor_id", doctor!.id),
      ]);
      const list = cases.data ?? [];
      // الحالات المُحتسبة على الطبيب: كل ما تم قبوله (مش معلق ومش ملغي)
      const billable = list.filter(
        (c: any) => c.status !== "pending_approval" && c.status !== "cancelled",
      );
      const totalCharges = billable.reduce((s, c: any) => s + (Number(c.price) || 0), 0);
      const totalPaid = (payments.data ?? []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const opening = Number(doctor?.opening_balance ?? 0);
      return {
        total: list.length,
        pending: list.filter((c: any) => c.status === "pending_approval").length,
        active: list.filter((c: any) => c.status === "active").length,
        delivered: list.filter((c: any) => c.status === "delivered").length,
        balance: opening + totalCharges - totalPaid,
      };
    },
  });

  const stats = [
    { label: "إجمالي الحالات", value: data?.total ?? 0, icon: ClipboardList, color: "text-blue-600" },
    { label: "في انتظار الموافقة", value: data?.pending ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "تحت التشغيل", value: data?.active ?? 0, icon: ClipboardList, color: "text-purple-600" },
    { label: "تم التسليم", value: data?.delivered ?? 0, icon: CheckCircle2, color: "text-green-600" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">لوحة التحكم</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{s.value}</p>
              </div>
              <s.icon className={`h-8 w-8 ${s.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">الرصيد المستحق</CardTitle>
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${(data?.balance ?? 0) > 0 ? "text-destructive" : "text-green-600"}`}>
            {(data?.balance ?? 0).toFixed(2)} ج.م
          </p>
          <Link to="/portal/statement" className="mt-2 inline-block text-sm text-primary hover:underline">
            عرض كشف الحساب التفصيلي ←
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Link
            to="/portal/new-case"
            className="block rounded-lg border-2 border-dashed border-primary/40 p-6 text-center transition hover:border-primary hover:bg-primary/5"
          >
            <p className="text-lg font-semibold text-primary">+ رفع حالة جديدة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ستظهر الحالة عند المعمل في انتظار الموافقة قبل بدء التنفيذ
            </p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
