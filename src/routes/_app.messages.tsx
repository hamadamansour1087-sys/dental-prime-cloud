import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PortalChat } from "@/components/PortalChat";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/messages")({
  component: LabMessages,
});

function LabMessages() {
  const { user, labId } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<{ id: string; name: string } | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: doctors = [] } = useQuery({
    queryKey: ["lab-msgs-doctors", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, name")
        .eq("lab_id", labId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["lab-msgs-cases", selectedDoctor?.id],
    enabled: !!selectedDoctor,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_number")
        .eq("doctor_id", selectedDoctor!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const filtered = doctors.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid gap-3 md:grid-cols-[260px_200px_1fr]" dir="rtl">
      <Card>
        <CardContent className="p-2 space-y-2">
          <Input placeholder="بحث طبيب..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
          <div className="space-y-1 max-h-[65vh] overflow-y-auto">
            {filtered.map((d: any) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setSelectedDoctor(d); setCaseId(null); }}
                className={`w-full rounded-md p-2 text-right text-sm transition ${
                  selectedDoctor?.id === d.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                د. {d.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          {!selectedDoctor && <p className="p-3 text-xs text-muted-foreground text-center">اختر طبيب</p>}
          {selectedDoctor && (
            <div className="space-y-1 max-h-[65vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setCaseId(null)}
                className={`w-full rounded-md p-2 text-right text-sm transition ${
                  caseId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                💬 عامة
              </button>
              {cases.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaseId(c.id)}
                  className={`w-full rounded-md p-2 text-right text-sm transition ${
                    caseId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  حالة {c.case_number || "—"}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 h-[70vh]">
          {!selectedDoctor || !labId ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              اختر طبيب لبدء المحادثة
            </p>
          ) : (
            <PortalChat
              labId={labId}
              doctorId={selectedDoctor.id}
              caseId={caseId}
              viewer="lab"
              currentUserId={user?.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
