import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, clientIp } from "@/lib/serverAuth";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

async function pad(startedAt: number, targetMs = 300) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < targetMs) await new Promise((r) => setTimeout(r, targetMs - elapsed));
}

const GENERIC_ERROR = "بيانات الدخول غير صحيحة";

// Server-side login: resolves phone → email internally, then signs in.
// Never exposes the email to the client to prevent user enumeration.
export const Route = createFileRoute("/api/portal-resolve-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        try {
          const ip = clientIp(request);
          if (!rateLimit(`portal-resolve:${ip}`, 10, 60_000)) {
            await pad(startedAt);
            return Response.json({ error: "محاولات كثيرة، حاول لاحقاً" }, { status: 429 });
          }
          const body = (await request.json()) as { phone?: string; password?: string };
          const phone = (body.phone ?? "").toString();
          const password = (body.password ?? "").toString();
          const norm = normalizePhone(phone);

          if (norm.length < 7 || !password) {
            await pad(startedAt);
            return Response.json({ error: GENERIC_ERROR }, { status: 401 });
          }

          const { data: candidates, error } = await supabaseAdmin
            .from("doctors")
            .select("phone, email, portal_enabled, user_id")
            .not("user_id", "is", null)
            .eq("portal_enabled", true);
          if (error) {
            await pad(startedAt);
            return Response.json({ error: GENERIC_ERROR }, { status: 401 });
          }

          const match = (candidates ?? []).find(
            (d) => d.phone && normalizePhone(d.phone) === norm,
          );

          if (!match || !match.email) {
            await pad(startedAt);
            return Response.json({ error: GENERIC_ERROR }, { status: 401 });
          }

          // Sign in server-side — never expose email to client
          const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email: match.email,
            password,
          });

          await pad(startedAt);
          if (authError || !authData.session) {
            return Response.json({ error: GENERIC_ERROR }, { status: 401 });
          }

          return Response.json({
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_in: authData.session.expires_in,
            user: {
              id: authData.session.user.id,
              email: authData.session.user.email,
            },
          });
        } catch (e) {
          console.error("portal-resolve-login error:", e);
          await pad(startedAt);
          return Response.json({ error: "حدث خطأ داخلي" }, { status: 500 });
        }
      },
    },
  },
});
