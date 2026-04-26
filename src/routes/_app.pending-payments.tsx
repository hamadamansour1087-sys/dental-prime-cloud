import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Wallet, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/pending-payments")({
  component: PendingPaymentsPage,
});

function PendingPaymentsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [approveItem, setApproveItem] = useState<any>(null);
  const [rejectItem, setRejectItem] = useState<any>(null);
  const [cashAccountId, setCashAccountId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pending-payments", labId, tab],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_payments")
        .select("*, doctors(name), delivery_agents(name)")
        .eq("lab_id", labId!)
        .eq("status", tab)
        .order("collected_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: cashAccounts = [] } = useQuery({
    queryKey: ["cash-accounts", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("cash_accounts").select("id, name").eq("lab_id", labId!).eq("is_active", true);
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("approve_pending_payment", {
        _pp_id: approveItem.id,
        _cash_account_id: cashAccountId || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم اعتماد السند");
      setApproveItem(null); setCashAccountId("");
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reject_pending_payment", {
        _pp_id: rejectItem.id, _reason: rejectReason || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رفض السند");
      setRejectItem(null); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">سندات قبض المندوبين</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="pending">معلّقة</TabsTrigger>
          <TabsTrigger value="approved">معتمدة</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
          ) : items.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">لا توجد سندات</Card>
          ) : (
            <div className="space-y-2">
              {items.map((it: any) => (
                <Card key={it.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-primary">{Number(it.amount).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">ج.م</span>
                        {it.method && <Badge variant="outline">{it.method}</Badge>}
                      </div>
                      <p className="text-sm">
                        <span className="text-muted-foreground">الطبيب:</span>{" "}
                        <span className="font-medium">{it.doctors?.name ?? "—"}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">المندوب:</span>{" "}
                        <span className="font-medium">{it.delivery_agents?.name ?? "—"}</span>
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(it.collected_at), "yyyy-MM-dd HH:mm")}</span>
                        {it.latitude && it.longitude && (
                          <a href={`https://maps.google.com/?q=${it.latitude},${it.longitude}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline">
                            <MapPin className="h-3 w-3" /> الموقع
                          </a>
                        )}
                      </div>
                      {it.notes && <p className="text-xs text-muted-foreground mt-1">ملاحظات: {it.notes}</p>}
                      {it.rejection_reason && <p className="text-xs text-destructive mt-1">سبب الرفض: {it.rejection_reason}</p>}
                    </div>
                    {tab === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setApproveItem(it)}>
                          <CheckCircle2 className="ml-1 h-4 w-4" /> اعتماد
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectItem(it)}>
                          <XCircle className="ml-1 h-4 w-4" /> رفض
                        </Button>
                      </div>
                    )}
                    {tab === "approved" && <Badge variant="default"><CheckCircle2 className="ml-1 h-3 w-3" />معتمد</Badge>}
                    {tab === "rejected" && <Badge variant="destructive"><XCircle className="ml-1 h-3 w-3" />مرفوض</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!approveItem} onOpenChange={(v) => !v && setApproveItem(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>اعتماد السند</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">سيتم تسجيل المبلغ <strong>{approveItem && Number(approveItem.amount).toFixed(2)} ج.م</strong> في حساب الطبيب <strong>{approveItem?.doctors?.name}</strong>.</p>
            <div>
              <label className="text-sm">الخزنة (اختياري)</label>
              <Select value={cashAccountId || "none"} onValueChange={(v) => setCashAccountId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {cashAccounts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>تأكيد الاعتماد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectItem} onOpenChange={(v) => !v && setRejectItem(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>رفض السند</DialogTitle></DialogHeader>
          <Textarea placeholder="سبب الرفض" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>رفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


