import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Database, Download, LogOut, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const BACKUP_TABLES = [
  "labs",
  "profiles",
  "user_roles",
  "doctors",
  "doctor_clinics",
  "patients",
  "technicians",
  "suppliers",
  "work_type_categories",
  "work_types",
  "workflows",
  "workflow_stages",
  "workflow_transitions",
  "price_lists",
  "cases",
  "case_items",
  "case_stage_history",
  "case_attachments",
  "cash_accounts",
  "expense_categories",
  "expenses",
  "payments",
  "supplier_payments",
  "vouchers",
  "inventory_items",
  "inventory_movements",
  "purchase_invoices",
  "purchase_invoice_items",
] as const;

type TableName = (typeof BACKUP_TABLES)[number];

const STORAGE_KEY = "hamd:lastBackupAt";

export function shouldRemindBackup(): boolean {
  if (typeof window === "undefined") return false;
  const last = localStorage.getItem(STORAGE_KEY);
  if (!last) return true;
  const hours = (Date.now() - Number(last)) / (1000 * 60 * 60);
  return hours >= 24;
}

function markBackupTaken() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }
}

async function fetchAllForLab(table: TableName, labId: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const base = supabase.from(table).select("*").range(from, from + PAGE - 1);
    const q = table === "labs"
      ? base.eq("id" as never, labId as never)
      : base.eq("lab_id" as never, labId as never);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  labId: string;
  onProceed: () => void;
}

export function BackupReminderDialog({ open, onOpenChange, labId, onProceed }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: string; done: number } | null>(null);

  const downloadAndExit = async () => {
    setBusy(true);
    try {
      const data: Record<string, unknown[]> = {};
      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const t = BACKUP_TABLES[i];
        setProgress({ current: t, done: i });
        try {
          data[t] = await fetchAllForLab(t, labId);
        } catch (e) {
          console.warn(`Skipped ${t}:`, e);
          data[t] = [];
        }
      }
      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        lab_id: labId,
        tables: data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      markBackupTaken();
      toast.success("تم تنزيل النسخة الاحتياطية");
      // small delay so the download starts before navigating away
      setTimeout(() => {
        onOpenChange(false);
        onProceed();
      }, 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التصدير");
      setBusy(false);
    }
  };

  const skip = () => {
    markBackupTaken(); // user explicitly chose to skip — don't nag again for 24h
    onOpenChange(false);
    onProceed();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onOpenChange(v))}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            هل تريد أخذ نسخة احتياطية قبل الخروج؟
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            ينصح بأخذ نسخة احتياطية يومية لحفظ كامل بيانات معملك (الحالات، الأطباء، الفواتير...).
            سيتم تنزيل ملف JSON على جهازك يمكنك حفظه في مكان آمن.
          </DialogDescription>
        </DialogHeader>

        {busy && progress && (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>جاري تصدير: {progress.current}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress.done / BACKUP_TABLES.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 sm:flex-row-reverse">
          <Button onClick={downloadAndExit} disabled={busy} className="gap-2">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التحميل...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                تنزيل ثم خروج
              </>
            )}
          </Button>
          <Button variant="outline" onClick={skip} disabled={busy} className="gap-2">
            <LogOut className="h-4 w-4" />
            خروج بدون نسخة
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
        </DialogFooter>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check className="h-3 w-3" />
          لن نسألك مرة أخرى خلال ٢٤ ساعة بعد أي اختيار.
        </p>
      </DialogContent>
    </Dialog>
  );
}
