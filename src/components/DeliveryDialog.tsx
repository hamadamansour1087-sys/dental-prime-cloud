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
import { PackageCheck } from "lucide-react";

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

  const { data: agents } = useQuery({
    queryKey: ["delivery-agents-active", labId],
    enabled: !!labId && open,
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
    if (open) {
      setAgentId("");
      setRecipientName("");
      setNotes("");
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setDeliveredAt(d.toISOString().slice(0, 16));
    }
  }, [open]);

  // Auto-select if only one agent
  useEffect(() => {
    if (agents?.length === 1 && !agentId) {
      setAgentId(agents[0].id);
    }
  }, [agents, agentId]);

  const submit = async () => {
    if (!recipientName.trim()) {
      const { toast } = await import("sonner");
      toast.error("أدخل اسم المستلم");
      return;
    }
    setSubmitting(true);
    const { toast } = await import("sonner");

    try {
      // Update case status
      const { error: caseError } = await supabase
        .from("cases")
        .update({
          status: "delivered" as any,
          date_delivered: new Date(deliveredAt).toISOString(),
        })
        .eq("id", caseId);

      if (caseError) throw caseError;

      // Insert delivery record if agent selected
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4" /> تسليم الحالة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting || !recipientName.trim()}>
            {submitting ? "جارٍ..." : "تأكيد التسليم"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
