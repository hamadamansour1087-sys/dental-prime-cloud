import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, Phone, MapPin, Wallet, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/delivery/doctors")({
  component: AgentDoctors,
});

function AgentDoctors() {
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

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["agent-doctors", agent?.id],
    enabled: !!agent,
    queryFn: async () => {
      const ids = new Set<string>();
      if (agent!.route_id) {
        const { data: rd } = await supabase.from("delivery_route_doctors").select("doctor_id").eq("route_id", agent!.route_id);
        (rd ?? []).forEach((r) => ids.add(r.doctor_id));
      }
      if (agent!.governorates?.length) {
        const { data: gd } = await supabase.from("doctors").select("id").eq("lab_id", agent!.lab_id).in("governorate", agent!.governorates);
        (gd ?? []).forEach((d) => ids.add(d.id));
      }
      if (ids.size === 0) return [];
      const { data } = await supabase.from("doctors")
        .select("id, name, phone, governorate, address, clinic_name")
        .in("id", Array.from(ids)).order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3" dir="rtl">
      <h1 className="text-xl font-bold flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" /> الأطباء</h1>
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : doctors.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا يوجد أطباء</Card>
      ) : (
        doctors.map((d: any) => (
          <Card key={d.id} className="p-3">
            <p className="font-semibold">{d.name}</p>
            {d.clinic_name && <p className="text-xs text-muted-foreground">{d.clinic_name}</p>}
            <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
              {d.governorate && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.governorate}{d.address ? ` — ${d.address}` : ""}</p>}
              {d.phone && <p className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" />{d.phone}</p>}
            </div>
            <div className="flex gap-2 mt-3">
              {d.phone && (
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <a href={`tel:${d.phone}`}>اتصال</a>
                </Button>
              )}
              <Button asChild size="sm" className="flex-1">
                <Link to="/delivery/doctor/$doctorId" params={{ doctorId: d.id }}>
                  <Wallet className="ml-1 h-3 w-3" />الكشف <ChevronLeft className="mr-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
