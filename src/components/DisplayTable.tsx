// Display rows with all report columns A–U plus a sales summary.
import { currentMonth, rowSummary } from "@/analytics/metrics";
import type { DisplayWithSales } from "@/sales/window";
import { inr, m2, monthName } from "@/lib/format";

const COLS: [string, (r: DisplayWithSales) => string | null][] = [
  ["Sequence No", (r) => r.refNo],
  ["Display Date", (r) => r.displayDateRaw],
  ["RMI Name", (r) => r.rmiName],
  ["Dealer", (r) => r.dealerName],
  ["Dealer Status", (r) => r.dealerStatus],
  ["Zone", (r) => r.zone],
  ["Region", (r) => r.region],
  ["Location", (r) => r.location],
  ["Dealer / Franchise", (r) => r.dealerCategory],
  ["Franchise Type", (r) => r.franchiseType],
  ["Displayed Where", (r) => r.displayedWhere],
  ["Cassette Type", (r) => r.cassetteType],
  ["Cassette No", (r) => r.cassetteNumber],
  ["Panel No", (r) => r.panelNo],
  ["Panel Size", (r) => r.panelSize],
  ["Product Type", (r) => r.productType],
  ["Size (MM)", (r) => r.sizeMm],
  ["Design Name", (r) => r.designName],
  ["Design Status", (r) => r.designStatus],
  ["Status", (r) => r.status],
];

const MAP_LABEL: Record<string, string> = { mapped: "", needs_review: "design in review", unmapped: "design not found", no_design: "no design" };

export function DisplayTable({ rows }: { rows: DisplayWithSales[] }) {
  const cur = currentMonth();
  return (
    <div className="overflow-auto max-h-[70vh] border border-line rounded-lg">
      <table className="data">
        <thead>
          <tr>
            {COLS.map(([h]) => (
              <th key={h}>{h}</th>
            ))}
            <th className="num">M−1 value</th>
            <th className="num">After value</th>
            <th className="num">After volume</th>
            <th className="num">Months after</th>
            <th className="num">Avg value (÷14)</th>
            <th>SAP material</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = rowSummary(r, cur);
            return (
              <tr key={r.refNo}>
                {COLS.map(([h, f]) => (
                  <td key={h} className={h === "Dealer" || h === "Design Name" ? "max-w-[240px] truncate" : ""} title={f(r) ?? ""}>
                    {f(r) ?? ""}
                  </td>
                ))}
                <td className="num">{inr(s.beforeValue)}</td>
                <td className="num">{inr(s.afterValue)}</td>
                <td className="num">{m2(s.afterVolume)}</td>
                <td className="num">{s.afterMonths}</td>
                <td className="num">{inr(r.avgValue)}</td>
                <td className="text-ink-3">{r.materialCode ?? MAP_LABEL[r.mapStatus ?? ""] ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <div className="p-4 text-[13px] text-ink-3">No displays match the current filters.</div>}
    </div>
  );
}

export function cohortNote(rows: DisplayWithSales[]) {
  const months = [...new Set(rows.map((r) => r.cohortMonth).filter(Boolean))].sort() as string[];
  if (!months.length) return "";
  return months.length === 1 ? monthName(months[0]) : `${monthName(months[0])} – ${monthName(months.at(-1)!)}`;
}
