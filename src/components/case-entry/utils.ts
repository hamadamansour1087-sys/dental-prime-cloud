import { toast } from "sonner";
import type { CaseEntryItem, SmartDefaults } from "./types";

const PREFS_KEY = "lovable.case-entry.prefs.v1";
const DRAFT_KEY_BASE = "lovable.case-entry.draft.v2";

export function makeDraftKey(mode: string, fixedDoctorId?: string) {
  return `${DRAFT_KEY_BASE}.${mode}${fixedDoctorId ? `.${fixedDoctorId}` : ""}`;
}

export const newItem = (_defaults?: SmartDefaults): CaseEntryItem => ({
  id: crypto.randomUUID(),
  work_type_id: "",
  tooth_numbers: "",
  shade: "",
  units: "1",
  unit_price: "",
});

export const formatArabicDate = (value: string) => {
  if (!value) return "اختر تاريخ التسليم";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const loadPrefs = (): SmartDefaults => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as SmartDefaults;
  } catch {
    return {};
  }
};

export const savePrefs = (prefs: SmartDefaults) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
};

// Thermal-printer (80mm) slip
export interface PrintSlipData {
  caseNumber: string;
  doctorName: string;
  patientName: string;
  workTypes: string;
  shade: string;
  units: number;
  dueDate: string;
  notes: string;
  labName?: string;
}

export const printThermalSlip = (data: PrintSlipData) => {
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) {
    toast.error("افتح السماح بالنوافذ المنبثقة للطباعة");
    return;
  }
  const esc = (s: unknown) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>إيصال ${esc(data.caseNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', 'Cairo', system-ui, sans-serif; font-size: 12px; margin: 0; padding: 6px; color: #000; }
  .center { text-align: center; }
  .lab { font-size: 16px; font-weight: 800; }
  .num { font-size: 22px; font-weight: 900; letter-spacing: 1px; margin: 6px 0; padding: 6px; border: 2px dashed #000; text-align: center; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #999; }
  .row .lbl { font-weight: 700; }
  .notes { margin-top: 6px; padding: 4px; border: 1px solid #333; font-size: 11px; }
  .foot { margin-top: 8px; text-align: center; font-size: 10px; color: #555; }
</style></head><body>
  <div class="center lab">${esc(data.labName ?? "معمل الأسنان")}</div>
  <div class="center" style="font-size:10px;color:#555">${esc(new Date().toLocaleString("ar-EG"))}</div>
  <div class="num">${esc(data.caseNumber)}</div>
  <div class="row"><span class="lbl">الطبيب:</span><span>${esc(data.doctorName || "—")}</span></div>
  <div class="row"><span class="lbl">المريض:</span><span>${esc(data.patientName || "—")}</span></div>
  <div class="row"><span class="lbl">نوع العمل:</span><span>${esc(data.workTypes || "—")}</span></div>
  <div class="row"><span class="lbl">اللون:</span><span>${esc(data.shade || "—")}</span></div>
  <div class="row"><span class="lbl">الوحدات:</span><span>${esc(data.units)}</span></div>
  <div class="row"><span class="lbl">التسليم:</span><span>${esc(data.dueDate || "—")}</span></div>
  ${data.notes ? `<div class="notes"><b>ملاحظات:</b><br/>${esc(data.notes)}</div>` : ""}
  <div class="foot">— شكراً لتعاملكم معنا —</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
};
