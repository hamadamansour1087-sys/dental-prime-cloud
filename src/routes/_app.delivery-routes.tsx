import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Route as RouteIcon, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/delivery-routes")({
  component: DeliveryRoutesPage,
});

function DeliveryRoutesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [pickerRoute, setPickerRoute] = useState<{ id: string; name: string } | null>(null);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["delivery-routes-full", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: rs } = await supabase.from("delivery_routes").select("*").eq("lab_id", labId!).order("name");
      const ids = (rs ?? []).map((r) => r.id);
      const { data: rd } = ids.length
        ? await supabase.from("delivery_route_doctors").select("route_id, doctors(id, name)").in("route_id", ids)
        : { data: [] };
      const map = new Map<string, any[]>();
      (rd ?? []).forEach((r: any) => {
        if (!map.has(r.route_id)) map.set(r.route_id, []);
        map.get(r.route_id)!.push(r.doctors);
      });
      return (rs ?? []).map((r) => ({ ...r, doctors: map.get(r.id) ?? [] }));
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("الاسم مطلوب");
      const { error } = await supabase.from("delivery_routes").insert({
        lab_id: labId!, name: form.name, description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء خط السير");
      setOpen(false); setForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["delivery-routes-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["delivery-routes-full"] });
    },
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">خطوط السير</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> خط سير جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>خط سير جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => createMut.mutate()}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
      ) : routes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد خطوط سير</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {routes.map((r: any) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => { if (confirm(`حذف ${r.name}؟`)) deleteRoute.mutate(r.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.doctors.map((d: any) => (
                  <span key={d.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">{d.name}</span>
                ))}
                {r.doctors.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد أطباء</p>}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setPickerRoute({ id: r.id, name: r.name })}>
                <Users className="ml-1 h-3 w-3" /> إدارة الأطباء
              </Button>
            </Card>
          ))}
        </div>
      )}

      {pickerRoute && (
        <DoctorsPicker route={pickerRoute} onClose={() => setPickerRoute(null)} />
      )}
    </div>
  );
}

function DoctorsPicker({ route, onClose }: { route: { id: string; name: string }; onClose: () => void }) {
  const { labId } = useAuth();
  const qc = useQueryClient();

  const { data: allDoctors = [] } = useQuery({
    queryKey: ["doctors-list", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("doctors").select("id, name, governorate").eq("lab_id", labId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: assigned = [] } = useQuery({
    queryKey: ["route-doctors", route.id],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_route_doctors").select("doctor_id").eq("route_id", route.id);
      return (data ?? []).map((d) => d.doctor_id);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ doctorId, on }: { doctorId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("delivery_route_doctors").insert({
          lab_id: labId!, route_id: route.id, doctor_id: doctorId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_route_doctors").delete()
          .eq("route_id", route.id).eq("doctor_id", doctorId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-doctors", route.id] });
      qc.invalidateQueries({ queryKey: ["delivery-routes-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>أطباء خط السير: {route.name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {allDoctors.map((d: any) => (
            <label key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
              <Checkbox
                checked={assigned.includes(d.id)}
                onCheckedChange={(v) => toggle.mutate({ doctorId: d.id, on: !!v })}
              />
              <span className="flex-1">{d.name}</span>
              {d.governorate && <span className="text-xs text-muted-foreground">{d.governorate}</span>}
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
