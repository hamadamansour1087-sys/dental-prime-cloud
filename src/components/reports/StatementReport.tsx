import { format } from "date-fns";

interface Lab {
  name: string;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  currency?: string | null;
  email?: string | null;
}

interface Doctor {
  name: string;
  governorate?: string | null;
  clinic_name?: string | null;
  phone?: string | null;
  opening_balance?: number | null;
}

export interface StatementCase {
  id: string;
  case_number: string;
  date_received: string;
  patient_name?: string | null;
  notes?: string | null;
  work_type_name?: string | null;
  tooth_numbers?: string | null;
  price?: number | null;
}

export interface StatementPayment {
  id: string;
  payment_date: string;
  amount: number;
  reference?: string | null;
  notes?: string | null;
}

interface Row {
  date: string;
  code: string;
  patient: string;
  notes: string;
  diagUpper: string;
  diagLower: string;
  workType: string;
  caseValue: number;
  payment: number;
}

function splitTeeth(t?: string | null): { upper: string; lower: string } {
  if (!t) return { upper: "", lower: "" };
  const tokens = t.split(/[,\s]+/).filter(Boolean);
  const upper: string[] = [];
  const lower: string[] = [];
  for (const tok of tokens) {
    const m = tok.match(/^(\d{2})$/);
    if (m) {
      const q = parseInt(tok[0], 10);
      if (q === 1 || q === 2) upper.push(tok);
      else if (q === 3 || q === 4) lower.push(tok);
      else upper.push(tok);
    } else {
      upper.push(tok);
    }
  }
  return { upper: upper.join(" "), lower: lower.join(" ") };
}

// Brand palette
const BRAND = "#8a7a5c"; // warm bronze
const BRAND_DARK = "#6f624a";
const BRAND_LIGHT = "#f5f1e8";
const BORDER = "#3a3a3a";

