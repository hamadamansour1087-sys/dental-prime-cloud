import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, clientIp } from "@/lib/serverAuth";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

// Constant-time-ish delay so found vs not-found responses look similar.
async function pad(startedAt: number, targetMs = 250) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < targetMs) await new Promise((r) => setTimeout(r, targetMs - elapsed));
}

export const Route = createFileRoute("/api/agent-resolve-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        try {
          const ip = clientIp(request);
          if (!rateLimit(`agent-resolve:${ip}`, 10, 60_000)) {
            await pad(startedAt);
            return Response.json({ error: "محاولات كثيرة، حاول لاحقاً" }, { status: 429 });
          }
          const body = (await request.json()) as { phone?: string };
          const norm = normalizePhone((body.phone ?? "").toString());
          if (norm.length < 7) {
            await pad(startedAt);
            return Response.json({ error: "رقم الموبايل غير صالح" }, { status: 400 });
          }

          const { data: candidates, error } = await supabaseAdmin
            .from("delivery_agents")
            .select("phone, email, is_active, user_id")
            .not("user_id", "is", null)
            .eq("is_active", true);
          if (error) {
            await pad(startedAt);
            return Response.json({ error: "خطأ" }, { status: 500 });
          }

          const match = (candidates ?? []).find((d) => d.phone && normalizePhone(d.phone) === norm);
          await pad(startedAt);
          if (!match || !match.email) return Response.json({ error: "لا يوجد حساب بهذا الرقم" }, { status: 404 });
          return Response.json({ email: match.email });
        } catch (e) {
          await pad(startedAt);
          return Response.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
        }
      },
    },
  },
});
