import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Truck, Navigation, Clock, Stethoscope, Package, ArrowDown } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/agent-tracking")({
  component: AgentTrackingPage,
});

const EVENT_LABELS: Record<string, { label: string; color: string; icon: typeof MapPin }> = {
  delivery: { label: "تسليم", color: "bg-success/10 text-success", icon: Package },
  pickup: { label: "تسلّم", color: "bg-primary/10 text-primary", icon: ArrowDown },
  checkpoint: { label: "نقطة مرور", color: "bg-muted text-muted-foreground", icon: Navigation },
};

function AgentTrackingPage() {
  const { labId } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: agents = [] } = useQuery({
    queryKey: ["delivery-agents-list", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_agents")
        .select("id, name")
        .eq("lab_id", labId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: points = [], isLoading } = useQuery({
    queryKey: ["agent-tracking", labId, selectedAgent, selectedDate],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("agent_tracking_points")
        .select("*, delivery_agents(name), doctors(name, clinic_name), cases(case_number)")
        .eq("lab_id", labId!)
        .gte("tracked_at", `${selectedDate}T00:00:00`)
        .lte("tracked_at", `${selectedDate}T23:59:59`)
        .order("tracked_at", { ascending: true });

      if (selectedAgent !== "all") {
        q = q.eq("agent_id", selectedAgent);
      }

      const { data } = await q;
      return data ?? [];
    },
  });

  // Group points by agent
  const grouped = points.reduce((acc: Record<string, any[]>, p: any) => {
    const name = p.delivery_agents?.name ?? "غير معروف";
    if (!acc[name]) acc[name] = [];
    acc[name].push(p);
    return acc;
  }, {});

  const totalDistance = (pts: any[]) => {
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      dist += haversine(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude);
    }
    return dist;
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">خطوط سير المندوبين</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المندوب</Label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المندوبين</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : points.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          لا توجد نقاط تتبع لهذا اليوم
        </Card>
      ) : (
        Object.entries(grouped).map(([agentName, agentPoints]) => (
          <Card key={agentName} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                {agentName}
              </h2>
              <div className="flex gap-2">
                <Badge variant="secondary">{agentPoints.length} نقطة</Badge>
                <Badge variant="outline">{totalDistance(agentPoints).toFixed(1)} كم</Badge>
              </div>
            </div>

            <div className="relative pr-4">
              {/* Timeline line */}
              <div className="absolute right-[7px] top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-3">
                {agentPoints.map((p: any, idx: number) => {
                  const ev = EVENT_LABELS[p.event_type] ?? EVENT_LABELS.checkpoint;
                  const Icon = ev.icon;
                  return (
                    <div key={p.id} className="relative flex gap-3">
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full ${ev.color} ring-2 ring-background mt-0.5`}>
                        <Icon className="h-2.5 w-2.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={`text-[10px] ${ev.color}`}>{ev.label}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(p.tracked_at), "HH:mm:ss")}
                          </span>
                        </div>

                        <div className="text-xs mt-1 space-y-0.5">
                          {p.cases?.case_number && (
                            <p className="text-muted-foreground">حالة: {p.cases.case_number}</p>
                          )}
                          {p.doctors?.name && (
                            <p className="flex items-center gap-1 text-muted-foreground">
                              <Stethoscope className="h-3 w-3" />
                              {p.doctors.name}
                              {p.doctors.clinic_name && ` — ${p.doctors.clinic_name}`}
                            </p>
                          )}
                          <p className="font-mono text-[10px] text-muted-foreground flex items-center gap-1" dir="ltr">
                            <MapPin className="h-3 w-3" />
                            {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                            {p.location_accuracy && ` (±${Math.round(p.location_accuracy)}م)`}
                          </p>
                          {p.notes && (
                            <p className="text-muted-foreground italic">{p.notes}</p>
                          )}
                        </div>

                        {idx < agentPoints.length - 1 && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            ↓ {haversine(p.latitude, p.longitude, agentPoints[idx + 1].latitude, agentPoints[idx + 1].longitude).toFixed(2)} كم
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Google Maps link for full route */}
            {agentPoints.length >= 2 && (
              <a
                href={buildGoogleMapsUrl(agentPoints)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Navigation className="h-3 w-3" />
                عرض خط السير على الخريطة
              </a>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGoogleMapsUrl(points: any[]): string {
  if (points.length < 2) return "#";
  const origin = `${points[0].latitude},${points[0].longitude}`;
  const dest = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
  const waypoints = points.slice(1, -1).map((p: any) => `${p.latitude},${p.longitude}`).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}
