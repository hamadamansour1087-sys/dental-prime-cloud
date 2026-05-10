import { format } from "date-fns";
import { RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubscriptionBadge } from "./badges";
import type { LabRow } from "./types";

interface Props {
  labs: LabRow[] | undefined;
  onActivate: (labId: string) => void;
  onSuspend: (labId: string) => void;
  onExtend: (lab: LabRow) => void;
}

export function LabsTable({ labs, onActivate, onSuspend, onExtend }: Props) {
  return (
    <Card className="bg-white/5 border-white/10 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-white/5">
            <TableHead className="text-slate-300">المعمل</TableHead>
            <TableHead className="text-slate-300">البريد / الهاتف</TableHead>
            <TableHead className="text-slate-300">الاشتراك</TableHead>
            <TableHead className="text-slate-300">التجربة</TableHead>
            <TableHead className="text-slate-300">تاريخ الإنشاء</TableHead>
            <TableHead className="text-slate-300">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labs?.map((lab) => {
            const trialEnd = lab.trial_start_date
              ? new Date(new Date(lab.trial_start_date).getTime() + (lab.trial_days ?? 0) * 86400000)
              : null;
            const expired = !!trialEnd && trialEnd < new Date() && lab.subscription_status === "trial";
            const effectiveStatus = expired ? "expired" : lab.subscription_status;
            const daysLeft = trialEnd
              ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
              : null;

            return (
              <TableRow key={lab.id} className="border-white/10 hover:bg-white/5 text-white">
                <TableCell className="font-medium">{lab.name}</TableCell>
                <TableCell className="text-xs text-slate-400">
                  {lab.email && <span className="block">{lab.email}</span>}
                  {lab.phone && <span className="block">{lab.phone}</span>}
                </TableCell>
                <TableCell>
                  <SubscriptionBadge status={effectiveStatus} />
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {lab.trial_start_date ? (
                    <div>
                      <span>{lab.trial_days} يوم</span>
                      {daysLeft !== null && effectiveStatus === "trial" && (
                        <span className="block text-amber-400">متبقي {daysLeft} يوم</span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {format(new Date(lab.created_at), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5 flex-wrap">
                    {effectiveStatus !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs"
                        onClick={() => onActivate(lab.id)}
                      >
                        <ToggleRight className="h-3 w-3 ml-1" />
                        تفعيل
                      </Button>
                    )}
                    {effectiveStatus === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs"
                        onClick={() => onSuspend(lab.id)}
                      >
                        <ToggleLeft className="h-3 w-3 ml-1" />
                        إيقاف
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 h-7 text-xs"
                      onClick={() => onExtend(lab)}
                    >
                      <RefreshCw className="h-3 w-3 ml-1" />
                      تمديد
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