export function StatementReport({
  lab,
  doctor,
  cases,
  payments,
  fromDate,
  toDate,
}: {
  lab: Lab;
  doctor: Doctor;
  cases: StatementCase[];
  payments: StatementPayment[];
  fromDate: Date;
  toDate: Date;
}) {
  const opening = Number(doctor.opening_balance ?? 0);
  const casesTotal = cases.reduce((s, c) => s + Number(c.price ?? 0), 0);
  const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const balance = opening + casesTotal - paymentsTotal;

  type Item = { sortKey: string; row: Row };
  const items: Item[] = [];

  cases.forEach((c) => {
    const teeth = splitTeeth(c.tooth_numbers);
    items.push({
      sortKey: `${c.date_received}-1-${c.case_number}`,
      row: {
        date: format(new Date(c.date_received), "d/M/yyyy"),
        code: c.case_number,
        patient: c.patient_name ? `د/ ${c.patient_name}` : "-/-",
        notes: c.notes ?? "-",
        diagUpper: teeth.upper,
        diagLower: teeth.lower,
        workType: c.work_type_name ?? "—",
        caseValue: Number(c.price ?? 0),
        payment: 0,
      },
    });
  });

  payments.forEach((p) => {
    items.push({
      sortKey: `${p.payment_date}-2-${p.id}`,
      row: {
        date: format(new Date(p.payment_date), "d/M/yyyy"),
        code: "",
        patient: "-/-",
        notes: p.reference ? `دفعات بإيصال رقم ${p.reference}` : p.notes || "دفعة",
        diagUpper: "",
        diagLower: "",
        workType: "",
        caseValue: 0,
        payment: Number(p.amount ?? 0),
      },
    });
  });

  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const currency = lab.currency || "ج.م";

  return (
    <div
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "10mm 12mm 14mm",
        background: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        fontSize: "11px",
        lineHeight: 1.45,
        boxSizing: "border-box",
      }}
    >
      {/* === Brand Header Bar === */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 14px",
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
          color: "#fff",
          borderRadius: "6px",
          marginBottom: "10px",
        }}
      >
        {/* Logo + Lab Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          {lab.logo_url ? (
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "#fff",
                borderRadius: "8px",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <img
                src={lab.logo_url}
                alt={lab.name}
                crossOrigin="anonymous"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "rgba(255,255,255,0.15)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {lab.name?.charAt(0) ?? "L"}
            </div>
          )}
          <div>
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "2px" }}>{lab.name}</div>
            <div style={{ fontSize: "10px", opacity: 0.9, lineHeight: 1.5 }}>
              {lab.address && <div>{lab.address}</div>}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {lab.phone && <span dir="ltr">📞 {lab.phone}</span>}
                {lab.email && <span dir="ltr">✉ {lab.email}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Title block */}
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            color: BRAND_DARK,
            padding: "10px 22px",
            borderRadius: "6px",
            textAlign: "center",
            minWidth: "150px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 800 }}>كشف حساب</div>
          <div style={{ fontSize: "10px", marginTop: "3px", color: "#666", letterSpacing: "0.3px" }}>Account Statement</div>
        </div>
      </div>

      {/* === Meta info bar === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "10px",
          fontSize: "11px",
        }}
      >
        <div
          style={{
            border: `1px solid #d4cdb8`,
            background: BRAND_LIGHT,
            padding: "8px 12px",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontSize: "9.5px", color: "#666", marginBottom: "2px" }}>الطبيب / العيادة</div>
          <div style={{ fontWeight: 700, fontSize: "12.5px" }}>
            د/ {doctor.name}
            {doctor.governorate ? ` — ${doctor.governorate}` : ""}
          </div>
          {(doctor.clinic_name || doctor.phone) && (
            <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
              {doctor.clinic_name}
              {doctor.clinic_name && doctor.phone ? " — " : ""}
              {doctor.phone && <span dir="ltr">{doctor.phone}</span>}
            </div>
          )}
        </div>
        <div
          style={{
            border: `1px solid #d4cdb8`,
            background: BRAND_LIGHT,
            padding: "8px 12px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "9.5px", color: "#666" }}>من تاريخ</div>
            <div style={{ fontWeight: 700, fontSize: "12px" }}>{format(fromDate, "yyyy/MM/dd")}</div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#d4cdb8" }} />
          <div>
            <div style={{ fontSize: "9.5px", color: "#666" }}>إلى تاريخ</div>
            <div style={{ fontWeight: 700, fontSize: "12px" }}>{format(toDate, "yyyy/MM/dd")}</div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#d4cdb8" }} />
          <div>
            <div style={{ fontSize: "9.5px", color: "#666" }}>تاريخ الإصدار</div>
            <div style={{ fontWeight: 700, fontSize: "12px" }}>{format(new Date(), "yyyy/MM/dd")}</div>
          </div>
        </div>
      </div>

      {/* === Table === */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: `1px solid ${BORDER}`,
          fontSize: "10.5px",
        }}
      >
        <thead>
          <tr style={{ background: BRAND, color: "#fff" }}>
            <th style={th}>ت/كود الحالة</th>
            <th style={th}>المريض</th>
            <th style={th}>ملاحظات</th>
            <th style={{ ...th, width: "30%" }}>التشخيص</th>
            <th style={th}>قيمة الحالة</th>
            <th style={th}>الدفعات</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening balance row */}
          <tr style={{ background: "#fafaf7" }}>
            <td style={td}>{format(fromDate, "d/M/yyyy")}</td>
            <td style={tdC}>-/-</td>
            <td style={{ ...td, fontStyle: "italic", color: "#555" }}>
              <div>رصيد مرحل من</div>
              <div>الفترة السابقة</div>
            </td>
            <td style={tdDiag}>
              <div style={diagRow}><span style={diagCell}></span><span style={diagCell}></span><span style={diagWork}></span></div>
              <div style={diagRow}><span style={diagCell}></span><span style={diagCell}></span><span style={diagWork}></span></div>
            </td>
            <td style={tdNum}>{opening.toFixed(2)}</td>
            <td style={tdNum}>0.00</td>
          </tr>

          {items.map((it, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafaf7" }}>
              <td style={td}>
                <div>{it.row.date}</div>
                {it.row.code && (
                  <div style={{ direction: "ltr", fontFamily: "monospace", fontSize: "10px", color: "#666", marginTop: "2px" }}>
                    {it.row.code}
                  </div>
                )}
              </td>
              <td style={tdC}>{it.row.patient}</td>
              <td style={td}>{it.row.notes}</td>
              <td style={tdDiag}>
                <div style={diagRow}>
                  <span style={diagCell}>{it.row.diagUpper.split(" ")[0] ?? ""}</span>
                  <span style={diagCell}>{it.row.diagUpper.split(" ").slice(1).join(" ")}</span>
                  <span style={diagWork}>{it.row.workType}</span>
                </div>
                <div style={diagRow}>
                  <span style={diagCell}>{it.row.diagLower.split(" ")[0] ?? ""}</span>
                  <span style={diagCell}>{it.row.diagLower.split(" ").slice(1).join(" ")}</span>
                  <span style={diagWork}></span>
                </div>
              </td>
              <td style={tdNum}>{it.row.caseValue ? it.row.caseValue.toFixed(2) : "—"}</td>
              <td style={{ ...tdNum, color: it.row.payment ? "#1d6b3a" : undefined, fontWeight: it.row.payment ? 700 : 400 }}>
                {it.row.payment ? it.row.payment.toFixed(2) : "—"}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr style={{ background: BRAND_LIGHT, fontWeight: 700 }}>
            <td style={{ ...td, fontWeight: 700 }} colSpan={4}>
              <div style={{ textAlign: "left", paddingLeft: "10px" }}>الإجماليات</div>
            </td>
            <td style={{ ...tdNum, fontWeight: 800, fontSize: "11.5px" }}>{(opening + casesTotal).toFixed(2)}</td>
            <td style={{ ...tdNum, fontWeight: 800, fontSize: "11.5px", color: "#1d6b3a" }}>{paymentsTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* === Footer summary === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginTop: "14px",
        }}
      >
        <div style={summaryBox}>
          <div style={summaryLabel}>إجمالي المستحق</div>
          <div style={{ ...summaryValue, color: BRAND_DARK }}>
            {(opening + casesTotal).toFixed(2)} <span style={{ fontSize: "9px" }}>{currency}</span>
          </div>
        </div>
        <div style={summaryBox}>
          <div style={summaryLabel}>إجمالي المدفوع</div>
          <div style={{ ...summaryValue, color: "#1d6b3a" }}>
            {paymentsTotal.toFixed(2)} <span style={{ fontSize: "9px" }}>{currency}</span>
          </div>
        </div>
        <div
          style={{
            ...summaryBox,
            background: balance > 0 ? "#fef2f2" : "#f0fdf4",
            borderColor: balance > 0 ? "#fca5a5" : "#86efac",
          }}
        >
          <div style={summaryLabel}>رصيد الطبيب</div>
          <div
            style={{
              ...summaryValue,
              color: balance > 0 ? "#b91c1c" : "#15803d",
              fontWeight: 800,
            }}
          >
            {balance.toFixed(2)} <span style={{ fontSize: "9px" }}>{currency}</span>
          </div>
        </div>
      </div>

      {/* === Footer signature line === */}
      <div
        style={{
          marginTop: "22px",
          paddingTop: "10px",
          borderTop: `1px dashed #999`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "#666",
        }}
      >
        <div>
          <div style={{ marginBottom: "20px" }}>توقيع المحاسب: ________________</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ marginBottom: "20px" }}>ختم المعمل: ________________</div>
        </div>
      </div>

      <div style={{ marginTop: "8px", textAlign: "center", fontSize: "9px", color: "#999" }}>
        تم إنشاء هذا الكشف إلكترونياً بواسطة {lab.name} — {format(new Date(), "yyyy/MM/dd HH:mm")}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "7px 4px",
  border: `1px solid ${BORDER}`,
  fontWeight: 700,
  textAlign: "center",
  fontSize: "11px",
};

