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

export const Route = createFileRoute("/api/create-delivery-agent-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = await authenticateCaller(request);
          if (caller instanceof Response) return caller;

          const body = (await request.json()) as { agent_id: string; password?: string };
          if (!body.agent_id) return jsonError("بيانات ناقصة", 400);

          const { data: agent } = await supabaseAdmin
            .from("delivery_agents")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.agent_id)
            .maybeSingle();
          if (!agent) return jsonError("المندوب غير موجود", 404);
          if (agent.user_id) return jsonError("هذا المندوب لديه حساب بالفعل", 400);
          if (!agent.phone) return jsonError("يجب إضافة رقم موبايل أولاً", 400);

          if (!(await isLabAdminOrManager(caller.id, agent.lab_id))) {
            return jsonError("صلاحيات غير كافية", 403);
          }

          const phoneNorm = normalizePhone(agent.phone);
          if (phoneNorm.length < 7) return jsonError("رقم الموبايل غير صالح", 400);

          const internalEmail = `agent-${phoneNorm}-${agent.lab_id.slice(0, 8)}@portal.local`;
          const password =
            body.password && body.password.length >= 6 ? body.password : generatePassword(8);

          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: agent.name, is_delivery_agent: true },
          });
          if (cErr || !created.user) {
            return jsonError(cErr?.message ?? "فشل إنشاء الحساب", 400);
          }

          await cleanupAutoBootstrappedLab(created.user.id);

          // Agents do NOT get a profiles row — only a user_roles entry.
          await supabaseAdmin.from("user_roles").insert({
            user_id: created.user.id,
            lab_id: agent.lab_id,
            role: "delivery",
          });

          await supabaseAdmin
            .from("delivery_agents")
            .update({ user_id: created.user.id, email: internalEmail })
            .eq("id", body.agent_id);

          await writeAuditLog({
            actorId: caller.id,
            actorEmail: caller.email,
            labId: agent.lab_id,
            action: "agent_account_created",
            resourceType: "delivery_agent",
            resourceId: agent.id,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            metadata: { agent_name: agent.name, new_user_id: created.user.id, phone: phoneNorm },
          });

          return Response.json({
            success: true,
            user_id: created.user.id,
            phone: phoneNorm,
            password,
          });
        } catch (e) {
          console.error("create-delivery-agent-account error:", e);
          return jsonError("حدث خطأ داخلي", 500);
        }
      },
    },
  },
});
