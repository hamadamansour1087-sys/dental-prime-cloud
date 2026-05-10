import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        const checks: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};

        // Database check
        const dbStart = Date.now();
        try {
          const { error } = await supabaseAdmin.from("labs").select("id", { head: true, count: "exact" }).limit(1);
          checks.database = { ok: !error, latencyMs: Date.now() - dbStart, error: error?.message };
        } catch (e) {
          checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: (e as Error).message };
        }

        // Auth check
        const authStart = Date.now();
        try {
          const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          checks.auth = { ok: !error, latencyMs: Date.now() - authStart, error: error?.message };
        } catch (e) {
          checks.auth = { ok: false, latencyMs: Date.now() - authStart, error: (e as Error).message };
        }

        const allOk = Object.values(checks).every((c) => c.ok);
        const body = {
          status: allOk ? "healthy" : "degraded",
          timestamp: new Date().toISOString(),
          uptimeMs: Date.now() - startedAt,
          checks,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: allOk ? 200 : 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