const td: React.CSSProperties = {
  padding: "6px 6px",
  border: `1px solid ${BORDER}`,
  textAlign: "center",
  verticalAlign: "middle",
};

const tdC: React.CSSProperties = { ...td };

const tdNum: React.CSSProperties = {
  ...td,
  fontFamily: "monospace",
  textAlign: "center",
};

const tdDiag: React.CSSProperties = {
  ...td,
  padding: "4px",
  textAlign: "center",
};

const diagRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0",
  minHeight: "20px",
};

const diagCell: React.CSSProperties = {
  flex: "0 0 70px",
  borderBottom: `1px solid ${BORDER}`,
  padding: "2px 4px",
  fontFamily: "monospace",
  letterSpacing: "2px",
  textAlign: "center",
  margin: "0 2px",
  minHeight: "16px",
};

const diagWork: React.CSSProperties = {
  flex: 1,
  padding: "2px 6px",
  textAlign: "center",
  fontSize: "10.5px",
};

const summaryBox: React.CSSProperties = {
  border: `1px solid #d4cdb8`,
  borderRadius: "6px",
  padding: "10px 12px",
  textAlign: "center",
  background: "#fafaf7",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "10px",
  color: "#666",
  marginBottom: "4px",
  fontWeight: 600,
};

const summaryValue: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  fontFamily: "monospace",
};
