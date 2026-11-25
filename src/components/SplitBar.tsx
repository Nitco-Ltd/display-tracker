// One 100% horizontal bar split into parts (fixed colour order from the validated palette, 2px gaps between
// segments), with a legend that always shows each part's name, value and share, so colour is never the only cue.
import { inr, pct } from "@/lib/format";

export interface SplitPart {
  code: string; // e.g. "B2"
  label: string;
  value: number;
}

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export function SplitBar({ parts, total, ariaLabel }: { parts: SplitPart[]; total: number; ariaLabel: string }) {
  const shown = parts.map((p) => ({ ...p, share: total > 0 ? Math.max(0, p.value) / total : 0 }));
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] rounded-md overflow-hidden" role="img" aria-label={ariaLabel}>
        {shown.map((p, i) =>
          p.share > 0 ? <div key={p.code} title={`${p.code} · ${p.label}: ${inr(p.value)} (${pct(p.share)})`} style={{ width: `${p.share * 100}%`, background: COLORS[i % COLORS.length] }} /> : null,
        )}
      </div>
      <div className="mt-2.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-3">
        {shown.map((p, i) => (
          <div key={p.code} className="flex items-start gap-2 text-[13px]">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <div>
              <div className="text-ink-2">
                <b className="text-ink">{p.code}</b> · {p.label}
              </div>
              <div>
                <b>{inr(p.value)}</b> <span className="text-ink-3">· {pct(p.share)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
