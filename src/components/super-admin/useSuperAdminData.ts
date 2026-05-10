import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LabRequest, LabRow, RequestTab } from "./types";

interface ApproveArgs {
  requestId: string;
  trialDays: number;
}

interface RejectArgs {
  requestId: string;
  reason: string;
}

interface ExtendArgs {
  lab: LabRow;
  extraDays: number;
}

export function useSuperAdminData(tab: RequestTab) {
  const qc = useQueryClient();

  const requests = useQuery<LabRequest[]>({
    queryKey: ["sa-lab-requests", tab],
    queryFn: async () => {
      const q = supabase.from("lab_requests").select("*").order("created_at", { ascending: false });
      if (tab === "pending") q.eq("status", "pending");
      else if (tab === "approved") q.eq("status", "approved");
      else if (tab === "rejected") q.eq("status", "rejected");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LabRequest[];
    },
    enabled: tab !== "labs",
  });

  const labs = useQuery<LabRow[]>({
    queryKey: ["sa-all-labs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labs")
        .select("id, name, subscription_status, trial_days, trial_start_date, created_at, is_active, email, phone")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LabRow[];
    },
  });

  const invalidateRequests = () => qc.invalidateQueries({ queryKey: ["sa-lab-requests"] });
  const invalidateLabs = () => qc.invalidateQueries({ queryKey: ["sa-all-labs"] });

  const approve = useMutation({
    mutationFn: async ({ requestId, trialDays }: ApproveArgs) => {
      const { error } = await supabase.rpc("approve_lab_request", {
        _request_id: requestId,
        _trial_days: trialDays,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الموافقة على الطلب وإنشاء المعمل بنجاح");
      invalidateRequests();
      invalidateLabs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ requestId, reason }: RejectArgs) => {
      const { error } = await supabase
        .from("lab_requests")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      invalidateRequests();
    },
    onError: (e: Error) => toast.error(e.message),
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
      invalidateLabs();
    },
    onError: (e: Error) => toast.error(e.message),
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
      invalidateLabs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extendTrial = useMutation({
    mutationFn: async ({ lab, extraDays }: ExtendArgs) => {
      const newStart = lab.trial_start_date || new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("labs")
        .update({
          trial_days: (lab.trial_days || 0) + extraDays,
          trial_start_date: newStart,
          subscription_status: "trial",
          is_active: true,
        })
        .eq("id", lab.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تمديد الفترة التجريبية");
      invalidateLabs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { requests, labs, approve, reject, activateLab, suspendLab, extendTrial };
}
