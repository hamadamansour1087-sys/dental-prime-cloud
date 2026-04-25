import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";

export function EditDoctorDialog({ doctor }: { doctor: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: doctor.name ?? "",
    phone: doctor.phone ?? "",
    email: doctor.email ?? "",
    governorate: doctor.governorate ?? "",
    address: doctor.address ?? "",
    notes: doctor.notes ?? "",
    opening_balance: String(doctor.opening_balance ?? "0"),
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name) return toast.error("الاسم مطلوب");
    setSaving(true);
    const { error } = await supabase
      .from("doctors")
      .update({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        governorate: form.governorate || null,
        address: form.address || null,
        notes: form.notes || null,
        opening_balance: parseFloat(form.opening_balance) || 0,
      })
      .eq("id", doctor.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث بيانات الطبيب");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="تعديل">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الطبيب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المحافظة</Label>
              <Select value={form.governorate} onValueChange={(v) => setForm({ ...form, governorate: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                <SelectContent>
                  {EGYPT_GOVERNORATES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>رصيد أول المدة</Label>
              <Input type="number" step="0.01" value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>البريد</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
