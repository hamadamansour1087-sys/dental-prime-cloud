// Shared types for the case-entry feature.
export interface CaseEntryItem {
  id: string;
  work_type_id: string;
  tooth_numbers: string;
  shade: string;
  units: string;
  unit_price: string;
}

export interface PendingFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "photo" | "scan";
  previewUrl?: string;
  // Internal markers preserved for edit mode
  _storagePath?: string;
  _attachmentId?: string;
}

export interface DoctorOption {
  id: string;
  name: string;
  governorate?: string | null;
  doctor_clinics?: { id: string; name: string }[];
}

export interface WorkTypeOption {
  id: string;
  name: string;
}

export type CaseEntryMode = "admin" | "portal";

export interface SmartDefaults {
  lastDoctorId?: string;
  lastWorkTypeId?: string;
  lastShade?: string;
}

export type SubmitMode = "save" | "save_new" | "save_print";

export const SCAN_EXT = /\.(stl|ply|obj|zip|3mf|dcm)$/i;
