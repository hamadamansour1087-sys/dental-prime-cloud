import { format } from "date-fns";

interface Lab {
  name: string;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  currency?: string | null;
}

interface Doctor {
  name: string;
  governorate?: string | null;
  clinic_name?: string | null;
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

  // Build interleaved rows sorted by date
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
        notes: p.reference
          ? `دفعات بإيصال رقم ${p.reference}`
          : p.notes || "دفعة",
        diagUpper: "",
        diagLower: "",
        workType: "",
        caseValue: 0,
        payment: Number(p.amount ?? 0),
      },
    });
  });

  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm 14mm",
        background: "#ffffff",
        color: "#111",
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        fontSize: "11px",
        lineHeight: 1.4,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ width: "30%" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>كشف حساب طبيب</div>
          <div style={{ display: "flex", justifyContent: "center", gap: "30px", fontSize: "12px" }}>
            <span>من : <span style={{ borderBottom: "1px solid #000", padding: "0 8px" }}>{format(fromDate, "yyyy/MM/dd")}</span></span>
            <span>الى : <span style={{ borderBottom: "1px solid #000", padding: "0 8px" }}>{format(toDate, "yyyy/MM/dd")}</span></span>
          </div>
        </div>
        <div style={{ width: "30%", textAlign: "left" }}>
          <div style={{ border: "1px solid #000", padding: "6px 10px", display: "inline-block", minWidth: "150px", textAlign: "center", fontWeight: 600 }}>
            {lab.name}
          </div>
        </div>
      </div>

      {/* Doctor info */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "8px", fontSize: "12px" }}>
        <span style={{ borderBottom: "1px solid #000", padding: "0 12px", minWidth: "200px", textAlign: "center" }}>
          {doctor.name}{doctor.governorate ? ` ${doctor.governorate}` : ""}
        </span>
        <span style={{ fontWeight: 600 }}>: الطبيب/المستشفى</span>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "10.5px" }}>
        <thead>
          <tr style={{ background: "#8a7a5c", color: "#fff" }}>
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
          <tr>
            <td style={td}>{format(fromDate, "d/M/yyyy")}</td>
            <td style={tdC}>-/-</td>
            <td style={td}>
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
            <tr key={i}>
              <td style={td}>
                <div>{it.row.date}</div>
                {it.row.code && <div style={{ direction: "ltr", fontFamily: "monospace" }}>{it.row.code}</div>}
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
              <td style={tdNum}>{it.row.caseValue.toFixed(2)}</td>
              <td style={tdNum}>{it.row.payment.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer total */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px", gap: "10px", alignItems: "center", fontSize: "13px" }}>
        <span style={{ border: "1px solid #000", padding: "6px 22px", fontWeight: 700, fontFamily: "monospace", minWidth: "120px", textAlign: "center" }}>
          {balance.toFixed(2)}
        </span>
        <span style={{ fontWeight: 700 }}>: رصيد الطبيب</span>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "6px 4px",
  border: "1px solid #000",
  fontWeight: 700,
  textAlign: "center",
  fontSize: "11px",
};

const td: React.CSSProperties = {
  padding: "6px 6px",
  border: "1px solid #000",
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
  borderBottom: "1px solid #000",
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
