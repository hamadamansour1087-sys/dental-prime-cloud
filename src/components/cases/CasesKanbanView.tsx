import type { MouseEvent as ReactMouseEvent } from "react";
import { format } from "date-fns";
import { AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseRow, CaseStage } from "./types";

interface Props {
  cases: CaseRow[];
  stages: CaseStage[] | undefined;
  parentWorkTypes: Map<string, string> | undefined;
  today: string;
  onOpen: (caseId: string) => void;
  onMove: (caseId: string, toStageId: string, workflowId: string | null, currentStageId: string | null) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLElement>, c: CaseRow) => void;
}

export function CasesKanbanView({
  cases,
  stages,
  parentWorkTypes,
  today,
  onOpen,
  onMove,
  onContextMenu,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stages?.map((stage) => {
        const stageCases = cases.filter((c) => c.current_stage_id === stage.id);
        return (
          <div key={stage.id} className="rounded-2xl border border-border/60 bg-card/50 p-3 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 ring-offset-card"
                  style={{ backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}40` }}
                />
                <span className="font-medium text-sm">{stage.name}</span>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
                {stageCases.length}
              </span>
            </div>
            <div className="space-y-2">
              {stageCases.map((c) => {
                const overdue = !!c.due_date && c.due_date < today && c.status === "active";
                const nextStage = stages?.find((s) => s.order_index === stage.order_index + 1);
                const parentWorkType = c.parent_case_id ? parentWorkTypes?.get(c.parent_case_id) : null;
                const showParent =
                  c.parent_case_id && c.case_type !== "new" && parentWorkType && parentWorkType !== c.work_types?.name;
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer transition-colors hover:border-primary"
                    onContextMenu={(e) => onContextMenu(e, c)}
                  >
                    <CardContent className="p-3 text-sm">
                      <button type="button" onClick={() => onOpen(c.id)} className="block w-full text-right">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{c.case_number}</span>
                          {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        </div>
                        <p className="font-medium">{c.doctors?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.patients?.name ?? "—"}</p>
                        {c.work_types?.name && (
                          <div className="mt-1 text-xs">
                            {c.work_types.name}
                            {showParent && (
                              <span className="block text-[10px] text-muted-foreground">
                                الأصلي: {parentWorkType}
                              </span>
                            )}
                          </div>
                        )}
                        {c.due_date && (
                          <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(c.due_date), "dd/MM/yyyy")}
                          </p>
                        )}
                      </button>
                      {nextStage && !stage.is_end && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full text-xs"
                          onClick={() => onMove(c.id, nextStage.id, c.workflow_id, c.current_stage_id)}
                        >
                          ← {nextStage.name}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {!stageCases.length && (
                <p className="py-4 text-center text-xs text-muted-foreground">فارغ</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
