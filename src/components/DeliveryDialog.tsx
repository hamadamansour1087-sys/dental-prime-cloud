import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageCheck, CheckCircle2, User, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  onDelivered?: () => void;
}

export function DeliveryDialog({ open, onOpenChange, caseId, onDelivered }: DeliveryDialogProps) {
  const { labId } = useAuth();
  const [agentId, setAgentId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if the agent already registered a delivery for this case
  const { data: existingDelivery, isLoading: loadingDelivery } = useQuery({
    queryKey: ["case-delivery-existing", caseId],
    enabled: !!caseId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_deliveries")
        .select("*, delivery_agents:agent_id(name)")
        .eq("case_id", caseId)
        .order("delivered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["delivery-agents-active", labId],
    enabled: !!labId && open && !existingDelivery,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_agents")
        .select("id, name")
        .eq("lab_id", labId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open && !existingDelivery) {
      setAgentId("");
      setRecipientName("");
      setNotes("");
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setDeliveredAt(d.toISOString().slice(0, 16));
    }
  }, [open, existingDelivery]);

  // Auto-select if only one agent
  useEffect(() => {
    if (agents?.length === 1 && !agentId) {
      setAgentId(agents[0].id);
    }
  }, [agents, agentId]);

  // If delivery already exists, auto-confirm
  const confirmExisting = async () => {
    if (!existingDelivery) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("cases")
        .update({
          status: "delivered" as any,
          date_delivered: existingDelivery.delivered_at,
        })
        .eq("id", caseId);
      if (error) throw error;
      toast.success("تم تأكيد التسليم");
      onOpenChange(false);
      onDelivered?.();
    } catch (e: any) {
      toast.error(e?.message ?? "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const submitNew = async () => {
    if (!recipientName.trim()) {
      toast.error("أدخل اسم المستلم");
      return;
    }
    setSubmitting(true);
    try {
      const { error: caseError } = await supabase
        .from("cases")
        .update({
          status: "delivered" as any,
          date_delivered: new Date(deliveredAt).toISOString(),
        })
        .eq("id", caseId);
      if (caseError) throw caseError;

      if (agentId) {
        const { error: deliveryError } = await supabase
          .from("case_deliveries")
          .insert({
            case_id: caseId,
            lab_id: labId!,
            agent_id: agentId,
            recipient_name: recipientName.trim(),
            notes: notes.trim() || null,
            delivered_at: new Date(deliveredAt).toISOString(),
          });
        if (deliveryError) throw deliveryError;
      }

      toast.success("تم تسليم الحالة بنجاح");
      onOpenChange(false);
      onDelivered?.();
    } catch (e: any) {
      toast.error(e?.message ?? "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const agentName = (existingDelivery as any)?.delivery_agents?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4" /> تسليم الحالة
          </DialogTitle>
        </DialogHeader>

        {loadingDelivery ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : existingDelivery ? (
          /* Agent already delivered — show details and confirm */
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                تم تسجيل التسليم بواسطة المندوب
              </div>
              <div className="space-y-2 text-sm">
                {agentName && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">المندوب:</span>
                    <span className="font-medium">{agentName}</span>
                  </div>
                )}
                {existingDelivery.recipient_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">المستلم:</span>
                    <span className="font-medium">{existingDelivery.recipient_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">وقت التسليم:</span>
                  <span className="font-medium">{format(new Date(existingDelivery.delivered_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                {existingDelivery.latitude && existingDelivery.longitude && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">الموقع:</span>
                    <a
                      href={`https://maps.google.com/?q=${existingDelivery.latitude},${existingDelivery.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      عرض على الخريطة
                    </a>
                  </div>
                )}
                {existingDelivery.notes && (
                  <p className="mt-1 rounded border-r-2 border-primary/40 bg-background/60 px-2 py-1 text-xs text-muted-foreground">
                    {existingDelivery.notes}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
              <Button onClick={confirmExisting} disabled={submitting}>
                {submitting ? "جارٍ..." : "تأكيد التسليم"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* No existing delivery — manual entry */
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              لم يسجّل المندوب التسليم بعد. يمكنك تسجيل التسليم يدوياً.
            </div>

            <div>
              <Label>المندوب</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المندوب (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                  {!agents?.length && (
                    <div className="p-2 text-sm text-muted-foreground">لا يوجد مناديب مسجلين</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>اسم المستلم *</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="اسم الشخص الذي استلم الحالة"
              />
            </div>

            <div>
              <Label>تاريخ ووقت التسليم الفعلي *</Label>
              <Input
                type="datetime-local"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
              />
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="ملاحظات إضافية عن التسليم"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button onClick={submitNew} disabled={submitting || !recipientName.trim()}>
                {submitting ? "جارٍ..." : "تأكيد التسليم"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
