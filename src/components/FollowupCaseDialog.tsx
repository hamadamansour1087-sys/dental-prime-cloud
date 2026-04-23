import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { RotateCcw, Wrench } from "lucide-react";

type CaseType = "remake" | "repair";

export function FollowupCaseDialog({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  caseType,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  caseNumber: string;
  caseType: CaseType;
  onCreated?: (newCaseId: string, options: { withNewWork: boolean }) => void;
}) {
  const qc = useQueryClient();
  const [withNewWork, setWithNewWork] = useState<"same" | "new">("same");
  const [chargeMode, setChargeMode] = useState<"free" | "paid">("free");
  const [customPrice, setCustomPrice] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setWithNewWork("same");
      setChargeMode("free");
      setCustomPrice("");
      setDueDate("");
      setNotes("");
    }
  }, [open]);

  const isRemake = caseType === "remake";
  const title = isRemake ? "إعادة الحالة" : "تصليح الحالة";
  const Icon = isRemake ? RotateCcw : Wrench;
  const prefix = isRemake ? "R-" : "F-";

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_followup_case", {
      _parent_case_id: caseId,
      _case_type: caseType,
      _with_new_work: withNewWork === "new",
      _charge_mode: chargeMode,
      _custom_price: chargeMode === "paid" && customPrice ? Number(customPrice) : null,
      _notes: notes || null,
      _due_date: dueDate || null,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`تم إنشاء حالة ${isRemake ? "الإعادة" : "التصليح"}: ${prefix}${caseNumber}`);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    onCreated?.(data as unknown as string, { withNewWork: withNewWork === "new" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>
            مرتبطة بالحالة الأصلية: <span className="font-mono font-semibold">{caseNumber}</span> — رقم الحالة الجديد سيبدأ بـ{" "}
            <span className="font-mono font-semibold">{prefix}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">نوع العملية</Label>
            <RadioGroup value={withNewWork} onValueChange={(v) => setWithNewWork(v as any)} className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-muted/50">
                <RadioGroupItem value="same" id="same" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{isRemake ? "إعادة الحالة فقط" : "تصليح فقط"}</p>
                  <p className="text-xs text-muted-foreground">نفس بيانات الحالة الأصلية بدون أي شغل جديد</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-muted/50">
                <RadioGroupItem value="new" id="new" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{isRemake ? "إعادة مع شغل جديد" : "تصليح مع شغل جديد"}</p>
                  <p className="text-xs text-muted-foreground">نسخ البيانات + إمكانية تعديلها لاحقاً من صفحة الحالة</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label className="mb-2 block">المحاسبة</Label>
            <RadioGroup value={chargeMode} onValueChange={(v) => setChargeMode(v as any)} className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50">
                <RadioGroupItem value="free" id="free" />
                <span className="text-sm">مجاناً (بدون رسوم)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50">
                <RadioGroupItem value="paid" id="paid" />
                <span className="text-sm">بسعر</span>
              </label>
            </RadioGroup>
          </div>

          {chargeMode === "paid" && (
            <div>
              <Label>السعر (اتركه فارغاً لاستخدام السعر الافتراضي)</Label>
              <Input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="السعر الافتراضي حسب نوع الشغل والطبيب"
              />
            </div>
          )}

          <div>
            <Label>تاريخ التسليم (اختياري)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={isRemake ? "سبب الإعادة..." : "وصف التصليح المطلوب..."}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "جارٍ..." : `إنشاء ${isRemake ? "الإعادة" : "التصليح"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
