"use client";
// Single-series vertical bar chart (SVG): thin bars with 4px rounded tops anchored to the baseline,
// recessive grid, hover tooltip on every bar, selective direct labels (first, last, max).
import { useState } from "react";
import { inrCompact, m2, num, pct } from "@/lib/format";

const FORMATS = { inr: inrCompact, num, m2, pct } as const;
export type FormatName = keyof typeof FORMATS;

export interface Bar {
  key: string;
  label: string; // x-axis label
  value: number;
  tooltip: string[]; // lines shown on hover
  muted?: boolean; // e.g. a month still in progress
}

export function BarChart({
  bars,
  format: formatName,
  height = 220,
  ariaLabel,
}: {
  bars: Bar[];
  format: FormatName; // a name, not a function: server pages can't pass functions to client components
  height?: number;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const format = FORMATS[formatName];
  const W = Math.max(640, bars.length * 44);
  const H = height;
  const pad = { t: 22, r: 8, b: 26, l: 8 };
  const vals = bars.map((b) => (Number.isFinite(b.value) ? b.value : 0));
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const y = (v: number) => pad.t + ((max - v) / span) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / Math.max(1, bars.length);
  const bw = Math.min(28, slot * 0.6);
  const labelIdx = new Set([0, bars.length - 1, vals.indexOf(max)]);
  const ticks = [0, 0.5, 1].map((f) => min + f * span);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel} style={{ minWidth: Math.min(W, 640) }}>
        {ticks.map((t, i) => (
          <line key={i} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--gridline)" strokeWidth={1} />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
        {bars.map((b, i) => {
          const v = vals[i];
          const x = pad.l + i * slot + (slot - bw) / 2;
          const top = y(Math.max(v, 0));
          const h = Math.abs(y(v) - y(0));
          const r = Math.min(4, h / 2, bw / 2);
          // rounded data-end only (top for positive bars)
          const d =
            v >= 0
              ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`
              : `M${x},${y(0)} V${y(v) - r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) - r} V${y(0)} Z`;
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && <path d={d} fill={b.muted ? "var(--series-1-soft)" : "var(--series-1)"} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {labelIdx.has(i) && v !== 0 && (
                <text x={x + bw / 2} y={(v >= 0 ? top : y(v)) - 6} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                  {format(v)}
                </text>
              )}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 card shadow-md px-2.5 py-1.5 text-[12px]"
          style={{ left: `min(calc(${((hover + 0.5) / bars.length) * 100}% + 8px), calc(100% - 200px))`, top: 4 }}
        >
          {bars[hover].tooltip.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold" : "text-ink-2"}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
