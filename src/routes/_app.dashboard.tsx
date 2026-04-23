import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  LayoutGrid,
  Workflow,
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { DailyInsightsWidget } from "@/components/DailyInsightsWidget";

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
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

      const [active, overdue, deliveredToday, doctors, monthCases, monthRevenue] = await Promise.all([
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "active").lt("due_date", today),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "delivered").gte("date_delivered", today),
        supabase.from("doctors").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("cases").select("*", { count: "exact", head: true }).gte("date_received", monthStart),
        supabase.from("cases").select("price").eq("status", "delivered").gte("date_delivered", monthStart),
      ]);

      const revenue = (monthRevenue.data ?? []).reduce((sum, c) => sum + (Number(c.price) || 0), 0);

      return {
        active: active.count ?? 0,
        overdue: overdue.count ?? 0,
        deliveredToday: deliveredToday.count ?? 0,
        doctors: doctors.count ?? 0,
        monthCases: monthCases.count ?? 0,
        monthRevenue: revenue,
      };
    },
  });

  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend", labId],
    enabled: !!labId,
    queryFn: async () => {
      const start = format(subDays(new Date(), 13), "yyyy-MM-dd");
      const { data } = await supabase
        .from("cases")
        .select("date_received, status, date_delivered")
        .gte("date_received", start);

      const byDay = new Map<string, { received: number; delivered: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(startOfDay(new Date()), i), "MM/dd");
        byDay.set(d, { received: 0, delivered: 0 });
      }
      data?.forEach((c) => {
        if (c.date_received) {
          const k = format(new Date(c.date_received), "MM/dd");
          if (byDay.has(k)) byDay.get(k)!.received++;
        }
        if (c.date_delivered) {
          const k = format(new Date(c.date_delivered), "MM/dd");
          if (byDay.has(k)) byDay.get(k)!.delivered++;
        }
      });
      return Array.from(byDay.entries()).map(([day, v]) => ({ day, ...v }));
    },
  });

  const { data: stageStats } = useQuery({
    queryKey: ["dashboard-stages", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: stages } = await supabase
        .from("workflow_stages")
        .select("id, name, color, order_index")
        .order("order_index");
      const { data: cases } = await supabase
        .from("cases")
        .select("current_stage_id")
        .eq("status", "active");
      const counts = new Map<string, number>();
      cases?.forEach((c) => {
        if (c.current_stage_id) counts.set(c.current_stage_id, (counts.get(c.current_stage_id) ?? 0) + 1);
      });
      return (stages ?? []).map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
    },
  });

  const { data: topDoctors } = useQuery({
    queryKey: ["dashboard-top-doctors", labId],
    enabled: !!labId,
    queryFn: async () => {
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const { data } = await supabase
        .from("cases")
        .select("doctor_id, price, doctors(name)")
        .gte("date_received", monthStart)
        .not("doctor_id", "is", null);
      const map = new Map<string, { name: string; count: number; revenue: number }>();
      data?.forEach((c) => {
        const id = c.doctor_id!;
        const name = (c.doctors as { name?: string } | null)?.name ?? "—";
        const cur = map.get(id) ?? { name, count: 0, revenue: 0 };
        cur.count++;
        cur.revenue += Number(c.price) || 0;
        map.set(id, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });

  const totalActive = stageStats?.reduce((s, x) => s + x.count, 0) ?? 0;
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n) + " ج.م";

  const cards = [
    {
      label: "حالات نشطة",
      value: stats?.active ?? 0,
      icon: ClipboardList,
      gradient: "from-primary/15 to-primary/5",
      iconColor: "text-primary",
      href: "/cases",
    },
    {
      label: "حالات متأخرة",
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      gradient: "from-destructive/15 to-destructive/5",
      iconColor: "text-destructive",
      href: "/cases",
    },
    {
      label: "تسليمات اليوم",
      value: stats?.deliveredToday ?? 0,
      icon: CheckCircle2,
      gradient: "from-success/15 to-success/5",
      iconColor: "text-success",
      href: "/cases",
    },
    {
      label: "أطباء نشطون",
      value: stats?.doctors ?? 0,
      icon: Stethoscope,
      gradient: "from-chart-3/15 to-chart-3/5",
      iconColor: "text-chart-3",
      href: "/doctors",
    },
    {
      label: "حالات هذا الشهر",
      value: stats?.monthCases ?? 0,
      icon: Activity,
      gradient: "from-chart-2/15 to-chart-2/5",
      iconColor: "text-chart-2",
      href: "/cases",
    },
    {
      label: "إيرادات الشهر",
      value: fmtCurrency(stats?.monthRevenue ?? 0),
      icon: DollarSign,
      gradient: "from-chart-4/15 to-chart-4/5",
      iconColor: "text-chart-4",
      href: "/invoices",
      isText: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-6 shadow-elegant">
        <div className="relative z-10">
          <p className="text-xs font-medium text-primary">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            أهلاً، {profile?.full_name ?? "بك"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرة شاملة على أداء معملك اليوم
          </p>
        </div>
        <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.label} to={c.href}>
            <Card className={`card-hover cursor-pointer overflow-hidden bg-gradient-to-br ${c.gradient} border-0 shadow-elegant`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <c.icon className={`h-5 w-5 ${c.iconColor}`} />
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className={`mt-1 font-bold tracking-tight ${c.isText ? "text-base" : "text-2xl"}`}>
                  {c.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* AI Daily Insights */}
      <DailyInsightsWidget
        stats={{
          active_cases: stats?.active ?? 0,
          overdue_cases: stats?.overdue ?? 0,
          delivered_today: stats?.deliveredToday ?? 0,
          active_doctors: stats?.doctors ?? 0,
          month_cases: stats?.monthCases ?? 0,
          month_revenue: stats?.monthRevenue ?? 0,
          stage_distribution: stageStats?.map((s) => ({ stage: s.name, count: s.count })) ?? [],
          date: format(new Date(), "yyyy-MM-dd"),
        }}
      />

      <Tabs defaultValue="overview" dir="rtl">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="ml-1 h-4 w-4" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="stages">
            <Workflow className="ml-1 h-4 w-4" />
            توزيع المراحل
          </TabsTrigger>
          <TabsTrigger value="doctors">
            <TrendingUp className="ml-1 h-4 w-4" />
            أداء الأطباء
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Trend Chart */}
          <Card className="shadow-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">حركة الحالات (آخر 14 يوم)</CardTitle>
                  <CardDescription>المستلم مقابل المسلَّم يومياً</CardDescription>
                </div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend ?? []}>
                    <defs>
                      <linearGradient id="recv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="deliv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone"
                      dataKey="received"
                      name="مستلَم"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#recv)"
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      name="مسلَّم"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#deliv)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="text-base">توزيع الحالات على المراحل</CardTitle>
                <CardDescription>إجمالي {totalActive} حالة نشطة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageStats?.map((s) => {
                  const pct = totalActive > 0 ? (s.count / totalActive) * 100 : 0;
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background"
                          style={{ backgroundColor: s.color, boxShadow: `0 0 12px ${s.color}50` }}
                        />
                        <span className="flex-1 text-sm font-medium">{s.name}</span>
                        <Badge variant="secondary" className="font-mono">
                          {s.count}
                        </Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
                {!stageStats?.length && (
                  <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="text-base">المخطط الدائري للمراحل</CardTitle>
                <CardDescription>نسبة كل مرحلة من إجمالي الحالات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(stageStats ?? []).filter((s) => s.count > 0)}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {(stageStats ?? []).map((s) => (
                          <Cell key={s.id} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="doctors">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-base">أعلى 5 أطباء هذا الشهر</CardTitle>
              <CardDescription>حسب عدد الحالات المسجلة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDoctors ?? []} layout="vertical" margin={{ right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={120} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" name="عدد الحالات" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!topDoctors?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  لا توجد بيانات هذا الشهر
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
