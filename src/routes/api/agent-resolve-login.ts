import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

export const Route = createFileRoute("/api/agent-resolve-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { phone?: string };
          const norm = normalizePhone((body.phone ?? "").toString());
          if (norm.length < 7) return Response.json({ error: "رقم الموبايل غير صالح" }, { status: 400 });

          const { data: candidates, error } = await supabaseAdmin
            .from("delivery_agents")
            .select("phone, email, is_active, user_id")
            .not("user_id", "is", null)
            .eq("is_active", true);
          if (error) return Response.json({ error: error.message }, { status: 500 });

          const match = (candidates ?? []).find((d) => d.phone && normalizePhone(d.phone) === norm);
          if (!match || !match.email) return Response.json({ error: "لا يوجد حساب بهذا الرقم" }, { status: 404 });
          return Response.json({ email: match.email });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
        }
      },
    },
  },
});
