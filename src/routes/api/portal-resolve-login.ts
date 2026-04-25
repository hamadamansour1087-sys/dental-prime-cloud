import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

// Resolves a phone number to the internal email used by the doctor's auth account.
// Returns 404 if no enabled portal account exists for that phone.
// No auth required — public endpoint, but only returns the email (not the password).
export const Route = createFileRoute("/api/portal-resolve-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { phone?: string };
          const phone = (body.phone ?? "").toString();
          const norm = normalizePhone(phone);
          if (norm.length < 7) {
            return Response.json({ error: "رقم الموبايل غير صالح" }, { status: 400 });
          }

          // Find a doctor whose phone normalizes to this value AND has portal enabled
          const { data: candidates, error } = await supabaseAdmin
            .from("doctors")
            .select("phone, email, portal_enabled, user_id")
            .not("user_id", "is", null)
            .eq("portal_enabled", true);
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          const match = (candidates ?? []).find(
            (d) => d.phone && normalizePhone(d.phone) === norm,
          );

          if (!match || !match.email) {
            return Response.json({ error: "لا يوجد حساب بهذا الرقم" }, { status: 404 });
          }

          return Response.json({ email: match.email });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "خطأ" },
            { status: 500 },
          );
        }
      },
    },
  },
});
