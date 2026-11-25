// A breakdown shown as a tree: each line is a part of the line above it. Plain names, a one-line explanation,
// the amount, its share, and a small bar. Used on Overview (displays) and Monthly sales (sales).

export interface TreeLine {
  label: string;
  help?: string;
  value: string; // already formatted (₹ or a count)
  share: number; // 0..1, drawn as the bar and shown as %
  level: 0 | 1 | 2 | 3;
  last?: boolean; // last line of its branch: └ instead of ├
  bold?: boolean;
  color?: string; // bar colour (default neutral)
  note?: string; // extra text after the value, e.g. "₹13.27 Cr of sales"
}

const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "–");

export function Tree({ lines, valueHeader, shareHeader }: { lines: TreeLine[]; valueHeader: string; shareHeader: string }) {
  return (
    <div className="overflow-auto">
      <table className="data">
        <thead>
          <tr>
            <th />
            <th className="num">{valueHeader}</th>
            <th className="num">{shareHeader}</th>
            <th aria-label="share" className="hidden md:table-cell" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={l.bold ? "font-semibold" : undefined}>
              <td style={{ whiteSpace: "normal" }}>
                <div className="flex items-start gap-2" style={{ paddingLeft: `${Math.max(0, l.level - 1) * 20}px` }}>
                  {l.level > 0 && (
                    <span className="text-ink-3 font-normal" aria-hidden>
                      {l.last ? "└" : "├"}
                    </span>
                  )}
                  <div>
                    <div className="text-[14px]">{l.label}</div>
                    {l.help && <div className="text-[12px] text-ink-3 font-normal">{l.help}</div>}
                  </div>
                </div>
              </td>
              <td className="num whitespace-nowrap">
                <div className="text-[15px]">{l.value}</div>
                {l.note && <div className="text-[12px] text-ink-3 font-normal">{l.note}</div>}
              </td>
              <td className="num whitespace-nowrap">{l.level === 0 ? "" : pct(l.share)}</td>
              <td className="hidden md:table-cell w-[16%] min-w-[70px]">
                <div className="h-2.5 rounded-full bg-surface-0 overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, l.share) * 100)}%`, background: l.color ?? "var(--axis)" }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
