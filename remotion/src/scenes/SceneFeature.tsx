import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";
import { cairo, playfair } from "../fonts";

// Reusable feature scene — large Arabic headline + supporting English label + visual mock
type Props = {
  number: string;
  english: string;
  arabicTitle: string;
  arabicDesc: string;
  children?: React.ReactNode;
  align?: "left" | "right";
};

export const SceneFeature: React.FC<Props> = ({
  number,
  english,
  arabicTitle,
  arabicDesc,
  children,
  align = "right",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const numY = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  const enO = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const lineW = interpolate(spring({ frame: frame - 12, fps, config: { damping: 200 } }), [0, 1], [0, 90]);

  const titleSpring = spring({ frame: frame - 16, fps, config: { damping: 16, stiffness: 80 } });
  const titleY = interpolate(titleSpring, [0, 1], [50, 0]);
  const titleO = interpolate(frame, [16, 38], [0, 1], { extrapolateRight: "clamp" });

  const descO = interpolate(frame, [34, 56], [0, 1], { extrapolateRight: "clamp" });
  const descY = interpolate(spring({ frame: frame - 34, fps, config: { damping: 20 } }), [0, 1], [20, 0]);

  const visO = interpolate(frame, [22, 50], [0, 1], { extrapolateRight: "clamp" });
  const visScale = interpolate(spring({ frame: frame - 22, fps, config: { damping: 16, stiffness: 70 } }), [0, 1], [0.92, 1]);

  // Slow drift for the whole text block
  const drift = Math.sin(frame / 30) * 4;

  const textCol = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        alignItems: align === "right" ? "flex-end" : "flex-start",
        textAlign: align === "right" ? "right" : "left",
        direction: align === "right" ? "rtl" : "ltr",
        transform: `translateY(${drift}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: numO, transform: `translateY(${numY}px)` }}>
        <span style={{ fontFamily: playfair, color: C.gold, fontSize: 28, fontWeight: 400, letterSpacing: 6 }}>
          {number}
        </span>
        <span style={{ width: lineW, height: 1, background: C.gold, opacity: 0.7 }} />
        <span style={{ fontFamily: playfair, color: C.inkMuted, fontSize: 22, letterSpacing: 8, opacity: enO, textTransform: "uppercase" }}>
          {english}
        </span>
      </div>

      <div
        style={{
          fontFamily: cairo,
          color: C.ink,
          fontSize: 110,
          fontWeight: 700,
          lineHeight: 1.05,
          opacity: titleO,
          transform: `translateY(${titleY}px)`,
          maxWidth: 760,
        }}
      >
        {arabicTitle}
      </div>

      <div
        style={{
          fontFamily: cairo,
          color: C.inkMuted,
          fontSize: 30,
          fontWeight: 400,
          lineHeight: 1.6,
          opacity: descO,
          transform: `translateY(${descY}px)`,
          maxWidth: 640,
        }}
      >
        {arabicDesc}
      </div>
    </div>
  );

  const visualCol = (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visO,
        transform: `scale(${visScale}) translateY(${-drift}px)`,
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: align === "right" ? "row" : "row-reverse",
        alignItems: "center",
        padding: "120px 140px",
        gap: 80,
      }}
    >
      {textCol}
      {visualCol}
    </div>
  );
};
