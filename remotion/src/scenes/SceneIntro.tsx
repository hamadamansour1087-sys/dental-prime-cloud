import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";
import { cairo, playfair } from "../fonts";

// Scene 1 — brand intro: H.A.M.D logo mark + tagline
export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const markRot = interpolate(spring({ frame, fps, config: { damping: 200 } }), [0, 1], [-15, 0]);

  const lineW = interpolate(spring({ frame: frame - 18, fps, config: { damping: 200 } }), [0, 1], [0, 280]);
  const titleY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 14 } }), [0, 1], [40, 0]);
  const titleO = interpolate(frame, [28, 50], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(spring({ frame: frame - 50, fps, config: { damping: 18 } }), [0, 1], [20, 0]);

  // Subtle hover after entry
  const hover = Math.sin(frame / 18) * 4;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 32 }}>
      {/* Logo mark */}
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: playfair,
          fontWeight: 700,
          fontSize: 110,
          color: C.bg,
          transform: `scale(${markScale}) rotate(${markRot}deg) translateY(${hover}px)`,
          boxShadow: `0 30px 90px ${C.gold}55, 0 0 0 1px ${C.gold}`,
        }}
      >
        H
      </div>

      {/* Animated rule */}
      <div style={{ width: lineW, height: 1.5, background: C.gold, opacity: 0.8 }} />

      {/* Title */}
      <div style={{ transform: `translateY(${titleY}px)`, opacity: titleO, textAlign: "center" }}>
        <div style={{ fontFamily: playfair, color: C.ink, fontSize: 96, letterSpacing: 18, fontWeight: 700 }}>
          H.A.M.D
        </div>
      </div>

      {/* Subtitle (Arabic) */}
      <div
        style={{
          transform: `translateY(${subY}px)`,
          opacity: subO,
          fontFamily: cairo,
          color: C.inkMuted,
          fontSize: 34,
          letterSpacing: 8,
          fontWeight: 400,
        }}
      >
        نظام إدارة معامل الأسنان
      </div>
    </div>
  );
};
