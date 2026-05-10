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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const Route = createFileRoute("/api/agent-resolve-login")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const startedAt = Date.now();
        try {
          const ip = clientIp(request);
          if (!rateLimit(`agent-resolve:${ip}`, 10, 60_000)) {
            await pad(startedAt);
            return withCors(Response.json({ error: "محاولات كثيرة، حاول لاحقاً" }, { status: 429 }));
          }
          const body = (await request.json()) as { phone?: string; password?: string };
          const norm = normalizePhone((body.phone ?? "").toString());
          const password = (body.password ?? "").toString();

          if (norm.length < 7 || !password) {
            await pad(startedAt);
            return withCors(Response.json({ error: GENERIC_ERROR }, { status: 401 }));
          }

          const { data: candidates, error } = await supabaseAdmin
            .from("delivery_agents")
            .select("phone, email, is_active, user_id")
            .not("user_id", "is", null)
            .eq("is_active", true);
          if (error) {
            await pad(startedAt);
            return withCors(Response.json({ error: GENERIC_ERROR }, { status: 401 }));
          }

          const match = (candidates ?? []).find((d) => d.phone && normalizePhone(d.phone) === norm);
          if (!match || !match.email) {
            await pad(startedAt);
            return withCors(Response.json({ error: GENERIC_ERROR }, { status: 401 }));
          }

          // Sign in server-side — never expose email to client
          const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email: match.email,
            password,
          });

          await pad(startedAt);
          if (authError || !authData.session) {
            return withCors(Response.json({ error: GENERIC_ERROR }, { status: 401 }));
          }

          return withCors(Response.json({
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_in: authData.session.expires_in,
            user: {
              id: authData.session.user.id,
              email: authData.session.user.email,
            },
          }));
        } catch (e) {
          await pad(startedAt);
          return withCors(Response.json({ error: "حدث خطأ داخلي" }, { status: 500 }));
        }
      },
    },
  },
});
