import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Normalize a phone number to digits only (Egyptian style: drop leading 0/+/spaces)
function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

function generatePassword(length = 8): string {
  // 8-digit numeric password (easy to dictate over the phone)
  let s = "";
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export const Route = createFileRoute("/api/create-doctor-account")({
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
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            },
          });
          const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
          if (claimsErr || !claimsRes?.claims?.sub) {
            console.error("Auth claims verification failed:", claimsErr);
            return Response.json(
              { error: `جلسة غير صالحة: ${claimsErr?.message ?? "تعذّر التحقق من التوكن"}` },
              { status: 401 },
            );
          }
          const authUser = {
            id: claimsRes.claims.sub,
            email: typeof claimsRes.claims.email === "string" ? claimsRes.claims.email : undefined,
          };
          if (!authUser.id) {
            return Response.json({ error: "تعذّر التحقق من المستخدم" }, { status: 401 });
          }
          const userRes = { user: authUser };

          const body = (await request.json()) as {
            doctor_id: string;
            // password and email are now optional — generated server-side
            password?: string;
          };
          if (!body.doctor_id) {
            return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
          }

          // Verify caller is admin/manager of doctor's lab
          const { data: doctor, error: dErr } = await supabaseAdmin
            .from("doctors")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.doctor_id)
            .maybeSingle();
          if (dErr || !doctor) {
            return Response.json({ error: "الطبيب غير موجود" }, { status: 404 });
          }
          if (doctor.user_id) {
            return Response.json({ error: "هذا الطبيب لديه حساب بالفعل" }, { status: 400 });
          }
          if (!doctor.phone) {
            return Response.json(
              { error: "يجب إضافة رقم موبايل للطبيب أولاً (يستخدم لتسجيل الدخول)" },
              { status: 400 },
            );
          }

          const { data: roleCheck } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userRes.user.id)
            .eq("lab_id", doctor.lab_id);
          const isPriv = (roleCheck ?? []).some((r) => r.role === "admin" || r.role === "manager");
          if (!isPriv) {
            return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });
          }

          const phoneNorm = normalizePhone(doctor.phone);
          if (phoneNorm.length < 7) {
            return Response.json({ error: "رقم الموبايل غير صالح" }, { status: 400 });
          }
          // Build a stable internal email so Supabase auth accepts it.
          // Doctor logs in with phone — UI maps phone → this email under the hood.
          const internalEmail = `dr-${phoneNorm}-${doctor.lab_id.slice(0, 8)}@portal.local`;
          const password = body.password && body.password.length >= 6 ? body.password : generatePassword(8);

          // Create auth user
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: doctor.name, is_doctor: true },
          });
          if (cErr || !created.user) {
            return Response.json({ error: cErr?.message ?? "فشل إنشاء الحساب" }, { status: 400 });
          }

          // The bootstrap_new_user_lab trigger will fire — clean up the auto-created lab/profile
          await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
          const { data: autoProfile } = await supabaseAdmin
            .from("profiles")
            .select("lab_id")
            .eq("id", created.user.id)
            .maybeSingle();
          if (autoProfile?.lab_id) {
            await supabaseAdmin.from("workflow_stages").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("workflows").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("work_types").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("role_permissions").delete().in(
              "role_id",
              ((await supabaseAdmin.from("roles").select("id").eq("lab_id", autoProfile.lab_id)).data ?? []).map(
                (r) => r.id,
              ),
            );
            await supabaseAdmin.from("roles").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
            await supabaseAdmin.from("labs").delete().eq("id", autoProfile.lab_id);
          }

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
              portal_password_plain: password,
            })
            .eq("id", body.doctor_id);

          return Response.json({
            success: true,
            user_id: created.user.id,
            phone: phoneNorm,
            password,
          });
        } catch (e) {
          console.error("create-doctor-account error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "خطأ غير متوقع" },
            { status: 500 },
          );
        }
      },
    },
  },
});
