import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function NotificationsBell() {
  const { labId } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications", labId],
    enabled: !!labId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

      const [overdue, dueSoon] = await Promise.all([
        supabase
          .from("cases")
          .select("id, case_number, due_date, doctor_id, doctors(name)")
          .eq("status", "active")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(20),
        supabase
          .from("cases")
          .select("id, case_number, due_date, doctor_id, doctors(name)")
          .eq("status", "active")
          .gte("due_date", today)
          .lte("due_date", in3)
          .order("due_date", { ascending: true })
          .limit(20),
      ]);

      return {
        overdue: overdue.data ?? [],
        dueSoon: dueSoon.data ?? [],
      };
    },
  });

  const overdueCount = data?.overdue.length ?? 0;
  const soonCount = data?.dueSoon.length ?? 0;
  const total = overdueCount + soonCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" title="الإشعارات">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-md">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold">الإشعارات الذكية</h3>
          <p className="text-xs text-muted-foreground">
            تنبيهات فورية بشأن الحالات
          </p>
        </div>
        <ScrollArea className="max-h-96">
          <div className="p-2">
            {total === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <Bell className="h-6 w-6 text-success" />
                </div>
                <p className="text-sm font-medium">كل شيء على ما يرام</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  لا توجد حالات متأخرة أو مستحقة قريباً
                </p>
              </div>
            )}

            {overdueCount > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-semibold text-destructive">
                    حالات متأخرة
                  </span>
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    {overdueCount}
                  </Badge>
                </div>
                {data?.overdue.map((c) => (
                  <NotifItem
                    key={c.id}
                    caseId={c.id}
                    caseNumber={c.case_number}
                    doctorName={(c.doctors as { name?: string } | null)?.name}
                    dueDate={c.due_date}
                    variant="overdue"
                  />
                ))}
              </div>
            )}

            {soonCount > 0 && (
              <div>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-semibold text-warning">
                    مستحقة خلال 3 أيام
                  </span>
                  <Badge className="h-4 bg-warning px-1.5 text-[10px] text-warning-foreground">
                    {soonCount}
                  </Badge>
                </div>
                {data?.dueSoon.map((c) => (
                  <NotifItem
                    key={c.id}
                    caseId={c.id}
                    caseNumber={c.case_number}
                    doctorName={(c.doctors as { name?: string } | null)?.name}
                    dueDate={c.due_date}
                    variant="soon"
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/cases">عرض كل الحالات</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotifItem({
  caseId,
  caseNumber,
  doctorName,
  dueDate,
  variant,
}: {
  caseId: string;
  caseNumber: string;
  doctorName?: string;
  dueDate: string | null;
  variant: "overdue" | "soon";
}) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId }}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-smooth hover:bg-accent"
    >
      <Clock
        className={`h-3.5 w-3.5 shrink-0 ${variant === "overdue" ? "text-destructive" : "text-warning"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{caseNumber}</p>
        {doctorName && (
          <p className="truncate text-xs text-muted-foreground">{doctorName}</p>
        )}
      </div>
      {dueDate && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {dueDate}
        </span>
      )}
    </Link>
  );
}
