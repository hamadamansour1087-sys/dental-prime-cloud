import { format } from "date-fns";
import { QuadrantsPrintView } from "@/components/QuadrantsPrintView";

interface Lab {
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  logo_url?: string | null;
  currency?: string | null;
}

export function CaseReport({
  lab,
  caseRow,
  items = [],
  stageHistory = [],
}: {
  lab: Lab;
  caseRow: any;
  items?: any[];
  stageHistory?: any[];
}) {
  const currency = lab.currency || "ج.م";
  const stage = caseRow.workflow_stages;
  const itemsTotal = items.reduce((s, it) => s + (Number(it.total_price) || 0), 0);

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
          </div>
        </div>
        <div style={{ textAlign: "left", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", minWidth: "150px" }}>
          <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>Case Report</div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>تقرير حالة</div>
          <div style={{ fontSize: "13px", color: "#0e7490", marginTop: "2px", fontFamily: "monospace", fontWeight: 700 }}>{caseRow.case_number}</div>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <InfoBlock title="بيانات الطبيب">
          <Field label="الاسم" value={caseRow.doctors?.name ?? "—"} bold />
          <Field label="الهاتف" value={caseRow.doctors?.phone ?? "—"} ltr />
        </InfoBlock>
        <InfoBlock title="بيانات المريض">
          <Field label="الاسم" value={caseRow.patients?.name ?? "—"} bold />
          <Field label="الهاتف" value={caseRow.patients?.phone ?? "—"} ltr />
        </InfoBlock>
        <InfoBlock title="بيانات الحالة">
          <Field label="تاريخ الاستلام" value={format(new Date(caseRow.date_received), "dd/MM/yyyy")} />
          <Field label="تاريخ التسليم المتوقع" value={caseRow.due_date ? format(new Date(caseRow.due_date), "dd/MM/yyyy") : "—"} />
          <Field label="المرحلة الحالية" value={stage?.name ?? "—"} bold />
          <Field label="اللون العام" value={caseRow.shade ?? "—"} />
        </InfoBlock>
        <InfoBlock title="ملخص مالي">
          <Field label="عدد الوحدات" value={String(caseRow.units ?? 1)} />
          <Field label="عدد العناصر" value={String(items.length)} />
          <Field label="السعر الكلي" value={`${Number(caseRow.price ?? 0).toFixed(2)} ${currency}`} bold />
        </InfoBlock>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <SectionTitle>عناصر العمل</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "linear-gradient(135deg, #0e7490, #06b6d4)", color: "#fff" }}>
                <th style={th}>#</th>
                <th style={th}>نوع العمل</th>
                <th style={th}>اللون</th>
                <th style={th}>الأسنان</th>
                <th style={{ ...th, textAlign: "center" }}>الوحدات</th>
                <th style={{ ...th, textAlign: "left" }}>سعر الوحدة</th>
                <th style={{ ...th, textAlign: "left" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={td}>{idx + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{it.work_types?.name ?? "—"}</td>
                  <td style={td}>{it.shade ?? "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {it.tooth_numbers ? <QuadrantsPrintView selected={it.tooth_numbers} size="sm" /> : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{it.units}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "monospace" }}>{it.unit_price != null ? Number(it.unit_price).toFixed(2) : "—"}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontWeight: 700 }}>{it.total_price != null ? Number(it.total_price).toFixed(2) : "—"}</td>
                </tr>
              ))}
              <tr style={{ background: "#f0f9ff", fontWeight: 700 }}>
                <td colSpan={6} style={{ ...td, textAlign: "left", color: "#0e7490" }}>إجمالي العناصر</td>
                <td style={{ ...td, textAlign: "left", fontFamily: "monospace", color: "#0e7490", fontSize: "12px" }}>{itemsTotal.toFixed(2)} {currency}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Stage history */}
      {stageHistory.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <SectionTitle>الخط الزمني للمراحل</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ ...th, color: "#0f172a", borderBottom: "2px solid #cbd5e1" }}>المرحلة</th>
                <th style={{ ...th, color: "#0f172a", borderBottom: "2px solid #cbd5e1" }}>الفني</th>
                <th style={{ ...th, color: "#0f172a", borderBottom: "2px solid #cbd5e1" }}>الدخول</th>
                <th style={{ ...th, color: "#0f172a", borderBottom: "2px solid #cbd5e1" }}>الخروج</th>
                <th style={{ ...th, color: "#0f172a", borderBottom: "2px solid #cbd5e1", textAlign: "center" }}>المدة</th>
              </tr>
            </thead>
            <tbody>
              {stageHistory.map((h: any, i: number) => (
                <tr key={h.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={td}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: h.workflow_stages?.color ?? "#94a3b8", marginLeft: "6px" }} />
                    {h.workflow_stages?.name ?? "—"}
                    {h.skipped && <span style={{ marginRight: "6px", fontSize: "9px", color: "#dc2626" }}>(تم التخطي)</span>}
                  </td>
                  <td style={td}>{h.technicians?.name ?? "—"}</td>
                  <td style={td}>{format(new Date(h.entered_at), "dd/MM HH:mm")}</td>
                  <td style={td}>{h.exited_at ? format(new Date(h.exited_at), "dd/MM HH:mm") : "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontFamily: "monospace" }}>{formatDuration(h.duration_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {caseRow.notes && (
        <div style={{ marginBottom: "14px" }}>
          <SectionTitle>ملاحظات</SectionTitle>
          <div style={{ border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: "8px", padding: "10px 12px", whiteSpace: "pre-wrap", fontSize: "11px", color: "#7c2d12" }}>
            {caseRow.notes}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "20px", borderTop: "1px solid #e2e8f0", paddingTop: "8px", fontSize: "9px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
        <span>تقرير تم إنشاؤه آلياً</span>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0e7490", borderRight: "4px solid #0e7490", paddingRight: "8px", marginBottom: "8px" }}>
      {children}
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px", background: "#fafafa" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#0e7490", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, value, bold, ltr }: { label: string; value: string; bold?: boolean; ltr?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "3px", gap: "8px" }}>
      <span style={{ color: "#64748b" }}>{label}:</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: "#0f172a", textAlign: "left" }} dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}

function formatDuration(mins: number | null) {
  if (!mins) return "—";
  if (mins < 60) return `${mins} د`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}س ${m}د` : `${h}س`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}ي ${rh}س` : `${d}ي`;
}
