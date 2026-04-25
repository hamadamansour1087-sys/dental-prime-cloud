/**
 * Print/PDF-friendly quadrant view (uses inline styles only).
 * Shows the four quadrants UR/UL/LR/LL with tooth numbers 1-8 inside each.
 */
import { parseTeethToQuadrants, type Quadrant } from "@/lib/teeth";

const Q_LABEL: Record<Quadrant, string> = {
  UR: "علوي يمين",
  UL: "علوي يسار",
  LR: "سفلي يمين",
  LL: "سفلي يسار",
};

export function QuadrantsPrintView({
  selected,
  size = "md",
}: {
  selected: string | null | undefined;
  size?: "sm" | "md";
}) {
  const q = parseTeethToQuadrants(selected);
  const total = q.UR.length + q.UL.length + q.LR.length + q.LL.length;
  if (total === 0) return <span style={{ color: "#94a3b8" }}>—</span>;

  const isSm = size === "sm";
  const cellPad = isSm ? "3px 4px" : "5px 6px";
  const labelFs = isSm ? "8.5px" : "9.5px";
  const numFs = isSm ? "11px" : "13px";

  const Box = ({ name }: { name: Quadrant }) => {
    const teeth = q[name];
    return (
      <div
        style={{
          border: "1px solid #94a3b8",
          borderRadius: "3px",
          padding: cellPad,
          textAlign: "center",
          background: "#fff",
          minWidth: isSm ? "60px" : "78px",
        }}
      >
        <div style={{ fontSize: labelFs, color: "#64748b", fontWeight: 600, marginBottom: "1px" }}>
          {Q_LABEL[name]}
        </div>
        <div
          dir="ltr"
          style={{
            fontFamily: "monospace",
            fontSize: numFs,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "1px",
          }}
        >
          {teeth.length ? teeth.join(" ") : "—"}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: isSm ? "3px" : "4px",
      }}
    >
      <Box name="UR" />
      <Box name="UL" />
      <Box name="LR" />
      <Box name="LL" />
    </div>
  );
}
