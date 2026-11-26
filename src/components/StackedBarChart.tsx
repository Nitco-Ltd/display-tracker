"use client";
// Stacked vertical bars (SVG) drawn at the container's real width: parts stacked from the baseline in a fixed order,
// 2px surface gaps between parts, 4px rounded top, a legend that names every part, a hover tooltip on every column,
// the tallest bar labelled. Bars grow from the baseline on first paint (off for reduced motion).
import { useState } from "react";
import { CHART_FORMATS, type ChartFormat } from "@/lib/format";
import { LegendItem } from "./Section";
import { niceTicks, useWidth } from "./useWidth";


export interface StackPart {
  key: string;
  label: string;
  color: string;
}
export interface StackBar {
  key: string;
  label: string;
  values: number[]; // one per part, bottom first
  tooltip: string[];
}

export function StackedBarChart({
  parts,
  bars,
  format = "num",
  height = 260,
  ariaLabel,
}: {
  parts: StackPart[];
  bars: StackBar[];
  format?: ChartFormat;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = CHART_FORMATS[format];
  const H = height;
  const pad = { t: 22, r: 4, b: 26, l: 48 };
  const totals = bars.map((b) => b.values.reduce((a, v) => a + Math.max(0, v), 0));
  const max = Math.max(0, ...totals);
  const { ticks, hi } = niceTicks(0, max * 1.06);
  const y = (v: number) => pad.t + ((hi - v) / (hi || 1)) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / Math.max(1, bars.length);
  const bw = Math.max(6, Math.min(30, slot * 0.58));
  const maxIdx = totals.indexOf(max);
  const every = Math.max(1, Math.ceil(46 / slot));

  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
        {parts.map((p) => (
          <LegendItem key={p.key} color={p.color} label={p.label} />
        ))}
      </div>
      <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
        <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--gridline)"} />
              <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = pad.l + i * slot + (slot - bw) / 2;
            let c = 0;
            const visible = b.values.map((v, j) => ({ v: Math.max(0, v), j })).filter((s) => s.v > 0);
            const topJ = visible.at(-1)?.j;
            return (
              <g key={b.key} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
                <g className="grow-y" style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }} opacity={hover === null || hover === i ? 1 : 0.45}>
                  {visible.map((s, k) => {
                    const yBot = y(c) - (k > 0 ? 2 : 0);
                    c += s.v;
                    const yTop = y(c);
                    const h = yBot - yTop;
                    if (h <= 0) return null;
                    const r = s.j === topJ ? Math.min(4, h, bw / 2) : 0;
                    const d = `M${x},${yBot} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + bw - r} Q${x + bw},${yTop} ${x + bw},${yTop + r} V${yBot} Z`;
                    return <path key={s.j} d={d} fill={parts[s.j].color} />;
                  })}
                </g>
                {i === maxIdx && max > 0 && (
                  <text x={x + bw / 2} y={y(totals[i]) - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-secondary)">
                    {fmt(totals[i])}
                  </text>
                )}
                {(bars.length - 1 - i) % every === 0 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={hover === i ? "var(--text-primary)" : "var(--text-muted)"}>
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="fade-in pointer-events-none absolute z-10 card px-3 py-2 text-[12.5px] whitespace-nowrap"
            style={{ left: Math.min(Math.max(0, pad.l + (hover + 0.5) * slot + 12), W - 240), top: 0, boxShadow: "var(--shadow-lg)", borderRadius: 12 }}
          >
            {bars[hover].tooltip.map((l, i) => (
              <div key={i} className={i === 0 ? "font-semibold mb-0.5" : "text-ink-2"}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
