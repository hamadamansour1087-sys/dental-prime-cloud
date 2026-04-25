import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Printer, FileSpreadsheet, FileText, Filter, RefreshCw, TrendingUp, Users, MapPin, Wrench, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";
import { exportElementToPdf } from "@/lib/pdf";
import { printElement } from "@/lib/print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

const CHART_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 87% 65%)",
  "hsl(346 77% 60%)",
  "hsl(190 84% 50%)",
  "hsl(48 96% 53%)",
  "hsl(160 64% 45%)",
];

type Preset = "today" | "week" | "month" | "last_month" | "ytd" | "custom";

function getPresetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case "today":
      return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "week":
      return { from: format(subDays(today, 6), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "month":
      return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "ytd":
      return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    default:
      return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
  }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n || 0);
}
function fmtNum(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n || 0);
}

function ReportsPage() {
  const { labId } = useAuth();
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState(getPresetRange("month"));
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [tab, setTab] = useState("production");

  const printRef = useRef<HTMLDivElement>(null);

  const onPresetChange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(getPresetRange(p));
  };

  // ----- Reference data -----
  const { data: doctors = [] } = useQuery({
    queryKey: ["rep-doctors", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("doctors").select("id,name,governorate").eq("lab_id", labId!).order("name");
      return data ?? [];
    },
  });
  const { data: workTypes = [] } = useQuery({
    queryKey: ["rep-worktypes", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("work_types").select("id,name,category_id").eq("lab_id", labId!).order("name");
      return data ?? [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["rep-cats", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("work_type_categories").select("id,name,color").eq("lab_id", labId!).order("order_index");
      return data ?? [];
    },
  });

  // ----- Delivered cases (financial truth = delivered only) -----
  const { data: deliveredCases = [], isLoading: loadingDelivered, refetch: refetchDelivered } = useQuery({
    queryKey: ["rep-delivered", labId, range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("cases")
        .select("id,case_number,date_delivered,date_received,price,units,doctor_id,work_type_id,status")
        .eq("lab_id", labId!)
        .eq("status", "delivered")
        .gte("date_delivered", `${range.from}T00:00:00`)
        .lte("date_delivered", `${range.to}T23:59:59`)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      if (workTypeFilter !== "all") q = q.eq("work_type_id", workTypeFilter);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      // category filter: client-side via work_types
      if (categoryFilter !== "all") {
        const wtIds = new Set(workTypes.filter((w) => w.category_id === categoryFilter).map((w) => w.id));
        rows = rows.filter((r) => r.work_type_id && wtIds.has(r.work_type_id));
      }
      // governorate filter: client-side via doctors
      if (governorateFilter !== "all") {
        const docIds = new Set(doctors.filter((d) => d.governorate === governorateFilter).map((d) => d.id));
        rows = rows.filter((r) => r.doctor_id && docIds.has(r.doctor_id));
      }
      return rows;
    },
  });

  // ----- All cases received in range (for production volume) -----
  const { data: receivedCases = [] } = useQuery({
    queryKey: ["rep-received", labId, range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("cases")
        .select("id,date_received,doctor_id,work_type_id,units,status")
        .eq("lab_id", labId!)
        .gte("date_received", range.from)
        .lte("date_received", range.to)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      if (workTypeFilter !== "all") q = q.eq("work_type_id", workTypeFilter);
      const { data } = await q;
      let rows = data ?? [];
      if (categoryFilter !== "all") {
        const wtIds = new Set(workTypes.filter((w) => w.category_id === categoryFilter).map((w) => w.id));
        rows = rows.filter((r) => r.work_type_id && wtIds.has(r.work_type_id));
      }
      if (governorateFilter !== "all") {
        const docIds = new Set(doctors.filter((d) => d.governorate === governorateFilter).map((d) => d.id));
        rows = rows.filter((r) => r.doctor_id && docIds.has(r.doctor_id));
      }
      return rows;
    },
  });

  // ----- Payments in range -----
  const { data: payments = [] } = useQuery({
    queryKey: ["rep-payments", labId, range, doctorFilter],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select("id,doctor_id,amount,payment_date,method")
        .eq("lab_id", labId!)
        .gte("payment_date", range.from)
        .lte("payment_date", range.to)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  // ----- All-time delivered + payments per doctor (for receivables / مديونيات) -----
  const { data: allDoctorsBalance = [] } = useQuery({
    queryKey: ["rep-balances", labId, doctorFilter, governorateFilter],
    enabled: !!labId && doctors.length > 0,
    queryFn: async () => {
      const [allDelivered, allPayments] = await Promise.all([
        supabase.from("cases").select("doctor_id,price").eq("lab_id", labId!).eq("status", "delivered").limit(50000),
        supabase.from("payments").select("doctor_id,amount").eq("lab_id", labId!).limit(50000),
      ]);
      const billedMap = new Map<string, number>();
      (allDelivered.data ?? []).forEach((c) => {
        if (!c.doctor_id) return;
        billedMap.set(c.doctor_id, (billedMap.get(c.doctor_id) ?? 0) + (Number(c.price) || 0));
      });
      const paidMap = new Map<string, number>();
      (allPayments.data ?? []).forEach((p) => {
        paidMap.set(p.doctor_id, (paidMap.get(p.doctor_id) ?? 0) + (Number(p.amount) || 0));
      });
      let docs = doctors;
      if (doctorFilter !== "all") docs = docs.filter((d) => d.id === doctorFilter);
      if (governorateFilter !== "all") docs = docs.filter((d) => d.governorate === governorateFilter);
      return docs.map((d) => {
        const billed = billedMap.get(d.id) ?? 0;
        const paid = paidMap.get(d.id) ?? 0;
        return { ...d, billed, paid, balance: billed - paid };
      });
    },
  });

  // ----- Aggregations -----
  const wtMap = useMemo(() => new Map(workTypes.map((w) => [w.id, w])), [workTypes]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const docMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const productionByWorkType = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number; revenue: number }>();
    deliveredCases.forEach((c) => {
      const wt = c.work_type_id ? wtMap.get(c.work_type_id) : null;
      const name = wt?.name ?? "غير محدد";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0 };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, wtMap]);

  const productionByCategory = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number; revenue: number; color: string }>();
    deliveredCases.forEach((c) => {
      const wt = c.work_type_id ? wtMap.get(c.work_type_id) : null;
      const cat = wt?.category_id ? catMap.get(wt.category_id) : null;
      const name = cat?.name ?? "بدون فئة";
      const color = cat?.color ?? "#6B7280";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0, color };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, wtMap, catMap]);

  const productionByDoctor = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number; revenue: number; paid: number }>();
    deliveredCases.forEach((c) => {
      if (!c.doctor_id) return;
      const d = docMap.get(c.doctor_id);
      const name = d?.name ?? "غير محدد";
      const cur = map.get(c.doctor_id) ?? { name, count: 0, units: 0, revenue: 0, paid: 0 };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(c.doctor_id, cur);
    });
    payments.forEach((p) => {
      const cur = map.get(p.doctor_id);
      if (cur) cur.paid += Number(p.amount) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, payments, docMap]);

  const productionByGovernorate = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number; revenue: number; doctors: Set<string> }>();
    deliveredCases.forEach((c) => {
      if (!c.doctor_id) return;
      const d = docMap.get(c.doctor_id);
      const name = d?.governorate ?? "غير محدد";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0, doctors: new Set() };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      cur.doctors.add(c.doctor_id);
      map.set(name, cur);
    });
    return Array.from(map.values())
      .map((g) => ({ name: g.name, count: g.count, units: g.units, revenue: g.revenue, doctors: g.doctors.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, docMap]);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; cases: number; payments: number }>();
    deliveredCases.forEach((c) => {
      if (!c.date_delivered) return;
      const day = c.date_delivered.slice(0, 10);
      const cur = map.get(day) ?? { date: day, revenue: 0, cases: 0, payments: 0 };
      cur.revenue += Number(c.price) || 0;
      cur.cases += 1;
      map.set(day, cur);
    });
    payments.forEach((p) => {
      const day = p.payment_date;
      const cur = map.get(day) ?? { date: day, revenue: 0, cases: 0, payments: 0 };
      cur.payments += Number(p.amount) || 0;
      map.set(day, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [deliveredCases, payments]);

  // KPIs
  const totalRevenue = deliveredCases.reduce((s, c) => s + (Number(c.price) || 0), 0);
  const totalCollected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalDelivered = deliveredCases.length;
  const totalReceived = receivedCases.length;
  const totalReceivables = allDoctorsBalance.reduce((s, d) => s + (d.balance > 0 ? d.balance : 0), 0);

  // ----- Export helpers -----
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const meta = [
      ["تقارير المعمل"],
      [`الفترة: ${range.from} إلى ${range.to}`],
      [`تاريخ التصدير: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
      [],
    ];

    const kpis = [
      ["المؤشر", "القيمة"],
      ["عدد الحالات المستلمة", totalReceived],
      ["عدد الحالات المسلمة", totalDelivered],
      ["إجمالي الإيرادات (مسلم)", totalRevenue],
      ["إجمالي التحصيلات", totalCollected],
      ["صافي الفترة", totalCollected - totalRevenue],
      ["إجمالي المديونيات الحالية", totalReceivables],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...meta, ...kpis]), "ملخص");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        productionByWorkType.map((r) => ({ "نوع العمل": r.name, "عدد الحالات": r.count, "الوحدات": r.units, "الإيراد": r.revenue })),
      ),
      "حسب نوع العمل",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        productionByCategory.map((r) => ({ "الفئة": r.name, "عدد الحالات": r.count, "الوحدات": r.units, "الإيراد": r.revenue })),
      ),
      "حسب الفئة",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        productionByDoctor.map((r) => ({
          "الطبيب": r.name,
          "عدد الحالات": r.count,
          "الوحدات": r.units,
          "الإيراد": r.revenue,
          "المحصل (الفترة)": r.paid,
          "صافي الفترة": r.paid - r.revenue,
        })),
      ),
      "حسب الطبيب",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        productionByGovernorate.map((r) => ({ "المحافظة": r.name, "أطباء": r.doctors, "حالات": r.count, "وحدات": r.units, "إيراد": r.revenue })),
      ),
      "حسب المحافظة",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        allDoctorsBalance.map((d) => ({
          "الطبيب": d.name,
          "المحافظة": d.governorate ?? "",
          "إجمالي الفواتير": d.billed,
          "إجمالي المدفوع": d.paid,
          "الرصيد (له/عليه)": d.balance,
        })),
      ),
      "المديونيات",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payments.map((p) => ({
          "التاريخ": p.payment_date,
          "الطبيب": docMap.get(p.doctor_id)?.name ?? "",
          "المبلغ": Number(p.amount),
          "الطريقة": p.method ?? "",
        })),
      ),
      "التحصيلات",
    );

    XLSX.writeFile(wb, `تقرير_${range.from}_${range.to}.xlsx`);
    toast.success("تم تصدير ملف Excel");
  };

  const exportToPdf = async () => {
    if (!printRef.current) return;
    try {
      toast.loading("جاري تجهيز ملف PDF...", { id: "pdf" });
      await exportElementToPdf(printRef.current, `تقرير_${range.from}_${range.to}.pdf`);
      toast.success("تم تصدير PDF", { id: "pdf" });
    } catch (e) {
      toast.error("تعذر تصدير PDF", { id: "pdf" });
      console.error(e);
    }
  };

  const printReport = () => {
    if (!printRef.current) return;
    printElement(printRef.current, `تقرير ${range.from} → ${range.to}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">التقارير والتحليلات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تقارير شاملة عن الإنتاج والمالية مع فلاتر ذكية وتصدير احترافي
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => { refetchDelivered(); toast.success("تم تحديث البيانات"); }}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={printReport}>
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPdf}>
            <FileText className="ml-2 h-4 w-4" />
            PDF
          </Button>
          <Button size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            فلاتر ذكية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["today", "اليوم"],
              ["week", "آخر 7 أيام"],
              ["month", "هذا الشهر"],
              ["last_month", "الشهر الماضي"],
              ["ytd", "منذ بداية السنة"],
              ["custom", "مخصص"],
            ] as Array<[Preset, string]>).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={preset === k ? "default" : "outline"}
                onClick={() => onPresetChange(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={range.from} onChange={(e) => { setRange({ ...range, from: e.target.value }); setPreset("custom"); }} />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={range.to} onChange={(e) => { setRange({ ...range, to: e.target.value }); setPreset("custom"); }} />
            </div>
            <div>
              <Label className="text-xs">الطبيب</Label>
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأطباء</SelectItem>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">نوع العمل</Label>
              <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {workTypes.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الفئة</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">المحافظة</Label>
              <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المحافظات</SelectItem>
                  {EGYPT_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printable area */}
      <div ref={printRef} className="space-y-6 bg-background">
        {/* Print-only header */}
        <div className="hidden print:block text-center border-b pb-3">
          <h1 className="text-xl font-bold">تقرير المعمل</h1>
          <p className="text-sm">من {range.from} إلى {range.to}</p>
          <p className="text-xs text-muted-foreground">تم الإنشاء: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="حالات مستلمة" value={fmtNum(totalReceived)} icon={<ClipboardIcon />} color="bg-blue-500/10 text-blue-600" />
          <KpiCard label="حالات مسلمة" value={fmtNum(totalDelivered)} icon={<TrendingUp className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-600" />
          <KpiCard label="إجمالي الإيرادات" value={fmtCurrency(totalRevenue)} icon={<Wallet className="h-4 w-4" />} color="bg-violet-500/10 text-violet-600" />
          <KpiCard label="التحصيلات" value={fmtCurrency(totalCollected)} icon={<TrendingUp className="h-4 w-4" />} color="bg-amber-500/10 text-amber-600" />
          <KpiCard label="إجمالي المديونيات" value={fmtCurrency(totalReceivables)} icon={<Wallet className="h-4 w-4" />} color="bg-rose-500/10 text-rose-600" />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full print:hidden">
            <TabsTrigger value="production"><Wrench className="h-4 w-4 ml-1" />الإنتاج</TabsTrigger>
            <TabsTrigger value="doctors"><Users className="h-4 w-4 ml-1" />الأطباء</TabsTrigger>
            <TabsTrigger value="geography"><MapPin className="h-4 w-4 ml-1" />المحافظات</TabsTrigger>
            <TabsTrigger value="financial"><Wallet className="h-4 w-4 ml-1" />المالية</TabsTrigger>
            <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 ml-1" />الاتجاهات</TabsTrigger>
          </TabsList>

          {/* Production */}
          <TabsContent value="production" className="space-y-4 print:!block">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">الإيراد حسب نوع العمل</CardTitle></CardHeader>
                <CardContent style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productionByWorkType.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => fmtNum(v)} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                      <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">توزيع الفئات</CardTitle></CardHeader>
                <CardContent style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={productionByCategory} dataKey="revenue" nameKey="name" outerRadius={110} label={(e) => e.name}>
                        {productionByCategory.map((entry, i) => (
                          <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">تفاصيل الإنتاج حسب نوع العمل</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={["نوع العمل", "حالات", "وحدات", "الإيراد"]}
                  rows={productionByWorkType.map((r) => [r.name, fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue)])}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Doctors */}
          <TabsContent value="doctors" className="space-y-4 print:!block">
            <Card>
              <CardHeader><CardTitle className="text-base">أعلى 10 أطباء (إيراد)</CardTitle></CardHeader>
              <CardContent style={{ height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productionByDoctor.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(v) => fmtNum(v)} />
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name="إيراد" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="paid" name="محصل" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">تفاصيل أداء الأطباء (الفترة)</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={["الطبيب", "حالات", "وحدات", "الإيراد", "المحصل", "الفرق"]}
                  rows={productionByDoctor.map((r) => [
                    r.name, fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue), fmtCurrency(r.paid),
                    <Badge key="b" variant={r.paid - r.revenue >= 0 ? "default" : "destructive"}>{fmtCurrency(r.paid - r.revenue)}</Badge>,
                  ])}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geography */}
          <TabsContent value="geography" className="space-y-4 print:!block">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">الإيراد حسب المحافظة</CardTitle></CardHeader>
                <CardContent style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productionByGovernorate}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis tickFormatter={(v) => fmtNum(v)} />
                      <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                      <Bar dataKey="revenue" fill={CHART_COLORS[2]} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">توزيع الحالات</CardTitle></CardHeader>
                <CardContent style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={productionByGovernorate} dataKey="count" nameKey="name" outerRadius={110} label={(e) => e.name}>
                        {productionByGovernorate.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">تفاصيل المحافظات</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={["المحافظة", "أطباء", "حالات", "وحدات", "الإيراد"]}
                  rows={productionByGovernorate.map((r) => [r.name, fmtNum(r.doctors), fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue)])}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial */}
          <TabsContent value="financial" className="space-y-4 print:!block">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiCard label="إجمالي الفواتير (تاريخي)" value={fmtCurrency(allDoctorsBalance.reduce((s, d) => s + d.billed, 0))} color="bg-blue-500/10 text-blue-600" />
              <KpiCard label="إجمالي المدفوع (تاريخي)" value={fmtCurrency(allDoctorsBalance.reduce((s, d) => s + d.paid, 0))} color="bg-emerald-500/10 text-emerald-600" />
              <KpiCard label="إجمالي المديونيات الحالية" value={fmtCurrency(totalReceivables)} color="bg-rose-500/10 text-rose-600" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">المديونيات حسب الطبيب</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={["الطبيب", "المحافظة", "الفواتير", "المدفوع", "الرصيد"]}
                  rows={[...allDoctorsBalance].sort((a, b) => b.balance - a.balance).map((r) => [
                    r.name,
                    r.governorate ?? "-",
                    fmtCurrency(r.billed),
                    fmtCurrency(r.paid),
                    <Badge key="b" variant={r.balance > 0 ? "destructive" : r.balance < 0 ? "default" : "secondary"}>
                      {fmtCurrency(r.balance)}
                    </Badge>,
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">سجل التحصيلات (الفترة)</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={["التاريخ", "الطبيب", "المبلغ", "الطريقة"]}
                  rows={[...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).map((p) => [
                    p.payment_date,
                    docMap.get(p.doctor_id)?.name ?? "-",
                    fmtCurrency(Number(p.amount)),
                    p.method ?? "-",
                  ])}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends */}
          <TabsContent value="trends" className="space-y-4 print:!block">
            <Card>
              <CardHeader><CardTitle className="text-base">الإيرادات والتحصيلات اليومية</CardTitle></CardHeader>
              <CardContent style={{ height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => fmtNum(v)} />
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="إيراد" stroke={CHART_COLORS[0]} strokeWidth={2} />
                    <Line type="monotone" dataKey="payments" name="محصل" stroke={CHART_COLORS[1]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">عدد الحالات اليومية المسلمة</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cases" name="حالات" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loadingDelivered && <p className="text-center text-sm text-muted-foreground">جاري تحميل البيانات...</p>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold mt-1">{value}</p>
          </div>
          {icon && <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color ?? ""}`}>{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-6">لا توجد بيانات في الفترة المحددة</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClipboardIcon() {
  return <Wrench className="h-4 w-4" />;
}
