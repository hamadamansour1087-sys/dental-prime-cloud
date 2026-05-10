import "@tanstack/react-start/server-only";
/**
 * Shared helpers for the four portal-account API routes:
 *   create-doctor-account, create-delivery-agent-account,
 *   reset-doctor-password,  reset-agent-password.
 *
 * Centralizes: bearer auth, admin/manager role check, password generation,
 * phone normalization, and cleanup of the lab auto-bootstrapped by the
 * `bootstrap_new_user_lab` trigger when creating non-lab portal accounts.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PrivilegedCaller = { id: string; email: string | null };

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

export function generatePassword(length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) s += randomInt(0, 10).toString();
  return s;
}

/** Verify Bearer token and return the caller (id + email) or a 401 Response. */
export async function authenticateCaller(
  request: Request,
): Promise<PrivilegedCaller | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonError("غير مصرح", 401);
  const token = authHeader.slice(7).trim();
  if (!token) return jsonError("رمز الجلسة فارغ", 401);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return jsonError("Server configuration error", 500);

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return jsonError(`جلسة غير صالحة: ${error?.message ?? "تعذّر التحقق من التوكن"}`, 401);
  }
  return {
    id: data.claims.sub as string,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

/** Returns true if `userId` is admin or manager in the given lab. */
export async function isLabAdminOrManager(userId: string, labId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("lab_id", labId);
  return (data ?? []).some((r) => r.role === "admin" || r.role === "manager");
}

/**
 * Removes the lab + ancillary rows auto-created by the
 * `bootstrap_new_user_lab` trigger when a portal-only user signs up.
 * Safe to call after createUser for doctors / delivery agents.
 */
export async function cleanupAutoBootstrappedLab(newUserId: string): Promise<void> {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
  const { data: autoProfile } = await supabaseAdmin
    .from("profiles")
    .select("lab_id")
    .eq("id", newUserId)
    .maybeSingle();
  if (!autoProfile?.lab_id) return;

  const labId = autoProfile.lab_id;
  await supabaseAdmin.from("workflow_stages").delete().eq("lab_id", labId);
  await supabaseAdmin.from("workflows").delete().eq("lab_id", labId);
  await supabaseAdmin.from("work_types").delete().eq("lab_id", labId);

  const { data: roles } = await supabaseAdmin.from("roles").select("id").eq("lab_id", labId);
  const roleIds = (roles ?? []).map((r) => r.id);
  if (roleIds.length) {
    await supabaseAdmin.from("role_permissions").delete().in("role_id", roleIds);
  }
  await supabaseAdmin.from("roles").delete().eq("lab_id", labId);
  await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
  await supabaseAdmin.from("labs").delete().eq("id", labId);
}
