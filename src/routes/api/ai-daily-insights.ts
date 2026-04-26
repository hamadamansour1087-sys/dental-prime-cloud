import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer, rateLimit } from "@/lib/serverAuth";

export const Route = createFileRoute("/api/ai-daily-insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await verifyBearer(request);
          if (!userId) {
            return new Response(JSON.stringify({ error: "غير مصرح" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!rateLimit(`ai-insights:${userId}`, 20, 60_000)) {
            return new Response(JSON.stringify({ error: "تم تجاوز الحد" }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY غير مهيأ" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { stats } = await request.json();
          if (!stats) {
            return new Response(JSON.stringify({ error: "stats required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userPrompt = `حلل هذه الإحصائيات اليومية لمعمل أسنان وأعطِ ملخصاً ذكياً:\n\n${JSON.stringify(stats, null, 2)}`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "أنت مدير عمليات خبير في معامل الأسنان. حلل البيانات وأعد ملخصاً تنفيذياً ذكياً عبر استدعاء الأداة فقط.",
                },
                { role: "user", content: userPrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "daily_insights",
                    description: "ملخص يومي ذكي لأداء المعمل",
                    parameters: {
                      type: "object",
                      properties: {
                        headline: { type: "string", description: "عنوان موجز يلخص حالة اليوم في جملة واحدة" },
                        summary: { type: "string", description: "ملخص تنفيذي 2-3 أسطر بالعربية" },
                        health_score: { type: "number", description: "تقييم صحة المعمل من 0 إلى 100" },
                        alerts: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              level: { type: "string", enum: ["info", "warning", "critical"] },
                              message: { type: "string" },
                            },
                            required: ["level", "message"],
                            additionalProperties: false,
                          },
                          description: "تنبيهات مرتبة حسب الأولوية",
                        },
                        recommendations: {
                          type: "array",
                          items: { type: "string" },
                          description: "3-5 توصيات قابلة للتنفيذ",
                        },
                      },
                      required: ["headline", "summary", "health_score", "alerts", "recommendations"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "daily_insights" } },
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(JSON.stringify({ error: "تم تجاوز الحد الأقصى" }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
              });
            }
            if (response.status === 402) {
              return new Response(JSON.stringify({ error: "نفد الرصيد" }), {
                status: 402,
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ error: "AI error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) {
            return new Response(JSON.stringify({ error: "لا توجد نتيجة" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const insights = JSON.parse(toolCall.function.arguments);
          return new Response(JSON.stringify({ insights }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("daily-insights error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "خطأ" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
