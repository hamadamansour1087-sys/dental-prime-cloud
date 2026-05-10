/**
 * Super Admin route — slim orchestrator.
 * All UI is split into `src/components/super-admin/*` and queries/mutations
 * live in `useSuperAdminData`.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperAdminLogin } from "@/components/super-admin/SuperAdminLogin";
import { AccessDenied } from "@/components/super-admin/AccessDenied";
import { StatsCards } from "@/components/super-admin/StatsCards";
import { RequestCard } from "@/components/super-admin/RequestCard";
import { LabsTable } from "@/components/super-admin/LabsTable";
import {
  ApproveDialog,
  ExtendTrialDialog,
  RejectDialog,
} from "@/components/super-admin/Dialogs";
import { useSuperAdminData } from "@/components/super-admin/useSuperAdminData";
import type { LabRequest, LabRow, RequestTab } from "@/components/super-admin/types";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) throw redirect({ to: "/login" });
    const { data, error } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (error || !data) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [{ title: "H.A.M.D — لوحة تحكم السوبر أدمن" }],
  }),
});

function SuperAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const verifyRunRef = useRef(0);

  const verifySuperAdmin = useCallback(async (nextUser: User | null) => {
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
      if (runId !== verifyRunRef.current) return;
      setAuthed(!error && !!data);
    } catch (e) {
      console.error("[super-admin] super_admins query failed:", (e as Error)?.message);
      if (runId !== verifyRunRef.current) return;
      setAuthed(false);
    }
    if (runId === verifyRunRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) await verifySuperAdmin(session?.user ?? null);
      } catch (e) {
        console.error("[super-admin] getSession failed:", (e as Error)?.message);
        if (!cancelled) setLoading(false);
      }
    };
    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  if (!user) return <SuperAdminLogin onSuccess={(u) => verifySuperAdmin(u)} />;
  if (!authed) {
    return (
      <AccessDenied
        onLogout={() => {
          supabase.auth.signOut();
          setUser(null);
          setAuthed(false);
        }}
      />
    );
  }

  return <SuperAdminDashboard user={user} />;
}

function SuperAdminDashboard({ user }: { user: User }) {
  const [tab, setTab] = useState<RequestTab>("pending");

  const [selectedReq, setSelectedReq] = useState<LabRequest | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [selectedLab, setSelectedLab] = useState<LabRow | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(14);

  const { requests, labs, approve, reject, activateLab, suspendLab, extendTrial } =
    useSuperAdminData(tab);

  const pendingCount = requests.data?.length ?? 0;

  const handleApproveConfirm = () => {
    if (!selectedReq) return;
    approve.mutate(
      { requestId: selectedReq.id, trialDays },
      {
        onSuccess: () => {
          setApproveOpen(false);
          setSelectedReq(null);
        },
      },
    );
  };

  const handleRejectConfirm = () => {
    if (!selectedReq) return;
    reject.mutate(
      { requestId: selectedReq.id, reason: rejectionReason },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setSelectedReq(null);
          setRejectionReason("");
        },
      },
    );
  };

  const handleExtendConfirm = () => {
    if (!selectedLab) return;
    extendTrial.mutate(
      { lab: selectedLab, extraDays: extendDays },
      {
        onSuccess: () => {
          setExtendOpen(false);
          setSelectedLab(null);
          setExtendDays(14);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <StatsCards labs={labs.data} pendingCount={pendingCount} />

        <Tabs value={tab} onValueChange={(v) => setTab(v as RequestTab)} className="space-y-4">
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

          {(["pending", "approved", "rejected"] as const).map((t) => (
            <TabsContent key={t} value={t}>
              {requests.isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : !requests.data?.length ? (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="py-12 text-center text-slate-400">لا توجد طلبات</CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {requests.data.map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      onApprove={(r) => {
                        setSelectedReq(r);
                        setApproveOpen(true);
                      }}
                      onReject={(r) => {
                        setSelectedReq(r);
                        setRejectOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}

          <TabsContent value="labs">
            <LabsTable
              labs={labs.data}
              onActivate={(id) => activateLab.mutate(id)}
              onSuspend={(id) => suspendLab.mutate(id)}
              onExtend={(lab) => {
                setSelectedLab(lab);
                setExtendDays(14);
                setExtendOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        request={selectedReq}
        trialDays={trialDays}
        setTrialDays={setTrialDays}
        onConfirm={handleApproveConfirm}
        pending={approve.isPending}
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        request={selectedReq}
        reason={rejectionReason}
        setReason={setRejectionReason}
        onConfirm={handleRejectConfirm}
        pending={reject.isPending}
      />
      <ExtendTrialDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        lab={selectedLab}
        extraDays={extendDays}
        setExtraDays={setExtendDays}
        onConfirm={handleExtendConfirm}
        pending={extendTrial.isPending}
      />

      <Toaster richColors position="top-center" />
    </div>
  );
}
