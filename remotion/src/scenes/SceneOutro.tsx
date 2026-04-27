import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";
import { cairo, playfair } from "../fonts";

// Closing scene — full bleed brand
export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markS = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const titleO = interpolate(frame, [10, 32], [0, 1], { extrapolateRight: "clamp" });

  const subO = interpolate(frame, [28, 50], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 20 } }), [0, 1], [20, 0]);

  const lineW = interpolate(spring({ frame: frame - 22, fps, config: { damping: 200 } }), [0, 1], [0, 360]);

  const tagO = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const hover = Math.sin(frame / 18) * 3;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div
        style={{
          width: 130,
          height: 130,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: playfair,
          fontSize: 80,
          fontWeight: 700,
          color: C.bg,
          transform: `scale(${markS}) translateY(${hover}px)`,
          boxShadow: `0 30px 90px ${C.gold}55`,
        }}
      >
        H
      </div>

      <div style={{ opacity: titleO, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: playfair, color: C.ink, fontSize: 84, letterSpacing: 14, fontWeight: 700 }}>
          H.A.M.D
        </div>
      </div>

      <div style={{ width: lineW, height: 1, background: C.gold }} />

      <div
        style={{
          opacity: subO,
          transform: `translateY(${subY}px)`,
          fontFamily: cairo,
          color: C.ink,
          fontSize: 36,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        كل ما تحتاجه إدارة معملك
      </div>

      <div
        style={{
          opacity: tagO,
          fontFamily: cairo,
          color: C.inkMuted,
          fontSize: 22,
          letterSpacing: 6,
          marginTop: 12,
        }}
      >
        في مكان واحد
      </div>
    </div>
  );
};
