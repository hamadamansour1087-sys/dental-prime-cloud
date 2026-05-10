import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CaseRow, CaseStage } from "./types";

export function useCasesData(labId: string | null | undefined) {
  const stages = useQuery<CaseStage[]>({
    queryKey: ["stages", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_stages")
        .select("id, name, color, order_index, is_end, estimated_days")
        .order("order_index");
      return data ?? [];
    },
  });

  const cases = useQuery<CaseRow[]>({
    queryKey: ["cases", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "*, doctors(name), patients(name), work_types(name), workflow_stages!cases_current_stage_id_fkey(name, code, color)",
        )
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CaseRow[];
    },
  });

  // Latest technician + entry date at the "ready" (تم التسليم) stage per case
  const readyTechnicians = useQuery<Map<string, { name: string | null; enteredAt: string | null }>>({
    queryKey: ["cases-ready-technicians", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_stage_history")
        .select("case_id, entered_at, technicians(name), workflow_stages!inner(code)")
        .eq("workflow_stages.code", "ready")
        .order("entered_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, { name: string | null; enteredAt: string | null }>();
      (data ?? []).forEach((row: { case_id: string; entered_at: string | null; technicians?: { name?: string } | null }) => {
        if (!map.has(row.case_id)) {
          map.set(row.case_id, { name: row.technicians?.name ?? null, enteredAt: row.entered_at });
        }
      });
      return map;
    },
  });

  const deliveryAgents = useQuery<Map<string, { name: string | null; deliveredAt: string | null }>>({
    queryKey: ["cases-delivery-agents", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_deliveries")
        .select("case_id, delivered_at, delivery_agents(name)")
        .eq("lab_id", labId!)
        .order("delivered_at", { ascending: false });
      const map = new Map<string, { name: string | null; deliveredAt: string | null }>();
      data?.forEach((d: { case_id: string; delivered_at: string | null; delivery_agents?: { name?: string } | null }) => {
        if (!map.has(d.case_id)) {
          map.set(d.case_id, { name: d.delivery_agents?.name ?? null, deliveredAt: d.delivered_at });
        }
      });
      return map;
    },
  });

  const parentWorkTypes = useQuery<Map<string, string>>({
    queryKey: ["cases-parent-work-types", labId],
    enabled: !!labId && !!cases.data,
    queryFn: async () => {
      const followups = (cases.data ?? []).filter(
        (c) => c.parent_case_id && c.case_type !== "new",
      );
      const map = new Map<string, string>();
      if (followups.length === 0) return map;
      const parentIds = [...new Set(followups.map((c) => c.parent_case_id!))];
      const { data } = await supabase
        .from("cases")
        .select("id, work_types(name)")
        .in("id", parentIds);
      data?.forEach((p: { id: string; work_types?: { name?: string } | null }) => {
        if (p.work_types?.name) map.set(p.id, p.work_types.name);
      });
      return map;
    },
  });

  return { stages, cases, readyTechnicians, deliveryAgents, parentWorkTypes };
}
