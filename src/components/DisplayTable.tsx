// Display rows: the columns people need to act on. Every report column (A–U) is in the Excel export.
import { currentMonth, isConverted, isLinked, isMeasurable, rowSummary } from "@/analytics/metrics";
import type { DisplayWithSales } from "@/sales/window";
import { inr, m2, monthName } from "@/lib/format";

function Status({ r, cur }: { r: DisplayWithSales; cur: string }) {
  const [label, color] = !isLinked(r)
    ? ["Tile not in SAP", "var(--text-muted)"]
    : !isMeasurable(r, cur)
      ? ["Too new", "var(--text-muted)"]
      : isConverted(r, cur)
        ? ["Bought", "var(--status-good-text)"]
        : ["Not yet", "var(--status-warning-text)"];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

export function DisplayTable({ rows, status = true }: { rows: DisplayWithSales[]; status?: boolean }) {
  const cur = currentMonth();
  return (
    <div className="overflow-auto max-h-[70vh] -mx-1">
      <table className="data">
        <thead>
          <tr>
            <th>Date</th>
            <th>Dealer</th>
            <th>Tile</th>
            <th>RMI</th>
            <th>Region</th>
            {status && <th>Status</th>}
            <th className="num">Month before</th>
            <th className="num">After display</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = rowSummary(r, cur);
            return (
              <tr key={r.refNo}>
                <td className="text-ink-2">{r.displayDateRaw}</td>
                <td className="max-w-[230px] truncate font-medium" title={r.dealerName ?? ""}>
                  {r.dealerName}
                </td>
                <td className="max-w-[210px] truncate" title={`${r.designName ?? ""} · ${r.sizeMm ?? ""}`}>
                  {r.designName ?? <span className="text-ink-3">no design</span>}
                  {r.sizeMm && <span className="text-ink-3"> · {r.sizeMm}</span>}
                </td>
                <td className="text-ink-2 max-w-[150px] truncate">{r.rmiName}</td>
                <td className="text-ink-2">{r.region ?? r.zone}</td>
                {status && (
                  <td>
                    <Status r={r} cur={cur} />
                  </td>
                )}
                <td className="num text-ink-2">{inr(s.beforeValue)}</td>
                <td className="num font-medium" title={`${m2(s.afterVolume)} over ${s.afterMonths} month${s.afterMonths === 1 ? "" : "s"}`}>
                  {inr(s.afterValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <div className="p-6 text-center text-[13.5px] text-ink-3">No displays for this selection.</div>}
    </div>
  );
}

export function cohortNote(rows: DisplayWithSales[]) {
  const months = [...new Set(rows.map((r) => r.cohortMonth).filter(Boolean))].sort() as string[];
  if (!months.length) return "";
  return months.length === 1 ? monthName(months[0]) : `${monthName(months[0])} – ${monthName(months.at(-1)!)}`;
}
