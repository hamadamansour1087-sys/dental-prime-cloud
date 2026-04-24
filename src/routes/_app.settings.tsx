import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Hash, Palette, Workflow, Shield, Briefcase, Tag, Layers, ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkTypeCategoriesTab } from "@/components/WorkTypeCategoriesTab";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <Tabs defaultValue="lab" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="lab"><Building2 className="ml-1 h-4 w-4" />بيانات المعمل</TabsTrigger>
          <TabsTrigger value="numbering"><Hash className="ml-1 h-4 w-4" />الترقيم والعملة</TabsTrigger>
          <TabsTrigger value="work-types"><Briefcase className="ml-1 h-4 w-4" />أنواع العمل</TabsTrigger>
          <TabsTrigger value="work-type-categories"><Layers className="ml-1 h-4 w-4" />فئات أنواع العمل</TabsTrigger>
          <TabsTrigger value="expense-categories"><Tag className="ml-1 h-4 w-4" />فئات المصروفات</TabsTrigger>
          <TabsTrigger value="workflows"><Workflow className="ml-1 h-4 w-4" />سير العمل</TabsTrigger>
          <TabsTrigger value="users"><Shield className="ml-1 h-4 w-4" />المستخدمون والأدوار</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="ml-1 h-4 w-4" />المظهر</TabsTrigger>
        </TabsList>

        <TabsContent value="lab"><LabInfoTab /></TabsContent>
        <TabsContent value="numbering"><NumberingTab /></TabsContent>
        <TabsContent value="work-types"><WorkTypesTab /></TabsContent>
        <TabsContent value="work-type-categories"><WorkTypeCategoriesTab /></TabsContent>
        <TabsContent value="expense-categories"><ExpenseCategoriesTab /></TabsContent>
        <TabsContent value="workflows">
          <Card>
            <CardHeader><CardTitle className="text-base">سير العمل</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">إدارة مراحل سير العمل في صفحة منفصلة بسبب حجم الأدوات.</p>
              <Button asChild><Link to="/workflows"><ArrowLeft className="ml-1 h-4 w-4" />فتح إدارة سير العمل</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-base">المستخدمون والأدوار</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">إدارة فريق المعمل وصلاحيات الوصول.</p>
              <Button asChild><Link to="/users"><ArrowLeft className="ml-1 h-4 w-4" />فتح إدارة المستخدمين</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle className="text-base">المظهر</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">يمكنك التبديل بين التصميم الفاتح والداكن من زر القمر/الشمس في الأعلى.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabInfoTab() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const { data: lab } = useQuery({
    queryKey: ["lab", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("labs").select("*").eq("id", labId!).single()).data,
  });
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  useEffect(() => {
    if (lab) setForm({ name: lab.name, phone: lab.phone ?? "", email: lab.email ?? "", address: lab.address ?? "" });
  }, [lab]);
  const save = async () => {
    if (!labId) return;
    const { error } = await supabase.from("labs").update(form).eq("id", labId);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    qc.invalidateQueries({ queryKey: ["lab"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">بيانات المعمل</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>اسم المعمل</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
        </div>
        <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <Button onClick={save}>حفظ</Button>
      </CardContent>
    </Card>
  );
}

function NumberingTab() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const { data: lab } = useQuery({
    queryKey: ["lab", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("labs").select("*").eq("id", labId!).single()).data,
  });
  const [form, setForm] = useState({ currency: "EGP", case_number_prefix: "C" });
  useEffect(() => {
    if (lab) setForm({ currency: lab.currency, case_number_prefix: lab.case_number_prefix });
  }, [lab]);
  const save = async () => {
    if (!labId) return;
    const { error } = await supabase.from("labs").update(form).eq("id", labId);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    qc.invalidateQueries({ queryKey: ["lab"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">الترقيم والعملة</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div><Label>بادئة رقم الحالة</Label><Input value={form.case_number_prefix} onChange={(e) => setForm({ ...form, case_number_prefix: e.target.value })} /></div>
        </div>
        <Button onClick={save}>حفظ</Button>
      </CardContent>
    </Card>
  );
}

function WorkTypesTab() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", default_price: 0, flat_pricing: false, category_id: "" });
  const { data: items } = useQuery({
    queryKey: ["work_types", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_types").select("*, work_type_categories(name, color)").order("name")).data ?? [],
  });
  const { data: cats } = useQuery({
    queryKey: ["work_type_categories", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_type_categories").select("id, name, color").order("order_index")).data ?? [],
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      const payload = {
        name: form.name,
        description: form.description,
        default_price: form.default_price || null,
        flat_pricing: form.flat_pricing,
        category_id: form.category_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("work_types").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_types").insert({ ...payload, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["work_types"] });
      setOpen(false); setEditing(null); setForm({ name: "", description: "", default_price: 0, flat_pricing: false, category_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("work_types").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["work_types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">أنواع العمل</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", description: "", default_price: 0, flat_pricing: false, category_id: "" }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="ml-1 h-4 w-4" /> نوع جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل نوع عمل" : "نوع عمل جديد"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>الفئة</Label>
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون فئة</SelectItem>
                    {cats?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">الفئة تساعد في توقع موعد التسليم بدقة أعلى.</p>
              </div>
              <div><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>السعر الافتراضي</Label><Input type="number" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })} /></div>
              <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">تسعير ثابت (لا يتأثر بعدد الوحدات)</Label>
                  <p className="text-xs text-muted-foreground">مناسب للأطقم الكاملة، أنصاف الأطقم، وأعمال Finishing — السعر = السعر الافتراضي بغض النظر عن عدد الوحدات</p>
                </div>
                <Switch checked={form.flat_pricing} onCheckedChange={(v) => setForm({ ...form, flat_pricing: v })} />
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {items?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد أنواع عمل</p>}
        {items?.map((it: any) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">
                {it.name}
                {it.work_type_categories?.name && (
                  <span className="mr-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: it.work_type_categories.color || "#6B7280" }}>
                    {it.work_type_categories.name}
                  </span>
                )}
                {it.flat_pricing && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">سعر ثابت</span>}
              </p>
              {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {it.default_price && <span className="text-sm font-mono">{Number(it.default_price).toFixed(2)}</span>}
              <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setForm({ name: it.name, description: it.description ?? "", default_price: Number(it.default_price ?? 0), flat_pricing: !!it.flat_pricing, category_id: it.category_id ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف نوع العمل؟")) del.mutate(it.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpenseCategoriesTab() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const { data: items } = useQuery({
    queryKey: ["expense_categories", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      if (editing) {
        const { error } = await supabase.from("expense_categories").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_categories").insert({ ...form, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setOpen(false); setEditing(null); setForm({ name: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["expense_categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">فئات المصروفات</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", description: "" }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="ml-1 h-4 w-4" /> فئة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل فئة" : "فئة جديدة"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {items?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد فئات</p>}
        {items?.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{it.name}</p>
              {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setForm({ name: it.name, description: it.description ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الفئة؟")) del.mutate(it.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
