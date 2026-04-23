import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CheckCircle2, Circle, SkipForward, Clock, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageHistoryEntry {
  id: string;
  entered_at: string | null;
  exited_at: string | null;
  duration_minutes: number | null;
  skipped: boolean;
  notes: string | null;
  workflow_stages?: { name: string; color: string } | null;
  technicians?: { name: string } | null;
}

interface CaseTimelineProps {
  history: StageHistoryEntry[];
  currentStageId?: string | null;
}

function formatDuration(mins: number) {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} دقيقة`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)} ساعة`;
  return `${Math.round(hours / 24)} يوم`;
}

export function CaseTimeline({ history }: CaseTimelineProps) {
  if (!history?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">لا يوجد سجل مراحل بعد</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-r-2 border-dashed border-border/60 pr-6">
      {history.map((h, idx) => {
        const stage = h.workflow_stages;
        const isActive = !h.exited_at && !h.skipped;
        const isDone = !!h.exited_at && !h.skipped;
        const enteredAt = h.entered_at
          ? format(new Date(h.entered_at), "dd MMM yyyy · HH:mm", { locale: ar })
          : "—";

        return (
          <li key={h.id} className="relative">
            {/* Marker */}
            <span
              className={cn(
                "absolute -right-[33px] top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background transition-all",
                isActive && "animate-pulse shadow-lg",
                h.skipped && "opacity-50",
              )}
              style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              ) : h.skipped ? (
                <SkipForward className="h-3 w-3 text-white" />
              ) : (
                <Circle className="h-3 w-3 fill-white text-white" />
              )}
            </span>

            {/* Card */}
            <div
              className={cn(
                "rounded-xl border p-3 transition-all hover:shadow-[var(--shadow-elegant)]",
                isActive && "border-primary/40 bg-gradient-to-br from-primary/5 to-transparent shadow-[var(--shadow-elegant)]",
                h.skipped && "border-dashed bg-muted/20 opacity-70",
                !isActive && !h.skipped && "bg-card",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{stage?.name ?? "—"}</span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      المرحلة الحالية
                    </span>
                  )}
                  {h.skipped && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      <SkipForward className="h-3 w-3" /> تم التخطي
                    </span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> مكتمل
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{enteredAt}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {h.technicians?.name && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium text-foreground">{h.technicians.name}</span>
                  </span>
                )}
                {h.duration_minutes != null && !h.skipped && h.exited_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(h.duration_minutes)}
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] opacity-60">#{idx + 1}</span>
              </div>

              {h.notes && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <p className="whitespace-pre-wrap">{h.notes}</p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
