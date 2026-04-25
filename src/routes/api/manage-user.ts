import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";

type AppRole = "admin" | "manager" | "technician";

export const Route = createFileRoute("/api/manage-user")({
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
            action: "invite" | "set_roles" | "deactivate" | "activate" | "remove";
            lab_id: string;
            email?: string;
            password?: string;
            full_name?: string;
            phone?: string;
            user_id?: string;
            roles?: AppRole[];
          };

          if (!body.lab_id || !body.action) {
            return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
          }

          // caller must be admin of lab
          const { data: callerRoles } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userRes.user.id)
            .eq("lab_id", body.lab_id);
          const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
          if (!isAdmin) {
            return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });
          }

          if (body.action === "invite") {
            if (!body.email || !body.password || body.password.length < 6 || !body.full_name) {
              return Response.json({ error: "بيانات الدعوة ناقصة" }, { status: 400 });
            }
            const roles = (body.roles && body.roles.length > 0 ? body.roles : ["technician"]) as AppRole[];

            // Try to create user. If already exists, look them up.
            let newUserId: string | null = null;
            const created = await supabaseAdmin.auth.admin.createUser({
              email: body.email,
              password: body.password,
              email_confirm: true,
              user_metadata: { full_name: body.full_name, lab_name: "" },
            });
            if (created.error) {
              if (
                created.error.message?.toLowerCase().includes("already") ||
                created.error.status === 422
              ) {
                const { data: list } = await supabaseAdmin.auth.admin.listUsers({
                  page: 1,
                  perPage: 200,
                });
                const found = list?.users.find(
                  (u) => u.email?.toLowerCase() === body.email!.toLowerCase(),
                );
                if (!found) {
                  return Response.json(
                    { error: "البريد مستخدم لكن تعذر إيجاد الحساب" },
                    { status: 409 },
                  );
                }
                newUserId = found.id;
              } else {
                return Response.json({ error: created.error.message }, { status: 400 });
              }
            } else {
              newUserId = created.data.user?.id ?? null;
            }
            if (!newUserId) return Response.json({ error: "فشل إنشاء الحساب" }, { status: 500 });

            // Upsert profile to belong to this lab
            await supabaseAdmin.from("profiles").upsert(
              {
                id: newUserId,
                lab_id: body.lab_id,
                full_name: body.full_name,
                phone: body.phone ?? null,
                is_active: true,
              },
              { onConflict: "id" },
            );

            // Replace roles for this lab
            await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", newUserId)
              .eq("lab_id", body.lab_id);
            await supabaseAdmin
              .from("user_roles")
              .insert(roles.map((role) => ({ user_id: newUserId!, lab_id: body.lab_id, role })));

            return Response.json({ ok: true, user_id: newUserId });
          }

          if (body.action === "set_roles") {
            if (!body.user_id || !body.roles) {
              return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
            }
            // Don't let admin demote themselves to no-admin if they're the only admin
            if (body.user_id === userRes.user.id && !body.roles.includes("admin")) {
              const { count } = await supabaseAdmin
                .from("user_roles")
                .select("*", { count: "exact", head: true })
                .eq("lab_id", body.lab_id)
                .eq("role", "admin");
              if ((count ?? 0) <= 1) {
                return Response.json(
                  { error: "لا يمكنك إزالة دورك كمدير وأنت الوحيد" },
                  { status: 400 },
                );
              }
            }
            await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", body.user_id)
              .eq("lab_id", body.lab_id);
            if (body.roles.length > 0) {
              await supabaseAdmin
                .from("user_roles")
                .insert(body.roles.map((role) => ({ user_id: body.user_id!, lab_id: body.lab_id, role })));
            }
            return Response.json({ ok: true });
          }

          if (body.action === "deactivate" || body.action === "activate") {
            if (!body.user_id) {
              return Response.json({ error: "user_id مطلوب" }, { status: 400 });
            }
            await supabaseAdmin
              .from("profiles")
              .update({ is_active: body.action === "activate" })
              .eq("id", body.user_id);
            return Response.json({ ok: true });
          }

          if (body.action === "remove") {
            if (!body.user_id) {
              return Response.json({ error: "user_id مطلوب" }, { status: 400 });
            }
            if (body.user_id === userRes.user.id) {
              return Response.json({ error: "لا يمكنك إزالة نفسك" }, { status: 400 });
            }
            // Just remove from this lab (don't delete auth user)
            await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", body.user_id)
              .eq("lab_id", body.lab_id);
            // Clear lab association if profile was bound to this lab
            await supabaseAdmin
              .from("profiles")
              .update({ lab_id: null, is_active: false })
              .eq("id", body.user_id)
              .eq("lab_id", body.lab_id);
            return Response.json({ ok: true });
          }

          return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
