// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://dental-prime-cloud.lovable.app",
  "https://id-preview--62356e65-a116-4a02-a620-159e57942fb1.lovable.app",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...headers, "content-type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "جلسة غير صالحة" }), {
        status: 401,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string" || text.length > 5000) {
      return new Response(JSON.stringify({ error: "نص غير صالح" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "مفتاح API غير مهيأ" }), {
        status: 500,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    const allowedVoices = ["EXAVITQu4vr4xnSDxMaL", "pNInz6obpgDQGcFmaJgB", "yoZ06aMxZJJ28mfd3POQ"];
    const vid = allowedVoices.includes(voiceId) ? voiceId : allowedVoices[0];

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.95 },
        }),
      }
    );
    if (!r.ok) {
      console.error("ElevenLabs error:", r.status, await r.text());
      return new Response(JSON.stringify({ error: "خطأ في خدمة التحويل الصوتي" }), {
        status: 500,
        headers: { ...headers, "content-type": "application/json" },
      });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, { headers: { ...headers, "content-type": "audio/mpeg" } });
  } catch (e) {
    console.error("generate-voiceover error:", e);
    return new Response(JSON.stringify({ error: "حدث خطأ داخلي" }), {
      status: 500,
      headers: { ...corsHeaders(req), "content-type": "application/json" },
    });
  }
});
