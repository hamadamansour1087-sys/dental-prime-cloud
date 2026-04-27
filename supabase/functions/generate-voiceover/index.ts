// deno-lint-ignore-file
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, voiceId } = await req.json();
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    const vid = voiceId || "EXAVITQu4vr4xnSDxMaL";
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
      const t = await r.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, { headers: { ...corsHeaders, "content-type": "audio/mpeg" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
