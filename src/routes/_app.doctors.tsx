import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">المحافظة</TableHead>
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-right">البريد</TableHead>
              <TableHead className="text-right">العيادات</TableHead>
              <TableHead className="text-right">رصيد أول المدة</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">البورتال</TableHead>
              <TableHead className="text-right w-[120px]">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors?.map((d: any) => (
              <TableRow key={d.id} className={`group ${!d.is_active ? "opacity-55" : ""}`}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  {d.governorate ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />{d.governorate}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {d.phone ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />{d.phone}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {d.email ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                      <Mail className="h-3 w-3 shrink-0" />{d.email}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {d.doctor_clinics?.length > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />{d.doctor_clinics.length}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {Number(d.opening_balance) !== 0 ? (
                    <span className="text-xs font-medium tabular-nums text-primary">{Number(d.opening_balance).toFixed(2)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {d.is_active ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">مفعّل</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">غير مفعّل</span>
                  )}
                </TableCell>
                <TableCell>
                  <PortalAccountButton doctor={d} onDone={() => qc.invalidateQueries({ queryKey: ["doctors"] })} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
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
                </TableCell>
              </TableRow>
            ))}
            {!doctors?.length && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Stethoscope className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">لا يوجد أطباء بعد</p>
                    <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                      <Link to="/settings">إضافة طبيب جديد</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
