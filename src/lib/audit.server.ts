import "@tanstack/react-start/server-only";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuditLogEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  labId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Fire-and-forget audit logger. Errors are logged but never thrown so they
// can never break the calling operation.
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      lab_id: entry.labId ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      before_data: entry.beforeData ?? null,
      after_data: entry.afterData ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) console.error("[audit] insert failed:", error.message);
  } catch (e) {
    console.error("[audit] unexpected error:", e);
  }
}
