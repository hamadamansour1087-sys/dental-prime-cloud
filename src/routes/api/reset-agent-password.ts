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

export const Route = createFileRoute("/api/reset-agent-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = await authenticateCaller(request);
          if (caller instanceof Response) return caller;

          const body = (await request.json()) as { agent_id: string };
          if (!body.agent_id) return jsonError("بيانات ناقصة", 400);

          const { data: agent, error: aErr } = await supabaseAdmin
            .from("delivery_agents")
            .select("id, lab_id, name, user_id, phone")
            .eq("id", body.agent_id)
            .maybeSingle();
          if (aErr || !agent) return jsonError("المندوب غير موجود", 404);
          if (!agent.user_id) return jsonError("المندوب ليس لديه حساب", 400);

          if (!(await isLabAdminOrManager(caller.id, agent.lab_id))) {
            return jsonError("صلاحيات غير كافية", 403);
          }

          const newPassword = generatePassword(8);
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            agent.user_id,
            { password: newPassword },
          );
          if (updateErr) return jsonError(updateErr.message, 500);

          await writeAuditLog({
            actorId: caller.id,
            actorEmail: caller.email,
            labId: agent.lab_id,
            action: "agent_password_reset",
            resourceType: "delivery_agent",
            resourceId: agent.id,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            metadata: { agent_name: agent.name, agent_user_id: agent.user_id },
          });

          return Response.json({ success: true, password: newPassword });
        } catch (e) {
          console.error("reset-agent-password error:", e);
          return jsonError("حدث خطأ داخلي", 500);
        }
      },
    },
  },
});
