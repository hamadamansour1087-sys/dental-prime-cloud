import { Link } from "@tanstack/react-router";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { ArrowRight, Calendar, Clock, AlertTriangle, CheckCircle2, ArrowLeftRight, QrCode, User, Stethoscope, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CaseHeaderProps {
  caseRow: any;
  stage?: { name: string; color: string } | null;
  onBack: () => void;
  onMoveStage: () => void;
  onLabel: () => void;
  onPdf?: () => void;
}

export function CaseHeader({ caseRow, stage, onBack, onMoveStage, onLabel, onPdf }: CaseHeaderProps) {
  const isDelivered = caseRow.status === "delivered";
  const dueDate = caseRow.due_date ? new Date(caseRow.due_date) : null;
  const daysToDue = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const isOverdue = daysToDue != null && daysToDue < 0 && !isDelivered;
  const isUrgent = daysToDue != null && daysToDue >= 0 && daysToDue <= 2 && !isDelivered;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-[var(--shadow-elegant)] sm:p-6">
      {/* Decorative gradient blob */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />

      <div className="relative space-y-4">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Button size="icon" variant="ghost" onClick={onBack} className="shrink-0">
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold sm:text-2xl">حالة</h1>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-base font-bold text-primary sm:text-lg">
                  {caseRow.case_number}
                </span>
                {isDelivered && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> تم التسليم
                  </span>
                )}
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> متأخر {Math.abs(daysToDue!)} يوم
                  </span>
                )}
                {isUrgent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" /> {daysToDue === 0 ? "اليوم" : `${daysToDue} يوم متبقي`}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  استُلمت {format(new Date(caseRow.date_received), "dd MMM yyyy", { locale: ar })}
                </span>
                {dueDate && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    التسليم {format(dueDate, "dd MMM yyyy", { locale: ar })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stage && (
              <span
                className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium shadow-sm"
                style={{ borderColor: stage.color, backgroundColor: `${stage.color}15`, color: stage.color }}
              >
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.name}
              </span>
            )}
            {!isDelivered && (
              <Button size="sm" onClick={onMoveStage} className="shadow-sm">
                <ArrowLeftRight className="ml-1 h-4 w-4" /> نقل المرحلة
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onLabel}>
              <QrCode className="ml-1 h-4 w-4" /> ملصق QR
            </Button>
            {onPdf && (
              <Button variant="outline" size="sm" onClick={onPdf}>
                <FileDown className="ml-1 h-4 w-4" /> PDF
              </Button>
            )}
          </div>
        </div>

        {/* Quick info chips */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InfoChip icon={<Stethoscope className="h-3.5 w-3.5" />} label="الطبيب" value={caseRow.doctors?.name ?? "—"} />
          <InfoChip icon={<User className="h-3.5 w-3.5" />} label="المريض" value={caseRow.patients?.name ?? "—"} />
          <InfoChip label="إجمالي الوحدات" value={String(caseRow.units ?? 0)} mono />
          <InfoChip
            label="الإجمالي"
            value={Number(caseRow.price ?? 0).toFixed(2)}
            mono
            highlight
          />
        </div>
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
  mono,
  highlight,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/60 p-2.5 backdrop-blur",
        highlight && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold",
          mono && "font-mono",
          highlight && "text-primary",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
