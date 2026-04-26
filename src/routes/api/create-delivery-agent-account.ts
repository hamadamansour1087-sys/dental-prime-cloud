import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

function generatePassword(length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export const Route = createFileRoute("/api/create-delivery-agent-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "غير مصرح" }, { status: 401 });
          }
          const token = authHeader.slice(7).trim();
          if (!token) return Response.json({ error: "رمز الجلسة فارغ" }, { status: 401 });

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

          const body = (await request.json()) as { agent_id: string; password?: string };
          if (!body.agent_id) return Response.json({ error: "بيانات ناقصة" }, { status: 400 });

          const { data: agent } = await supabaseAdmin
            .from("delivery_agents")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.agent_id)
            .maybeSingle();
          if (!agent) return Response.json({ error: "المندوب غير موجود" }, { status: 404 });
          if (agent.user_id) return Response.json({ error: "هذا المندوب لديه حساب بالفعل" }, { status: 400 });
          if (!agent.phone) return Response.json({ error: "يجب إضافة رقم موبايل أولاً" }, { status: 400 });

          const { data: roleCheck } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId)
            .eq("lab_id", agent.lab_id);
          const isPriv = (roleCheck ?? []).some((r) => r.role === "admin" || r.role === "manager");
          if (!isPriv) return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });

          const phoneNorm = normalizePhone(agent.phone);
          if (phoneNorm.length < 7) return Response.json({ error: "رقم الموبايل غير صالح" }, { status: 400 });

          const internalEmail = `agent-${phoneNorm}-${agent.lab_id.slice(0, 8)}@portal.local`;
          const password = body.password && body.password.length >= 6 ? body.password : generatePassword(8);

          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: agent.name, is_delivery_agent: true },
          });
          if (cErr || !created.user) {
            return Response.json({ error: cErr?.message ?? "فشل إنشاء الحساب" }, { status: 400 });
          }

          // Cleanup auto-bootstrapped lab from signup trigger
          await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
          const { data: autoProfile } = await supabaseAdmin
            .from("profiles").select("lab_id").eq("id", created.user.id).maybeSingle();
          if (autoProfile?.lab_id) {
            await supabaseAdmin.from("workflow_stages").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("workflows").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("work_types").delete().eq("lab_id", autoProfile.lab_id);
            const roleIds = ((await supabaseAdmin.from("roles").select("id").eq("lab_id", autoProfile.lab_id)).data ?? []).map((r) => r.id);
            if (roleIds.length) await supabaseAdmin.from("role_permissions").delete().in("role_id", roleIds);
            await supabaseAdmin.from("roles").delete().eq("lab_id", autoProfile.lab_id);
            await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
            await supabaseAdmin.from("labs").delete().eq("id", autoProfile.lab_id);
          }

          // Agents do NOT get a profiles row (they're not lab members) — they get user_roles for the delivery role
          await supabaseAdmin.from("user_roles").insert({
            user_id: created.user.id, lab_id: agent.lab_id, role: "delivery",
          });

          await supabaseAdmin
            .from("delivery_agents")
            .update({ user_id: created.user.id, email: internalEmail })
            .eq("id", body.agent_id);

          return Response.json({ success: true, user_id: created.user.id, phone: phoneNorm, password });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
        }
      },
    },
  },
});
