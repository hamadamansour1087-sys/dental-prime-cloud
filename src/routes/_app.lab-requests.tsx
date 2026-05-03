import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, Building2, Mail, Phone, MapPin, Calendar } from "lucide-react";

export const Route = createFileRoute("/_app/lab-requests")({
  component: LabRequestsPage,
});

function LabRequestsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["lab-requests", tab],
    queryFn: async () => {
      const q = supabase
        .from("lab_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (tab === "pending") q.eq("status", "pending");
      else if (tab === "approved") q.eq("status", "approved");
      else if (tab === "rejected") q.eq("status", "rejected");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Lab subscription management
  const { data: labs } = useQuery({
    queryKey: ["all-labs-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labs")
        .select("id, name, subscription_status, trial_days, trial_start_date, created_at, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("approve_lab_request", {
        _request_id: selectedReq.id,
        _trial_days: trialDays,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الموافقة على الطلب وإنشاء المعمل بنجاح");
      qc.invalidateQueries({ queryKey: ["lab-requests"] });
      qc.invalidateQueries({ queryKey: ["all-labs-admin"] });
      setApproveOpen(false);
      setSelectedReq(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lab_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReq.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["lab-requests"] });
      setRejectOpen(false);
      setSelectedReq(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activateLab = useMutation({
    mutationFn: async (labId: string) => {
      const { error } = await supabase
        .from("labs")
        .update({ subscription_status: "active" })
        .eq("id", labId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تفعيل المعمل");
      qc.invalidateQueries({ queryKey: ["all-labs-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="h-3 w-3 ml-1" />بانتظار المراجعة</Badge>;
      case "approved": return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50"><CheckCircle2 className="h-3 w-3 ml-1" />تمت الموافقة</Badge>;
      case "rejected": return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5"><XCircle className="h-3 w-3 ml-1" />مرفوض</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const subBadge = (status: string) => {
    switch (status) {
      case "trial": return <Badge variant="outline" className="text-amber-600 border-amber-300">تجريبي</Badge>;
      case "active": return <Badge variant="outline" className="text-emerald-600 border-emerald-300">مفعّل</Badge>;
      case "expired": return <Badge variant="outline" className="text-destructive border-destructive/30">منتهي</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">إدارة المعامل والطلبات</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">طلبات جديدة</TabsTrigger>
          <TabsTrigger value="approved">معتمدة</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
          <TabsTrigger value="labs">جميع المعامل</TabsTrigger>
        </TabsList>

        {/* Requests tabs */}
        {["pending", "approved", "rejected"].map((t) => (
          <TabsContent key={t} value={t}>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : !requests?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد طلبات</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((req: any) => (
                  <Card key={req.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {req.lab_name}
                        </CardTitle>
                        {statusBadge(req.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium">{req.owner_name}</p>
                      {req.email && <p className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{req.email}</p>}
                      {req.phone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{req.phone}</p>}
                      {req.address && <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{req.address}</p>}
                      <p className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}</p>
                      {req.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{req.notes}</p>}
                      {req.rejection_reason && <p className="text-xs text-destructive bg-destructive/5 rounded p-2">سبب الرفض: {req.rejection_reason}</p>}

                      {req.status === "pending" && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" className="flex-1" onClick={() => { setSelectedReq(req); setApproveOpen(true); }}>
                            <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setSelectedReq(req); setRejectOpen(true); }}>
                            <XCircle className="h-4 w-4 ml-1" /> رفض
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        {/* Labs tab */}
        <TabsContent value="labs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعمل</TableHead>
                  <TableHead>الاشتراك</TableHead>
                  <TableHead>أيام التجربة</TableHead>
                  <TableHead>بدء التجربة</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labs?.map((lab: any) => {
                  const trialEnd = lab.trial_start_date
                    ? new Date(new Date(lab.trial_start_date).getTime() + lab.trial_days * 86400000)
                    : null;
                  const expired = trialEnd && trialEnd < new Date() && lab.subscription_status === "trial";
                  return (
                    <TableRow key={lab.id}>
                      <TableCell className="font-medium">{lab.name}</TableCell>
                      <TableCell>{subBadge(expired ? "expired" : lab.subscription_status)}</TableCell>
                      <TableCell>{lab.trial_days} يوم</TableCell>
                      <TableCell className="text-xs">{lab.trial_start_date ? format(new Date(lab.trial_start_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-xs">{format(new Date(lab.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {(lab.subscription_status === "trial" || lab.subscription_status === "expired") && (
                          <Button size="sm" variant="outline" onClick={() => activateLab.mutate(lab.id)}>
                            تفعيل كامل
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>الموافقة على طلب المعمل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p><strong>المعمل:</strong> {selectedReq?.lab_name}</p>
              <p><strong>صاحب الطلب:</strong> {selectedReq?.owner_name}</p>
              <p><strong>البريد:</strong> {selectedReq?.email}</p>
            </div>
            <div>
              <Label>عدد أيام الفترة التجريبية</Label>
              <Input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>إلغاء</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? "جارٍ..." : "موافقة وإنشاء المعمل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب المعمل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p><strong>المعمل:</strong> {selectedReq?.lab_name}</p>
              <p><strong>صاحب الطلب:</strong> {selectedReq?.owner_name}</p>
            </div>
            <div>
              <Label>سبب الرفض (اختياري)</Label>
              <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="بيانات غير مكتملة..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
              {reject.isPending ? "جارٍ..." : "رفض الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
