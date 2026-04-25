import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PortalChat } from "@/components/PortalChat";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/portal/messages")({
  component: DoctorMessages,
});

function DoctorMessages() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"general" | string>("general");

  const { data: doctor } = useQuery({
    queryKey: ["msgs-doctor", user?.id],
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

  const { data: cases = [] } = useQuery({
    queryKey: ["msgs-doctor-cases", doctor?.id],
    enabled: !!doctor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_number, status")
        .eq("doctor_id", doctor!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (!doctor) return null;

  return (
    <div className="grid gap-3 md:grid-cols-[240px_1fr]" dir="rtl">
      <Card>
        <CardContent className="p-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setTab("general")}
              className={`w-full rounded-md p-2 text-right text-sm transition ${
                tab === "general" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              💬 محادثة عامة
            </button>
            {cases.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTab(c.id)}
                className={`w-full rounded-md p-2 text-right text-sm transition ${
                  tab === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                حالة {c.case_number || "—"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 h-[70vh]">
          <PortalChat
            labId={doctor.lab_id}
            doctorId={doctor.id}
            caseId={tab === "general" ? null : tab}
            viewer="doctor"
            currentUserId={user?.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
