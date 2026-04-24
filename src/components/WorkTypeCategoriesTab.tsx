import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, Clock } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FORM = { name: "", description: "", avg_delivery_days: 5, color: "#6B7280", order_index: 0 };

export function WorkTypeCategoriesTab() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: items } = useQuery({
    queryKey: ["work_type_categories", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase.from("work_type_categories").select("*").order("order_index")).data ?? [],
  });

  const { data: counts } = useQuery({
    queryKey: ["work_type_categories_counts", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("work_types").select("category_id");
      const map: Record<string, number> = {};
      (data ?? []).forEach((w: any) => {
        if (w.category_id) map[w.category_id] = (map[w.category_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const reset = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!labId) throw new Error("No lab");
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        avg_delivery_days: Number(form.avg_delivery_days) || 0,
        color: form.color || "#6B7280",
        order_index: Number(form.order_index) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("work_type_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_type_categories").insert({ ...payload, lab_id: labId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["work_type_categories"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_type_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["work_type_categories"] });
      qc.invalidateQueries({ queryKey: ["work_types"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          فئات أنواع العمل
        </CardTitle>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="ml-1 h-4 w-4" /> فئة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل فئة" : "فئة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>الاسم</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="أمثلة الأنواع التي تنتمي لهذه الفئة"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>متوسط أيام التسليم</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.avg_delivery_days}
                    onChange={(e) => setForm({ ...form, avg_delivery_days: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>اللون</Label>
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 p-1"
                  />
                </div>
              </div>
              <div>
                <Label>ترتيب العرض</Label>
                <Input
                  type="number"
                  value={form.order_index}
                  onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="mb-2 text-xs text-muted-foreground">
          الفئات تُستخدم لتصنيف أنواع العمل ولتحسين دقة توقع موعد التسليم بالذكاء الاصطناعي.
        </p>
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد فئات</p>
        )}
        {items?.map((it: any) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: it.color }}
                aria-hidden
              />
              <div>
                <p className="font-medium">
                  {it.name}
                  <span className="mr-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {it.avg_delivery_days} يوم
                  </span>
                  {counts?.[it.id] ? (
                    <span className="mr-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {counts[it.id]} نوع
                    </span>
                  ) : null}
                </p>
                {it.description && (
                  <p className="text-xs text-muted-foreground">{it.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(it);
                  setForm({
                    name: it.name,
                    description: it.description ?? "",
                    avg_delivery_days: it.avg_delivery_days ?? 5,
                    color: it.color ?? "#6B7280",
                    order_index: it.order_index ?? 0,
                  });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm("حذف الفئة؟ سيتم فك ربطها من أنواع العمل.")) del.mutate(it.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
