import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Phone, Mail, MapPin, Trash2, Power, PowerOff, Settings } from "lucide-react";
import { toast } from "sonner";
import { PortalAccountButton } from "@/components/PortalAccountButton";
import { EditDoctorDialog } from "@/components/EditDoctorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/doctors")({
  component: DoctorsPage,
});



function DoctorsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data: doctors } = useQuery({
    queryKey: ["doctors", labId, search, showInactive],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("doctors")
        .select("*, doctor_clinics(id, name, address, phone)")
        .order("created_at", { ascending: false });
      if (!showInactive) q = q.eq("is_active", true);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("doctors").update({ is_active: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(current ? "تم تعطيل الطبيب" : "تم تفعيل الطبيب");
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  const deleteDoctor = async (id: string) => {
    const { count } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", id);
    if (count && count > 0) {
      toast.error(`لا يمكن الحذف - يوجد ${count} حالة مرتبطة. يمكنك تعطيل الطبيب بدلاً من ذلك.`);
      return;
    }
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الطبيب");
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الأطباء</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">
            <Settings className="ml-1 h-4 w-4" />
            إضافة طبيب من الإعدادات
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={showInactive ? "default" : "outline"} size="sm" onClick={() => setShowInactive(!showInactive)}>
          {showInactive ? "إخفاء غير المفعلين" : "عرض غير المفعلين"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {doctors?.map((d: any) => (
          <Card key={d.id} className={!d.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {d.name}
                    {!d.is_active && <span className="ml-2 text-xs text-destructive">(غير مفعّل)</span>}
                  </CardTitle>
                  {d.governorate && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{d.governorate}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={d.is_active ? "تعطيل" : "تفعيل"}
                    onClick={() => toggleActive(d.id, d.is_active)}
                  >
                    {d.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الطبيب؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد من حذف "{d.name}"؟ لا يمكن التراجع عن هذا الإجراء. إذا كان هناك حالات مرتبطة بهذا الطبيب، استخدم التعطيل بدلاً من الحذف.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDoctor(d.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {d.doctor_clinics?.length > 0 && (
                <p className="text-xs">{d.doctor_clinics.length} عيادة</p>
              )}
              {d.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</p>}
              {d.email && <p className="flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{d.email}</p>}
              {Number(d.opening_balance) !== 0 && (
                <p className="text-xs">رصيد أول المدة: {Number(d.opening_balance).toFixed(2)}</p>
              )}
              <PortalAccountButton doctor={d} onDone={() => qc.invalidateQueries({ queryKey: ["doctors"] })} />
            </CardContent>
          </Card>
        ))}
        {!doctors?.length && <p className="col-span-full py-8 text-center text-muted-foreground">لا يوجد أطباء بعد</p>}
      </div>
    </div>
  );
}
