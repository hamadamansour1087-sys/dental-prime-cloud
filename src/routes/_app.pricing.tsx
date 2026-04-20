import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";

export const Route = createFileRoute("/_app/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();

  const { data: workTypes } = useQuery({
    queryKey: ["worktypes-pricing", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_types").select("id, name, default_price, is_active").order("name")).data ?? [],
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-pricing", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("doctors").select("id, name, governorate").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: priceLists } = useQuery({
    queryKey: ["price-lists", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("price_lists")
        .select("*, work_types(name), doctors(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">إدارة الأسعار</h1>
      <Tabs defaultValue="general" dir="rtl">
        <TabsList>
          <TabsTrigger value="general">الأسعار العامة</TabsTrigger>
          <TabsTrigger value="special">الأسعار الخاصة</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">السعر الافتراضي لكل نوع عمل</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {workTypes?.map((w) => (
                <GeneralPriceRow
                  key={w.id}
                  workType={w}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["worktypes-pricing"] })}
                />
              ))}
              {!workTypes?.length && <p className="py-4 text-center text-sm text-muted-foreground">لا توجد أنواع عمل</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="special" className="space-y-3">
          <div className="flex justify-end">
            <SpecialPriceDialog
              labId={labId}
              workTypes={workTypes ?? []}
              doctors={doctors ?? []}
              onSaved={() => qc.invalidateQueries({ queryKey: ["price-lists"] })}
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {priceLists?.map((p: any) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{p.work_types?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.doctor_id ? `طبيب: ${p.doctors?.name}` : `محافظة: ${p.governorate}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-primary">{Number(p.price).toFixed(2)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("حذف هذا السعر؟")) return;
                          const { error } = await supabase.from("price_lists").delete().eq("id", p.id);
                          if (error) return toast.error(error.message);
                          toast.success("تم الحذف");
                          qc.invalidateQueries({ queryKey: ["price-lists"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!priceLists?.length && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد أسعار خاصة بعد</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralPriceRow({ workType, onSaved }: { workType: any; onSaved: () => void }) {
  const [price, setPrice] = useState<string>(workType.default_price?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[140px] flex-1 text-sm">{workType.name}</span>
      <Input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-32"
        placeholder="0.00"
      />
      <Button
        size="sm"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const { error } = await supabase
            .from("work_types")
            .update({ default_price: price ? parseFloat(price) : null })
            .eq("id", workType.id);
          setSaving(false);
          if (error) return toast.error(error.message);
          toast.success("تم الحفظ");
          onSaved();
        }}
      >
        حفظ
      </Button>
    </div>
  );
}

function SpecialPriceDialog({
  labId,
  workTypes,
  doctors,
  onSaved,
}: {
  labId: string | null;
  workTypes: any[];
  doctors: any[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"doctor" | "governorate">("doctor");
  const [form, setForm] = useState({ work_type_id: "", doctor_id: "", governorate: "", price: "", notes: "" });

  const save = async () => {
    if (!labId || !form.work_type_id || !form.price) return toast.error("املأ الحقول المطلوبة");
    if (scope === "doctor" && !form.doctor_id) return toast.error("اختر الطبيب");
    if (scope === "governorate" && !form.governorate) return toast.error("اختر المحافظة");

    const { error } = await supabase.from("price_lists").insert({
      lab_id: labId,
      work_type_id: form.work_type_id,
      doctor_id: scope === "doctor" ? form.doctor_id : null,
      governorate: scope === "governorate" ? form.governorate : null,
      price: parseFloat(form.price),
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة السعر");
    setOpen(false);
    setForm({ work_type_id: "", doctor_id: "", governorate: "", price: "", notes: "" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="ml-1 h-4 w-4" />سعر خاص جديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto sm:w-full">
        <DialogHeader><DialogTitle>إضافة سعر خاص</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نوع العمل *</Label>
            <Select value={form.work_type_id} onValueChange={(v) => setForm({ ...form, work_type_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>{workTypes.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>نطاق السعر</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">خاص بطبيب</SelectItem>
                <SelectItem value="governorate">خاص بمحافظة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "doctor" ? (
            <div>
              <Label>الطبيب *</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
                <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.governorate ? ` — ${d.governorate}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>المحافظة *</Label>
              <Select value={form.governorate} onValueChange={(v) => setForm({ ...form, governorate: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                <SelectContent>{EGYPT_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>السعر *</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
