import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_end: boolean;
}

interface CaseProgressBarProps {
  stages: Stage[];
  currentStageId?: string | null;
  completedStageIds?: Set<string>;
}

export function CaseProgressBar({ stages, currentStageId, completedStageIds }: CaseProgressBarProps) {
  if (!stages?.length) return null;
  const sorted = [...stages].sort((a, b) => a.order_index - b.order_index);
  const currentIdx = sorted.findIndex((s) => s.id === currentStageId);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-1">
        {sorted.map((stage, idx) => {
          const isPast = idx < currentIdx || completedStageIds?.has(stage.id);
          const isCurrent = stage.id === currentStageId;
          const isFuture = idx > currentIdx && !completedStageIds?.has(stage.id);

          return (
            <div key={stage.id} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                    isPast && "border-emerald-500 bg-emerald-500 text-white",
                    isCurrent && "scale-110 border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] ring-4 ring-primary/15",
                    isFuture && "border-border bg-muted text-muted-foreground",
                  )}
                  style={isCurrent ? { backgroundColor: stage.color, borderColor: stage.color } : undefined}
                >
                  {isPast ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "max-w-[70px] truncate text-center text-[10px] leading-tight",
                    isCurrent && "font-bold text-foreground",
                    isPast && "text-emerald-700 dark:text-emerald-400",
                    isFuture && "text-muted-foreground",
                  )}
                  title={stage.name}
                >
                  {stage.name}
                </span>
              </div>
              {idx < sorted.length - 1 && (
                <div
                  className={cn(
                    "mb-5 h-0.5 w-6 rounded-full transition-all sm:w-10",
                    isPast ? "bg-emerald-500" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
