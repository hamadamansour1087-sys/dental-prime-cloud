import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "@/lib/audit.server";
import { clientIp } from "@/lib/serverAuth";
import {
  authenticateCaller,
  cleanupAutoBootstrappedLab,
  generatePassword,
  isLabAdminOrManager,
  jsonError,
  normalizePhone,
} from "@/lib/portalAccounts.server";

export const Route = createFileRoute("/api/create-doctor-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = await authenticateCaller(request);
          if (caller instanceof Response) return caller;

          const body = (await request.json()) as { doctor_id: string; password?: string };
          if (!body.doctor_id) return jsonError("بيانات ناقصة", 400);

          const { data: doctor, error: dErr } = await supabaseAdmin
            .from("doctors")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.doctor_id)
            .maybeSingle();
          if (dErr || !doctor) return jsonError("الطبيب غير موجود", 404);
          if (doctor.user_id) return jsonError("هذا الطبيب لديه حساب بالفعل", 400);
          if (!doctor.phone) {
            return jsonError("يجب إضافة رقم موبايل للطبيب أولاً (يستخدم لتسجيل الدخول)", 400);
          }

          if (!(await isLabAdminOrManager(caller.id, doctor.lab_id))) {
            return jsonError("صلاحيات غير كافية", 403);
          }

          const phoneNorm = normalizePhone(doctor.phone);
          if (phoneNorm.length < 7) return jsonError("رقم الموبايل غير صالح", 400);

          const internalEmail = `dr-${phoneNorm}-${doctor.lab_id.slice(0, 8)}@portal.local`;
          const password =
            body.password && body.password.length >= 6 ? body.password : generatePassword(8);

          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: doctor.name, is_doctor: true },
          });
          if (cErr || !created.user) {
            return jsonError(cErr?.message ?? "فشل إنشاء الحساب", 400);
          }

          await cleanupAutoBootstrappedLab(created.user.id);

          await supabaseAdmin.from("profiles").insert({
            id: created.user.id,
            lab_id: doctor.lab_id,
            full_name: doctor.name,
          });
          await supabaseAdmin.from("user_roles").insert({
            user_id: created.user.id,
            lab_id: doctor.lab_id,
            role: "doctor",
          });

          await supabaseAdmin
            .from("doctors")
            .update({
              user_id: created.user.id,
              portal_enabled: true,
              email: internalEmail,
            })
            .eq("id", body.doctor_id);

          await writeAuditLog({
            actorId: caller.id,
            actorEmail: caller.email,
            labId: doctor.lab_id,
            action: "doctor_account_created",
            resourceType: "doctor",
            resourceId: doctor.id,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            metadata: { doctor_name: doctor.name, new_user_id: created.user.id, phone: phoneNorm },
          });

          return Response.json({
            success: true,
            user_id: created.user.id,
            phone: phoneNorm,
            password,
          });
        } catch (e) {
          console.error("create-doctor-account error:", e);
          return jsonError("حدث خطأ داخلي", 500);
        }
      },
    },
  },
});
