import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MapPin, Phone, Calendar, Stethoscope, Bell, BellOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

export const Route = createFileRoute("/delivery/dashboard")({
  component: DeliveryDashboard,
});

function DeliveryDashboard() {
  const { user } = useAuth();

  const { data: agent } = useQuery({
    queryKey: ["delivery-agent-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("delivery_agents")
        .select("id, lab_id, route_id, governorates").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["delivery-ready-cases", agent?.id],
    enabled: !!agent,
    queryFn: async () => {
      // Get doctor IDs the agent can serve: route doctors + governorate doctors
      const doctorIds = new Set<string>();
      if (agent!.route_id) {
        const { data: rd } = await supabase.from("delivery_route_doctors").select("doctor_id").eq("route_id", agent!.route_id);
        (rd ?? []).forEach((r) => doctorIds.add(r.doctor_id));
      }
      if (agent!.governorates?.length) {
        const { data: gd } = await supabase.from("doctors").select("id").eq("lab_id", agent!.lab_id).in("governorate", agent!.governorates);
        (gd ?? []).forEach((d) => doctorIds.add(d.id));
      }
      if (doctorIds.size === 0) return [];

      // Find ready stage(s) — stage code = 'ready'
      const { data: c } = await supabase
        .from("cases")
        .select("id, case_number, date_received, due_date, tooth_numbers, units, doctors(id, name, phone, governorate, address, clinic_name), workflow_stages!cases_current_stage_id_fkey(name, code)")
        .eq("lab_id", agent!.lab_id)
        .eq("status", "active")
        .in("doctor_id", Array.from(doctorIds))
        .order("date_received", { ascending: false });
      return (c ?? []).filter((x: any) => x.workflow_stages?.code === "ready");
    },
  });

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">حالات جاهزة للتسليم</h1>
        <Badge variant="secondary">{cases.length}</Badge>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : cases.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد حالات جاهزة حالياً</Card>
      ) : (
        cases.map((c: any) => (
          <Card key={c.id} className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{c.case_number}</p>
                <p className="font-semibold flex items-center gap-1.5"><Stethoscope className="h-4 w-4 text-primary" />{c.doctors?.name}</p>
                {c.doctors?.clinic_name && <p className="text-xs text-muted-foreground">{c.doctors.clinic_name}</p>}
              </div>
              <Badge>جاهز</Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {c.doctors?.governorate && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.doctors.governorate}{c.doctors.address ? ` — ${c.doctors.address}` : ""}</p>}
              {c.doctors?.phone && <p className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" />{c.doctors.phone}</p>}
              <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />استُلمت {format(new Date(c.date_received), "yyyy-MM-dd")}</p>
            </div>
            <div className="flex gap-2 pt-1">
              {c.doctors?.phone && (
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={`tel:${c.doctors.phone}`}><Phone className="ml-1 h-3 w-3" />اتصال</a>
                </Button>
              )}
              <Button asChild size="sm" className="flex-1">
                <Link to="/delivery/deliver/$caseId" params={{ caseId: c.id }}>
                  تسليم <ChevronLeft className="mr-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </Card>
        ))
      )}

      <div className="pt-4">
        <Button asChild variant="outline" className="w-full">
          <Link to="/delivery/doctors">عرض الأطباء وكشوفات الحساب</Link>
        </Button>
      </div>
    </div>
  );
}
