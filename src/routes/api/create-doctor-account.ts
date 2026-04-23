import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/create-doctor-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "غير مصرح" }, { status: 401 });
          }
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userRes, error: uErr } = await userClient.auth.getUser();
          if (uErr || !userRes.user) {
            return Response.json({ error: "جلسة غير صالحة" }, { status: 401 });
          }

          const body = (await request.json()) as {
            doctor_id: string;
            email: string;
            password: string;
          };
          if (!body.doctor_id || !body.email || !body.password || body.password.length < 6) {
            return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
          }

          // Verify caller is admin/manager of doctor's lab
          const { data: doctor, error: dErr } = await supabaseAdmin
            .from("doctors")
            .select("id, lab_id, name, user_id")
            .eq("id", body.doctor_id)
            .maybeSingle();
          if (dErr || !doctor) {
            return Response.json({ error: "الطبيب غير موجود" }, { status: 404 });
          }
          if (doctor.user_id) {
            return Response.json({ error: "هذا الطبيب لديه حساب بالفعل" }, { status: 400 });
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

          // Create auth user
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: body.email,
            password: body.password,
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
            // delete the auto-created lab and its seeded data
            await supabaseAdmin.from("workflow_stages").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("workflows").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("work_types").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("role_permissions").delete().in(
              "role_id",
              ((await supabaseAdmin.from("roles").select("id").eq("lab_id", autoProfile.lab_id)).data ?? []).map(
                (r) => r.id
              )
            );
            await supabaseAdmin.from("roles").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
            await supabaseAdmin.from("labs").delete().eq("id", autoProfile.lab_id);
          }

          // Re-create profile pointing to the doctor's lab
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

          // Link doctor row
          await supabaseAdmin
            .from("doctors")
            .update({ user_id: created.user.id, portal_enabled: true, email: body.email })
            .eq("id", body.doctor_id);

          return Response.json({ success: true, user_id: created.user.id });
        } catch (e) {
          console.error("create-doctor-account error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "خطأ غير متوقع" },
            { status: 500 }
          );
        }
      },
    },
  },
});
