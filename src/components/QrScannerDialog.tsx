import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QrScannerDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => handleResult(decoded),
          () => {},
        );
      } catch (e: any) {
        setError(e?.message ?? "تعذر فتح الكاميرا");
      }
    };
    // small delay to ensure container is mounted
    const t = setTimeout(start, 100);
    return () => {
      clearTimeout(t);
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear());
        scannerRef.current = null;
      }
    };
  }, [open]);

  const handleResult = (text: string) => {
    // Try to extract /cases/{id}
    const match = text.match(/\/cases\/([0-9a-f-]{36})/i);
    if (!match) {
      toast.error("الكود غير معروف");
      return;
    }
    const id = match[1];
    onOpenChange(false);
    setTimeout(() => navigate({ to: "/cases/$caseId", params: { caseId: id } }), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>مسح كود الحالة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div id={containerId} className="overflow-hidden rounded-lg border bg-black" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            وجّه الكاميرا نحو ملصق الحالة
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
