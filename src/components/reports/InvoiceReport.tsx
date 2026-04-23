import { format } from "date-fns";
import { ToothChartMini } from "@/components/ToothChartMini";

interface Lab {
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  logo_url?: string | null;
  currency?: string | null;
}

interface Doctor {
  name: string;
  governorate?: string | null;
  phone?: string | null;
  clinic_name?: string | null;
  opening_balance?: number | null;
}

interface CaseRow {
  id: string;
  case_number: string;
  date_received: string;
  tooth_numbers?: string | null;
  units?: number | null;
  shade?: string | null;
  price?: number | null;
  patients?: { name?: string | null } | null;
  work_types?: { name?: string | null } | null;
}

export function InvoiceReport({
  lab,
  doctor,
  cases,
  periodLabel,
  invoiceNo,
  payments = 0,
}: {
  lab: Lab;
  doctor: Doctor;
  cases: CaseRow[];
  periodLabel: string;
  invoiceNo: string;
  payments?: number;
}) {
  const itemsTotal = cases.reduce((s, c) => s + Number(c.price ?? 0), 0);
  const opening = Number(doctor.opening_balance ?? 0);
  const grand = opening + itemsTotal;
  const remaining = grand - payments;
  const currency = lab.currency || "ج.م";

  return (
    <div
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        fontSize: "11px",
        lineHeight: 1.5,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0e7490", paddingBottom: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {lab.logo_url ? (
            <img src={lab.logo_url} alt="logo" crossOrigin="anonymous" style={{ height: "56px", width: "56px", objectFit: "contain", borderRadius: "8px" }} />
          ) : (
            <div style={{ height: "56px", width: "56px", borderRadius: "8px", background: "linear-gradient(135deg, #0e7490, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "22px" }}>
              {lab.name?.[0] ?? "L"}
            </div>
          )}
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0e7490" }}>{lab.name}</div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              {lab.phone && <span dir="ltr">{lab.phone}</span>}
              {lab.email && <span> · {lab.email}</span>}
            </div>
            {lab.address && <div style={{ fontSize: "10px", color: "#64748b" }}>{lab.address}</div>}
          </div>
        </div>
        <div style={{ textAlign: "left", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", minWidth: "150px" }}>
          <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>Invoice</div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>فاتورة شهرية</div>
          <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontFamily: "monospace" }}>{invoiceNo}</div>
          <div style={{ fontSize: "10px", color: "#0e7490", marginTop: "2px" }}>{periodLabel}</div>
        </div>
      </div>

      {/* Doctor info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "10px 12px" }}>
          <div style={{ fontSize: "9px", color: "#0369a1", fontWeight: 600, marginBottom: "4px" }}>إلى السيد الطبيب</div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0c4a6e" }}>{doctor.name}</div>
          {doctor.clinic_name && <div style={{ fontSize: "10px", color: "#475569" }}>{doctor.clinic_name}</div>}
          {doctor.governorate && <div style={{ fontSize: "10px", color: "#475569" }}>{doctor.governorate}</div>}
          {doctor.phone && <div style={{ fontSize: "10px", color: "#475569" }} dir="ltr">{doctor.phone}</div>}
        </div>
        <div style={{ background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
          <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>تفاصيل الفاتورة</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "2px" }}>
            <span style={{ color: "#475569" }}>تاريخ الإصدار:</span>
            <span style={{ fontWeight: 600 }}>{format(new Date(), "dd/MM/yyyy")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "2px" }}>
            <span style={{ color: "#475569" }}>الفترة:</span>
            <span style={{ fontWeight: 600 }}>{periodLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "2px" }}>
            <span style={{ color: "#475569" }}>عدد الحالات:</span>
            <span style={{ fontWeight: 600 }}>{cases.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", marginBottom: "12px" }}>
        <thead>
          <tr style={{ background: "linear-gradient(135deg, #0e7490, #06b6d4)", color: "#fff" }}>
            <th style={th}>رقم الحالة</th>
            <th style={th}>التاريخ</th>
            <th style={th}>المريض</th>
            <th style={th}>نوع العمل</th>
            <th style={th}>اللون</th>
            <th style={{ ...th, textAlign: "center" }}>الوحدات</th>
            <th style={{ ...th, textAlign: "center" }}>الأسنان</th>
            <th style={{ ...th, textAlign: "left" }}>السعر ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {cases.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...td, textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                لا توجد حالات لهذه الفترة
              </td>
            </tr>
          )}
          {cases.map((c, i) => (
            <tr key={c.id} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{c.case_number}</td>
              <td style={td}>{format(new Date(c.date_received), "dd/MM/yyyy")}</td>
              <td style={td}>{c.patients?.name ?? "—"}</td>
              <td style={td}>{c.work_types?.name ?? "—"}</td>
              <td style={td}>{c.shade ?? "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{c.units ?? 1}</td>
              <td style={{ ...td, textAlign: "center" }}>
                {c.tooth_numbers ? (
                  <div style={{ display: "inline-flex", justifyContent: "center" }}>
                    <ToothChartMini selected={c.tooth_numbers} />
                  </div>
                ) : "—"}
              </td>
              <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontWeight: 600 }}>
                {Number(c.price ?? 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "12px" }}>
        <div style={{ width: "55%", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <Row label="إجمالي حالات الشهر" value={itemsTotal} currency={currency} />
          <Row label="رصيد أول المدة" value={opening} currency={currency} muted />
          {payments > 0 && <Row label="المدفوعات" value={-payments} currency={currency} muted />}
          <div style={{ background: "linear-gradient(135deg, #0e7490, #06b6d4)", color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "13px" }}>الإجمالي المستحق</span>
            <span style={{ fontWeight: 800, fontSize: "16px", fontFamily: "monospace" }}>{remaining.toFixed(2)} {currency}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "10mm", right: "12mm", left: "12mm", borderTop: "1px solid #e2e8f0", paddingTop: "8px", fontSize: "9px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
        <span>شكراً لتعاملكم معنا</span>
        <span>{lab.name} · {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "right",
  fontWeight: 700,
  fontSize: "10px",
  borderBottom: "2px solid #0c4a6e",
};

const td: React.CSSProperties = {
  padding: "6px",
  textAlign: "right",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};

function Row({ label, value, currency, muted }: { label: string; value: number; currency: string; muted?: boolean }) {
  return (
    <div style={{ padding: "8px 14px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", background: muted ? "#fafafa" : "#fff" }}>
      <span style={{ color: "#475569", fontSize: "11px" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "12px" }}>{value.toFixed(2)} {currency}</span>
    </div>
  );
}
