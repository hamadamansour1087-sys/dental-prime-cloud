import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CaseEntryForm } from "@/components/CaseEntryForm";

export const Route = createFileRoute("/portal/new-case")({
  component: NewCasePortal,
});

function NewCasePortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: doctor, isLoading } = useQuery({
    queryKey: ["portal-doctor-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, lab_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading || !doctor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6">
      <CaseEntryForm
        mode="portal"
        labId={doctor.lab_id}
        fixedDoctorId={doctor.id}
        onCancel={() => navigate({ to: "/portal/cases" })}
        onSaved={() => navigate({ to: "/portal/cases" })}
      />
    </div>
  );
}
