import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function generatePassword(length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export const Route = createFileRoute("/api/reset-doctor-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "غير مصرح" }, { status: 401 });
          }
          const token = authHeader.slice(7).trim();
          if (!token) {
            return Response.json({ error: "رمز الجلسة فارغ" }, { status: 401 });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
          if (claimsErr || !claimsRes?.claims?.sub) {
            return Response.json({ error: "جلسة غير صالحة" }, { status: 401 });
          }
          const callerId = claimsRes.claims.sub as string;

          const body = (await request.json()) as { doctor_id: string };
          if (!body.doctor_id) {
            return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
          }

          // Get doctor
          const { data: doctor, error: dErr } = await supabaseAdmin
            .from("doctors")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.doctor_id)
            .maybeSingle();
          if (dErr || !doctor) {
            return Response.json({ error: "الطبيب غير موجود" }, { status: 404 });
          }
          if (!doctor.user_id) {
            return Response.json({ error: "الطبيب ليس لديه حساب بورتال" }, { status: 400 });
          }

          // Verify caller is admin/manager
          const { data: roleCheck } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId)
            .eq("lab_id", doctor.lab_id);
          const isPriv = (roleCheck ?? []).some((r) => r.role === "admin" || r.role === "manager");
          if (!isPriv) {
            return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });
          }

          const newPassword = generatePassword(8);

          // Update password via admin API — no account deletion needed
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            doctor.user_id,
            { password: newPassword }
          );
          if (updateErr) {
            return Response.json({ error: updateErr.message }, { status: 500 });
          }

          return Response.json({ success: true, password: newPassword });
        } catch (e) {
          console.error("reset-doctor-password error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "خطأ غير متوقع" },
            { status: 500 },
          );
        }
      },
    },
  },
});
