import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, FileJson, FileSpreadsheet, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/backup")({
  component: BackupPage,
});

// Tables exported in a full backup (lab-scoped)
const BACKUP_TABLES = [
  "labs",
  "profiles",
  "user_roles",
  "roles",
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
  "audit_log",
] as const;

type TableName = (typeof BACKUP_TABLES)[number];

const TABLE_LABELS: Partial<Record<TableName, string>> = {
  labs: "بيانات المعمل",
  profiles: "المستخدمون",
  user_roles: "الأدوار",
  doctors: "الأطباء",
  patients: "المرضى",
  cases: "الحالات",
  case_items: "بنود الحالات",
  case_stage_history: "سجل المراحل",
  payments: "مدفوعات الأطباء",
  expenses: "المصروفات",
  vouchers: "السندات",
  inventory_items: "أصناف المخزون",
  purchase_invoices: "فواتير المشتريات",
  workflows: "سير العمل",
  workflow_stages: "مراحل العمل",
};

async function fetchAllForLab(table: TableName, labId: string): Promise<unknown[]> {
  // Most tables have lab_id; profiles is filtered by lab_id; labs by id
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

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
}

function BackupPage() {
  const { labId, hasRole, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: string; done: number; total: number } | null>(null);
  const [counts, setCounts] = useState<Partial<Record<TableName, number>>>({});

  if (!hasRole("admin")) {
    return <Navigate to="/dashboard" />;
  }
  if (!labId) {
    return null;
  }

  const exportFullJson = async () => {
    setBusy(true);
    setProgress({ current: "بدء التصدير", done: 0, total: BACKUP_TABLES.length });
    try {
      const data: Record<string, unknown[]> = {};
      const newCounts: Partial<Record<TableName, number>> = {};
      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const t = BACKUP_TABLES[i];
        setProgress({ current: TABLE_LABELS[t] ?? t, done: i, total: BACKUP_TABLES.length });
        try {
          const rows = await fetchAllForLab(t, labId);
          data[t] = rows;
          newCounts[t] = rows.length;
        } catch (e) {
          console.warn(`Skipped ${t}:`, e);
          data[t] = [];
        }
      }
      setCounts(newCounts);
      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        lab_id: labId,
        exported_by: profile?.full_name ?? null,
        tables: data,
      };
      const fname = `backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
      downloadFile(fname, JSON.stringify(payload, null, 2), "application/json");
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التصدير";
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const exportTableCsv = async (t: TableName) => {
    setBusy(true);
    try {
      const rows = (await fetchAllForLab(t, labId)) as Record<string, unknown>[];
      if (rows.length === 0) {
        toast.info("لا توجد بيانات في هذا الجدول");
        return;
      }
      const csv = toCsv(rows);
      downloadFile(`${t}-${format(new Date(), "yyyy-MM-dd")}.csv`, csv, "text/csv;charset=utf-8");
      toast.success(`تم تصدير ${rows.length} صف`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التصدير";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const QUICK_TABLES: TableName[] = [
    "cases",
    "doctors",
    "patients",
    "payments",
    "expenses",
    "inventory_items",
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          النسخ الاحتياطي والتصدير
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          صدّر نسخة كاملة من بيانات معملك أو جدولًا واحدًا لاستخدامه في Excel
        </p>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">احفظ النسخة في مكان آمن</p>
            <p className="text-muted-foreground mt-1">
              تحتوي على بيانات حسّاسة (أطباء، مرضى، مالية). نوصي بأخذ نسخة أسبوعيًا على الأقل.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            نسخة كاملة (JSON)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            يصدّر كل الجداول ({BACKUP_TABLES.length} جدول) في ملف JSON واحد. مناسب للأرشفة الكاملة.
          </p>
          <Button onClick={exportFullJson} disabled={busy} size="lg" className="w-full sm:w-auto">
            {busy && progress ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري تصدير: {progress.current} ({progress.done}/{progress.total})
              </>
            ) : (
              <>
                <Download className="ml-2 h-4 w-4" />
                تنزيل النسخة الاحتياطية الآن
              </>
            )}
          </Button>

          {Object.keys(counts).length > 0 && !busy && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {(Object.entries(counts) as [TableName, number][]).map(([t, n]) => (
                <div key={t} className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground truncate">{TABLE_LABELS[t] ?? t}</p>
                  <p className="font-semibold tabular-nums">{n.toLocaleString("ar-EG")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-success" />
            تصدير جدول واحد (Excel/CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUICK_TABLES.map((t) => (
            <div
              key={t}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">{t}</Badge>
                <span className="text-sm font-medium">{TABLE_LABELS[t] ?? t}</span>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => exportTableCsv(t)}>
                <Download className="ml-1 h-4 w-4" />
                CSV
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الاستعادة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            استعادة النسخ الاحتياطية تتم يدويًا عبر الدعم الفني لضمان سلامة البيانات. احتفظ بملف JSON في مكان آمن وراسل الدعم عند الحاجة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
