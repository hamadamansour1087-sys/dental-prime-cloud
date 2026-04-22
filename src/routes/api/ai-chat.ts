import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `أنت "مساعد H.A.M.D" — مساعد ذكي متخصص في إدارة معامل تركيبات الأسنان.
- جاوب دائماً بالعربية الفصحى المبسطة وبأسلوب مهني وودود.
- عندك خبرة في: أنواع التركيبات (زيركون، إيماكس، PFM، فينير، طقم متحرك)، المراحل الإنتاجية، التسعير، إدارة الأطباء والحالات.
- لما المستخدم يبعت صورة لاستمارة طبيب أو وصفة، استخرج منها: اسم الطبيب، اسم المريض، نوع العمل، اللون (Shade)، أرقام الأسنان، الملاحظات.
- لما تتطلب منك تحليل حالة، اقترح: الخطوة التالية، المخاطر المحتملة، تقدير الوقت، الأولوية.
- ردودك مختصرة ومنظمة باستخدام نقاط أو عناوين بالماركداون.`;

export const Route = createFileRoute("/api/ai-chat")({
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

          const { messages, model } = await request.json();
          if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: "messages must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
              stream: true,
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(
                JSON.stringify({ error: "تم تجاوز الحد الأقصى للطلبات، حاول لاحقاً" }),
                { status: 429, headers: { "Content-Type": "application/json" } }
              );
            }
            if (response.status === 402) {
              return new Response(
                JSON.stringify({ error: "نفد رصيد الذكاء الاصطناعي، يرجى إضافة رصيد" }),
                { status: 402, headers: { "Content-Type": "application/json" } }
              );
            }
            const t = await response.text();
            console.error("AI gateway error:", response.status, t);
            return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("ai-chat error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
