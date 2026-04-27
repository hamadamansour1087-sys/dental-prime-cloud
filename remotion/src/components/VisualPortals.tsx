import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";
import { cairo } from "../fonts";

// Visual mock — two device frames (doctor portal + delivery app) side by side
export const VisualPortals: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const card = (
    delay: number,
    title: string,
    subtitle: string,
    badge: string,
    badgeColor: string,
  ) => {
    const o = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
    const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 80 } });
    const y = interpolate(s, [0, 1], [40, 0]);
    const tilt = interpolate(s, [0, 1], [delay === 0 ? -8 : 8, delay === 0 ? -4 : 4]);

    return (
      <div
        style={{
          width: 280,
          height: 540,
          borderRadius: 38,
          background: `linear-gradient(170deg, ${C.bgSoft}, ${C.bg})`,
          border: `1.5px solid ${C.gold}55`,
          padding: 18,
          opacity: o,
          transform: `translateY(${y}px) rotate(${tilt}deg)`,
          boxShadow: `0 40px 90px ${C.bg}, 0 0 0 1px ${C.line}`,
          fontFamily: cairo,
          direction: "rtl",
        }}
      >
        {/* notch */}
        <div style={{ width: 80, height: 6, background: C.line, borderRadius: 3, margin: "0 auto 18px" }} />

        {/* header */}
        <div style={{ color: C.inkMuted, fontSize: 12, letterSpacing: 2, marginBottom: 6 }}>{subtitle}</div>
        <div style={{ color: C.ink, fontSize: 22, fontWeight: 700, marginBottom: 22 }}>{title}</div>

        {/* badge */}
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 10,
            background: `${badgeColor}22`,
            color: badgeColor,
            fontSize: 13,
            marginBottom: 22,
          }}
        >
          {badge}
        </div>

        {/* fake list items */}
        {[0, 1, 2, 3].map((i) => {
          const itemO = interpolate(frame, [delay + 25 + i * 6, delay + 40 + i * 6], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                background: C.line + "80",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 10,
                opacity: itemO,
              }}
            >
              <div style={{ height: 6, width: `${75 - i * 8}%`, background: C.inkMuted, borderRadius: 3, opacity: 0.6 }} />
              <div style={{ height: 5, width: `${50 - i * 5}%`, background: C.inkMuted, borderRadius: 3, opacity: 0.3, marginTop: 8 }} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: -40, alignItems: "center" }}>
      {card(0, "بوابة الأطباء", "DOCTOR PORTAL", "حالة جديدة", C.gold)}
      <div style={{ width: 30 }} />
      {card(15, "تطبيق المندوبين", "DELIVERY APP", "تسليم بنجاح", C.accent)}
    </div>
  );
};
