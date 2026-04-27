import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { C } from "../theme";
import { cairo, playfair } from "../fonts";

type Props = {
  number: string;
  english: string;
  arabicTitle: string;
  src: string;
};

export const SceneShot: React.FC<Props> = ({ number, english, arabicTitle, src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imgSpring = spring({ frame, fps, config: { damping: 18, stiffness: 70 } });
  const imgScale = interpolate(imgSpring, [0, 1], [0.94, 1]);
  const imgO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Subtle Ken Burns
  const kb = interpolate(frame, [0, 150], [1, 1.04]);
  const kbX = interpolate(frame, [0, 150], [0, -10]);

  const titleO = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 18 } }), [0, 1], [20, 0]);

  const numO = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" });
  const lineW = interpolate(spring({ frame: frame - 14, fps, config: { damping: 200 } }), [0, 1], [0, 120]);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "70px 90px", gap: 30 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          direction: "rtl",
          opacity: numO,
        }}
      >
        <span style={{ fontFamily: playfair, color: C.gold, fontSize: 28, letterSpacing: 6 }}>{number}</span>
        <span style={{ width: lineW, height: 1, background: C.gold, opacity: 0.7 }} />
        <span style={{ fontFamily: playfair, color: C.inkMuted, fontSize: 20, letterSpacing: 8, textTransform: "uppercase" }}>
          {english}
        </span>
      </div>

      <div
        style={{
          fontFamily: cairo,
          color: C.ink,
          fontSize: 72,
          fontWeight: 700,
          direction: "rtl",
          textAlign: "right",
          opacity: titleO,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {arabicTitle}
      </div>

      {/* Screenshot in browser frame */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: imgO,
          transform: `scale(${imgScale})`,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1500,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: `0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px ${C.gold}33`,
            background: "#fff",
          }}
        >
          {/* Title bar */}
          <div
            style={{
              height: 36,
              background: "#1f2937",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 8,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f57" }} />
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#febc2e" }} />
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28c840" }} />
          </div>
          <Img
            src={staticFile(src)}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              transform: `scale(${kb}) translateX(${kbX}px)`,
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>
    </div>
  );
};
