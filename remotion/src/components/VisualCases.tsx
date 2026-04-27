import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";
import { cairo } from "../fonts";

// Visual mock — case workflow card with progress bar
export const VisualCases: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stages = ["استلام", "تحضير", "صب", "تشطيب", "تسليم"];
  const progress = interpolate(frame, [30, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const activeIdx = Math.min(stages.length - 1, Math.floor(progress * stages.length));

  return (
    <div
      style={{
        width: 620,
        background: `linear-gradient(160deg, ${C.bgSoft}f0, ${C.bg}f0)`,
        border: `1px solid ${C.gold}55`,
        borderRadius: 24,
        padding: 40,
        boxShadow: `0 40px 80px ${C.bg}, 0 0 0 1px ${C.line}`,
        direction: "rtl",
        fontFamily: cairo,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ color: C.inkMuted, fontSize: 18, letterSpacing: 2 }}>حالة #2847</div>
        <div style={{ background: `${C.gold}22`, color: C.gold, padding: "6px 14px", borderRadius: 12, fontSize: 16 }}>
          قيد التنفيذ
        </div>
      </div>
      <div style={{ color: C.ink, fontSize: 32, fontWeight: 700, marginBottom: 8 }}>د. أحمد محمود</div>
      <div style={{ color: C.inkMuted, fontSize: 20, marginBottom: 36 }}>زيركون · 6 وحدات · لون A2</div>

      {/* Progress bar */}
      <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.gold}, ${C.goldSoft})` }} />
      </div>

      {/* Stages */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {stages.map((s, i) => {
          const reached = i <= activeIdx;
          const pulse = i === activeIdx ? 1 + Math.sin(frame / 6) * 0.1 : 1;
          return (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: reached ? C.gold : C.line,
                  border: `2px solid ${reached ? C.gold : C.line}`,
                  transform: `scale(${pulse})`,
                  transition: "none",
                }}
              />
              <div style={{ color: reached ? C.ink : C.inkMuted, fontSize: 16 }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
