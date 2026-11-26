"use client";
// Single-series line chart (SVG): 2px line, 8px markers, recessive grid with y-axis labels, hover crosshair + tooltip,
// direct labels on first / last / highest point. Points marked `faint` (e.g. too few displays to trust) are drawn hollow.
import { useState } from "react";
import { CHART_FORMATS, type ChartFormat } from "@/lib/format";
import { niceTicks, useWidth } from "./useWidth";


export interface LinePoint {
  key: string;
  label: string; // x-axis label (short)
  value: number;
  tooltip: string[];
  faint?: boolean;
}

export function LineChart({
  points,
  format: formatName,
  height = 240,
  ariaLabel,
  xTitle,
  baselineIndex,
}: {
  points: LinePoint[];
  format: ChartFormat;
  height?: number;
  ariaLabel: string;
  xTitle?: string;
  baselineIndex?: number; // draws a dashed reference line at this point's value (e.g. the month before display)
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = CHART_FORMATS[formatName];
  const H = height;
  const pad = { t: 20, r: 16, b: xTitle ? 42 : 26, l: 56 };
  const vals = points.map((p) => (Number.isFinite(p.value) ? p.value : NaN));
  const finite = vals.filter(Number.isFinite);
  // Small negative points (credit notes) shouldn't push the axis below zero by a whole step.
  const lowest = Math.min(0, ...finite);
  const highest = Math.max(0, ...finite);
  const { ticks, lo, hi } = niceTicks(Math.abs(lowest) < (highest || 1) * 0.02 ? 0 : lowest, highest * 1.08);
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((hi - Math.max(lo, v)) / span) * (H - pad.t - pad.b);
  const path = vals
    .map((v, i) => (Number.isFinite(v) ? `${i === 0 || !Number.isFinite(vals[i - 1]) ? "M" : "L"}${x(i)},${y(v)}` : ""))
    .join(" ");
  const maxIdx = vals.indexOf(Math.max(...finite));
  const labelled = new Set([0, points.length - 1, maxIdx]);
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((W - pad.l) / 64))));

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--gridline)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {fmt(t)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
        {baselineIndex !== undefined && Number.isFinite(vals[baselineIndex]) && (
          <line x1={pad.l} x2={W - pad.r} y1={y(vals[baselineIndex])} y2={y(vals[baselineIndex])} stroke="var(--text-muted)" strokeDasharray="4 4" />
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--axis)" />}
        <path className="draw" pathLength={1} d={path} fill="none" stroke="var(--series-1)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          Number.isFinite(vals[i]) ? (
            <circle
              key={p.key}
              cx={x(i)}
              cy={y(vals[i])}
              r={hover === i ? 5.5 : 4}
              fill={p.faint ? "var(--surface-1)" : "var(--series-1)"}
              stroke={p.faint ? "var(--series-1)" : "var(--surface-1)"}
              strokeWidth={2}
            />
          ) : null,
        )}
        {points.map((p, i) =>
          labelled.has(i) && Number.isFinite(vals[i]) ? (
            <text key={`l${p.key}`} x={x(i)} y={y(vals[i]) - 10} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--text-secondary)">
              {fmt(vals[i])}
            </text>
          ) : null,
        )}
        {points.map((p, i) =>
          i % every === 0 || i === points.length - 1 || i === 1 ? (
            <text key={`x${p.key}`} x={x(i)} y={H - pad.b + 16} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
              {p.label}
            </text>
          ) : null,
        )}
        {xTitle && (
          <text x={pad.l + (W - pad.l - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
            {xTitle}
          </text>
        )}
        {/* hit targets: full-height columns, wider than the marks */}
        {points.map((p, i) => {
          const half = (W - pad.l - pad.r) / Math.max(1, points.length - 1) / 2;
          return <rect key={`h${p.key}`} x={x(i) - half} y={pad.t} width={half * 2} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />;
        })}
      </svg>
      {hover !== null && (
        <div
          className="fade-in pointer-events-none absolute z-10 card px-3 py-2 text-[12.5px] whitespace-nowrap"
          style={{ boxShadow: "var(--shadow-lg)", borderRadius: 12, left: Math.min(Math.max(0, x(hover) + 10), W - 210), top: 0 }}
        >
          {points[hover].tooltip.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold mb-0.5" : "text-ink-2"}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
