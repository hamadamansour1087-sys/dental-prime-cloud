import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { format } from "date-fns";
import { TrendingUp, Wallet, Wrench } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { ReportsToolbar } from "@/components/reports/ReportsToolbar";
import { ReportsTabs } from "@/components/reports/ReportsTabs";
import { KpiCard } from "@/components/reports/shared";
import { fmtCurrency, fmtNum, getPresetRange } from "@/components/reports/presets";
import { useReportsData } from "@/components/reports/useReportsData";
import { exportToExcel, exportToPdf, printReport } from "@/components/reports/exporters";
import type { Preset } from "@/components/reports/types";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { labId } = useAuth();
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState(getPresetRange("month"));
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [governorateFilter, setGovernorateFilter] = useState("all");

  const printRef = useRef<HTMLDivElement>(null);

  const onPresetChange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(getPresetRange(p));
  };

  const data = useReportsData(labId, { range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ReportsToolbar
        preset={preset}
        onPresetChange={onPresetChange}
        range={range}
        setRange={setRange}
        setPreset={setPreset}
        doctorFilter={doctorFilter}
        setDoctorFilter={setDoctorFilter}
        workTypeFilter={workTypeFilter}
        setWorkTypeFilter={setWorkTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        governorateFilter={governorateFilter}
        setGovernorateFilter={setGovernorateFilter}
        doctors={data.doctors}
        workTypes={data.workTypes}
        categories={data.categories}
        onRefresh={() => { data.refetchDelivered(); toast.success("تم تحديث البيانات"); }}
        onPrint={() => printReport(printRef.current, range)}
        onPdf={() => exportToPdf(printRef.current, range)}
        onExcel={() => exportToExcel(range, data)}
      />

      <div ref={printRef} className="space-y-6 bg-background">
        <div className="hidden print:block text-center border-b pb-3">
          <h1 className="text-xl font-bold">تقرير المعمل</h1>
          <p className="text-sm">من {range.from} إلى {range.to}</p>
          <p className="text-xs text-muted-foreground">تم الإنشاء: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="حالات مستلمة" value={fmtNum(data.totalReceived)} icon={<Wrench className="h-4 w-4" />} color="bg-blue-500/10 text-blue-600" />
          <KpiCard label="حالات مسلمة" value={fmtNum(data.totalDelivered)} icon={<TrendingUp className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-600" />
          <KpiCard label="إجمالي الإيرادات" value={fmtCurrency(data.totalRevenue)} icon={<Wallet className="h-4 w-4" />} color="bg-violet-500/10 text-violet-600" />
          <KpiCard label="التحصيلات" value={fmtCurrency(data.totalCollected)} icon={<TrendingUp className="h-4 w-4" />} color="bg-amber-500/10 text-amber-600" />
          <KpiCard label="إجمالي المديونيات" value={fmtCurrency(data.totalReceivables)} icon={<Wallet className="h-4 w-4" />} color="bg-rose-500/10 text-rose-600" />
        </div>

        <ReportsTabs d={data} />

        {data.loadingDelivered && <p className="text-center text-sm text-muted-foreground">جاري تحميل البيانات...</p>}
      </div>
    </div>
  );
}
