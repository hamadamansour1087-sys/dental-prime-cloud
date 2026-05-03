import { Composition } from "remotion";
import { Reel } from "./reels/Reel";

const REELS = [
  { id: "reel-01", title: "نظام إدارة\nمعامل الأسنان", subtitle: "H.A.M.D", bullets: ["إدارة متكاملة", "تقارير دقيقة", "أتمتة ذكية", "بياناتك آمنة"], color1: "#0A1628", color2: "#1E3A5F", accent: "#00B4D8" },
  { id: "reel-02", title: "تتبع كل حالة\nمن الاستلام\nحتى التسليم", subtitle: "إدارة الحالات", bullets: ["تتبع لحظي", "تنبيهات ذكية", "تنظيم الفريق", "تقارير دقيقة"], color1: "#0F1B2D", color2: "#1A2F4A", accent: "#6C63FF" },
  { id: "reel-03", title: "بوابة الأطباء", subtitle: "تواصل مباشر مع معملك", bullets: ["تواصل فوري", "طلبات أسرع", "متابعة لحظية", "أمان تام"], color1: "#0A2A2A", color2: "#0D3B3B", accent: "#2DD4BF" },
  { id: "reel-04", title: "تقارير وتحليلات\nشاملة", subtitle: "لأداء معملك", bullets: ["تقارير شاملة", "تحليلات ذكية", "قرارات أفضل", "وفّر الوقت"], color1: "#1A0A2E", color2: "#2D1B4E", accent: "#A78BFA" },
  { id: "reel-05", title: "نظام تتبع\nالمندوبين", subtitle: "والتسليم الذكي", bullets: ["تتبع مباشر", "تحديثات فورية", "تقارير أداء"], color1: "#0A1628", color2: "#1E3A5F", accent: "#3B82F6" },
  { id: "reel-06", title: "إدارة مالية\nمتكاملة", subtitle: "فواتير وتحصيلات", bullets: ["فواتير احترافية", "تحصيلات ذكية", "تقارير مالية", "دقة وأمان"], color1: "#0A1F0A", color2: "#1A3A1A", accent: "#22C55E" },
  { id: "reel-07", title: "جرّب مجاناً!", subtitle: "سجّل معملك الآن", bullets: ["بدون بطاقة ائتمان", "سهل الاستخدام", "دعم فني متخصص"], color1: "#1A0A3A", color2: "#2D1B5E", accent: "#F59E0B" },
  { id: "reel-08", title: "مسح QR", subtitle: "تتبع فوري لكل حالة", bullets: ["تتبع فوري", "تنبيهات ذكية", "أمان بيانات"], color1: "#0F1B33", color2: "#1A2F55", accent: "#8B5CF6" },
  { id: "reel-09", title: "مساعد ذكي\nبالذكاء\nالاصطناعي", subtitle: "H.A.M.D AI", bullets: ["أتمتة العمليات", "أعلى دقة", "تحليلات ذكية", "أسرع أداء"], color1: "#0A0F1A", color2: "#141E33", accent: "#06B6D4" },
  { id: "reel-10", title: "بياناتك\nفي أمان تام", subtitle: "نسخ احتياطي تلقائي", bullets: ["حماية متقدمة", "نسخ تلقائي", "تخزين مشفر", "استرجاع سريع"], color1: "#0A1628", color2: "#162544", accent: "#3B82F6" },
];

export const ReelsRoot = () => (
  <>
    {REELS.map((r) => (
      <Composition
        key={r.id}
        id={r.id}
        component={Reel}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ title: r.title, subtitle: r.subtitle, bullets: r.bullets, color1: r.color1, color2: r.color2, accent: r.accent }}
      />
    ))}
  </>
);
