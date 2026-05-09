// Reusable React Query hooks for common entities.
// Reduces duplication of supabase.from(...) queries scattered across pages.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useDoctors(opts?: { enabled?: boolean }) {
  const { labId } = useAuth();
  return useQuery({
    queryKey: ["doctors", labId],
    enabled: !!labId && (opts?.enabled ?? true),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("lab_id", labId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeliveryAgents(opts?: { enabled?: boolean }) {
  const { labId } = useAuth();
  return useQuery({
    queryKey: ["delivery_agents", labId],
    enabled: !!labId && (opts?.enabled ?? true),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .eq("lab_id", labId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTechnicians(opts?: { enabled?: boolean }) {
  const { labId } = useAuth();
  return useQuery({
    queryKey: ["technicians", labId],
    enabled: !!labId && (opts?.enabled ?? true),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("lab_id", labId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkTypes(opts?: { enabled?: boolean }) {
  const { labId } = useAuth();
  return useQuery({
    queryKey: ["work_types", labId],
    enabled: !!labId && (opts?.enabled ?? true),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_types")
        .select("*")
        .eq("lab_id", labId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCurrentLab() {
  const { labId } = useAuth();
  return useQuery({
    queryKey: ["lab", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labs")
        .select("*")
        .eq("id", labId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
