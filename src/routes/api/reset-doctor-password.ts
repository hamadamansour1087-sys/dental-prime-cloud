import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "@/lib/audit.server";
import { clientIp } from "@/lib/serverAuth";
import {
  authenticateCaller,
  generatePassword,
  isLabAdminOrManager,
  jsonError,
} from "@/lib/portalAccounts.server";

export const Route = createFileRoute("/api/reset-doctor-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = await authenticateCaller(request);
          if (caller instanceof Response) return caller;

          const body = (await request.json()) as { doctor_id: string };
          if (!body.doctor_id) return jsonError("بيانات ناقصة", 400);

          const { data: doctor, error: dErr } = await supabaseAdmin
            .from("doctors")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.doctor_id)
            .maybeSingle();
          if (dErr) {
            console.error("reset-doctor-password doctor lookup error:", dErr);
            return jsonError("خطأ في البحث عن الطبيب", 500);
          }
          if (!doctor) return jsonError("الطبيب غير موجود", 404);
          if (!doctor.user_id) return jsonError("الطبيب ليس لديه حساب بورتال", 400);

          if (!(await isLabAdminOrManager(caller.id, doctor.lab_id))) {
            return jsonError("صلاحيات غير كافية", 403);
          }

          const newPassword = generatePassword(8);
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            doctor.user_id,
            { password: newPassword },
          );
          if (updateErr) return jsonError(updateErr.message, 500);

          await writeAuditLog({
            actorId: caller.id,
            actorEmail: caller.email,
            labId: doctor.lab_id,
            action: "doctor_password_reset",
            resourceType: "doctor",
            resourceId: doctor.id,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            metadata: { doctor_name: doctor.name, doctor_user_id: doctor.user_id },
          });

          return Response.json({ success: true, password: newPassword });
        } catch (e) {
          console.error("reset-doctor-password error:", e);
          return jsonError("حدث خطأ داخلي", 500);
        }
      },
    },
  },
});
