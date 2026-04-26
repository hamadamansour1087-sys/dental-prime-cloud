import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseNumber: string;
  caseId: string;
  doctorName?: string | null;
  patientName?: string | null;
  dateReceived?: string | null;
  dueDate?: string | null;
  stageName?: string | null;
  labName?: string | null;
}

export function CaseLabelDialog({
  open,
  onOpenChange,
  caseNumber,
  caseId,
  doctorName,
  patientName,
  dateReceived,
  dueDate,
  stageName,
  labName,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const url = `${window.location.origin}/cases/${caseId}`;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: "M" }).then(setQrUrl);
  }, [open, caseId]);

  const handlePrint = () => {
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const html = `
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>ملصق ${esc(caseNumber)}</title>
<style>
  @page { size: A6; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 0; color: #111; }
  .label { width: 100%; }
  .lab { font-size: 11px; color: #666; text-align: center; margin-bottom: 4px; }
  .num { font-size: 28px; font-weight: 800; text-align: center; letter-spacing: 1px; margin: 4px 0 8px; font-family: ui-monospace, monospace; }
  .row { display: flex; gap: 8px; align-items: flex-start; }
  .qr { flex: 0 0 90px; }
  .qr img { width: 90px; height: 90px; display: block; }
  .info { flex: 1; font-size: 11px; line-height: 1.6; }
  .info b { display: inline-block; min-width: 50px; color: #555; font-weight: 500; }
  .stage { display: inline-block; font-size: 10px; padding: 2px 8px; border: 1px solid #999; border-radius: 999px; margin-top: 4px; }
  .footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #999; font-size: 9px; color: #666; text-align: center; word-break: break-all; }
</style></head><body>
<div class="label">
  ${labName ? `<div class="lab">${esc(labName)}</div>` : ""}
  <div class="num">${esc(caseNumber)}</div>
  <div class="row">
    <div class="qr">${qrUrl ? `<img src="${esc(qrUrl)}" alt="QR"/>` : ""}</div>
    <div class="info">
      ${doctorName ? `<div><b>الطبيب:</b> ${esc(doctorName)}</div>` : ""}
      ${patientName ? `<div><b>المريض:</b> ${esc(patientName)}</div>` : ""}
      ${dateReceived ? `<div><b>الاستلام:</b> ${esc(format(new Date(dateReceived), "dd/MM/yyyy"))}</div>` : ""}
      ${dueDate ? `<div><b>التسليم:</b> ${esc(format(new Date(dueDate), "dd/MM/yyyy"))}</div>` : ""}
      ${stageName ? `<div class="stage">${esc(stageName)}</div>` : ""}
    </div>
  </div>
  <div class="footer">${esc(window.location.origin)}/cases/${esc(caseId)}</div>
</div>
<script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},250);};</script>
</body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ملصق الحالة {caseNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-white p-4 text-center">
            {qrUrl ? (
              <img src={qrUrl} alt="QR" className="mx-auto h-44 w-44" />
            ) : (
              <canvas ref={canvasRef} className="mx-auto" />
            )}
            <p className="mt-2 font-mono text-lg font-bold">{caseNumber}</p>
            {doctorName && <p className="text-xs text-muted-foreground">{doctorName}</p>}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            امسح الكود من أي جوال لفتح الحالة مباشرة
          </p>
          <Button className="w-full" onClick={handlePrint}>
            <Printer className="ml-1 h-4 w-4" /> طباعة الملصق (A6)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
