import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Phone, Mail, MapPin, Trash2, Power, PowerOff, Settings, Stethoscope, Building2 } from "lucide-react";
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

  const initials = (name: string) =>
    name
      .replace(/^د\.?\s*/, "")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">الأطباء</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة بيانات الأطباء والعيادات المتعاملة</p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            إضافة طبيب
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card border border-border/60 p-2.5 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم..."
            className="pr-9 border-0 bg-muted/50 rounded-xl focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={showInactive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          className="rounded-xl gap-1.5"
        >
          {showInactive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          {showInactive ? "إخفاء غير المفعلين" : "عرض غير المفعلين"}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums bg-muted/50 px-2.5 py-1 rounded-lg">
          {doctors?.length ?? 0} طبيب
        </span>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-stagger">
        {doctors?.map((d: any) => (
          <div
            key={d.id}
            className={`group rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-all hover:shadow-md hover:border-border ${!d.is_active ? "opacity-55" : ""}`}
          >
            {/* Top row: avatar + name + actions */}
            <div className="flex items-start gap-3.5">
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {initials(d.name) || <Stethoscope className="size-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm truncate">{d.name}</h3>
                  {!d.is_active && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium pill-destructive">غير مفعّل</span>
                  )}
                </div>
                {d.governorate && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3" />{d.governorate}
                  </p>
                )}
              </div>
              <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditDoctorDialog doctor={d} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg"
                  title={d.is_active ? "تعطيل" : "تفعيل"}
                  onClick={() => toggleActive(d.id, d.is_active)}
                >
                  {d.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive" title="حذف">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>حذف الطبيب؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد من حذف "{d.name}"؟ لا يمكن التراجع عن هذا الإجراء.
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

            {/* Contact info */}
            <div className="mt-4 space-y-1.5 text-sm">
              {d.doctor_clinics?.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {d.doctor_clinics.length} عيادة
                </p>
              )}
              {d.phone && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />{d.phone}
                </p>
              )}
              {d.email && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
                  <Mail className="h-3 w-3" />{d.email}
                </p>
              )}
              {Number(d.opening_balance) !== 0 && (
                <p className="text-xs font-medium tabular-nums">
                  رصيد أول المدة: <span className="text-primary">{Number(d.opening_balance).toFixed(2)}</span>
                </p>
              )}
            </div>

            {/* Portal button */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <PortalAccountButton doctor={d} onDone={() => qc.invalidateQueries({ queryKey: ["doctors"] })} />
            </div>
          </div>
        ))}
        {!doctors?.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Stethoscope className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">لا يوجد أطباء بعد</p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
              <Link to="/settings">إضافة طبيب جديد</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
