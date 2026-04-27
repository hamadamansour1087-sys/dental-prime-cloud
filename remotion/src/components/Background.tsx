import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C } from "../theme";

// Persistent layered background — slow drifting golden orbs over deep navy
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (s: number, p: number) => Math.sin((frame / s) + p) * 80;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Vignette gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${C.bgSoft} 0%, ${C.bg} 70%)`,
        }}
      />
      {/* Drifting orbs */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          left: -200 + drift(120, 0),
          top: -200 + drift(160, 1),
          background: `radial-gradient(circle, ${C.gold}22 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          right: -150 + drift(140, 2),
          bottom: -150 + drift(180, 3),
          background: `radial-gradient(circle, ${C.accent}22 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      {/* Subtle grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.line}40 1px, transparent 1px), linear-gradient(90deg, ${C.line}40 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          opacity: interpolate(frame, [0, 60], [0, 0.4], { extrapolateRight: "clamp" }),
        }}
      />
      {/* Top + bottom film bars for cinematic feel */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: `linear-gradient(${C.bg}, transparent)` }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${C.bg})` }} />
      </div>
    </AbsoluteFill>
  );
};
