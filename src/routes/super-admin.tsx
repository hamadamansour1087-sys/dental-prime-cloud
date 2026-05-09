import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  LogOut,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      throw redirect({ to: "/login" });
    }
    const { data, error } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (error || !data) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [{ title: "H.A.M.D — لوحة تحكم السوبر أدمن" }],
  }),
});

function SuperAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const verifyRunRef = useRef(0);

  const verifySuperAdmin = useCallback(async (nextUser: any | null) => {
    const runId = ++verifyRunRef.current;
    if (!nextUser) {
      setUser(null);
      setAuthed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setUser(nextUser);
    try {
      const { data, error } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", nextUser.id)
        .maybeSingle();

      console.log("[super-admin] super_admins check:", { data, error: error?.message });
      if (runId !== verifyRunRef.current) return;
      setAuthed(!error && !!data);
    } catch (e: any) {
      console.error("[super-admin] super_admins query failed:", e?.message);
      if (runId !== verifyRunRef.current) return;
      setAuthed(false);
    }
    if (runId === verifyRunRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      console.log("[super-admin] initial check starting...");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log("[super-admin] getSession result:", session?.user?.id ?? "no session");
        if (!cancelled) await verifySuperAdmin(session?.user ?? null);
      } catch (e: any) {
        console.error("[super-admin] getSession failed:", e?.message);
        if (!cancelled) setLoading(false);
      }
    };
    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[super-admin] onAuthStateChange:", _event, session?.user?.id ?? "no session");
      if (!cancelled) void verifySuperAdmin(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [verifySuperAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <SuperAdminLogin onSuccess={(nextUser) => verifySuperAdmin(nextUser)} />;
  if (!authed) return <AccessDenied onLogout={() => { supabase.auth.signOut(); setUser(null); setAuthed(false); }} />;

  return <SuperAdminDashboard user={user} />;
}

/* ─── Login ─── */
function SuperAdminLogin({ onSuccess }: { onSuccess: (nextUser: any | null) => void | Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("بيانات الدخول غير صحيحة");
      setSubmitting(false);
    } else {
      await onSuccess(data.user);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4" dir="rtl">
      <Card className="w-full max-w-md border-border/30 bg-card/80 backdrop-blur-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">لوحة تحكم السوبر أدمن</CardTitle>
          <p className="text-sm text-muted-foreground">H.A.M.D — إدارة النظام</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Access Denied ─── */
function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4" dir="rtl">
      <Card className="w-full max-w-md border-destructive/30 bg-card/80 backdrop-blur-lg text-center">
        <CardContent className="py-12 space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
          <p className="text-sm text-muted-foreground">هذا الحساب ليس مسجلاً كسوبر أدمن.</p>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Dashboard ─── */
function SuperAdminDashboard({ user }: { user: any }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(14);
  const [selectedLab, setSelectedLab] = useState<any>(null);

  // Lab requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["sa-lab-requests", tab],
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
    enabled: tab !== "labs",
  });

  // All labs
  const { data: labs } = useQuery({
    queryKey: ["sa-all-labs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labs")
        .select("id, name, subscription_status, trial_days, trial_start_date, created_at, is_active, email, phone")
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
      qc.invalidateQueries({ queryKey: ["sa-lab-requests"] });
      qc.invalidateQueries({ queryKey: ["sa-all-labs"] });
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
      qc.invalidateQueries({ queryKey: ["sa-lab-requests"] });
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
      qc.invalidateQueries({ queryKey: ["sa-all-labs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suspendLab = useMutation({
    mutationFn: async (labId: string) => {
      const { error } = await supabase
        .from("labs")
        .update({ subscription_status: "expired", is_active: false })
        .eq("id", labId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إيقاف المعمل");
      qc.invalidateQueries({ queryKey: ["sa-all-labs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const extendTrial = useMutation({
    mutationFn: async () => {
      if (!selectedLab) return;
      const newStart = selectedLab.trial_start_date || new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("labs")
        .update({
          trial_days: (selectedLab.trial_days || 0) + extendDays,
          trial_start_date: newStart,
          subscription_status: "trial",
          is_active: true,
        })
        .eq("id", selectedLab.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تمديد الفترة التجريبية");
      qc.invalidateQueries({ queryKey: ["sa-all-labs"] });
      setExtendOpen(false);
      setSelectedLab(null);
      setExtendDays(14);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <Clock className="h-3 w-3 ml-1" />
            بانتظار المراجعة
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-3 w-3 ml-1" />
            تمت الموافقة
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
            <XCircle className="h-3 w-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const subBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 hover:bg-amber-500/20">تجريبي</Badge>;
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 hover:bg-emerald-500/20">مفعّل</Badge>;
      case "expired":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">منتهي / موقوف</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = requests?.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/80 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4 md:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">H.A.M.D — سوبر أدمن</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4 ml-2" />
            خروج
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold">{labs?.length ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">إجمالي المعامل</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {labs?.filter((l: any) => l.subscription_status === "active").length ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">مفعّل</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {labs?.filter((l: any) => l.subscription_status === "trial").length ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">تجريبي</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30 text-white">
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-amber-300">{pendingCount}</p>
              <p className="text-xs text-amber-300/70 mt-1">طلبات بانتظار المراجعة</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              طلبات جديدة {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              معتمدة
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              مرفوضة
            </TabsTrigger>
            <TabsTrigger value="labs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              جميع المعامل
            </TabsTrigger>
          </TabsList>

          {/* Requests */}
          {["pending", "approved", "rejected"].map((t) => (
            <TabsContent key={t} value={t}>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : !requests?.length ? (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="py-12 text-center text-slate-400">لا توجد طلبات</CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {requests.map((req: any) => (
                    <Card key={req.id} className="bg-white/5 border-white/10 text-white">
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
                        {req.email && (
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            {req.email}
                          </p>
                        )}
                        {req.phone && (
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="h-3.5 w-3.5" />
                            {req.phone}
                          </p>
                        )}
                        {req.address && (
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <MapPin className="h-3.5 w-3.5" />
                            {req.address}
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                        {req.notes && (
                          <p className="text-xs text-slate-400 bg-white/5 rounded p-2">{req.notes}</p>
                        )}
                        {req.rejection_reason && (
                          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                            سبب الرفض: {req.rejection_reason}
                          </p>
                        )}
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedReq(req);
                                setApproveOpen(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => {
                                setSelectedReq(req);
                                setRejectOpen(true);
                              }}
                            >
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

          {/* Labs */}
          <TabsContent value="labs">
            <Card className="bg-white/5 border-white/10 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-slate-300">المعمل</TableHead>
                    <TableHead className="text-slate-300">البريد / الهاتف</TableHead>
                    <TableHead className="text-slate-300">الاشتراك</TableHead>
                    <TableHead className="text-slate-300">التجربة</TableHead>
                    <TableHead className="text-slate-300">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-slate-300">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labs?.map((lab: any) => {
                    const trialEnd = lab.trial_start_date
                      ? new Date(new Date(lab.trial_start_date).getTime() + lab.trial_days * 86400000)
                      : null;
                    const expired =
                      trialEnd && trialEnd < new Date() && lab.subscription_status === "trial";
                    const effectiveStatus = expired ? "expired" : lab.subscription_status;
                    const daysLeft = trialEnd
                      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
                      : null;

                    return (
                      <TableRow key={lab.id} className="border-white/10 hover:bg-white/5 text-white">
                        <TableCell className="font-medium">{lab.name}</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {lab.email && <span className="block">{lab.email}</span>}
                          {lab.phone && <span className="block">{lab.phone}</span>}
                        </TableCell>
                        <TableCell>{subBadge(effectiveStatus)}</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {lab.trial_start_date ? (
                            <div>
                              <span>{lab.trial_days} يوم</span>
                              {daysLeft !== null && effectiveStatus === "trial" && (
                                <span className="block text-amber-400">متبقي {daysLeft} يوم</span>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {format(new Date(lab.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap">
                            {effectiveStatus !== "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs"
                                onClick={() => activateLab.mutate(lab.id)}
                              >
                                <ToggleRight className="h-3 w-3 ml-1" />
                                تفعيل
                              </Button>
                            )}
                            {effectiveStatus === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs"
                                onClick={() => suspendLab.mutate(lab.id)}
                              >
                                <ToggleLeft className="h-3 w-3 ml-1" />
                                إيقاف
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 h-7 text-xs"
                              onClick={() => {
                                setSelectedLab(lab);
                                setExtendDays(14);
                                setExtendOpen(true);
                              }}
                            >
                              <RefreshCw className="h-3 w-3 ml-1" />
                              تمديد
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>الموافقة على طلب المعمل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p>
                <strong>المعمل:</strong> {selectedReq?.lab_name}
              </p>
              <p>
                <strong>صاحب الطلب:</strong> {selectedReq?.owner_name}
              </p>
              <p>
                <strong>البريد:</strong> {selectedReq?.email}
              </p>
            </div>
            <div>
              <Label>عدد أيام الفترة التجريبية</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              إلغاء
            </Button>
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
              <p>
                <strong>المعمل:</strong> {selectedReq?.lab_name}
              </p>
              <p>
                <strong>صاحب الطلب:</strong> {selectedReq?.owner_name}
              </p>
            </div>
            <div>
              <Label>سبب الرفض (اختياري)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="بيانات غير مكتملة..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
              {reject.isPending ? "جارٍ..." : "رفض الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تمديد الفترة التجريبية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p>
                <strong>المعمل:</strong> {selectedLab?.name}
              </p>
              <p>
                <strong>الأيام الحالية:</strong> {selectedLab?.trial_days} يوم
              </p>
            </div>
            <div>
              <Label>عدد الأيام المضافة</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => extendTrial.mutate()} disabled={extendTrial.isPending}>
              {extendTrial.isPending ? "جارٍ..." : "تمديد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="top-center" />
    </div>
  );
}
