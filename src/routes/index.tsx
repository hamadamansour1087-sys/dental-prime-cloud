import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

type Dest = "/dashboard" | "/portal/dashboard" | "/delivery/dashboard" | "/login";

function Index() {
  const { user, loading, roles, profile, labId } = useAuth();
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setDest("/login"); return; }

    // Delivery agent role takes priority
    if ((roles as string[]).includes("delivery")) {
      setDest("/delivery/dashboard");
      return;
    }

    // Lab member (has profile + lab_id)
    if (profile && labId) {
      setDest("/dashboard");
      return;
    }

    // Otherwise check if this user is a doctor (portal user)
    (async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setDest(data ? "/portal/dashboard" : "/login");
    })();
  }, [user, loading, roles, profile, labId]);

  if (loading || !dest) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  return <Navigate to={dest} />;
}
