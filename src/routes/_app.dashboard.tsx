import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  TrendingUp,
  Calendar,
  Activity,
  ArrowUpLeft,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { DailyInsightsWidget } from "@/components/DailyInsightsWidget";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { labId, profile } = useAuth();

  const { data: lab } = useQuery({
    queryKey: ["dashboard-lab", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("labs")
        .select("name, logo_url")
        .eq("id", labId!)
        .maybeSingle();
      return data;
    },
  });

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
        .select("doctor_id, price, doctors(name, clinic_name)")
        .eq("status", "delivered")
        .gte("date_delivered", monthStart)
        .not("doctor_id", "is", null);
      const map = new Map<string, { name: string; clinic: string; count: number; revenue: number }>();
      data?.forEach((c) => {
        const id = c.doctor_id!;
        const doc = c.doctors as { name?: string; clinic_name?: string } | null;
        const cur = map.get(id) ?? { name: doc?.name ?? "—", clinic: doc?.clinic_name ?? "", count: 0, revenue: 0 };
        cur.count++;
        cur.revenue += Number(c.price) || 0;
        map.set(id, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    },
  });

  const totalActive = stageStats?.reduce((s, x) => s + x.count, 0) ?? 0;
  const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n) + " ج.م";

  // First 4 stages for the segmented bar
  const segmentStages = (stageStats ?? []).slice(0, 4);
  const segmentTotal = segmentStages.reduce((s, x) => s + x.count, 0) || 1;

  // Initials for doctor avatars
  const initials = (name: string) =>
    name
      .replace(/^د\.?\s*/, "")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("");

  return (
    <div className="space-y-5 md:space-y-6" dir="rtl">
      {/* Greeting Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          {lab?.logo_url ? (
            <img
              src={lab.logo_url}
              alt={lab?.name ?? "logo"}
              className="size-12 md:size-14 rounded-2xl object-contain bg-card border border-border shadow-sm"
            />
          ) : (
            <div className="size-12 md:size-14 rounded-2xl bg-primary/10 border border-border flex items-center justify-center text-primary font-bold text-lg">
              {(lab?.name ?? "L").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">
              {format(new Date(), "EEEE • d MMMM yyyy")}
            </p>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-balance">
              {lab?.name ?? "المعمل"}
            </h1>
            {profile?.full_name && (
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                مرحباً، {profile.full_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto bg-card px-4 py-2 rounded-full shadow-sm border border-border">
          <span className="size-2 rounded-full bg-success" />
          <span className="text-xs md:text-sm font-medium">يعمل بانتظام</span>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Hero: Revenue + Stage Distribution (8 cols) */}
        <Link
          to="/invoices"
          className="lg:col-span-8 group bg-card rounded-3xl p-6 md:p-8 shadow-elegant border border-border/60 relative overflow-hidden transition-all hover:shadow-lg"
        >
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl bg-primary/10 pointer-events-none" />
          <div className="absolute -bottom-32 -right-16 w-72 h-72 rounded-full blur-3xl bg-warning/10 pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start gap-4">
            <div>
              <h2 className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4">
                إيرادات الشهر
              </h2>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight tabular-nums">
                  {fmtNum(stats?.monthRevenue ?? 0)}
                </span>
                <span className="text-muted-foreground text-base md:text-xl">ج.م</span>
              </div>
              <p className="text-xs md:text-sm text-primary mt-2 font-medium flex items-center gap-1">
                <TrendingUp className="size-3.5" />
                من بداية الشهر حتى الآن
              </p>
            </div>
            <div className="text-left shrink-0">
              <span className="text-muted-foreground text-xs block mb-1">حالات الشهر</span>
              <span className="text-2xl md:text-3xl font-medium tabular-nums">
                {fmtNum(stats?.monthCases ?? 0)}
              </span>
            </div>
          </div>

          {/* Stage segmented bar */}
          <div className="relative z-10 mt-8 md:mt-10">
            <div className="text-xs md:text-sm text-muted-foreground mb-3">
              توزيع الحالات النشطة ({fmtNum(totalActive)})
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex ring-1 ring-inset ring-border/50">
              {segmentStages.map((s) => {
                const w = (s.count / segmentTotal) * 100;
                if (w === 0) return null;
                return (
                  <div
                    key={s.id}
                    className="h-full transition-all"
                    style={{ width: `${w}%`, backgroundColor: s.color }}
                  />
                );
              })}
            </div>
            <div className="flex gap-x-4 gap-y-2 mt-3 text-xs text-muted-foreground flex-wrap">
              {segmentStages.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-foreground/80">{s.name}</span>
                  <span className="tabular-nums">({fmtNum(s.count)})</span>
                </div>
              ))}
              {segmentStages.length === 0 && <span>لا توجد بيانات</span>}
            </div>
          </div>
        </Link>

        {/* Side stack: Overdue + Delivered Today (4 cols) */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
          <Link
            to="/cases"
            className="bg-card rounded-3xl p-5 md:p-6 shadow-elegant border-t-4 border-t-destructive border-x border-b border-border/60 hover:shadow-lg transition-all flex flex-col justify-between min-h-[120px] lg:min-h-0 lg:flex-1"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-muted-foreground text-xs md:text-sm">حالات متأخرة</h3>
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl md:text-4xl font-medium text-destructive tabular-nums">
                {fmtNum(stats?.overdue ?? 0)}
              </span>
              <span className="text-muted-foreground text-xs md:text-sm">حالة</span>
            </div>
          </Link>

          <Link
            to="/cases"
            className="bg-card rounded-3xl p-5 md:p-6 shadow-elegant border-t-4 border-t-success border-x border-b border-border/60 hover:shadow-lg transition-all flex flex-col justify-between min-h-[120px] lg:min-h-0 lg:flex-1"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-muted-foreground text-xs md:text-sm">تسليمات اليوم</h3>
              <CheckCircle2 className="size-4 text-success" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl md:text-4xl font-medium tabular-nums">
                {fmtNum(stats?.deliveredToday ?? 0)}
              </span>
              <span className="text-muted-foreground text-xs md:text-sm">حالة</span>
            </div>
          </Link>
        </div>

        {/* Mini KPIs (3 cards on desktop, 3 cols mobile) */}
        <Link
          to="/cases"
          className="lg:col-span-4 bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60 hover:shadow-lg transition-all flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 md:size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">حالات نشطة</p>
              <p className="text-xl md:text-2xl font-medium tabular-nums">
                {fmtNum(stats?.active ?? 0)}
              </p>
            </div>
          </div>
          <ArrowUpLeft className="size-4 text-muted-foreground shrink-0" />
        </Link>

        <Link
          to="/doctors"
          className="lg:col-span-4 bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60 hover:shadow-lg transition-all flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 md:size-11 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <Stethoscope className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">أطباء نشطون</p>
              <p className="text-xl md:text-2xl font-medium tabular-nums">
                {fmtNum(stats?.doctors ?? 0)}
              </p>
            </div>
          </div>
          <ArrowUpLeft className="size-4 text-muted-foreground shrink-0" />
        </Link>

        <Link
          to="/cases"
          className="lg:col-span-4 bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60 hover:shadow-lg transition-all flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 md:size-11 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">حالات الشهر</p>
              <p className="text-xl md:text-2xl font-medium tabular-nums">
                {fmtNum(stats?.monthCases ?? 0)}
              </p>
            </div>
          </div>
          <ArrowUpLeft className="size-4 text-muted-foreground shrink-0" />
        </Link>

        {/* Trend chart (8 cols) */}
        <div className="lg:col-span-8 bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-medium text-base md:text-lg">حركة الحالات</h2>
              <p className="text-xs text-muted-foreground mt-0.5">آخر 14 يوم</p>
            </div>
            <Calendar className="size-5 text-muted-foreground" />
          </div>
          <div className="h-56 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend ?? []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="recv-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="deliv-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="received" name="مستلَم" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#recv-grad)" />
                <Area type="monotone" dataKey="delivered" name="مسلَّم" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#deliv-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Doctors (4 cols) */}
        <div className="lg:col-span-4 bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-medium text-base md:text-lg">أبرز الأطباء</h2>
            <Link to="/doctors" className="text-xs text-primary hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {(topDoctors ?? []).map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-medium shrink-0">
                    {initials(d.name) || "د"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{d.name}</p>
                    {d.clinic && (
                      <p className="text-xs text-muted-foreground truncate">{d.clinic}</p>
                    )}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-base font-medium tabular-nums">{fmtNum(d.count)}</div>
                  <div className="text-[10px] text-muted-foreground">حالة</div>
                </div>
              </div>
            ))}
            {!topDoctors?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد بيانات هذا الشهر</p>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights (full width, kept for value) */}
      <div className="bg-card rounded-3xl p-5 md:p-6 shadow-elegant border border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-primary" />
          <h2 className="font-medium text-base md:text-lg">ملخص اليوم بالذكاء الاصطناعي</h2>
        </div>
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
      </div>
    </div>
  );
}
