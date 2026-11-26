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
      <div className="grow-x flex h-4 w-full gap-[2px] rounded-full overflow-hidden" role="img" aria-label={ariaLabel}>
        {shown.map((p, i) =>
          p.share > 0 ? <div key={p.code + p.label} title={`${p.code ? `${p.code} · ` : ""}${p.label}: ${inr(p.value)} (${pct(p.share)})`} style={{ width: `${p.share * 100}%`, background: COLORS[i % COLORS.length] }} /> : null,
        )}
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        {shown.map((p, i) => (
          <div key={p.code + p.label} className="flex items-start gap-2 text-[13px]">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <div>
              <div className="text-ink-2">
                {p.code ? (
                  <>
                    <b className="text-ink">{p.code}</b> ·{" "}
                  </>
                ) : null}
                {p.label}
              </div>
              <div>
                <span className="text-[16px] font-semibold">{inr(p.value)}</span> <span className="text-ink-3">· {pct(p.share)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
