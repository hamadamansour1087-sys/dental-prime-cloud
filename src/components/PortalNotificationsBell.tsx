import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, MessageSquare, FilePlus2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { playNotificationSound } from "@/lib/notificationSound";

interface Props {
  variant: "lab" | "doctor";
}

interface NotifItem {
  id: string;
  type: "case" | "message";
  title: string;
  subtitle: string;
  created_at: string;
  href?: string;
}

export function PortalNotificationsBell({ variant }: Props) {
  const { user, labId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // For doctor variant we need their doctor row
  const { data: doctor } = useQuery({
    queryKey: ["notif-doctor", user?.id],
    enabled: !!user && variant === "doctor",
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, lab_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const effectiveLabId = variant === "lab" ? labId : doctor?.lab_id;
  const doctorId = doctor?.id;

  const { data: items = [] } = useQuery<NotifItem[]>({
    queryKey: ["portal-notifications", variant, effectiveLabId, doctorId],
    enabled: !!effectiveLabId && (variant === "lab" || !!doctorId),
    queryFn: async () => {
      const out: NotifItem[] = [];
      if (variant === "lab") {
        // Pending portal cases
        const { data: cases } = await supabase
          .from("cases")
          .select("id, case_number, created_at, doctors(name)")
          .eq("lab_id", effectiveLabId!)
          .eq("status", "pending_approval")
          .order("created_at", { ascending: false })
          .limit(20);
        (cases ?? []).forEach((c: any) =>
          out.push({
            id: `case-${c.id}`,
            type: "case",
            title: "حالة جديدة بانتظار الموافقة",
            subtitle: `د. ${c.doctors?.name ?? "—"}`,
            created_at: c.created_at,
            href: "/pending-cases",
          })
        );
        // Unread messages from doctors
        const { data: msgs } = await supabase
          .from("portal_messages")
          .select("id, body, created_at, doctors:doctor_id(name)")
          .eq("lab_id", effectiveLabId!)
          .eq("sender_type", "doctor")
          .eq("read_by_lab", false)
          .order("created_at", { ascending: false })
          .limit(20);
        (msgs ?? []).forEach((m: any) =>
          out.push({
            id: `msg-${m.id}`,
            type: "message",
            title: `رسالة من د. ${m.doctors?.name ?? "—"}`,
            subtitle: (m.body ?? "📎 مرفق").slice(0, 80),
            created_at: m.created_at,
            href: "/messages",
          })
        );
      } else {
        // Doctor: unread lab messages
        const { data: msgs } = await supabase
          .from("portal_messages")
          .select("id, body, created_at, case_id")
          .eq("doctor_id", doctorId!)
          .eq("sender_type", "lab")
          .eq("read_by_doctor", false)
          .order("created_at", { ascending: false })
          .limit(20);
        (msgs ?? []).forEach((m: any) =>
          out.push({
            id: `msg-${m.id}`,
            type: "message",
            title: "رسالة من المعمل",
            subtitle: (m.body ?? "📎 مرفق").slice(0, 80),
            created_at: m.created_at,
            href: "/portal/messages",
          })
        );
      }
      return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    refetchInterval: 60_000,
  });

  // Realtime + sound
  useEffect(() => {
    if (!effectiveLabId) return;
    if (variant === "doctor" && !doctorId) return;

    const channel = supabase.channel(`portal-notifs-${variant}-${effectiveLabId}-${doctorId ?? "lab"}`);

    if (variant === "lab") {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cases", filter: `lab_id=eq.${effectiveLabId}` },
        (payload) => {
          const row = payload.new as { status: string; id: string };
          if (row.status === "pending_approval") {
            playNotificationSound({ freq: 880 });
            qc.invalidateQueries({ queryKey: ["portal-notifications"] });
          }
        }
      );
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_messages", filter: `lab_id=eq.${effectiveLabId}` },
        (payload) => {
          const m = payload.new as { sender_type: string; id: string };
          if (m.sender_type === "doctor") {
            playNotificationSound({ freq: 660 });
            qc.invalidateQueries({ queryKey: ["portal-notifications"] });
          }
        }
      );
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "portal_messages", filter: `lab_id=eq.${effectiveLabId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["portal-notifications"] });
        }
      );
    } else {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_messages", filter: `doctor_id=eq.${doctorId}` },
        (payload) => {
          const m = payload.new as { sender_type: string; id: string };
          if (m.sender_type === "lab") {
            playNotificationSound({ freq: 660 });
            qc.invalidateQueries({ queryKey: ["portal-notifications"] });
          }
        }
      );
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cases", filter: `doctor_id=eq.${doctorId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["portal-cases"] });
        }
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [variant, effectiveLabId, doctorId, qc]);

  // Avoid playing sound for items that existed at first load
  useEffect(() => {
    if (!initializedRef.current && items.length >= 0) {
      items.forEach((i) => seenIdsRef.current.add(i.id));
      initializedRef.current = true;
    }
  }, [items]);

  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="border-b p-3">
          <p className="text-sm font-semibold">الإشعارات</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!items.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إشعارات جديدة</p>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (it.href) navigate({ to: it.href });
              }}
              className="flex w-full gap-2 border-b p-3 text-right text-sm transition hover:bg-muted/50"
            >
              <div className="mt-0.5 shrink-0">
                {it.type === "case" ? (
                  <FilePlus2 className="h-4 w-4 text-amber-600" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{it.title}</p>
                <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(it.created_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
