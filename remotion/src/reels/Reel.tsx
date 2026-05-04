import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Audio, staticFile } from "remotion";

// Using system fonts - Noto Sans Arabic is available
const FONT = "'Noto Sans Arabic', 'Noto Sans', sans-serif";

interface ReelProps {
  title: string;
  subtitle: string;
  bullets: string[];
  color1: string;
  color2: string;
  accent: string;
  audioFile?: string;
}

export const Reel: React.FC<ReelProps> = ({ title, subtitle, bullets, color1, color2, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background pulse
  const bgPulse = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.95, 1.05]);

  // Logo entrance
  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 }, durationInFrames: 30 });
  const logoRotate = interpolate(logoScale, [0, 1], [180, 0]);

  // Title lines animation
  const titleLines = title.split("\n");

  // Subtitle
  const subDelay = 25;
  const subSpring = spring({ frame: frame - subDelay, fps, config: { damping: 20 }, durationInFrames: 25 });
  const subY = interpolate(subSpring, [0, 1], [60, 0]);
  const subOp = interpolate(subSpring, [0, 1], [0, 1]);

  // Decorative line
  const lineWidth = interpolate(frame, [30, 60], [0, 400], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // Exit animation (last 30 frames)
  const exitOp = interpolate(frame, [270, 295], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Floating particles
  const particles = Array.from({ length: 8 }, (_, i) => {
    const x = 100 + (i * 137) % 880;
    const baseY = 200 + (i * 233) % 1500;
    const y = baseY + Math.sin(frame * 0.03 + i) * 40;
    const size = 3 + (i % 3) * 2;
    const op = 0.15 + Math.sin(frame * 0.05 + i * 2) * 0.1;
    return { x, y, size, op };
  });

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      {/* Background */}
      <AbsoluteFill style={{
        background: `linear-gradient(160deg, ${color1} 0%, ${color2} 60%, ${color1} 100%)`,
        transform: `scale(${bgPulse})`,
      }} />

      {/* Grid pattern */}
      <AbsoluteFill style={{ opacity: 0.04 }}>
        <div style={{
          width: "100%", height: "100%",
          backgroundImage: `linear-gradient(${accent}40 1px, transparent 1px), linear-gradient(90deg, ${accent}40 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      </AbsoluteFill>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: "50%",
          background: accent, opacity: p.op,
        }} />
      ))}

      {/* Accent glow */}
      <div style={{
        position: "absolute", top: "15%", right: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
        transform: `scale(${1 + Math.sin(frame * 0.015) * 0.2})`,
      }} />

      {/* H.A.M.D Logo */}
      <div style={{
        position: "absolute", top: 120, left: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        transform: `scale(${logoScale}) rotate(${logoRotate}deg)`,
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: 24,
          background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 48, fontWeight: 900, color: "#fff",
          fontFamily: "sans-serif",
          boxShadow: `0 20px 60px ${accent}40`,
        }}>
          H
        </div>
      </div>

      {/* Brand text */}
      <Sequence from={10}>
        <div style={{
          position: "absolute", top: 240, left: 0, right: 0,
          textAlign: "center",
          opacity: spring({ frame: frame - 10, fps, config: { damping: 20 }, durationInFrames: 20 }),
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: 8 }}>
            H.A.M.D
          </span>
        </div>
      </Sequence>

      {/* Decorative line */}
      <div style={{
        position: "absolute", top: 310, left: "50%",
        transform: "translateX(-50%)", height: 3,
        width: lineWidth, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        borderRadius: 2,
      }} />

      {/* Main Title */}
      <div style={{
        position: "absolute", top: 380, left: 60, right: 60,
        textAlign: "center", direction: "rtl",
      }}>
        {titleLines.map((line, i) => {
          const delay = 15 + i * 12;
          const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 }, durationInFrames: 25 });
          const y = interpolate(s, [0, 1], [80, 0]);
          const op = interpolate(s, [0, 1], [0, 1]);
          return (
            <div key={i} style={{
              fontSize: titleLines.length > 2 ? 72 : 84,
              fontWeight: 900, color: "#fff",
              fontFamily: FONT,
              lineHeight: 1.2,
              transform: `translateY(${y}px)`,
              opacity: op,
              textShadow: `0 4px 30px ${color1}`,
            }}>
              {line}
            </div>
          );
        })}
      </div>

      {/* Subtitle */}
      <div style={{
        position: "absolute",
        top: 380 + titleLines.length * (titleLines.length > 2 ? 90 : 105) + 30,
        left: 60, right: 60,
        textAlign: "center", direction: "rtl",
        transform: `translateY(${subY}px)`,
        opacity: subOp,
      }}>
        <span style={{
          fontSize: 42, fontWeight: 600, color: accent,
          fontFamily: FONT,
        }}>
          {subtitle}
        </span>
      </div>

      {/* Bullets */}
      <div style={{
        position: "absolute",
        bottom: 350, left: 80, right: 80,
        direction: "rtl",
      }}>
        {bullets.map((b, i) => {
          const delay = 60 + i * 18;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18 }, durationInFrames: 20 });
          const x = interpolate(s, [0, 1], [100, 0]);
          const op = interpolate(s, [0, 1], [0, 1]);

          // Subtle floating after entry
          const floatY = frame > delay + 20 ? Math.sin((frame - delay) * 0.04 + i) * 3 : 0;

          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 16,
              marginBottom: 24,
              transform: `translateX(${x}px) translateY(${floatY}px)`,
              opacity: op,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                background: accent, flexShrink: 0,
                boxShadow: `0 0 12px ${accent}80`,
              }} />
              <span style={{
                fontSize: 36, fontWeight: 500, color: "#ffffffDD",
                fontFamily: FONT,
              }}>
                {b}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <Sequence from={90}>
        <div style={{
          position: "absolute", bottom: 100, left: 80, right: 80,
          opacity: spring({ frame: frame - 90, fps, config: { damping: 20 }, durationInFrames: 20 }),
        }}>
          <div style={{
            background: `${accent}20`, borderRadius: 20,
            padding: "20px 30px",
            border: `1px solid ${accent}30`,
            textAlign: "center", direction: "rtl",
          }}>
            <span style={{
              fontSize: 28, fontWeight: 600, color: accent,
              fontFamily: FONT,
            }}>
              جرّب الآن مجاناً — H.A.M.D
            </span>
          </div>
        </div>
      </Sequence>

      {/* Corner accents */}
      <div style={{
        position: "absolute", top: 50, left: 50,
        width: 40, height: 40,
        borderTop: `3px solid ${accent}40`,
        borderLeft: `3px solid ${accent}40`,
        opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
      }} />
      <div style={{
        position: "absolute", bottom: 50, right: 50,
        width: 40, height: 40,
        borderBottom: `3px solid ${accent}40`,
        borderRight: `3px solid ${accent}40`,
        opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
      }} />
    </AbsoluteFill>
  );
};
