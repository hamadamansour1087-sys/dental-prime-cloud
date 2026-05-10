// Shared types for the cases list page.
import type { Database } from "@/integrations/supabase/types";

type StageRow = Pick<
  Database["public"]["Tables"]["workflow_stages"]["Row"],
  "id" | "name" | "color" | "order_index" | "is_end" | "estimated_days"
>;

export type CaseStage = StageRow;

// The cases list query joins related tables; keeping a loose-but-typed shape
// here avoids `any` while preserving compatibility with the supabase select.
export interface CaseRow {
  id: string;
  case_number: string;
  status: "active" | "on_hold" | "delivered" | "cancelled" | "pending_approval" | string;
  date_received: string | null;
  date_delivered: string | null;
  due_date: string | null;
  units: number | null;
  current_stage_id: string | null;
  stage_entered_at: string | null;
  workflow_id: string | null;
  parent_case_id: string | null;
  case_type: string | null;
  doctors?: { name: string } | null;
  patients?: { name: string } | null;
  work_types?: { name: string } | null;
  workflow_stages?: { name: string; code: string; color: string } | null;
}

export type FollowupKind = "remake" | "repair";
