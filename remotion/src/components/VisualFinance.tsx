import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { C } from "../theme";
import { cairo, playfair } from "../fonts";

// Visual mock — invoice / financial card stacked
export const VisualFinance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const total = Math.floor(interpolate(frame, [25, 90], [0, 14750], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const formatted = total.toLocaleString("en-US");

  const cards = [
    { label: "المدفوع", value: "8,200", color: C.gold },
    { label: "المتبقي", value: "6,550", color: C.accent },
  ];

  return (
    <div style={{ position: "relative", width: 600, fontFamily: cairo, direction: "rtl" }}>
      {/* Main invoice */}
      <div
        style={{
          background: `linear-gradient(160deg, ${C.bgSoft}f0, ${C.bg}f0)`,
          border: `1px solid ${C.gold}55`,
          borderRadius: 24,
          padding: 44,
          boxShadow: `0 40px 80px ${C.bg}`,
        }}
      >
        <div style={{ color: C.inkMuted, fontSize: 18, letterSpacing: 3, marginBottom: 8 }}>فاتورة #INV-1042</div>
        <div style={{ color: C.ink, fontSize: 24, fontWeight: 700, marginBottom: 32 }}>د. سارة عبد الله</div>

        <div style={{ color: C.inkMuted, fontSize: 16, marginBottom: 6 }}>الإجمالي</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 32 }}>
          <span style={{ fontFamily: playfair, color: C.gold, fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            {formatted}
          </span>
          <span style={{ color: C.inkMuted, fontSize: 22 }}>ج.م</span>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {cards.map((c, i) => {
            const o = interpolate(frame, [30 + i * 8, 50 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            const y = interpolate(spring({ frame: frame - 30 - i * 8, fps, config: { damping: 18 } }), [0, 1], [20, 0]);
            return (
              <div
                key={c.label}
                style={{
                  flex: 1,
                  background: `${c.color}15`,
                  border: `1px solid ${c.color}40`,
                  borderRadius: 14,
                  padding: 16,
                  opacity: o,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div style={{ color: C.inkMuted, fontSize: 14 }}>{c.label}</div>
                <div style={{ color: c.color, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{c.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
