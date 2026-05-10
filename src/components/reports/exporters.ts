import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { exportElementToPdf } from "@/lib/pdf";
import { printElement } from "@/lib/print";
import type { DateRange } from "./types";
import type { ReportsData } from "./useReportsData";

export function exportToExcel(range: DateRange, d: ReportsData) {
  const wb = XLSX.utils.book_new();
  const meta = [
    ["تقارير المعمل"],
    [`الفترة: ${range.from} إلى ${range.to}`],
    [`تاريخ التصدير: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
    [],
  ];

  const kpis = [
    ["المؤشر", "القيمة"],
    ["عدد الحالات المستلمة", d.totalReceived],
    ["عدد الحالات المسلمة", d.totalDelivered],
    ["إجمالي الإيرادات (مسلم)", d.totalRevenue],
    ["إجمالي التحصيلات", d.totalCollected],
    ["صافي الفترة", d.totalCollected - d.totalRevenue],
    ["إجمالي المديونيات الحالية", d.totalReceivables],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...meta, ...kpis]), "ملخص");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.productionByWorkType.map((r) => ({ "نوع العمل": r.name, "عدد الحالات": r.count, "الوحدات": r.units, "الإيراد": r.revenue })),
  ), "حسب نوع العمل");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.productionByCategory.map((r) => ({ "الفئة": r.name, "عدد الحالات": r.count, "الوحدات": r.units, "الإيراد": r.revenue })),
  ), "حسب الفئة");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.productionByDoctor.map((r) => ({
      "الطبيب": r.name,
      "عدد الحالات": r.count,
      "الوحدات": r.units,
      "الإيراد": r.revenue,
      "المحصل (الفترة)": r.paid,
      "صافي الفترة": r.paid - r.revenue,
    })),
  ), "حسب الطبيب");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.productionByGovernorate.map((r) => ({ "المحافظة": r.name, "أطباء": r.doctors, "حالات": r.count, "وحدات": r.units, "إيراد": r.revenue })),
  ), "حسب المحافظة");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.allDoctorsBalance.map((x) => ({
      "الطبيب": x.name,
      "المحافظة": x.governorate ?? "",
      "إجمالي الفواتير": x.billed,
      "إجمالي المدفوع": x.paid,
      "الرصيد (له/عليه)": x.balance,
    })),
  ), "المديونيات");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    d.payments.map((p) => ({
      "التاريخ": p.payment_date,
      "الطبيب": d.docMap.get(p.doctor_id)?.name ?? "",
      "المبلغ": Number(p.amount),
      "الطريقة": p.method ?? "",
    })),
  ), "التحصيلات");

  XLSX.writeFile(wb, `تقرير_${range.from}_${range.to}.xlsx`);
  toast.success("تم تصدير ملف Excel");
}

export async function exportToPdf(el: HTMLElement | null, range: DateRange) {
  if (!el) return;
  try {
    toast.loading("جاري تجهيز ملف PDF...", { id: "pdf" });
    await exportElementToPdf(el, `تقرير_${range.from}_${range.to}.pdf`);
    toast.success("تم تصدير PDF", { id: "pdf" });
  } catch (e) {
    toast.error("تعذر تصدير PDF", { id: "pdf" });
    console.error(e);
  }
}

export function printReport(el: HTMLElement | null, range: DateRange) {
  if (!el) return;
  printElement(el, `تقرير ${range.from} → ${range.to}`);
}
