import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, User, Building2, FileText } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";

type ClinicInput = { name: string; address: string; phone: string };

export function AddDoctorDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    governorate: "",
    address: "",
    notes: "",
    opening_balance: "0",
  });
  const [clinics, setClinics] = useState<ClinicInput[]>([
    { name: "", address: "", phone: "" },
  ]);

  const reset = () => {
    setForm({
      name: "",
      phone: "",
      email: "",
      governorate: "",
      address: "",
      notes: "",
      opening_balance: "0",
    });
    setClinics([{ name: "", address: "", phone: "" }]);
  };

  const submit = async () => {
    if (!labId || !form.name || !form.governorate) {
      toast.error("الاسم والمحافظة مطلوبان");
      return;
    }
    const { data: doc, error } = await supabase
      .from("doctors")
      .insert({
        lab_id: labId,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        governorate: form.governorate,
        address: form.address || null,
        notes: form.notes || null,
        opening_balance: parseFloat(form.opening_balance) || 0,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    const validClinics = clinics.filter((c) => c.name.trim());
    if (validClinics.length) {
      const { error: cErr } = await supabase.from("doctor_clinics").insert(
        validClinics.map((c, i) => ({
          lab_id: labId,
          doctor_id: doc.id,
          name: c.name,
          address: c.address || null,
          phone: c.phone || null,
          is_primary: i === 0,
        })),
      );
      if (cErr) return toast.error(cErr.message);
    }

    toast.success("تمت إضافة الطبيب");
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="ml-1 h-4 w-4" />
            طبيب جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:w-full"
      >
        <DialogHeader>
          <DialogTitle>إضافة طبيب جديد</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" dir="rtl" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <User className="ml-1 h-4 w-4" />
              البيانات
            </TabsTrigger>
            <TabsTrigger value="clinics">
              <Building2 className="ml-1 h-4 w-4" />
              العيادات
            </TabsTrigger>
            <TabsTrigger value="notes">
              <FileText className="ml-1 h-4 w-4" />
              ملاحظات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المحافظة *</Label>
                <Select
                  value={form.governorate}
                  onValueChange={(v) => setForm({ ...form, governorate: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحافظة" />
                  </SelectTrigger>
                  <SelectContent>
                    {EGYPT_GOVERNORATES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رصيد أول المدة</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) =>
                    setForm({ ...form, opening_balance: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>البريد</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </TabsContent>

          <TabsContent value="clinics">
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="font-semibold">العيادات</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setClinics([
                      ...clinics,
                      { name: "", address: "", phone: "" },
                    ])
                  }
                >
                  <Plus className="ml-1 h-3 w-3" />
                  إضافة عيادة
                </Button>
              </div>
              <div className="space-y-3">
                {clinics.map((c, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded border bg-muted/30 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        عيادة {i + 1}
                        {i === 0 && " (رئيسية)"}
                      </span>
                      {clinics.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() =>
                            setClinics(clinics.filter((_, idx) => idx !== i))
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="اسم العيادة"
                      value={c.name}
                      onChange={(e) =>
                        setClinics(
                          clinics.map((cl, idx) =>
                            idx === i ? { ...cl, name: e.target.value } : cl,
                          ),
                        )
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="العنوان"
                        value={c.address}
                        onChange={(e) =>
                          setClinics(
                            clinics.map((cl, idx) =>
                              idx === i
                                ? { ...cl, address: e.target.value }
                                : cl,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder="الهاتف"
                        value={c.phone}
                        onChange={(e) =>
                          setClinics(
                            clinics.map((cl, idx) =>
                              idx === i
                                ? { ...cl, phone: e.target.value }
                                : cl,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notes">
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                rows={6}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={submit}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
