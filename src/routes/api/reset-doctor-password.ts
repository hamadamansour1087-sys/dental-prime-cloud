import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomInt } from "crypto";
import { writeAuditLog } from "@/lib/audit.server";
import { clientIp } from "@/lib/serverAuth";

function generatePassword(length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) s += randomInt(0, 10).toString();
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
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData?.user?.id) {
            return Response.json({ error: "جلسة غير صالحة" }, { status: 401 });
          }
          const callerId = userData.user.id;

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
          if (dErr) {
            console.error("reset-doctor-password doctor lookup error:", dErr);
            return Response.json({ error: "خطأ في البحث عن الطبيب" }, { status: 500 });
          }
          if (!doctor) {
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
          const isPriv = (roleCheck ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
          if (!isPriv) {
            return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });
          }

          const newPassword = generatePassword(8);

          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            doctor.user_id,
            { password: newPassword }
          );
          if (updateErr) {
            return Response.json({ error: updateErr.message }, { status: 500 });
          }

          await writeAuditLog({
            actorId: callerId,
            actorEmail: userData.user.email ?? null,
            labId: doctor.lab_id,
            action: "doctor_password_reset",
            resourceType: "doctor",
            resourceId: doctor.id,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            metadata: { doctor_name: doctor.name, doctor_user_id: doctor.user_id },
          });

          return Response.json({ success: true, password: newPassword });
        } catch (e: any) {
          console.error("reset-doctor-password error:", e);
          return Response.json(
            { error: "حدث خطأ داخلي" },
            { status: 500 },
          );
        }
      },
    },
  },
});
