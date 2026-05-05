import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";

type Notification = {
  id: string;
  type: "pending_payment" | "case_delivered";
  title: string;
  body: string;
  time: string;
  read: boolean;
};

export function NotificationBell() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!labId) return;

    const channel = supabase
      .channel(`lab-notifications-${labId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pending_payments",
          filter: `lab_id=eq.${labId}`,
        },
        async (payload) => {
          const pp = payload.new as any;
          // Fetch agent and doctor names
          const [{ data: agent }, { data: doctor }] = await Promise.all([
            supabase
              .from("delivery_agents")
              .select("name")
              .eq("id", pp.agent_id)
              .maybeSingle(),
            supabase
              .from("doctors")
              .select("name")
              .eq("id", pp.doctor_id)
              .maybeSingle(),
          ]);

          const n: Notification = {
            id: pp.id,
            type: "pending_payment",
            title: "سند تحصيل جديد",
            body: `${agent?.name ?? "مندوب"} سجّل سند بمبلغ ${pp.amount} من د. ${doctor?.name ?? "—"}`,
            time: pp.collected_at ?? new Date().toISOString(),
            read: false,
          };

          setNotifications((prev) => [n, ...prev].slice(0, 50));

          // Invalidate pending payments query
          qc.invalidateQueries({ queryKey: ["pending-payments"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "case_deliveries",
          filter: `lab_id=eq.${labId}`,
        },
        async (payload) => {
          const cd = payload.new as any;
          const [{ data: agent }, { data: caseData }] = await Promise.all([
            supabase
              .from("delivery_agents")
              .select("name")
              .eq("id", cd.agent_id)
              .maybeSingle(),
            supabase
              .from("cases")
              .select("case_number, doctors(name)")
              .eq("id", cd.case_id)
              .maybeSingle(),
          ]);

          const n: Notification = {
            id: cd.id,
            type: "case_delivered",
            title: "حالة تم تسليمها",
            body: `${agent?.name ?? "مندوب"} سلّم الحالة ${caseData?.case_number ?? ""} لـ د. ${(caseData as any)?.doctors?.name ?? "—"}`,
            time: cd.delivered_at ?? new Date().toISOString(),
            read: false,
          };

          setNotifications((prev) => [n, ...prev].slice(0, 50));
          qc.invalidateQueries({ queryKey: ["agent-deliveries-lab"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, qc]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="text-sm font-semibold">الإشعارات</h3>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              لا توجد إشعارات
            </p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                to={
                  n.type === "pending_payment"
                    ? "/pending-payments"
                    : "/agent-deliveries"
                }
                onClick={() => {
                  setNotifications((prev) =>
                    prev.map((x) =>
                      x.id === n.id ? { ...x, read: true } : x
                    )
                  );
                  setOpen(false);
                }}
                className={`block border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-xs">{n.title}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(n.time), "HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n.body}
                </p>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
