import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Route as RouteIcon, Trash2, Users, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";

export const Route = createFileRoute("/_app/delivery-routes")({
  component: DeliveryRoutesPage,
});

type RouteRow = {
  id: string; name: string; description: string | null;
  governorates: string[];
  autoDoctors: { id: string; name: string; governorate: string | null }[];
  manualDoctors: { id: string; name: string; governorate: string | null }[];
};

function DeliveryRoutesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; description: string; governorates: string[] } | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; governorates: string[] }>({ name: "", description: "", governorates: [] });
  const [pickerRoute, setPickerRoute] = useState<{ id: string; name: string; governorates: string[] } | null>(null);

  const { data: routes = [], isLoading } = useQuery<RouteRow[]>({
    queryKey: ["delivery-routes-full", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: rs } = await supabase.from("delivery_routes").select("*").eq("lab_id", labId!).order("name");
      const ids = (rs ?? []).map((r) => r.id);
      const { data: rd } = ids.length
        ? await supabase.from("delivery_route_doctors").select("route_id, doctors(id, name, governorate)").in("route_id", ids)
        : { data: [] as any[] };
      const manualMap = new Map<string, any[]>();
      (rd ?? []).forEach((r: any) => {
        if (!manualMap.has(r.route_id)) manualMap.set(r.route_id, []);
        if (r.doctors) manualMap.get(r.route_id)!.push(r.doctors);
      });

      // Doctors by governorate (auto)
      const { data: allDocs } = await supabase.from("doctors")
        .select("id, name, governorate").eq("lab_id", labId!).eq("is_active", true);

      return (rs ?? []).map((r: any) => {
        const govs: string[] = r.governorates ?? [];
        const manual = manualMap.get(r.id) ?? [];
        const manualIds = new Set(manual.map((d: any) => d.id));
        const auto = govs.length
          ? (allDocs ?? []).filter((d: any) => d.governorate && govs.includes(d.governorate) && !manualIds.has(d.id))
          : [];
        return {
          id: r.id, name: r.name, description: r.description,
          governorates: govs, autoDoctors: auto, manualDoctors: manual,
        };
      });
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("الاسم مطلوب");
      if (editing) {
        const { error } = await supabase.from("delivery_routes").update({
          name: form.name, description: form.description || null, governorates: form.governorates,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_routes").insert({
          lab_id: labId!, name: form.name, description: form.description || null, governorates: form.governorates,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تم إنشاء خط السير");
      setOpen(false); setEditing(null); setForm({ name: "", description: "", governorates: [] });
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

  const openCreate = () => {
    setEditing(null); setForm({ name: "", description: "", governorates: [] }); setOpen(true);
  };
  const openEdit = (r: RouteRow) => {
    setEditing({ id: r.id, name: r.name, description: r.description ?? "", governorates: r.governorates });
    setForm({ name: r.name, description: r.description ?? "", governorates: r.governorates });
    setOpen(true);
  };

  const toggleGov = (g: string) => {
    setForm((f) => ({
      ...f,
      governorates: f.governorates.includes(g) ? f.governorates.filter((x) => x !== g) : [...f.governorates, g],
    }));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">خطوط السير</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="ml-1 h-4 w-4" /> خط سير جديد</Button></DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "تعديل خط السير" : "خط سير جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> المحافظات (الأطباء يُربطون تلقائيًا)</Label>
                <p className="text-xs text-muted-foreground mb-2">اختر محافظة أو أكثر — أي طبيب في هذه المحافظات سيظهر تلقائيًا للمندوب. اتركها فارغة إذا أردت إدارة الأطباء يدويًا فقط.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto border rounded p-2">
                  {EGYPT_GOVERNORATES.map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <Checkbox checked={form.governorates.includes(g)} onCheckedChange={() => toggleGov(g)} />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
      ) : routes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد خطوط سير</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {routes.map((r) => {
            const totalDocs = r.autoDoctors.length + r.manualDoctors.length;
            return (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => { if (confirm(`حذف ${r.name}؟`)) deleteRoute.mutate(r.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {r.governorates.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.governorates.map((g) => (
                      <Badge key={g} variant="secondary" className="text-xs"><MapPin className="ml-1 h-2.5 w-2.5" />{g}</Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {totalDocs} طبيب
                  {r.autoDoctors.length > 0 && <span className="mr-1">({r.autoDoctors.length} تلقائي)</span>}
                  {r.manualDoctors.length > 0 && <span className="mr-1">({r.manualDoctors.length} يدوي)</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[...r.manualDoctors, ...r.autoDoctors].slice(0, 8).map((d) => (
                    <span key={d.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">{d.name}</span>
                  ))}
                  {totalDocs > 8 && <span className="text-xs text-muted-foreground">+{totalDocs - 8}</span>}
                  {totalDocs === 0 && <p className="text-xs text-muted-foreground">لا يوجد أطباء</p>}
                </div>
                <Button size="sm" variant="outline" className="w-full"
                  onClick={() => setPickerRoute({ id: r.id, name: r.name, governorates: r.governorates })}>
                  <Users className="ml-1 h-3 w-3" /> إدارة الأطباء يدويًا
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {pickerRoute && (
        <DoctorsPicker route={pickerRoute} onClose={() => setPickerRoute(null)} />
      )}
    </div>
  );
}

function DoctorsPicker({ route, onClose }: { route: { id: string; name: string; governorates: string[] }; onClose: () => void }) {
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

  const autoIds = useMemo(() => {
    if (!route.governorates.length) return new Set<string>();
    return new Set(allDoctors.filter((d: any) => d.governorate && route.governorates.includes(d.governorate)).map((d: any) => d.id));
  }, [allDoctors, route.governorates]);

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
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>أطباء خط السير: {route.name}</DialogTitle>
        </DialogHeader>
        {route.governorates.length > 0 && (
          <p className="text-xs text-muted-foreground -mt-2">
            الأطباء في محافظات {route.governorates.join("، ")} مضافون تلقائيًا. هنا تضيف أطباء إضافيين خارج هذه المحافظات.
          </p>
        )}
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {allDoctors.map((d: any) => {
            const isAuto = autoIds.has(d.id);
            const isManual = assigned.includes(d.id);
            return (
              <label key={d.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${isAuto ? "bg-primary/5" : "hover:bg-muted"}`}>
                <Checkbox
                  checked={isAuto || isManual}
                  disabled={isAuto}
                  onCheckedChange={(v) => toggle.mutate({ doctorId: d.id, on: !!v })}
                />
                <span className="flex-1">{d.name}</span>
                {d.governorate && <span className="text-xs text-muted-foreground">{d.governorate}</span>}
                {isAuto && <Badge variant="secondary" className="text-[10px]">تلقائي</Badge>}
              </label>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
