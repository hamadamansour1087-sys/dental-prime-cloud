import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { HardHat, MapPin, RefreshCcw, TrendingUp, Users, Wallet, Wrench } from "lucide-react";
import { CHART_COLORS, fmtCurrency, fmtNum } from "./presets";
import { DataTable, KpiCard } from "./shared";
import type { ReportsData } from "./useReportsData";

const CHART_STYLE = { contain: "layout paint" } as const;

export function ReportsTabs({ d }: { d: ReportsData }) {
  const [tab, setTab] = useState("production");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full print:hidden">
        <TabsTrigger value="production"><Wrench className="h-4 w-4 ml-1" />الإنتاج</TabsTrigger>
        <TabsTrigger value="technicians"><HardHat className="h-4 w-4 ml-1" />الفنيون</TabsTrigger>
        <TabsTrigger value="remakes"><RefreshCcw className="h-4 w-4 ml-1" />الإعادة والتصليح</TabsTrigger>
        <TabsTrigger value="doctors"><Users className="h-4 w-4 ml-1" />الأطباء</TabsTrigger>
        <TabsTrigger value="geography"><MapPin className="h-4 w-4 ml-1" />المحافظات</TabsTrigger>
        <TabsTrigger value="financial"><Wallet className="h-4 w-4 ml-1" />المالية</TabsTrigger>
        <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 ml-1" />الاتجاهات</TabsTrigger>
      </TabsList>

      <TabsContent value="production" className="space-y-4 print:!block">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الإيراد حسب نوع العمل</CardTitle></CardHeader>
            <CardContent className="overflow-hidden isolate" style={{ height: 320, ...CHART_STYLE }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.productionByWorkType.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
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
            <CardContent className="overflow-hidden isolate" style={{ height: 320, ...CHART_STYLE }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.productionByCategory} dataKey="revenue" nameKey="name" outerRadius={110} label={(e) => e.name}>
                    {d.productionByCategory.map((entry, i) => (
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
              rows={d.productionByWorkType.map((r) => [r.name, fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue)])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="technicians" className="space-y-4 print:!block">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="عدد الفنيين النشطين" value={fmtNum(d.technicianProduction.length)} icon={<HardHat className="h-4 w-4" />} color="bg-blue-500/10 text-blue-600" />
          <KpiCard label="إجمالي الحالات المنجزة" value={fmtNum(d.technicianProduction.reduce((s, t) => s + t.cases, 0))} icon={<Wrench className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-600" />
          <KpiCard label="إجمالي وحدات الإنتاج" value={fmtNum(d.technicianProduction.reduce((s, t) => s + t.units, 0))} icon={<TrendingUp className="h-4 w-4" />} color="bg-violet-500/10 text-violet-600" />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">إنتاج الفنيين (الوحدات)</CardTitle></CardHeader>
          <CardContent className="overflow-hidden isolate" style={{ height: 320, ...CHART_STYLE }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.technicianProduction.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis tickFormatter={(v) => fmtNum(v)} />
                <Tooltip />
                <Legend />
                <Bar dataKey="units" name="وحدات" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="cases" name="حالات" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="remakes" name="إعادات" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">تقييم الفنيين</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={["#", "الفني", "الحالات", "الوحدات", "الإعادات", "نسبة الجودة"]}
              rows={d.technicianProduction.map((r, i) => [
                i + 1,
                r.name,
                fmtNum(r.cases),
                fmtNum(r.units),
                <Badge key="r" variant={r.remakes > 0 ? "destructive" : "secondary"}>{fmtNum(r.remakes)}</Badge>,
                <Badge key="q" variant={r.quality >= 90 ? "default" : r.quality >= 75 ? "secondary" : "destructive"}>{r.quality}%</Badge>,
              ])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="remakes" className="space-y-4 print:!block">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="إجمالي الحالات المعادة والتصاليح" value={fmtNum(d.remakeRepairCases.length)} icon={<RefreshCcw className="h-4 w-4" />} color="bg-amber-500/10 text-amber-600" />
          <KpiCard label="حالات إعادة" value={fmtNum(d.remakeRepairCases.filter((c) => c.case_type === "remake").length)} icon={<RefreshCcw className="h-4 w-4" />} color="bg-rose-500/10 text-rose-600" />
          <KpiCard label="حالات تصليح" value={fmtNum(d.remakeRepairCases.filter((c) => c.case_type === "repair").length)} icon={<Wrench className="h-4 w-4" />} color="bg-blue-500/10 text-blue-600" />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">تفاصيل الحالات المعادة والتصاليح</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={["رقم الحالة", "النوع", "الطبيب", "نوع العمل", "تاريخ الاستلام", "الوحدات", "الحالة"]}
              rows={d.remakeRepairCases.map((c) => [
                c.case_number,
                <Badge key="t" variant={c.case_type === "remake" ? "destructive" : "secondary"}>
                  {c.case_type === "remake" ? "إعادة" : "تصليح"}
                </Badge>,
                (c.doctor_id && d.docMap.get(c.doctor_id)?.name) ?? "-",
                (c.work_type_id && d.workTypes.find((w) => w.id === c.work_type_id)?.name) ?? "-",
                c.date_received ?? "-",
                fmtNum(Number(c.units) || 0),
                c.status ?? "-",
              ])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="doctors" className="space-y-4 print:!block">
        <Card>
          <CardHeader><CardTitle className="text-base">أعلى 10 أطباء (إيراد)</CardTitle></CardHeader>
          <CardContent className="overflow-hidden isolate" style={{ height: 360, ...CHART_STYLE }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.productionByDoctor.slice(0, 10)}>
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
              rows={d.productionByDoctor.map((r) => [
                r.name, fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue), fmtCurrency(r.paid),
                <Badge key="b" variant={r.paid - r.revenue >= 0 ? "default" : "destructive"}>{fmtCurrency(r.paid - r.revenue)}</Badge>,
              ])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="geography" className="space-y-4 print:!block">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الإيراد حسب المحافظة</CardTitle></CardHeader>
            <CardContent className="overflow-hidden isolate" style={{ height: 320, ...CHART_STYLE }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.productionByGovernorate}>
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
            <CardContent className="overflow-hidden isolate" style={{ height: 320, ...CHART_STYLE }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.productionByGovernorate} dataKey="count" nameKey="name" outerRadius={110} label={(e) => e.name}>
                    {d.productionByGovernorate.map((_, i) => (
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
              rows={d.productionByGovernorate.map((r) => [r.name, fmtNum(r.doctors), fmtNum(r.count), fmtNum(r.units), fmtCurrency(r.revenue)])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="financial" className="space-y-4 print:!block">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="إجمالي الفواتير (تاريخي)" value={fmtCurrency(d.allDoctorsBalance.reduce((s, x) => s + x.billed, 0))} color="bg-blue-500/10 text-blue-600" />
          <KpiCard label="إجمالي المدفوع (تاريخي)" value={fmtCurrency(d.allDoctorsBalance.reduce((s, x) => s + x.paid, 0))} color="bg-emerald-500/10 text-emerald-600" />
          <KpiCard label="إجمالي المديونيات الحالية" value={fmtCurrency(d.totalReceivables)} color="bg-rose-500/10 text-rose-600" />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">المديونيات حسب الطبيب</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={["الطبيب", "المحافظة", "الفواتير", "المدفوع", "الرصيد"]}
              rows={[...d.allDoctorsBalance].sort((a, b) => b.balance - a.balance).map((r) => [
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
              rows={[...d.payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).map((p) => [
                p.payment_date,
                d.docMap.get(p.doctor_id)?.name ?? "-",
                fmtCurrency(Number(p.amount)),
                p.method ?? "-",
              ])}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="trends" className="space-y-4 print:!block">
        <Card>
          <CardHeader><CardTitle className="text-base">الإيرادات والتحصيلات اليومية</CardTitle></CardHeader>
          <CardContent className="overflow-hidden isolate" style={{ height: 360, ...CHART_STYLE }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.dailyTrend}>
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
          <CardContent className="overflow-hidden isolate" style={{ height: 280, ...CHART_STYLE }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.dailyTrend}>
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
  );
}
