import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer, rateLimit } from "@/lib/serverAuth";

export const Route = createFileRoute("/api/ai-predict-delivery")({
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
          if (!rateLimit(`ai-predict:${userId}`, 30, 60_000)) {
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

          const { caseData } = await request.json();
          if (!caseData) {
            return new Response(JSON.stringify({ error: "caseData required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userPrompt = `استناداً لبيانات الحالة وفئة نوع العمل وسير العمل، توقع موعد التسليم بدقة. استخدم متوسط أيام التسليم للفئة (avg_delivery_days) كأساس، ثم عدّل بناءً على المرحلة الحالية والمتبقي من المراحل.\n\n${JSON.stringify(caseData, null, 2)}`;

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
                    "أنت خبير تخطيط إنتاج معامل أسنان. توقع موعد التسليم بدقة بناءً على فئة نوع العمل (مثل زيركون/بورسلين/أكريل) ومتوسط أيام التسليم للفئة، إضافة لسير العمل والمراحل المتبقية. أعد JSON فقط عبر الأداة.",
                },
                { role: "user", content: userPrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "predict_delivery",
                    description: "توقع موعد تسليم الحالة",
                    parameters: {
                      type: "object",
                      properties: {
                        estimated_days_remaining: {
                          type: "number",
                          description: "عدد الأيام المتبقية حتى التسليم",
                        },
                        confidence: {
                          type: "string",
                          enum: ["low", "medium", "high"],
                          description: "مستوى الثقة في التقدير",
                        },
                        on_time_probability: {
                          type: "number",
                          description: "احتمالية التسليم في الموعد من 0 إلى 100",
                        },
                        reasoning: {
                          type: "string",
                          description: "سبب التقدير في سطرين بالعربية",
                        },
                        risk_factors: {
                          type: "array",
                          items: { type: "string" },
                          description: "عوامل قد تؤخر التسليم",
                        },
                      },
                      required: ["estimated_days_remaining", "confidence", "on_time_probability", "reasoning", "risk_factors"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "predict_delivery" } },
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(JSON.stringify({ error: "تم تجاوز الحد" }), {
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
          const prediction = JSON.parse(toolCall.function.arguments);
          return new Response(JSON.stringify({ prediction }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("predict-delivery error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "خطأ" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
