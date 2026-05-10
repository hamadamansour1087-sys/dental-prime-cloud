export interface LabRequest {
  id: string;
  lab_name: string;
  owner_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at: string;
}

export interface LabRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  subscription_status: "trial" | "active" | "expired" | string;
  trial_days: number | null;
  trial_start_date: string | null;
  created_at: string;
  is_active: boolean | null;
}

export type RequestTab = "pending" | "approved" | "rejected" | "labs";
