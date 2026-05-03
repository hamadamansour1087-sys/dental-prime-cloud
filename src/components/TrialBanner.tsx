import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock } from "lucide-react";

export function TrialBanner({ labId }: { labId: string }) {
  const { data: lab } = useQuery({
    queryKey: ["lab-trial-info", labId],
    queryFn: async () => {
      const { data } = await supabase
        .from("labs")
        .select("subscription_status, trial_days, trial_start_date")
        .eq("id", labId)
        .single();
      return data;
    },
    staleTime: 60_000,
  });

  if (!lab || lab.subscription_status === "active") return null;

  const trialEnd = lab.trial_start_date
    ? new Date(new Date(lab.trial_start_date).getTime() + lab.trial_days * 86400000)
    : null;

  const now = new Date();
  const expired = trialEnd && trialEnd < now;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0;

  if (expired || lab.subscription_status === "expired") {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive" dir="rtl">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">
            انتهت الفترة التجريبية — النظام في وضع القراءة فقط.
          </span>
          <span>
            تواصل مع الدعم الفني لتفعيل البرنامج.
          </span>
        </div>
      </div>
    );
  }

  if (lab.subscription_status === "trial") {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400" dir="rtl">
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>
            الفترة التجريبية: متبقي <strong>{daysLeft} يوم</strong>
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export function useTrialExpired(labId: string | null) {
  const { data } = useQuery({
    queryKey: ["lab-trial-expired", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: lab } = await supabase
        .from("labs")
        .select("subscription_status, trial_days, trial_start_date")
        .eq("id", labId!)
        .single();
      if (!lab) return false;
      if (lab.subscription_status === "expired") return true;
      if (lab.subscription_status === "active") return false;
      if (lab.subscription_status === "trial" && lab.trial_start_date) {
        const trialEnd = new Date(new Date(lab.trial_start_date).getTime() + lab.trial_days * 86400000);
        return trialEnd < new Date();
      }
      return false;
    },
    staleTime: 60_000,
  });
  return data ?? false;
}
