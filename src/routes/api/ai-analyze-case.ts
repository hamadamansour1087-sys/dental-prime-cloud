import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-analyze-case")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY غير مهيأ" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { caseData } = await request.json();
          if (!caseData) {
            return new Response(JSON.stringify({ error: "caseData required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userPrompt = `حلل هذه الحالة وأعطني تقييم سريع:\n\n${JSON.stringify(caseData, null, 2)}`;

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
                    "أنت خبير إدارة معامل أسنان. حلل بيانات الحالة وأعد JSON منظم فقط عبر استدعاء الأداة.",
                },
                { role: "user", content: userPrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "analyze_case",
                    description: "تحليل سريع لحالة معمل أسنان",
                    parameters: {
                      type: "object",
                      properties: {
                        summary: { type: "string", description: "ملخص قصير بالعربية (سطرين كحد أقصى)" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                        risks: {
                          type: "array",
                          items: { type: "string" },
                          description: "قائمة بالمخاطر أو التنبيهات (تأخير، نقص بيانات، إلخ)",
                        },
                        next_action: {
                          type: "string",
                          description: "الإجراء التالي المقترح",
                        },
                        estimated_completion_days: {
                          type: "number",
                          description: "الأيام المتبقية لإنهاء الحالة",
                        },
                      },
                      required: ["summary", "priority", "risks", "next_action"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "analyze_case" } },
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
          const analysis = JSON.parse(toolCall.function.arguments);
          return new Response(JSON.stringify({ analysis }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("analyze-case error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "خطأ" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
