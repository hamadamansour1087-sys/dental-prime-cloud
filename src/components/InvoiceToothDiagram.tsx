/**
 * Invoice tooth diagram — shows a stylized dental arch (upper + lower)
 * with ONLY the worked-on teeth highlighted and labeled by their FDI number.
 * Designed for print/PDF inside InvoiceReport. Pure SVG, no external deps.
 */

const FDI = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};

const QUAD_TO_FDI: Record<string, number> = {
  UR1: 11, UR2: 12, UR3: 13, UR4: 14, UR5: 15, UR6: 16, UR7: 17, UR8: 18,
  UL1: 21, UL2: 22, UL3: 23, UL4: 24, UL5: 25, UL6: 26, UL7: 27, UL8: 28,
  LL1: 31, LL2: 32, LL3: 33, LL4: 34, LL5: 35, LL6: 36, LL7: 37, LL8: 38,
  LR1: 41, LR2: 42, LR3: 43, LR4: 44, LR5: 45, LR6: 46, LR7: 47, LR8: 48,
};

function parseSelected(selected: string | null | undefined): Set<number> {
  const out = new Set<number>();
  (selected ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      const n = Number(s);
      if (!isNaN(n)) out.add(n);
      else if (QUAD_TO_FDI[s]) out.add(QUAD_TO_FDI[s]);
    });
  return out;
}

export function InvoiceToothDiagram({
  selected,
  size = 140,
}: {
  selected: string | null | undefined;
  size?: number;
}) {
  const on = parseSelected(selected);

  // Geometry: each arch is rendered as 16 teeth on a half-ellipse.
  const W = 220;
  const H = 130;
  const cx = W / 2;
  const upperCy = 58;
  const lowerCy = 72;
  const rx = 92;
  const ryUpper = 44;
  const ryLower = 44;
  const toothR = 7.2;

  // Distribute 16 teeth across upper arch from angle 200° (right) to 340° (left)
  // (in SVG, y grows downward — upper arch uses negative y offset)
  const placeUpper = (i: number) => {
    const t = i / 15; // 0..1
    const angle = Math.PI * (1 - t); // PI..0  (right to left across the top)
    const x = cx + rx * Math.cos(angle);
    const y = upperCy - ryUpper * Math.sin(angle);
    return { x, y };
  };
  const placeLower = (i: number) => {
    const t = i / 15;
    const angle = Math.PI * (1 - t);
    const x = cx + rx * Math.cos(angle);
    const y = H - lowerCy + ryLower * Math.sin(angle);
    return { x, y };
  };

  const renderTooth = (
    n: number,
    pos: { x: number; y: number },
    labelAbove: boolean,
  ) => {
    const isOn = on.has(n);
    return (
      <g key={n}>
        <circle
          cx={pos.x}
          cy={pos.y}
          r={toothR}
          fill={isOn ? "#0e7490" : "#ffffff"}
          stroke={isOn ? "#0c4a6e" : "#cbd5e1"}
          strokeWidth={isOn ? 1.2 : 0.7}
        />
        {isOn && (
          <text
            x={pos.x}
            y={labelAbove ? pos.y - toothR - 3 : pos.y + toothR + 8}
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="700"
            fill="#0c4a6e"
            fontFamily="'Cairo', monospace"
          >
            {n}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      style={{ display: "block" }}
    >
      {/* subtle midline */}
      <line
        x1={cx}
        y1={6}
        x2={cx}
        y2={H - 6}
        stroke="#e2e8f0"
        strokeDasharray="2 2"
        strokeWidth={0.5}
      />
      {/* upper arch label */}
      <text x={4} y={12} fontSize="6.5" fill="#94a3b8" fontFamily="'Cairo', sans-serif">R</text>
      <text x={W - 10} y={12} fontSize="6.5" fill="#94a3b8" fontFamily="'Cairo', sans-serif">L</text>

      {FDI.upper.map((n, i) => renderTooth(n, placeUpper(i), true))}
      {FDI.lower.map((n, i) => renderTooth(n, placeLower(i), false))}
    </svg>
  );
}
