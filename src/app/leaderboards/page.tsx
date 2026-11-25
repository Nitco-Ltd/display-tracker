import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ParamLinks } from "@/components/SortLinks";
import { Tabs } from "@/components/Tabs";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { currentMonth, groupStats, type GroupStat } from "@/analytics/metrics";
import type { DisplayWithSales } from "@/sales/window";
import { inr, inrCompact, num, pct } from "@/lib/format";

const MIN_PAIRS = 10; // the "bought afterwards" ranking ignores groups with fewer measurable displays
const TOP = 25;

const BOARDS: { id: string; title: string; one: string; key: (r: DisplayWithSales) => string | null; label?: (r: DisplayWithSales) => string | null }[] = [
  { id: "zones", title: "Zones", one: "Zone", key: (r) => r.zone },
  { id: "rmis", title: "RMIs", one: "RMI", key: (r) => r.rmiName },
  { id: "dealers", title: "Dealers", one: "Dealer", key: (r) => r.dealerCode, label: (r) => r.dealerName },
  {
    id: "tiles",
    title: "Tiles",
    one: "Tile",
    key: (r) => (r.designName ? `${r.designName}|${r.sizeMmNorm ?? ""}` : null),
    label: (r) => (r.designName ? `${r.designName} · ${r.sizeMm ?? ""}` : null),
  },
];

function Ranking({ one, stats, sort }: { one: string; stats: GroupStat[]; sort: "sales" | "conversion" }) {
  const ranked =
    sort === "conversion"
      ? stats.filter((s) => s.measurablePairs >= MIN_PAIRS && s.key !== "(blank)").sort((a, b) => b.conversion - a.conversion || b.afterValue - a.afterValue)
      : stats.filter((s) => s.key !== "(blank)").sort((a, b) => b.afterValue - a.afterValue);
  const top = ranked.slice(0, TOP);
  const metric = (s: GroupStat) => (sort === "conversion" ? s.conversion : s.afterValue);
  const maxV = Math.max(1e-9, ...top.map(metric));
  return (
    <div>
      <div className="text-[12px] text-ink-3 mb-2">
        Top {top.length} of {num(ranked.length)}
        {sort === "conversion" ? ` (only those with at least ${MIN_PAIRS} displays old enough to measure)` : ""}.
      </div>
      <div className="overflow-auto max-h-[560px]">
        <table className="data">
          <thead className="sticky top-0 bg-[var(--surface-1)] z-[1]">
            <tr>
              <th className="num">#</th>
              <th>{one}</th>
              <th style={{ width: "26%" }}>{sort === "conversion" ? "Dealer bought the tile afterwards" : "Sales of displayed tiles, after display"}</th>
              <th className="num">Sales after display</th>
              <th className="num">Bought afterwards</th>
              <th className="num">Displays</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, i) => (
              <tr key={s.key}>
                <td className="num text-ink-3">{i + 1}</td>
                <td className="max-w-[320px] truncate" title={s.label}>
                  {s.label}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full bg-surface-0 overflow-hidden" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, (metric(s) / maxV) * 100)}%`, background: "var(--series-1)" }} />
                    </div>
                    <span className="w-[64px] text-right text-[12px] text-ink-2">{sort === "conversion" ? pct(s.conversion) : inrCompact(s.afterValue)}</span>
                  </div>
                </td>
                <td className="num">{inr(s.afterValue)}</td>
                <td className="num" title={`${num(s.convertedPairs)} of ${num(s.measurablePairs)} displays`}>
                  {pct(s.conversion)} <span className="text-ink-3">({num(s.convertedPairs)}/{num(s.measurablePairs)})</span>
                </td>
                <td className="num">{num(s.displays)}</td>
              </tr>
            ))}
            {!top.length && (
              <tr>
                <td colSpan={6} className="text-ink-3">
                  Nothing to rank with the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function Rankings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const sort = sp.sort === "conversion" ? "conversion" : "sales";
  return (
    <>
      <PageHeader
        title="Rankings"
        description="Which zones, RMIs, dealers and tiles get the most out of their displays: sales of the displayed tile by the same dealer after the display month, and how often the dealer bought it at all."
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <Section
        title={sort === "conversion" ? "Ranked by how often the dealer bought the tile afterwards" : "Ranked by sales of the displayed tile after display"}
        action={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-3">Rank by</span>
            <Suspense>
              <ParamLinks
                param="sort"
                fallback="sales"
                options={[
                  { value: "sales", label: "Sales after display" },
                  { value: "conversion", label: "Bought afterwards (%)" },
                ]}
              />
            </Suspense>
          </div>
        }
      >
        <Tabs tabs={BOARDS.map((b) => ({ id: b.id, label: b.title }))}>
          {BOARDS.map((b) => (
            <Ranking key={b.id} one={b.one} sort={sort} stats={groupStats(rows, b.key, b.label, cur)} />
          ))}
        </Tabs>
      </Section>
    </>
  );
}
