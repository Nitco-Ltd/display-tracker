"use client";
// Single-series vertical bar chart (SVG), drawn at the container's real width: thin bars with 4px rounded data-ends
// anchored to the baseline, recessive grid with y-axis labels, hover tooltip on every bar (hit target = full column),
// direct labels on first / last / highest bar, x labels thinned so they never collide.
import { useState } from "react";
import { inrCompact, m2, num, pct } from "@/lib/format";
import { niceTicks, useWidth } from "./useWidth";

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
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const format = FORMATS[formatName];
  const H = height;
  const pad = { t: 20, r: 8, b: 26, l: 52 };
  const vals = bars.map((b) => (Number.isFinite(b.value) ? b.value : 0));
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const { ticks, lo, hi } = niceTicks(min, max * 1.08);
  const span = hi - lo || 1;
  const y = (v: number) => pad.t + ((hi - v) / span) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / Math.max(1, bars.length);
  const bw = Math.max(4, Math.min(28, slot * 0.6));
  const labelIdx = new Set([0, bars.length - 1, vals.indexOf(max)]);
  const every = Math.max(1, Math.ceil(44 / slot));

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--gridline)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1} />
        {bars.map((b, i) => {
          const v = vals[i];
          const x = pad.l + i * slot + (slot - bw) / 2;
          const yt = y(Math.max(v, 0));
          const h = Math.abs(y(v) - y(0));
          const r = Math.min(4, h / 2, bw / 2);
          const d =
            v >= 0
              ? `M${x},${y(0)} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${y(0)} Z`
              : `M${x},${y(0)} V${y(v) - r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) - r} V${y(0)} Z`;
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && <path d={d} fill={b.muted ? "var(--series-1-soft)" : "var(--series-1)"} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {labelIdx.has(i) && v !== 0 && (
                <text x={x + bw / 2} y={(v >= 0 ? yt : y(v)) - 6} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                  {format(v)}
                </text>
              )}
              {(bars.length - 1 - i) % every === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 card shadow-md px-2.5 py-1.5 text-[12px] whitespace-nowrap"
          style={{ left: Math.min(Math.max(0, pad.l + (hover + 0.5) * slot + 10), W - 220), top: 0 }}
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
