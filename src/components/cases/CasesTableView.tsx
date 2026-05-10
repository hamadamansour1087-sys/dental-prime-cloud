import type { MouseEvent as ReactMouseEvent } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CaseRow, CaseStage } from "./types";

interface Props {
  cases: CaseRow[];
  stages: CaseStage[] | undefined;
  readyTechnicians: Map<string, string> | undefined;
  deliveryAgents: Map<string, string> | undefined;
  parentWorkTypes: Map<string, string> | undefined;
  today: string;
  onOpen: (caseId: string) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLElement>, c: CaseRow) => void;
}

export function CasesTableView({
  cases,
  stages,
  readyTechnicians,
  deliveryAgents,
  parentWorkTypes,
  today,
  onOpen,
  onContextMenu,
}: Props) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
      <Table className="[&_th]:bg-muted/40 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">رقم الحالة</TableHead>
            <TableHead className="w-[110px]">تاريخ الدخول</TableHead>
            <TableHead>الطبيب</TableHead>
            <TableHead>المريض</TableHead>
            <TableHead>نوع العمل</TableHead>
            <TableHead>المرحلة</TableHead>
            <TableHead className="w-[130px]">دخول المرحلة</TableHead>
            <TableHead>الفني</TableHead>
            <TableHead className="text-center">الوحدات</TableHead>
            <TableHead>التسليم المتوقع</TableHead>
            <TableHead>تأكيد التسليم</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => {
            const overdue = !!c.due_date && c.due_date < today && c.status === "active";
            const stage = stages?.find((s) => s.id === c.current_stage_id);
            const technicianName = readyTechnicians?.get(c.id);
            const parentWorkType = c.parent_case_id ? parentWorkTypes?.get(c.parent_case_id) : null;
            const showParent =
              c.parent_case_id && c.case_type !== "new" && parentWorkType && parentWorkType !== c.work_types?.name;
            return (
              <TableRow
                key={c.id}
                className="cursor-pointer group transition-colors hover:bg-muted/30"
                onDoubleClick={() => onOpen(c.id)}
                onContextMenu={(e) => onContextMenu(e, c)}
              >
                <TableCell className="font-mono text-xs">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-start transition-colors hover:text-primary"
                    onClick={() => onOpen(c.id)}
                  >
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {c.case_number}
                  </button>
                </TableCell>
                <TableCell className="text-xs">
                  {c.date_received ? format(new Date(c.date_received), "dd/MM/yyyy") : "—"}
                </TableCell>
                <TableCell>{c.doctors?.name ?? "—"}</TableCell>
                <TableCell>{c.patients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {c.work_types?.name ?? "—"}
                  {showParent && (
                    <span className="block text-[10px] text-muted-foreground">الأصلي: {parentWorkType}</span>
                  )}
                </TableCell>
                <TableCell>
                  {stage ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.stage_entered_at ? format(new Date(c.stage_entered_at), "dd/MM/yyyy HH:mm") : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {technicianName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {technicianName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">{c.units ?? 0}</TableCell>
                <TableCell className={`text-xs ${overdue ? "text-destructive font-semibold" : ""}`}>
                  {c.due_date ? format(new Date(c.due_date), "dd/MM/yyyy") : "—"}
                </TableCell>
                <TableCell className="text-xs text-emerald-600 dark:text-emerald-400">
                  {c.date_delivered ? (
                    <div>
                      <span>{format(new Date(c.date_delivered), "dd/MM/yyyy")}</span>
                      {deliveryAgents?.get(c.id) && (
                        <span className="block text-[10px] text-muted-foreground">{deliveryAgents.get(c.id)}</span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!cases.length && (
            <TableRow>
              <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                لا توجد حالات
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="border-t border-border/40 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-primary/40" />
        اضغط بالزر الأيمن على أي حالة لعرض القائمة السريعة
      </p>
    </div>
  );
}
