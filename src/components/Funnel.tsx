// Steps shown as labelled horizontal bars, each a part of the first (a funnel drawn as bars: easier to read than
// a trapezoid). Every step states its count and its share, so colour is never the only cue.
export interface FunnelStep {
  label: string;
  hint?: string;
  value: number;
  display: string; // formatted value
  share?: string; // e.g. "16%" shown next to the value
  color: string;
}

export function Funnel({ steps, max }: { steps: FunnelStep[]; max?: number }) {
  const top = max ?? Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-5">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="min-w-0">
              <span className="text-[13px] font-medium">{s.label}</span>
              {s.hint && <span className="text-[11.5px] text-ink-3 ml-2">{s.hint}</span>}
            </div>
            <div className="shrink-0 text-[13.5px] font-semibold">
              {s.display}
              {s.share && <span className="ml-2 text-[11.5px] font-medium text-ink-3">{s.share}</span>}
            </div>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden" aria-hidden>
            <div
              className="grow-x h-full rounded-full"
              style={{ width: `${Math.max(0.6, Math.min(100, (s.value / top) * 100))}%`, background: s.color, animationDelay: `${0.15 + i * 0.12}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
