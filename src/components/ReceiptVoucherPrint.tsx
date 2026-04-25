import { forwardRef } from "react";
import { format } from "date-fns";
import { numberToArabicWords } from "@/lib/numberToArabic";

export interface ReceiptLine {
  doctorName: string;
  governorate?: string | null;
  phone?: string | null;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
}

export interface ReceiptVoucherData {
  voucherNumber: string;
  voucherDate: string; // yyyy-MM-dd
  cashAccountName?: string;
  notes?: string;
  lines: ReceiptLine[];
  lab?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    logo_url?: string | null;
    currency?: string | null;
  } | null;
}

const methodLabel = (m: string) =>
  m === "cash" ? "نقدي" : m === "transfer" ? "تحويل" : m === "cheque" ? "شيك" : m === "card" ? "بطاقة" : m || "—";

export const ReceiptVoucherPrint = forwardRef<HTMLDivElement, { data: ReceiptVoucherData }>(
  ({ data }, ref) => {
    const total = data.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const isMulti = data.lines.length > 1;
    const currency = data.lab?.currency || "EGP";
    const currencyAr = currency === "EGP" ? "جنيهًا مصريًا" : currency;
    const dateFmt = (() => {
      try { return format(new Date(data.voucherDate), "dd/MM/yyyy"); } catch { return data.voucherDate; }
    })();

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "12mm 14mm",
          background: "#ffffff",
          color: "#000000",
          fontFamily: "'Cairo', 'Tajawal', 'Arial', sans-serif",
          fontSize: "12pt",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {data.lab?.logo_url ? (
              <img src={data.lab.logo_url} alt="logo" crossOrigin="anonymous" style={{ width: 64, height: 64, objectFit: "contain" }} />
            ) : null}
            <div>
              <div style={{ fontSize: "18pt", fontWeight: 700 }}>{data.lab?.name ?? "المعمل"}</div>
              {data.lab?.address && <div style={{ fontSize: "10pt", color: "#444" }}>{data.lab.address}</div>}
              {data.lab?.phone && <div style={{ fontSize: "10pt", color: "#444", direction: "ltr" }}>{data.lab.phone}</div>}
            </div>
          </div>
          <div style={{ textAlign: "left", border: "2px solid #000", padding: "6px 14px", borderRadius: 4 }}>
            <div style={{ fontSize: "16pt", fontWeight: 800 }}>سند قبض</div>
            <div style={{ fontSize: "10pt", marginTop: 2 }}>RECEIPT VOUCHER</div>
          </div>
        </div>

        {/* Voucher meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ border: "1px solid #555", padding: "6px 10px" }}>
            <span style={{ fontWeight: 700 }}>رقم السند: </span>
            <span style={{ fontFamily: "monospace" }}>{data.voucherNumber}</span>
          </div>
          <div style={{ border: "1px solid #555", padding: "6px 10px" }}>
            <span style={{ fontWeight: 700 }}>التاريخ: </span>
            <span>{dateFmt}</span>
          </div>
          {data.cashAccountName && (
            <div style={{ border: "1px solid #555", padding: "6px 10px", gridColumn: "span 2" }}>
              <span style={{ fontWeight: 700 }}>الخزنة المستلمة: </span>
              <span>{data.cashAccountName}</span>
            </div>
          )}
        </div>

        {/* Body */}
        {isMulti ? (
          <>
            <p style={{ marginBottom: 8, fontWeight: 700 }}>
              استلمنا من السادة الأطباء المذكورين أدناه المبالغ التالية:
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={th}>م</th>
                  <th style={th}>اسم الطبيب</th>
                  <th style={th}>المحافظة</th>
                  <th style={th}>طريقة الدفع</th>
                  <th style={th}>المرجع</th>
                  <th style={{ ...th, textAlign: "left" }}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.doctorName}</td>
                    <td style={td}>{l.governorate || "—"}</td>
                    <td style={td}>{methodLabel(l.method)}</td>
                    <td style={td}>{l.reference || "—"}</td>
                    <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontWeight: 700 }}>
                      {Number(l.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#f7f7f7" }}>
                  <td style={{ ...td, fontWeight: 800 }} colSpan={5}>الإجمالي</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontWeight: 800, fontSize: "13pt" }}>
                    {total.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <div style={{ marginBottom: 14, lineHeight: 2 }}>
            <p>
              <span style={{ fontWeight: 700 }}>استلمنا من السيد الطبيب: </span>
              <span style={{ borderBottom: "1px dashed #000", padding: "0 6px", fontWeight: 700 }}>
                {data.lines[0]?.doctorName ?? "—"}
              </span>
              {data.lines[0]?.governorate ? (
                <>
                  <span style={{ marginInlineStart: 14, fontWeight: 700 }}>المحافظة: </span>
                  <span>{data.lines[0].governorate}</span>
                </>
              ) : null}
            </p>
            <p>
              <span style={{ fontWeight: 700 }}>مبلغ وقدره: </span>
              <span style={{ borderBottom: "1px dashed #000", padding: "0 6px", fontFamily: "monospace", fontWeight: 700 }}>
                {total.toFixed(2)}
              </span>
              <span style={{ marginInlineStart: 8 }}>{currency === "EGP" ? "ج.م" : currency}</span>
            </p>
            <p>
              <span style={{ fontWeight: 700 }}>طريقة الدفع: </span>
              <span>{methodLabel(data.lines[0]?.method ?? "cash")}</span>
              {data.lines[0]?.reference ? (
                <>
                  <span style={{ marginInlineStart: 14, fontWeight: 700 }}>المرجع: </span>
                  <span>{data.lines[0].reference}</span>
                </>
              ) : null}
            </p>
          </div>
        )}

        {/* Amount in words */}
        <div style={{ border: "1px solid #000", padding: "8px 12px", marginBottom: 14, background: "#fafafa" }}>
          <span style={{ fontWeight: 700 }}>المبلغ كتابةً: </span>
          <span>{numberToArabicWords(total, currencyAr)}</span>
        </div>

        {/* Notes */}
        {data.notes && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontWeight: 700 }}>ملاحظات: </span>
            <span>{data.notes}</span>
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 50 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>توقيع المستلم (المحاسب)</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>توقيع المسلِّم</div>
          </div>
        </div>

        <div style={{ marginTop: 30, textAlign: "center", fontSize: "9pt", color: "#666", borderTop: "1px dashed #999", paddingTop: 6 }}>
          تم إصدار هذا السند إلكترونيًا بواسطة نظام إدارة المعمل
        </div>
      </div>
    );
  },
);
ReceiptVoucherPrint.displayName = "ReceiptVoucherPrint";

const th: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  textAlign: "right",
  fontWeight: 700,
  fontSize: "11pt",
};
const td: React.CSSProperties = {
  border: "1px solid #555",
  padding: "6px 8px",
  textAlign: "right",
  fontSize: "11pt",
};
